"""
Traitement des messages IA reçus par le flux :
- forecast.v1 : un lot de prévisions (ForecastRun + ForecastPoint). Un modèle inconnu est créé en « candidate » :
  ses lots sont stockés mais servis seulement après activation par un administrateur ;
- model.v1 : déclaration (upsert) d'un AiModel, jamais activé automatiquement ;
- interpolation.v1 : grille estimée d'une couche (InterpolationGrid), seules les N dernières par couche sont gardées.
"""

import logging
from typing import Any

from django.db import IntegrityError, transaction

from senair.common.domain import aqi_level
from senair.measurements.ingestion import schemas
from senair.measurements.ingestion.base import HandleResult, InvalidMessage, MessageContext, parse_datetime
from senair.network.models import Station, Zone

from .models import AiModel, ForecastPoint, ForecastRun, InterpolationGrid

logger = logging.getLogger("senair.ingestion")

CITY_SCOPE_ID = "thies"


def _model_for(ref: dict, task: str, trained_at) -> AiModel:
    model = AiModel.objects.filter(pk=ref["id"]).first()
    if model is None:
        model, created = AiModel.objects.get_or_create(
            pk=ref["id"],
            defaults={
                "name": ref.get("name") or ref["id"],
                "task": task,
                "algorithm": ref.get("algorithm") or "non précisé",
                "version": ref["version"],
                "trained_at": trained_at,
                "status": AiModel.Status.CANDIDATE,
            },
        )
        if created:
            logger.info("Modèle %s inconnu : enregistré comme candidat.", model.pk)
    elif model.task != task:
        raise InvalidMessage(f"Le modèle {model.pk} est déclaré pour la tâche {model.task}, pas {task}.")
    return model


class ForecastHandler:
    name = "forecast.v1"

    def handle(self, payload: Any, context: MessageContext) -> HandleResult:
        schemas.check("forecast.v1", payload)
        generated_at = parse_datetime(payload["generatedAt"])
        scope, scope_id = payload["scope"], payload["scopeId"]
        if scope == "zone" and not Zone.objects.filter(pk=scope_id).exists():
            raise InvalidMessage("Zone inconnue pour ce lot de prévisions.")
        if scope == "station" and not Station.objects.filter(pk=scope_id).exists():
            raise InvalidMessage("Station inconnue pour ce lot de prévisions.")
        horizons = [item["horizon"] for item in payload["forecasts"]]
        if len(horizons) != len(set(horizons)):
            raise InvalidMessage("Horizon en double dans le lot de prévisions.")

        model = _model_for(payload["model"], AiModel.Task.FORECAST, generated_at)
        if model.version != payload["model"]["version"]:
            logger.warning(
                "Lot de prévisions du modèle %s en version %s (registre : %s).", model.pk, payload["model"]["version"], model.version
            )
        try:
            with transaction.atomic():
                run = ForecastRun.objects.create(scope=scope, scope_id=scope_id, model=model, generated_at=generated_at)
                ForecastPoint.objects.bulk_create([self._point(run, item) for item in payload["forecasts"]])
        except IntegrityError:
            return HandleResult("duplicate", "Lot déjà reçu.")
        status = "servi" if model.status == AiModel.Status.ACTIVE else f"non servi (modèle {model.status})"
        return HandleResult("accepted", f"Lot {scope}:{scope_id} de {len(horizons)} horizon(s), {status}.")

    @staticmethod
    def _point(run: ForecastRun, item: dict) -> ForecastPoint:
        interval = item.get("interval") or None
        aqi = item.get("aqi")
        return ForecastPoint(
            run=run,
            horizon=item["horizon"],
            valid_at=parse_datetime(item["validAt"]),
            aqi=aqi,
            level=aqi_level(aqi),
            dominant_pollutant=item.get("dominantPollutant"),
            values=item.get("values") or {},
            confidence=item.get("confidence"),
            interval_low=interval["low"] if interval else None,
            interval_high=interval["high"] if interval else None,
            drivers=item.get("drivers") or [],
        )


class ModelHandler:
    name = "model.v1"

    def handle(self, payload: Any, context: MessageContext) -> HandleResult:
        schemas.check("model.v1", payload)
        metrics = payload.get("metrics") or {}
        fields = {
            "name": payload["name"],
            "task": payload["task"],
            "algorithm": payload["algorithm"],
            "version": payload["version"],
            "trained_at": parse_datetime(payload["trainedAt"]),
            "r2": metrics.get("r2"),
            "rmse": metrics.get("rmse"),
            "mae": metrics.get("mae"),
            "tracking_url": payload.get("trackingUrl"),
            "artifact_uri": payload.get("artifactUri") or "",
            "signature": payload.get("signature") or {},
        }
        with transaction.atomic():
            model = AiModel.objects.select_for_update().filter(pk=payload["id"]).first()
            if model is None:
                AiModel.objects.create(id=payload["id"], status=AiModel.Status.CANDIDATE, **fields)
                return HandleResult("accepted", f"Modèle {payload['id']} enregistré comme candidat.")
            if model.task != fields["task"] and model.status == AiModel.Status.ACTIVE:
                raise InvalidMessage("Changement de tâche refusé pour un modèle actif.")
            # Le statut n'est jamais modifié par le flux : seul un administrateur active ou archive.
            for name, value in fields.items():
                setattr(model, name, value)
            model.save()
        return HandleResult("accepted", f"Modèle {model.pk} mis à jour (statut {model.status} inchangé).")


class InterpolationHandler:
    name = "interpolation.v1"

    def handle(self, payload: Any, context: MessageContext) -> HandleResult:
        schemas.check("interpolation.v1", payload)
        at = parse_datetime(payload["at"])
        model = _model_for(payload["model"], AiModel.Task.INTERPOLATION, at)
        cells = [
            {
                "latitude": cell["latitude"],
                "longitude": cell["longitude"],
                "value": cell["value"],
                "aqi": cell.get("aqi"),
                "uncertainty": cell.get("uncertainty"),
            }
            for cell in payload["cells"]
        ]
        layer = payload["layer"]
        try:
            with transaction.atomic():
                grid = InterpolationGrid.objects.create(
                    model=model,
                    model_version=payload["model"]["version"][:40],
                    layer=layer,
                    at=at,
                    resolution_m=payload["resolutionM"],
                    method=payload["method"],
                    cells=cells,
                    message_id=payload["messageId"],
                )
        except IntegrityError:
            return HandleResult("duplicate", "Grille déjà reçue.")
        kept = (
            InterpolationGrid.objects.filter(layer=layer)
            .order_by("-at", "-pk")
            .values_list("pk", flat=True)[: InterpolationGrid.KEPT_PER_LAYER]
        )
        InterpolationGrid.objects.filter(layer=layer).exclude(pk__in=list(kept)).delete()
        return HandleResult("accepted", f"Grille {layer} de {len(cells)} cellule(s) ({grid.method}).")
