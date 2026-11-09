"""Adaptateurs de format et règles de validation, sur de vraies lignes de projet-transversal/air_quality.csv."""

from datetime import UTC, datetime, timedelta

import pytest
from django.utils import timezone

from senair.measurements.ingestion import samples
from senair.measurements.ingestion.adapters import AirGradientRawAdapter, HistoryRowAdapter, MeasurementV1Adapter
from senair.measurements.ingestion.base import InvalidMessage
from senair.measurements.ingestion.validation import validate
from tests.air_quality.helpers import HISTORY_CSV, csv_rows

needs_csv = pytest.mark.skipif(not HISTORY_CSV.is_file(), reason="projet-transversal/air_quality.csv absent")


@needs_csv
def test_history_row_hotel_de_ville_13_02_03():
    row = csv_rows(3)[3]
    m = validate(HistoryRowAdapter().parse(row))
    assert m.station_ref == "168373"
    assert m.station_name == "Hôtel de Ville"
    assert m.observed_at == datetime(2026, 7, 6, 13, 2, 3, tzinfo=UTC)  # timestamp capteur, pas created_at
    assert m.values["pm25"] == 205.1 and m.values["pm10"] == 207.2
    assert m.values["co"] == pytest.approx(0.0775)  # 77,5 µg/m³ OpenWeatherMap vers mg/m³
    assert m.values["tvoc"] is None  # colonne vide
    assert m.values["wind_speed_ms"] == 7.15 and m.values["wind_direction_deg"] == 235.0
    assert m.sources["pm25"] == "sensor" and m.sources["o3"] == "openweathermap" and m.sources["co"] == "openweathermap"
    assert m.sources["wind_speed_ms"] == "openweathermap" and m.sources["temperature_c"] == "sensor"
    assert m.upstream_aqi == 273.467
    assert m.message_format == "history.row" and m.data_source == "historique"


@needs_csv
def test_history_row_empty_values_are_null():
    rows = csv_rows(1, 2)
    first = HistoryRowAdapter().parse(rows[1])
    assert first.values["temperature_c"] is None and first.sources["temperature_c"] == "sensor"
    second = HistoryRowAdapter().parse(rows[2])
    assert second.values["co2"] is None
    assert second.station_name == "Ecole Elémentaire Sud Stade"


@needs_csv
def test_history_row_pm10_zero_is_absent_when_pm25_positive():
    row = csv_rows(7010)[7010]
    assert row["pm10"] == "0.0" and float(row["pm25"]) > 0
    m = validate(HistoryRowAdapter().parse(row))
    assert m.values["pm10"] is None
    assert m.sources["pm10"] == "sensor"  # la variable reste listée, avec une valeur nulle (« N/D »)
    assert m.partial_rejections == []


@needs_csv
def test_station_name_with_irregular_prefix():
    row = csv_rows(7010)[7010]
    assert HistoryRowAdapter().parse(row).station_name == "Ecole élémentaire kaba sall"


def test_history_row_requires_timestamp():
    with pytest.raises(InvalidMessage, match="Horodatage absent"):
        HistoryRowAdapter().parse({"location_id": "168373", "timestamp": "", "pm25": "10"})
    with pytest.raises(InvalidMessage, match="Horodatage invalide"):
        HistoryRowAdapter().parse({"location_id": "168373", "timestamp": "06/07/2026 13h", "pm25": "10"})


def test_out_of_range_value_is_nulled_and_counted():
    m = HistoryRowAdapter().parse(
        {"location_id": "168373", "timestamp": "2026-07-06 13:02:03", "pm25": "-3", "pm10": "12", "humidity": "140"}
    )
    validate(m)
    assert m.values["pm25"] is None and m.values["humidity_pct"] is None and m.values["pm10"] == 12
    assert sorted(m.partial_rejections) == ["humidity_pct", "pm25"]


def test_future_timestamp_and_empty_measure_are_rejected():
    future = (timezone.now() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    with pytest.raises(InvalidMessage, match="futur"):
        validate(HistoryRowAdapter().parse({"location_id": "1", "timestamp": future, "pm25": "4"}))
    with pytest.raises(InvalidMessage, match="Aucune valeur"):
        validate(HistoryRowAdapter().parse({"location_id": "1", "timestamp": "2026-07-06 13:02:03"}))


def test_airgradient_raw_prefers_corrected_values():
    m = AirGradientRawAdapter().parse(samples.airgradient_raw())
    assert m.station_ref == "168373" and m.station_name == "Hôtel de Ville"
    assert m.values == {"pm25": 20.5, "pm10": 28.4, "co2": 415.0, "tvoc": 108.5, "temperature_c": 34.5, "humidity_pct": 52.0}
    assert set(m.sources.values()) == {"sensor"}
    assert "co" not in m.values and "o3" not in m.values  # pas de gaz dans le flux brut
    assert m.observed_at.tzinfo is not None


def test_airgradient_raw_falls_back_to_raw_values():
    payload = samples.airgradient_raw()
    for key in ("pm02_corrected", "pm10_corrected", "atmp_corrected", "rhum_corrected", "rco2_corrected"):
        payload[key] = None
    payload["tvoc_index"] = 87
    m = AirGradientRawAdapter().parse(payload)
    assert (m.values["pm25"], m.values["pm10"], m.values["temperature_c"], m.values["co2"], m.values["tvoc"]) == (
        24.0,
        31.0,
        34.9,
        420.0,
        87.0,
    )


@pytest.mark.parametrize("payload", [None, [], "texte", {"locationName": "Thiès"}, {"locationId": 1}])
def test_airgradient_raw_rejects_malformed(payload):
    with pytest.raises(InvalidMessage):
        AirGradientRawAdapter().parse(payload)


def test_measurement_v1_converts_units():
    payload = samples.measurement_v1()
    payload["measures"]["no2"] = {"value": 10, "unit": "ppb", "source": "openweathermap"}
    m = MeasurementV1Adapter().parse(payload)
    assert m.values["co"] == pytest.approx(0.0775)
    assert m.values["no2"] == pytest.approx(10 * 46.0055 / 24.45)
    assert m.sources["o3"] == "openweathermap" and m.sources["pm25"] == "sensor"
    assert m.values["wind_speed_ms"] == 7.15 and m.sources["temperature_c"] == "openweathermap"
    assert m.upstream_aqi == 59.62


def test_measurement_v1_incompatible_unit_is_partial_rejection():
    payload = samples.measurement_v1()
    payload["measures"]["pm25"] = {"value": 3, "unit": "ppm", "source": "sensor"}
    m = MeasurementV1Adapter().parse(payload)
    assert m.values["pm25"] is None and m.partial_rejections == ["pm25"]


@pytest.mark.parametrize(
    "change",
    [
        lambda p: p.pop("observedAt"),
        lambda p: p.update(observedAt="hier"),
        lambda p: p.update(schemaVersion="2"),
        lambda p: p["measures"].update(pm1={"value": 1, "unit": "µg/m³", "source": "sensor"}),
        lambda p: p.update(extra=True),
    ],
)
def test_measurement_v1_schema_violations(change):
    payload = samples.measurement_v1()
    change(payload)
    with pytest.raises(InvalidMessage, match="measurement.v1"):
        MeasurementV1Adapter().parse(payload)
