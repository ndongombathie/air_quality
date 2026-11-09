"""Service d'ingestion : idempotence, IQA, stations inconnues, compteurs des sources, hook d'alertes, import_history."""

import csv
import io
from datetime import UTC, datetime, timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from senair.common.domain import compute_aqi
from senair.measurements.ingestion import samples
from senair.measurements.ingestion.adapters import AirGradientRawAdapter, HistoryRowAdapter
from senair.measurements.ingestion.base import InvalidMessage
from senair.measurements.ingestion.registry import build_registry
from senair.measurements.ingestion.service import IngestionService, ingest
from senair.measurements.models import Reading
from senair.network.models import DataSource, Station
from tests.air_quality.helpers import HISTORY_CSV, csv_rows

pytestmark = pytest.mark.django_db
needs_csv = pytest.mark.skipif(not HISTORY_CSV.is_file(), reason="projet-transversal/air_quality.csv absent")


@needs_csv
def test_ingest_computes_aqi_and_keeps_upstream(reference):
    row = csv_rows(3)[3]
    assert ingest(HistoryRowAdapter().parse(row)) == "accepted"
    reading = Reading.objects.get()
    expected = compute_aqi({"pm25": 205.1, "pm10": 207.2, "no2": 0.17, "so2": 0.26, "co": 0.0775, "o3": 59.62})
    assert (reading.aqi, reading.aqi_level, reading.dominant_pollutant) == (expected.aqi, expected.level, expected.dominant)
    assert reading.aqi == 1367 and reading.aqi_level == "hazardous"  # 205,1 / 15 × 100 (OMS 2021)
    assert reading.upstream_aqi == 273.467  # IQA du pipeline (limite 75) conservé pour comparaison
    assert reading.co == pytest.approx(0.0775)
    assert reading.sources["co"] == "openweathermap"
    assert Station.objects.get(pk="168373").last_observed_at == datetime(2026, 7, 6, 13, 2, 3, tzinfo=UTC)


@needs_csv
def test_repeated_hotel_de_ville_measure_is_ingested_once(reference):
    rows = csv_rows(3, 12, 21, 30)
    assert {r["timestamp"] for r in rows.values()} == {"2026-07-06 13:02:03"}
    assert {r["created_at"] for r in rows.values()} != {rows[3]["created_at"]}  # created_at avance, pas la mesure
    service = IngestionService()
    outcomes = [service.ingest(HistoryRowAdapter().parse(row)) for row in rows.values()]
    service.flush()
    assert outcomes == ["accepted", "duplicate", "duplicate", "duplicate"]
    assert Reading.objects.filter(station_id="168373").count() == 1
    assert (service.stats.accepted, service.stats.duplicates) == (1, 3)


def test_last_observed_at_never_moves_backwards(reference):
    now = timezone.now().replace(microsecond=0)
    ingest(AirGradientRawAdapter().parse(samples.airgradient_raw(now)))
    ingest(AirGradientRawAdapter().parse(samples.airgradient_raw(now - timedelta(hours=1))))
    assert Reading.objects.filter(station_id="168373").count() == 2
    assert Station.objects.get(pk="168373").last_observed_at == now


def test_unknown_station_is_registered_in_nearest_zone(reference):
    payload = samples.airgradient_raw(location_id=999001)
    payload.update(locationName="Thiès, Nouvelle station", latitude=14.7776, longitude=-16.9150)  # près de Kaba Sall
    assert ingest(AirGradientRawAdapter().parse(payload)) == "accepted"
    station = Station.objects.get(external_id="999001")
    assert station.pk == "999001" and station.name == "Nouvelle station" and station.zone_id == "kaba-sall"
    assert station.provider == "AirGradient" and station.status == "online"


def test_unknown_station_without_coordinates_is_rejected(reference):
    payload = samples.airgradient_raw(location_id=999002)
    payload.update(latitude=None, longitude=None)
    with pytest.raises(InvalidMessage, match="sans coordonnées"):
        ingest(AirGradientRawAdapter().parse(payload))
    assert DataSource.objects.get(pk="airgradient").rejected_24h == 1


def test_alert_hook_is_called_and_errors_are_contained(reference, monkeypatch, caplog):
    calls = []

    def boom(reading):
        calls.append(reading.pk)
        raise RuntimeError("panne du moteur d'alertes")

    monkeypatch.setattr("senair.alerts.services.evaluate_reading", boom)
    assert ingest(AirGradientRawAdapter().parse(samples.airgradient_raw())) == "accepted"
    assert calls == [Reading.objects.get().pk]
    assert "Évaluation des alertes en échec" in caplog.text


def test_alert_hook_not_called_for_duplicates(reference, monkeypatch):
    calls = []
    monkeypatch.setattr("senair.alerts.services.evaluate_reading", lambda reading: calls.append(reading.pk))
    payload = samples.airgradient_raw()
    ingest(AirGradientRawAdapter().parse(payload))
    assert ingest(AirGradientRawAdapter().parse(payload)) == "duplicate"
    assert len(calls) == 1


def test_data_source_counters_and_status(reference):
    service = IngestionService()
    registry = build_registry(service)
    raw = registry.topics()[0]
    now = timezone.now()
    for minutes in range(8):
        registry.dispatch(raw, samples.airgradient_raw(now - timedelta(minutes=minutes)))
    for bad in (b"{pas du json", b'{"locationName": "x"}'):
        with pytest.raises(InvalidMessage):
            registry.dispatch(raw, bad)
    service.flush()
    source = DataSource.objects.get(pk="airgradient")
    assert (source.accepted_24h, source.rejected_24h) == (8, 2)
    assert source.status == "degraded" and source.rejection_rate_24h == 0.2
    assert source.last_sync_at is not None and source.counters_reset_at is not None


def test_counters_window_resets_after_24_hours(reference):
    DataSource.objects.filter(pk="airgradient").update(
        accepted_24h=3, rejected_24h=50, counters_reset_at=timezone.now() - timedelta(hours=25)
    )
    ingest(AirGradientRawAdapter().parse(samples.airgradient_raw()))
    source = DataSource.objects.get(pk="airgradient")
    assert (source.accepted_24h, source.rejected_24h, source.status) == (1, 0, "healthy")


def test_disabled_source_is_skipped(reference):
    DataSource.objects.filter(pk="airgradient").update(enabled=False, status="disabled")
    assert ingest(AirGradientRawAdapter().parse(samples.airgradient_raw())) == "skipped"
    assert not Reading.objects.exists()
    assert DataSource.objects.get(pk="airgradient").status == "disabled"


@needs_csv
def test_import_history_is_idempotent(reference, tmp_path):
    with HISTORY_CSV.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = [next(reader) for _ in range(40)]
    rows.append({**rows[0], "id": "9999", "timestamp": ""})  # horodatage absent : rejet
    path = tmp_path / "extrait.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    distinct = len({(r["location_id"], r["timestamp"]) for r in rows if r["timestamp"]})

    out = io.StringIO()
    call_command("import_history", str(path), "--batch-size", "7", stdout=out)
    assert f"{distinct} mesure(s) acceptée(s), {40 - distinct} doublon(s), 1 rejetée(s)" in out.getvalue()
    assert "Horodatage absent" in out.getvalue()
    assert Reading.objects.count() == distinct

    out = io.StringIO()
    call_command("import_history", str(path), stdout=out)
    assert "0 mesure(s) acceptée(s), 40 doublon(s), 1 rejetée(s)" in out.getvalue()
    assert Reading.objects.count() == distinct
    assert DataSource.objects.get(pk="historique").accepted_24h == distinct


def test_import_history_missing_file(db):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="introuvable"):
        call_command("import_history", "/nonexistent/air_quality.csv")
