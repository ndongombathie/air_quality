"""Administration D2 à D4, D16 à D19 et D27 : permissions, contrat, audit."""

import csv
import io
import json
from datetime import timedelta
from urllib.parse import urlsplit

import pytest
from django.utils import timezone

from senair.common.domain import iso
from senair.forecasts.models import AiModel
from senair.measurements.ingestion import samples
from senair.measurements.ingestion.registry import build_registry
from senair.network.models import DataSource, Station
from senair.reporting.models import AuditLogEntry
from tests.air_quality.helpers import make_model, make_reading
from tests.contract import assert_contract, body

pytestmark = pytest.mark.django_db

STATION_INPUT = {
    "name": "Marché central",
    "shortName": "Marché",
    "zoneId": "centre-ville",
    "location": {"latitude": 14.789, "longitude": -16.926},
    "type": "road",
    "status": "maintenance",
    "externalId": "200001",
    "provider": "AirGradient",
}


def call(client, method: str, path: str, data=None):
    response = getattr(client, method)("/api/v1" + path, data=data, format="json")
    assert_contract(response, method, path)
    return response


@pytest.mark.parametrize("path", ["/admin/stations", "/admin/data-sources", "/admin/models"])
def test_admin_reads_require_admin_access(anon, citizen_client, authority_client, reference, path):
    assert call(anon, "get", path).status_code == 401
    assert call(citizen_client, "get", path).status_code == 403
    response = call(authority_client, "get", path)
    assert response.status_code == 200 and response["Cache-Control"] == "no-store"


def test_admin_stations_list_includes_latest(authority_client, reference):
    Station.objects.filter(pk="168393").update(status="offline")
    make_reading("168373", pm25=12.0)
    data = body(call(authority_client, "get", "/admin/stations"))
    assert len(data) == 9 and all("latest" in s for s in data)
    assert next(s for s in data if s["id"] == "168393")["status"] == "offline"


def test_create_station(admin_client, authority_client, reference):
    assert call(authority_client, "post", "/admin/stations", STATION_INPUT).status_code == 403
    response = call(admin_client, "post", "/admin/stations", STATION_INPUT)
    assert response.status_code == 201
    data = body(response)
    assert data["id"].startswith("st-") and data["zoneName"] == "Centre-ville" and data["latest"] is None
    station = Station.objects.get(pk=data["id"])
    assert (station.latitude, station.status, station.external_id) == (14.789, "maintenance", "200001")
    entry = AuditLogEntry.objects.get(action="station.create")
    assert entry.resource_id == station.pk and entry.changes["name"] == {"from": None, "to": "Marché central"}


@pytest.mark.parametrize(
    "change,field",
    [
        ({"zoneId": "inconnue"}, "zoneId"),
        ({"type": "rural"}, "type"),
        ({"externalId": "168373"}, "externalId"),
        ({"location": {"latitude": 120, "longitude": 0}}, "location.latitude"),
        ({"name": "x" * 121}, "name"),
    ],
)
def test_create_station_validation(admin_client, reference, change, field):
    response = call(admin_client, "post", "/admin/stations", {**STATION_INPUT, **change})
    assert response.status_code == 422 and field in body(response)["details"]["fields"]
    assert not AuditLogEntry.objects.exists()


def test_update_station_is_audited(admin_client, authority_client, reference):
    assert call(authority_client, "patch", "/admin/stations/168373", {"status": "maintenance"}).status_code == 403
    response = call(
        admin_client,
        "patch",
        "/admin/stations/168373",
        {"status": "maintenance", "zoneId": "malick-sy", "location": {"latitude": 14.8, "longitude": -16.92}},
    )
    assert response.status_code == 200
    data = body(response)
    assert (data["status"], data["zoneId"], data["zoneName"], data["location"]["latitude"]) == (
        "maintenance",
        "malick-sy",
        "Malick Sy",
        14.8,
    )
    changes = AuditLogEntry.objects.get(action="station.update").changes
    assert changes["status"] == {"from": "online", "to": "maintenance"} and changes["zone_id"]["to"] == "malick-sy"
    assert set(changes) == {"status", "zone_id", "latitude", "longitude"}
    assert call(admin_client, "patch", "/admin/stations/inconnue", {"status": "offline"}).status_code == 404
    assert call(admin_client, "patch", "/admin/stations/168373", {"status": "cassée"}).status_code == 422


def test_data_sources(admin_client, authority_client, reference):
    DataSource.objects.filter(pk="airgradient").update(
        accepted_24h=90, rejected_24h=10, counters_reset_at=timezone.now(), last_sync_at=timezone.now()
    )
    data = body(call(authority_client, "get", "/admin/data-sources"))
    airgradient = next(s for s in data if s["id"] == "airgradient")
    assert airgradient["rejectionRate24h"] == 0.1 and airgradient["lastSyncAt"]
    assert next(s for s in data if s["id"] == "sentinel-5p")["status"] == "disabled"

    assert call(authority_client, "patch", "/admin/data-sources/airgradient", {"enabled": False}).status_code == 403
    off = body(call(admin_client, "patch", "/admin/data-sources/airgradient", {"enabled": False}))
    assert (off["enabled"], off["status"]) == (False, "disabled")
    on = body(call(admin_client, "patch", "/admin/data-sources/airgradient", {"enabled": True}))
    assert (on["enabled"], on["status"]) == (True, "degraded")
    assert AuditLogEntry.objects.filter(action="source.update", resource_id="airgradient").count() == 2
    assert call(admin_client, "patch", "/admin/data-sources/inconnue", {"enabled": True}).status_code == 404
    assert call(admin_client, "patch", "/admin/data-sources/airgradient", {"enabled": "oui"}).status_code == 422


def test_models_activation_archives_previous(admin_client, authority_client, reference):
    make_model("xgboost-forecast", r2=0.82, tracking_url="http://mlflow.local/runs/1")
    make_model("lstm-forecast", status="candidate", algorithm="LSTM", version="2.0.0")
    data = body(call(authority_client, "get", "/admin/models"))
    xgb = next(m for m in data if m["id"] == "xgboost-forecast")
    assert xgb["metrics"] == {"r2": 0.82, "rmse": None, "mae": None} and xgb["trackingUrl"] == "http://mlflow.local/runs/1"

    assert call(authority_client, "patch", "/admin/models/lstm-forecast", {"status": "active"}).status_code == 403
    response = call(admin_client, "patch", "/admin/models/lstm-forecast", {"status": "active"})
    assert body(response)["status"] == "active"
    assert AiModel.objects.get(pk="xgboost-forecast").status == "archived"
    assert AiModel.objects.get(pk="knn-interpolation").status == "active"  # autre tâche : inchangé
    assert set(AuditLogEntry.objects.filter(action="model.update").values_list("resource_id", flat=True)) == {
        "lstm-forecast",
        "xgboost-forecast",
    }
    assert call(admin_client, "patch", "/admin/models/inconnu", {"status": "active"}).status_code == 404
    assert call(admin_client, "patch", "/admin/models/lstm-forecast", {"status": "supprimé"}).status_code == 422


def test_activation_switches_served_forecasts(admin_client, anon, reference):
    make_model("xgboost-forecast")
    registry = build_registry()
    registry.dispatch(_topic(), samples.forecast_v1())
    lstm = samples.forecast_v1(model_id="lstm-forecast")
    lstm["model"].update(algorithm="LSTM", version="2.0.0")
    registry.dispatch(_topic(), lstm)  # modèle inconnu : enregistré candidat
    assert body(anon.get("/api/v1/forecasts"))["modelName"] == "XGBoost"
    call(admin_client, "patch", "/admin/models/lstm-forecast", {"status": "active"})
    served = body(anon.get("/api/v1/forecasts"))
    assert (served["modelName"], served["modelVersion"]) == ("LSTM", "2.0.0")
    assert AiModel.objects.get(pk="xgboost-forecast").status == "archived"


def _topic():
    from django.conf import settings

    return settings.SENAIR["TOPIC_FORECASTS"]


def _download(client, link: dict) -> bytes:
    response = client.get(urlsplit(link["downloadUrl"]).path)
    assert response.status_code == 200
    return b"".join(response.streaming_content)


def test_export_readings_csv(admin_client, authority_client, anon, reference):
    now = timezone.now()
    make_reading("168373", now - timedelta(hours=2), pm25=20.0, co=0.0775)
    make_reading("168388", now - timedelta(hours=1), pm25=10.0)
    query = {"dataset": "readings", "format": "csv", "from": iso(now - timedelta(days=1)), "to": iso(now), "stationIds": ["168373"]}
    assert call(authority_client, "post", "/admin/exports", query).status_code == 403
    response = call(admin_client, "post", "/admin/exports", query)
    assert response.status_code == 200
    link = body(response)
    assert link["fileName"] == f"senair-readings-{(now - timedelta(days=1)):%Y-%m-%d}-au-{now:%Y-%m-%d}.csv"
    rows = list(csv.reader(io.StringIO(_download(anon, link).decode("utf-8-sig"))))
    assert rows[0] == [
        "location_id",
        "location_name",
        "latitude",
        "longitude",
        "timestamp",
        "pm25",
        "pm10",
        "no2",
        "so2",
        "co",
        "o3",
        "co2",
        "tvoc",
        "nh3",
        "no",
        "iqa",
        "categorie_iqa",
    ]
    assert len(rows) == 2 and rows[1][0] == "168373" and rows[1][-1] == "Mauvais pour les groupes sensibles"
    entry = AuditLogEntry.objects.get(action="data.export")
    assert entry.resource == "export" and entry.resource_id == "readings" and entry.changes["rows"]["to"] == 1


def test_export_forecasts_and_alerts_json(admin_client, anon, reference):
    make_model("xgboost-forecast")
    build_registry().dispatch(_topic(), samples.forecast_v1())
    now = timezone.now()
    query = {"dataset": "forecasts", "format": "json", "from": iso(now - timedelta(days=1)), "to": iso(now + timedelta(hours=1))}
    document = json.loads(_download(anon, body(call(admin_client, "post", "/admin/exports", query))))
    assert document["dataset"] == "forecasts" and len(document["lignes"]) == 6
    assert document["lignes"][0]["station"] == "Thiès" and document["lignes"][0]["modele"] == "xgboost-forecast@1.0.0"
    alerts = json.loads(_download(anon, body(call(admin_client, "post", "/admin/exports", {**query, "dataset": "alerts"}))))
    assert alerts["lignes"] == []


def test_export_validation(admin_client, anon, reference):
    assert call(anon, "post", "/admin/exports", {}).status_code == 401
    response = call(admin_client, "post", "/admin/exports", {"dataset": "users", "format": "xlsx", "from": "2026-07-06T00:00:00Z"})
    assert response.status_code == 422 and {"dataset", "format", "to"} <= set(body(response)["details"]["fields"])
    long = {"dataset": "readings", "format": "csv", "from": "2024-01-01T00:00:00Z", "to": "2026-01-01T00:00:00Z"}
    assert call(admin_client, "post", "/admin/exports", long).status_code == 422
