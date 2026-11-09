"""Fournisseurs d'interpolation : grille du flux, modèle KNN de l'équipe data, repli IDW."""

import shutil
from datetime import timedelta
from pathlib import Path

import pytest
from django.conf import settings
from django.utils import timezone

from senair.forecasts import interpolation
from senair.forecasts.models import AiModel
from senair.measurements.ingestion import samples
from senair.measurements.ingestion.registry import build_registry
from tests.air_quality.helpers import make_model, make_reading
from tests.contract import assert_contract, body

pytestmark = pytest.mark.django_db
KNN_PATH = Path(settings.SENAIR["MODEL_INTERPOLATION_PATH"])
needs_knn = pytest.mark.skipif(not KNN_PATH.is_file(), reason="air_quality/airflow/models/knn_model.pkl absent")


@needs_knn
def test_knn_provider_point(anon, reference):
    model = AiModel.objects.get(pk="knn-interpolation")
    assert model.status == "active" and model.signature["outputs"] == ["iqr", "pm25", "pm10", "co2", "no2", "so2", "o3"]
    make_reading("168373", pm25=20.0)
    response = anon.get("/api/v1/air-quality/at?lat=14.79&lon=-16.93")
    assert_contract(response, "get", "/air-quality/at?lat=14.79&lon=-16.93")
    data = body(response)
    codes = {m["code"] for m in data["measures"]}
    assert codes == {"pm25", "pm10", "co2", "no2", "so2", "o3"}  # sorties du KNN, « iqr » ignoré (IQA recalculé)
    assert all(m["source"] == "model" for m in data["measures"])
    pm25 = next(m["value"] for m in data["measures"] if m["code"] == "pm25")
    assert data["aqi"] == round(pm25 / 15 * 100) and data["status"] == "estimated"


@needs_knn
def test_knn_provider_heatmap(anon, reference):
    url = "/air-quality/heatmap?layer=pm25&resolutionM=1500"
    response = anon.get("/api/v1" + url)
    assert_contract(response, "get", url)
    data = body(response)
    assert data["method"] == "idw" and data["modelVersion"] == "knn-interpolation@airflow"
    assert data["cells"] and all(c["value"] is not None for c in data["cells"])


@needs_knn
def test_knn_layer_without_output_falls_back_to_idw(anon, reference):
    make_reading("168373", pm25=20.0, co=0.5)
    data = body(anon.get("/api/v1/air-quality/heatmap?layer=co&resolutionM=2000"))
    assert data["modelVersion"] == "idw-p2"


@needs_knn
def test_knn_artifact_outside_models_dir_is_refused(reference, tmp_path):
    copy = tmp_path / "knn_model.pkl"
    shutil.copy(KNN_PATH, copy)
    assert interpolation.load_artifact(str(copy)) is None
    assert interpolation.load_artifact("s3://bucket/knn.pkl") is None
    assert interpolation.load_artifact(str(KNN_PATH)) is not None


@needs_knn
def test_knn_not_used_for_past_maps(reference):
    make_reading("168373", timezone.now() - timedelta(days=2), pm25=20.0)
    at = timezone.now() - timedelta(days=2) + timedelta(minutes=30)
    estimate, _ = interpolation.estimate_point(14.79, -16.93, at)
    assert estimate.model_version == "idw-p2"


def test_signature_mismatch_skips_model(reference):
    AiModel.objects.filter(task="interpolation").update(signature={"inputs": ["latitude", "longitude", "heure"], "outputs": ["pm25"]})
    make_reading("168373", pm25=20.0)
    estimate, _ = interpolation.estimate_point(14.79, -16.93)
    assert estimate.method == "idw" and estimate.model_version == "idw-p2"


def test_recent_grid_of_active_model_is_preferred(anon, reference):
    make_model("kriging-demo", task="interpolation", algorithm="Krigeage ordinaire", version="0.1.0")
    AiModel.objects.filter(pk="knn-interpolation").update(status="archived")
    make_reading("168373", pm25=20.0)
    build_registry().dispatch(settings.SENAIR["TOPIC_INTERPOLATIONS"], samples.interpolation_v1(resolution_m=500))

    url = "/air-quality/heatmap?layer=aqi&bbox=-16.95,14.76,-16.92,14.80&resolutionM=300"
    response = anon.get("/api/v1" + url)
    assert_contract(response, "get", url)
    data = body(response)
    assert (data["method"], data["modelVersion"], data["resolutionM"]) == ("kriging", "kriging-demo@0.1.0", 500)
    assert data["cells"] and all(c["uncertainty"] == 0.2 for c in data["cells"])

    point = body(anon.get("/api/v1/air-quality/at?lat=14.79&lon=-16.93"))
    assert point["confidence"] == 0.8 and point["status"] == "estimated"


def test_stale_or_candidate_grid_is_ignored(reference):
    AiModel.objects.filter(task="interpolation").delete()
    make_reading("168373", pm25=20.0)
    registry = build_registry()
    registry.dispatch(settings.SENAIR["TOPIC_INTERPOLATIONS"], samples.interpolation_v1(resolution_m=2000))  # modèle créé « candidate »
    estimate, _ = interpolation.estimate_point(14.79, -16.93)
    assert estimate.method == "idw"
    AiModel.objects.filter(pk="kriging-demo").update(status="active")
    old = samples.interpolation_v1(timezone.now() - timedelta(hours=5), resolution_m=2000)
    registry.dispatch(settings.SENAIR["TOPIC_INTERPOLATIONS"], old)
    assert interpolation.GridProvider()._grid("aqi", timezone.now() - timedelta(hours=5)) is not None
    assert interpolation.estimate_point(14.79, -16.93)[0].method == "kriging"  # la grille récente reste servie


def test_distance_confidence():
    assert interpolation.distance_confidence(0) == 1.0
    assert interpolation.distance_confidence(2500) == 0.5
    assert interpolation.distance_confidence(14_000) == 0.3
    assert interpolation.distance_confidence(None) is None
