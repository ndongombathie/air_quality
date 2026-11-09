"""Endpoints publics P1 à P11 et P18 : contrat OpenAPI (succès et erreurs) et règles métier."""

from datetime import timedelta
from urllib.parse import urlencode

import pytest
from django.utils import timezone

from senair.common.domain import iso
from senair.forecasts.models import AiModel
from senair.measurements.ingestion import samples
from senair.measurements.ingestion.registry import build_registry
from senair.network.models import Station
from tests.air_quality.helpers import make_model, make_reading
from tests.contract import assert_contract, body

pytestmark = pytest.mark.django_db


def get(client, path: str, **params):
    url = path + ("?" + urlencode(params) if params else "")
    response = client.get("/api/v1" + url)
    assert_contract(response, "get", url)
    return response


def test_metadata(anon, reference):
    make_reading("168373")
    data = body(get(anon, "/metadata"))
    assert data["apiVersion"] == "1.0.0" and data["references"] == ["WHO_2021", "NS_05_062"]
    assert data["dataUpdatedAt"] is not None
    assert all(set(m) == {"name", "task", "version"} for m in data["models"])


def test_zones(anon, reference):
    data = body(get(anon, "/zones"))
    assert {"id": "centre-ville", "name": "Centre-ville", "centroid": {"latitude": 14.791343, "longitude": -16.924869}} in data


def test_stations_filters_and_latest(anon, reference):
    make_reading("168373", pm25=30.0, o3=60.0)
    data = body(get(anon, "/stations", include="latest"))
    assert len(data) == 9
    hdv = next(s for s in data if s["id"] == "168373")
    assert hdv["latest"]["aqi"] == 200 and hdv["latest"]["freshness"] == "fresh"
    assert next(s for s in data if s["id"] == "89441")["latest"] is None
    assert [s["id"] for s in body(get(anon, "/stations", zoneId="centre-ville"))] == ["168373"]
    roads = body(get(anon, "/stations", type="road"))
    assert {s["type"] for s in roads} == {"road"} and "latest" not in roads[0]


def test_stations_cache_headers(anon, reference):
    response = get(anon, "/stations")
    assert response["Cache-Control"] == "public, max-age=60" and response["ETag"]
    assert anon.get("/api/v1/stations", HTTP_IF_NONE_MATCH=response["ETag"]).status_code == 304


def test_station_detail_and_latest(anon, reference):
    make_reading("168373", pm25=20.5, temperature_c=34.5)
    detail = body(get(anon, "/stations/168373"))
    assert detail["latest"]["dominantPollutant"] == "pm25"
    latest = body(get(anon, "/stations/168373/latest"))
    assert latest["measures"][0]["code"] == "pm25" and latest["weather"]["temperatureC"] == 34.5
    empty = body(get(anon, "/stations/89441/latest"))
    assert empty["aqi"] is None and empty["freshness"] == "unknown"
    assert body(get(anon, "/stations/inconnue"))["code"] == "not_found"
    assert get(anon, "/stations/inconnue/latest").status_code == 404


def test_station_history_granularities(anon, reference):
    base = timezone.now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=3)
    make_reading("168373", base + timedelta(minutes=5), pm25=10.0, pm10=20.0)
    make_reading("168373", base + timedelta(minutes=35), pm25=20.0, pm10=None)
    make_reading("168373", base + timedelta(hours=1, minutes=5), pm25=30.0)
    window = {"from": iso(base - timedelta(hours=1)), "to": iso(timezone.now())}

    raw = body(get(anon, "/stations/168373/history", granularity="raw", **window))
    assert len(raw["points"]) == 3 and raw["granularity"] == "raw" and raw["scope"] == "station"

    hourly = body(get(anon, "/stations/168373/history", **window))
    assert hourly["granularity"] == "hour" and len(hourly["points"]) == 2
    first = hourly["points"][0]
    assert first["at"] == iso(base) and first["values"]["pm25"] == 15.0 and first["values"]["pm10"] == 20.0
    assert first["aqi"] == 100  # moyenne des IQA 67 et 133

    filtered = body(get(anon, "/stations/168373/history", granularity="day", pollutants="pm25,no2", **window))
    assert set(filtered["points"][0]["values"]) == {"pm25", "no2"} and filtered["points"][0]["values"]["no2"] is None


@pytest.mark.parametrize(
    "params,field",
    [
        ({"to": "2026-07-07T00:00:00Z"}, "from"),
        ({"from": "hier", "to": "2026-07-07T00:00:00Z"}, "from"),
        ({"from": "2026-07-08T00:00:00Z", "to": "2026-07-07T00:00:00Z"}, "from"),
        ({"from": "2026-07-06T00:00:00Z", "to": "2026-07-07T00:00:00Z", "granularity": "minute"}, "granularity"),
        ({"from": "2026-07-06T00:00:00Z", "to": "2026-07-07T00:00:00Z", "pollutants": "pm25,pm1"}, "pollutants"),
        ({"from": "2026-01-01T00:00:00Z", "to": "2026-07-07T00:00:00Z", "granularity": "raw"}, "to"),
    ],
)
def test_history_validation(anon, reference, params, field):
    response = get(anon, "/stations/168373/history", **params)
    assert response.status_code == 422 and field in body(response)["details"]["fields"]


def test_zone_and_city_history_take_station_max(anon, reference):
    at = timezone.now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    make_reading("168373", at + timedelta(minutes=10), pm25=30.0)  # Centre-ville
    make_reading("168388", at + timedelta(minutes=20), pm25=12.0)  # Jules Sagna
    make_reading("168393", at + timedelta(minutes=30), pm25=60.0)  # Médina Fall, hors ligne : exclue
    Station.objects.filter(pk="168393").update(status="offline")
    window = {"from": iso(at - timedelta(hours=1)), "to": iso(timezone.now())}

    city = body(get(anon, "/air-quality/history", **window))
    assert city["scope"] == "city" and city["scopeId"] == "thies"
    assert [(p["aqi"], p["values"]["pm25"]) for p in city["points"]] == [(200, 30.0)]

    zone = body(get(anon, "/zones/jules-sagna/history", **window))
    assert zone["scope"] == "zone" and zone["points"][0]["aqi"] == 80
    assert get(anon, "/zones/inconnue/history", **window).status_code == 404
    assert get(anon, "/air-quality/history", to=window["to"]).status_code == 422


def test_summary_city_and_zone(anon, reference):
    now = timezone.now()
    make_reading("168373", now - timedelta(minutes=5), pm25=30.0)
    make_reading("168373", now - timedelta(days=1, minutes=10), pm25=15.0)
    make_reading("168373", now - timedelta(days=7, minutes=10), pm25=45.0)
    make_reading("168388", now - timedelta(minutes=8), pm25=12.0)
    make_reading("168397", now - timedelta(hours=5), pm25=90.0)  # en ligne mais ne remonte plus

    city = body(get(anon, "/air-quality/summary"))
    assert (city["scope"], city["scopeId"], city["name"]) == ("city", "thies", "Thiès")
    assert city["aqi"] == 200 and city["level"] == "unhealthy" and city["status"] == "measured" and city["freshness"] == "fresh"
    assert (city["stationsReporting"], city["stationsTotal"]) == (2, 9)
    assert city["comparison"] == {"vsYesterday": 100.0, "vsLastWeek": -100.0}
    assert [z["zoneId"] for z in city["worstZones"]] == ["centre-ville", "jules-sagna"]

    zone = body(get(anon, "/air-quality/summary", zoneId="jules-sagna"))
    assert (zone["scope"], zone["name"], zone["aqi"], zone["stationsTotal"]) == ("zone", "Jules Sagna", 80, 1)
    assert zone["comparison"] == {"vsYesterday": None, "vsLastWeek": None}
    assert get(anon, "/air-quality/summary", zoneId="inconnue").status_code == 404


def test_summary_without_fresh_data_shows_last_known(anon, reference):
    make_reading("168373", timezone.now() - timedelta(days=3), pm25=10.0)
    data = body(get(anon, "/air-quality/summary"))
    assert data["stationsReporting"] == 0 and data["aqi"] == 67 and data["freshness"] == "outdated"


def test_summary_without_any_reading(anon, reference):
    data = body(get(anon, "/air-quality/summary"))
    assert data["aqi"] is None and data["worstZones"] == [] and data["freshness"] == "unknown"


# ─── Prévisions (P11) ───


def test_forecasts_unavailable_without_active_model(anon, reference):
    response = get(anon, "/forecasts")
    assert response.status_code == 404
    assert body(response)["code"] == "forecast_unavailable" and body(response)["message"] == "Aucune prévision disponible pour l'instant."
    build_registry().dispatch(settings_topic("TOPIC_FORECASTS"), samples.forecast_v1(model_id="candidat-x"))
    assert AiModel.objects.get(pk="candidat-x").status == "candidate"
    assert get(anon, "/forecasts").status_code == 404  # lot d'un modèle candidat : jamais servi


def settings_topic(key: str) -> str:
    from django.conf import settings

    return settings.SENAIR[key]


def test_forecasts_served_from_latest_active_run(anon, reference):
    make_model("xgboost-forecast")
    make_reading("168373", pm25=17.0)  # IQA actuel 113
    registry = build_registry()
    old = samples.forecast_v1(timezone.now() - timedelta(hours=3))
    registry.dispatch(settings_topic("TOPIC_FORECASTS"), old)
    latest = samples.forecast_v1()
    registry.dispatch(settings_topic("TOPIC_FORECASTS"), latest)

    data = body(get(anon, "/forecasts", horizons="1d,1h"))
    assert (data["scope"], data["scopeId"], data["modelName"], data["modelVersion"], data["status"]) == (
        "city",
        "thies",
        "XGBoost",
        "1.0.0",
        "forecast",
    )
    assert data["generatedAt"] == latest["generatedAt"]
    assert [f["horizon"] for f in data["forecasts"]] == ["1h", "1d"]
    first = data["forecasts"][0]
    assert first["aqi"] == 118 and first["confidence"] == 0.92 and first["interval"] == {"low": 112, "high": 124}
    assert first["trend"] == "stable" and data["forecasts"][1]["trend"] == "down"
    assert first["drivers"] == ["Heure de pointe du trafic"]


def test_forecasts_validation(anon, reference):
    assert get(anon, "/forecasts", scope="zone").status_code == 422
    assert get(anon, "/forecasts", horizons="4h").status_code == 422
    assert get(anon, "/forecasts", scope="planete").status_code == 422
    assert body(get(anon, "/forecasts", scope="station", scopeId="inconnue"))["code"] == "not_found"


# ─── Estimation spatiale (P8, P9) ───


def test_air_quality_at_idw_fallback(anon, reference):
    AiModel.objects.all().delete()  # pas de modèle d'interpolation actif : repli IDW
    make_reading("168373", pm25=30.0, temperature_c=33.0)
    make_reading("168388", pm25=10.0)
    data = body(get(anon, "/air-quality/at", lat=14.7914, lon=-16.9249))
    assert data["status"] == "estimated" and data["nearestStationId"] == "168373" and data["zoneId"] == "centre-ville"
    assert data["distanceToNearestStationM"] < 50 and data["confidence"] == 1.0
    pm25 = next(m for m in data["measures"] if m["code"] == "pm25")
    assert pm25["source"] == "model" and 29 < pm25["value"] <= 30
    assert data["weather"]["temperatureC"] == 33.0


def test_air_quality_at_errors(anon, reference):
    AiModel.objects.all().delete()
    far = get(anon, "/air-quality/at", lat=14.69, lon=-17.44)  # Dakar, à plus de 15 km
    assert far.status_code == 404 and body(far)["code"] == "out_of_coverage"
    assert get(anon, "/air-quality/at", lat=14.79, lon=-16.93).status_code == 404  # aucune mesure : no_data
    assert get(anon, "/air-quality/at", lat=14.79).status_code == 422
    assert get(anon, "/air-quality/at", lat=95, lon=-16.93).status_code == 422


def test_heatmap_idw(anon, reference):
    AiModel.objects.all().delete()  # pas de modèle d'interpolation actif : repli IDW
    make_reading("168373", pm25=30.0)
    make_reading("168401", pm25=10.0)
    data = body(get(anon, "/air-quality/heatmap", layer="pm25", bbox="-16.95,14.76,-16.92,14.80", resolutionM=1000))
    assert data["method"] == "idw" and data["modelVersion"] == "idw-p2" and data["status"] == "estimated" and data["resolutionM"] == 1000
    assert len(data["cells"]) == 20
    assert all(10 <= c["value"] <= 30 and 0 <= c["uncertainty"] <= 0.7 for c in data["cells"])
    aqi = body(get(anon, "/air-quality/heatmap", layer="aqi", resolutionM=2000))
    assert all(c["value"] == c["aqi"] and c["level"] for c in aqi["cells"])


def test_heatmap_validation(anon, reference):
    assert get(anon, "/air-quality/heatmap").status_code == 422
    assert get(anon, "/air-quality/heatmap", layer="co2").status_code == 422
    assert get(anon, "/air-quality/heatmap", layer="aqi", bbox="1,2,3").status_code == 422
    assert get(anon, "/air-quality/heatmap", layer="aqi", resolutionM=50).status_code == 422
    assert get(anon, "/air-quality/heatmap", layer="aqi", bbox="-17.5,14,-16,15.5", resolutionM=100).status_code == 422


def test_heatmap_without_data_is_empty(anon, reference):
    AiModel.objects.all().delete()
    data = body(get(anon, "/air-quality/heatmap", layer="aqi"))
    assert data["cells"] == [] and data["method"] == "idw"
