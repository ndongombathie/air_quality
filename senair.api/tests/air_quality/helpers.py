"""Fabriques de données de test (mesures, modèles, lots de prévisions)."""

import csv
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from senair.common.domain import compute_aqi
from senair.forecasts.models import AiModel
from senair.measurements.models import Reading
from senair.network.models import Station

HISTORY_CSV = settings.REPO_DIR / "projet-transversal/air_quality.csv"


def csv_rows(*ids: int) -> dict[int, dict]:
    """Vraies lignes de projet-transversal/air_quality.csv, par colonne id."""
    wanted = {str(i) for i in ids}
    with HISTORY_CSV.open(encoding="utf-8-sig", newline="") as handle:
        return {int(row["id"]): row for row in csv.DictReader(handle) if row["id"] in wanted}


def make_reading(station_id: str, observed_at: datetime | None = None, **values) -> Reading:
    observed_at = observed_at or timezone.now() - timedelta(minutes=5)
    values.setdefault("pm25", 20.0)
    result = compute_aqi(values)
    sources = {code: "sensor" for code in values}
    return Reading.objects.create(
        station=Station.objects.get(pk=station_id),
        observed_at=observed_at,
        message_format="test",
        sources=sources,
        aqi=result.aqi,
        aqi_level=result.level,
        dominant_pollutant=result.dominant,
        **values,
    )


def make_model(
    model_id: str = "xgboost-forecast", task: str = AiModel.Task.FORECAST, status: str = AiModel.Status.ACTIVE, **fields
) -> AiModel:
    defaults = {"name": "Prévision IQA", "algorithm": "XGBoost", "version": "1.0.0", "trained_at": timezone.now() - timedelta(days=1)}
    defaults.update(fields)
    return AiModel.objects.create(id=model_id, task=task, status=status, **defaults)
