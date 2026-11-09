"""Prévisions (P11) et registre des modèles IA (D18, D19)."""

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from senair.common.domain import FORECAST_HORIZONS, aqi_level, iso
from senair.common.exceptions import ApiError, validation_error
from senair.measurements.params import AdminView, PublicReadView, choice_param, list_param
from senair.measurements.queries import latest_readings
from senair.network.models import Station, Zone
from senair.reporting.audit import diff, record

from .models import AiModel, ForecastRun
from .stream import CITY_SCOPE_ID

TREND_TOLERANCE = 5  # écart d'IQA en deçà duquel la tendance est « stable » (même règle que le mode démonstration)


def current_aqi(scope: str, scope_id: str) -> float | None:
    """IQA actuel de la portée (max des dernières mesures des stations en ligne), base de la tendance."""
    stations = Station.objects.filter(status=Station.Status.ONLINE)
    if scope == "zone":
        stations = stations.filter(zone_id=scope_id)
    elif scope == "station":
        stations = Station.objects.filter(pk=scope_id)
    aqis = [r.aqi for r in latest_readings(stations.values_list("pk", flat=True)).values() if r.aqi is not None]
    return max(aqis) if aqis else None


def trend(aqi: float | None, current: float | None) -> str:
    if aqi is None or current is None:
        return "stable"
    if aqi > current + TREND_TOLERANCE:
        return "up"
    if aqi < current - TREND_TOLERANCE:
        return "down"
    return "stable"


class ForecastView(PublicReadView):
    def get(self, request):
        scope = choice_param(request, "scope", ("city", "zone", "station"), default="city")
        scope_id = request.query_params.get("scopeId") or (CITY_SCOPE_ID if scope == "city" else None)
        horizons = list_param(request, "horizons", FORECAST_HORIZONS)
        if scope_id is None:
            raise validation_error({"scopeId": "Paramètre obligatoire pour une zone ou une station."})
        if scope == "zone" and not Zone.objects.filter(pk=scope_id).exists():
            raise ApiError("not_found", "Zone introuvable.", status.HTTP_404_NOT_FOUND)
        if scope == "station" and not Station.objects.filter(pk=scope_id).exists():
            raise ApiError("not_found", "Station introuvable.", status.HTTP_404_NOT_FOUND)

        run = (
            ForecastRun.objects.select_related("model")
            .filter(scope=scope, scope_id=scope_id, model__status=AiModel.Status.ACTIVE, model__task=AiModel.Task.FORECAST)
            .order_by("-generated_at", "-pk")
            .first()
        )
        if run is None:
            raise ApiError("forecast_unavailable", "Aucune prévision disponible pour l'instant.", status.HTTP_404_NOT_FOUND)
        points = run.points.all()
        if horizons:
            points = points.filter(horizon__in=horizons)
        current = current_aqi(scope, scope_id)
        order = {h: i for i, h in enumerate(FORECAST_HORIZONS)}
        forecasts = [
            {
                "horizon": p.horizon,
                "valid_at": iso(p.valid_at),
                "aqi": p.aqi,
                "level": p.level or aqi_level(p.aqi),
                "dominant_pollutant": p.dominant_pollutant,
                "values": p.values,
                "confidence": p.confidence,
                "interval": {"low": p.interval_low, "high": p.interval_high}
                if p.interval_low is not None and p.interval_high is not None
                else None,
                "trend": trend(p.aqi, current),
                "drivers": p.drivers,
            }
            for p in sorted(points, key=lambda p: order.get(p.horizon, 99))
        ]
        return Response(
            {
                "scope": scope,
                "scope_id": scope_id,
                "model_name": run.model.algorithm,
                "model_version": run.model.version,
                "generated_at": iso(run.generated_at),
                "status": "forecast",
                "forecasts": forecasts,
            }
        )


def model_payload(model: AiModel) -> dict:
    return {
        "id": model.id,
        "name": model.name,
        "task": model.task,
        "algorithm": model.algorithm,
        "version": model.version,
        "status": model.status,
        "metrics": {"r2": model.r2, "rmse": model.rmse, "mae": model.mae},
        "trained_at": iso(model.trained_at),
        "tracking_url": model.tracking_url or None,
    }


class ModelListView(AdminView):
    def get(self, request):
        return Response([model_payload(m) for m in AiModel.objects.all()])


class ModelDetailView(AdminView):
    read_permission = "models:manage"

    def patch(self, request, model_id: str):
        model = AiModel.objects.filter(pk=model_id).first()
        if model is None:
            raise ApiError("not_found", "Modèle introuvable.", status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status") if isinstance(request.data, dict) else None
        if new_status not in AiModel.Status.values:
            raise validation_error({"status": f"Valeurs possibles : {', '.join(AiModel.Status.values)}."})
        with transaction.atomic():
            if new_status == AiModel.Status.ACTIVE:
                # Un seul modèle actif par tâche : l'ancien est archivé (et journalisé).
                for other in AiModel.objects.select_for_update().filter(task=model.task, status=AiModel.Status.ACTIVE).exclude(pk=model.pk):
                    record(request, "model.update", "model", other.pk, diff(other, {"status": AiModel.Status.ARCHIVED}))
                    other.status = AiModel.Status.ARCHIVED
                    other.save(update_fields=["status"])
            changes = diff(model, {"status": new_status})
            model.status = new_status
            model.save(update_fields=["status"])
            if changes:
                record(request, "model.update", "model", model.pk, changes)
        return Response(model_payload(model))
