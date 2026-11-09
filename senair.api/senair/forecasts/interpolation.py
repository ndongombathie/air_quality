"""
Estimation spatiale (GET /air-quality/at et /air-quality/heatmap) : fournisseurs essayés dans l'ordre de préférence.
1. GridProvider : dernière grille reçue par le flux (interpolation.v1) pour la couche, si elle date de 2 h au plus
   et si son modèle est actif (même règle que les prévisions : un modèle candidat n'est jamais servi) ;
2. ModelProvider : modèle actif de tâche « interpolation » dont le fichier (artifact_uri) est chargeable, par exemple
   le KNN de l'équipe data (joblib, entrées latitude et longitude, ordre des sorties lu dans signature.outputs) ;
3. IdwProvider : repli calculé par l'API, pondération inverse au carré de la distance sur les dernières mesures.
Le résultat est toujours « estimated ». L'IQA est recalculé par domain.compute_aqi à partir des concentrations
estimées (le backend fait foi), sauf pour une grille qui fournit déjà son IQA.
Confiance des estimations calculées par l'API (KNN, IDW) : max(0,3 ; 1 − d / 5 000 m), d = distance à la station
la plus proche ; incertitude d'une cellule = 1 − confiance. Pour une grille, l'incertitude est celle du modèle.
"""

import logging
import warnings
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Any

from django.conf import settings
from django.utils import timezone

from senair.common.domain import POLLUTANT_CODES, compute_aqi
from senair.measurements.geo import distance_m, idw
from senair.measurements.models import Reading
from senair.measurements.queries import latest_readings
from senair.network.models import Station

from .models import AiModel, InterpolationGrid

logger = logging.getLogger("senair.interpolation")

GRID_MAX_AGE = timedelta(hours=2)
# Une mesure plus ancienne que ce délai avant l'instant demandé n'entre pas dans une carte historique.
READING_WINDOW = timedelta(hours=2)
IDW_VERSION = "idw-p2"
# Grandeurs estimables : polluants de l'IQA et CO₂ (sortie du KNN).
ESTIMATED_CODES = (*POLLUTANT_CODES, "co2")


def distance_confidence(nearest_m: float | None) -> float | None:
    if nearest_m is None:
        return None
    return round(max(0.3, 1 - nearest_m / 5000), 2)


@dataclass
class PointEstimate:
    values: dict[str, float | None]
    aqi: float | None
    dominant: str | None
    confidence: float | None
    method: str
    model_version: str
    observed_at: datetime | None


@dataclass
class HeatmapEstimate:
    cells: list[dict]
    method: str
    model_version: str
    at: datetime
    generated_at: datetime
    resolution_m: int


def _aqi(values: dict[str, float | None]) -> tuple[float | None, str | None]:
    result = compute_aqi(values)
    return result.aqi, result.dominant


def _round(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(float(value), digits)


class _Context:
    """Stations et mesures de référence d'une requête (calculées une seule fois)."""

    def __init__(self, at: datetime | None):
        self.at = at
        self.stations = [s for s in Station.objects.all() if s.status == Station.Status.ONLINE] or list(Station.objects.all())
        self._readings: list[Reading] | None = None

    @property
    def readings(self) -> list[Reading]:
        if self._readings is None:
            ids = [s.pk for s in self.stations]
            if self.at is None:
                self._readings = list(latest_readings(ids).values())
            else:
                rows = Reading.objects.filter(station_id__in=ids, observed_at__lte=self.at, observed_at__gte=self.at - READING_WINDOW)
                latest: dict[str, Reading] = {}
                for reading in rows.order_by("observed_at"):
                    latest[reading.station_id] = reading
                self._readings = list(latest.values())
            positions = {s.pk: s for s in self.stations}
            for reading in self._readings:
                reading.station = positions[reading.station_id]
        return self._readings

    def nearest_distance(self, lat: float, lon: float) -> float | None:
        return min((distance_m(lat, lon, s.latitude, s.longitude) for s in self.stations), default=None)


class GridProvider:
    name = "grid"

    def _grid(self, layer: str, at: datetime | None) -> InterpolationGrid | None:
        reference = at or timezone.now()
        return (
            InterpolationGrid.objects.select_related("model")
            .filter(
                layer=layer,
                model__status=AiModel.Status.ACTIVE,
                at__lte=reference + timedelta(minutes=10),
                at__gte=reference - GRID_MAX_AGE,
            )
            .order_by("-at", "-pk")
            .first()
        )

    @staticmethod
    def _nearest_cell(grid: InterpolationGrid, lat: float, lon: float) -> dict | None:
        best, best_d = None, None
        for cell in grid.cells:
            d = distance_m(lat, lon, cell["latitude"], cell["longitude"])
            if best_d is None or d < best_d:
                best, best_d = cell, d
        return best if best_d is not None and best_d <= 1.5 * grid.resolution_m else None

    def point(self, lat: float, lon: float, ctx: _Context) -> PointEstimate | None:
        grid = self._grid("aqi", ctx.at)
        cell = self._nearest_cell(grid, lat, lon) if grid else None
        if cell is None:
            return None
        values: dict[str, float | None] = {}
        for code in POLLUTANT_CODES:
            other = self._grid(code, ctx.at)
            other_cell = self._nearest_cell(other, lat, lon) if other else None
            if other_cell is not None:
                values[code] = other_cell["value"]
        aqi = cell.get("aqi") if cell.get("aqi") is not None else cell["value"]
        _, dominant = _aqi(values)
        uncertainty = cell.get("uncertainty")
        return PointEstimate(
            values=values,
            aqi=_round(aqi, 0),
            dominant=dominant,
            confidence=None if uncertainty is None else round(1 - uncertainty, 2),
            method=grid.method,
            model_version=f"{grid.model_id}@{grid.model_version}",
            observed_at=grid.at,
        )

    def heatmap(self, layer: str, bbox: Sequence[float], resolution_m: int, ctx: _Context) -> HeatmapEstimate | None:
        grid = self._grid(layer, ctx.at)
        if grid is None:
            return None
        min_lon, min_lat, max_lon, max_lat = bbox
        cells = []
        for cell in grid.cells:
            if not (min_lat <= cell["latitude"] <= max_lat and min_lon <= cell["longitude"] <= max_lon):
                continue
            aqi = cell.get("aqi")
            if aqi is None and layer == "aqi":
                aqi = cell["value"]
            cells.append(
                {
                    "latitude": cell["latitude"],
                    "longitude": cell["longitude"],
                    "value": cell["value"],
                    "aqi": aqi,
                    "uncertainty": cell.get("uncertainty"),
                }
            )
        return HeatmapEstimate(cells, grid.method, f"{grid.model_id}@{grid.model_version}", grid.at, grid.received_at, grid.resolution_m)


# ─── Modèles chargés depuis un fichier (KNN de l'équipe data) ───

_ARTIFACTS: dict[tuple[str, float], Any] = {}
_ARTIFACTS_LOCK = Lock()


def allowed_artifact_dir() -> Path:
    """Seuls les fichiers du dossier des modèles déclaré dans les réglages sont chargés (joblib = pickle exécutable)."""
    return Path(settings.SENAIR["MODEL_INTERPOLATION_PATH"]).resolve().parent


def load_artifact(uri: str) -> Any | None:
    """Chargement paresseux et en cache (invalidé si le fichier change). None si absent, interdit ou illisible."""
    if not uri or "://" in uri.removeprefix("file://"):
        return None  # s3://, minio:// : non pris en charge par l'API, publier les grilles sur le flux
    path = Path(uri.removeprefix("file://")).resolve()
    if not path.is_relative_to(allowed_artifact_dir()) or not path.is_file():
        return None
    key = (str(path), path.stat().st_mtime)
    with _ARTIFACTS_LOCK:
        if key not in _ARTIFACTS:
            try:
                import joblib
            except ImportError:
                logger.warning("joblib absent (requirements-ml.txt) : modèle %s non chargé.", path.name)
                return None
            try:
                with warnings.catch_warnings(record=True) as caught:
                    warnings.simplefilter("always")
                    model = joblib.load(path)  # noqa: S301 (fichier du dossier des modèles, modèle activé par un administrateur)
                for warning in caught:
                    if type(warning.message).__name__ == "InconsistentVersionWarning":
                        logger.warning("Modèle %s entraîné avec une autre version de scikit-learn : accepté.", path.name)
            except Exception:
                logger.exception("Modèle %s illisible.", path.name)
                return None
            for stale in [k for k in _ARTIFACTS if k[0] == key[0]]:
                _ARTIFACTS.pop(stale)
            _ARTIFACTS[key] = model
        return _ARTIFACTS[key]


class ModelProvider:
    name = "model"

    def _active(self, ctx: _Context) -> tuple[AiModel, Any] | None:
        # Le modèle n'a pas d'entrée temporelle : il ne décrit que l'état récent, pas une carte passée.
        if ctx.at is not None and timezone.now() - ctx.at > GRID_MAX_AGE:
            return None
        model = AiModel.objects.filter(task=AiModel.Task.INTERPOLATION, status=AiModel.Status.ACTIVE).exclude(artifact_uri="").first()
        if model is None:
            return None
        inputs = model.signature.get("inputs") or ["latitude", "longitude"]
        if list(inputs) != ["latitude", "longitude"] or not model.signature.get("outputs"):
            return None
        estimator = load_artifact(model.artifact_uri)
        return (model, estimator) if estimator is not None and hasattr(estimator, "predict") else None

    def _predict(self, model: AiModel, estimator: Any, points: Sequence[tuple[float, float]]) -> list[dict[str, float | None]] | None:
        outputs = list(model.signature["outputs"])
        try:
            if hasattr(estimator, "feature_names_in_"):
                import pandas as pd

                features = pd.DataFrame(points, columns=["latitude", "longitude"])
            else:
                features = [list(p) for p in points]
            predictions = estimator.predict(features)
        except Exception:
            logger.exception("Prédiction du modèle %s en échec.", model.pk)
            return None
        rows = []
        for row in predictions:
            row = list(row) if hasattr(row, "__len__") else [row]
            if len(row) != len(outputs):
                logger.error("Le modèle %s renvoie %d sorties, la signature en déclare %d.", model.pk, len(row), len(outputs))
                return None
            rows.append({name: float(value) for name, value in zip(outputs, row, strict=True) if name in ESTIMATED_CODES or name == "aqi"})
        return rows

    def point(self, lat: float, lon: float, ctx: _Context) -> PointEstimate | None:
        active = self._active(ctx)
        if active is None:
            return None
        model, estimator = active
        rows = self._predict(model, estimator, [(lat, lon)])
        if not rows:
            return None
        values = {code: _round(rows[0].get(code)) for code in ESTIMATED_CODES if code in rows[0]}
        aqi, dominant = _aqi(values)
        return PointEstimate(
            values,
            aqi,
            dominant,
            distance_confidence(ctx.nearest_distance(lat, lon)),
            "idw",
            f"{model.pk}@{model.version}",
            max((r.observed_at for r in ctx.readings), default=None),
        )

    def heatmap(
        self, layer: str, bbox: Sequence[float], resolution_m: int, ctx: _Context, points: Sequence[tuple[float, float]]
    ) -> HeatmapEstimate | None:
        active = self._active(ctx)
        if active is None:
            return None
        model, estimator = active
        if layer != "aqi" and layer not in model.signature["outputs"]:
            return None
        rows = self._predict(model, estimator, points)
        if rows is None:
            return None
        cells = []
        for (lat, lon), row in zip(points, rows, strict=True):
            aqi, _ = _aqi(row)
            confidence = distance_confidence(ctx.nearest_distance(lat, lon))
            cells.append(
                {
                    "latitude": lat,
                    "longitude": lon,
                    "value": aqi if layer == "aqi" else _round(row.get(layer)),
                    "aqi": aqi,
                    "uncertainty": None if confidence is None else round(1 - confidence, 2),
                }
            )
        at = ctx.at or max((r.observed_at for r in ctx.readings), default=timezone.now())
        return HeatmapEstimate(cells, "idw", f"{model.pk}@{model.version}", at, timezone.now(), resolution_m)


class IdwProvider:
    name = "idw"

    @staticmethod
    def _samples(ctx: _Context, code: str) -> list[tuple[float, float, float]]:
        return [(r.station.latitude, r.station.longitude, getattr(r, code)) for r in ctx.readings if getattr(r, code) is not None]

    def _values(self, lat: float, lon: float, samples: dict[str, list]) -> dict[str, float | None]:
        return {code: _round(idw((lat, lon), rows)) for code, rows in samples.items() if rows}

    def point(self, lat: float, lon: float, ctx: _Context) -> PointEstimate | None:
        if not ctx.readings:
            return None
        samples = {code: self._samples(ctx, code) for code in ESTIMATED_CODES}
        values = self._values(lat, lon, samples)
        aqi, dominant = _aqi(values)
        return PointEstimate(
            values,
            aqi,
            dominant,
            distance_confidence(ctx.nearest_distance(lat, lon)),
            "idw",
            IDW_VERSION,
            max(r.observed_at for r in ctx.readings),
        )

    def heatmap(
        self, layer: str, bbox: Sequence[float], resolution_m: int, ctx: _Context, points: Sequence[tuple[float, float]]
    ) -> HeatmapEstimate | None:
        if not ctx.readings:
            return None
        samples = {code: self._samples(ctx, code) for code in POLLUTANT_CODES}
        cells = []
        for lat, lon in points:
            values = self._values(lat, lon, samples)
            aqi, _ = _aqi(values)
            confidence = distance_confidence(ctx.nearest_distance(lat, lon))
            cells.append(
                {
                    "latitude": lat,
                    "longitude": lon,
                    "value": aqi if layer == "aqi" else values.get(layer),
                    "aqi": aqi,
                    "uncertainty": None if confidence is None else round(1 - confidence, 2),
                }
            )
        at = ctx.at or max(r.observed_at for r in ctx.readings)
        return HeatmapEstimate(cells, "idw", IDW_VERSION, at, timezone.now(), resolution_m)


def estimate_point(lat: float, lon: float, at: datetime | None = None) -> tuple[PointEstimate | None, _Context]:
    ctx = _Context(at)
    for provider in (GridProvider(), ModelProvider(), IdwProvider()):
        estimate = provider.point(lat, lon, ctx)
        if estimate is not None:
            return estimate, ctx
    return None, ctx


def estimate_heatmap(
    layer: str, bbox: Sequence[float], resolution_m: int, points: Sequence[tuple[float, float]], at: datetime | None = None
) -> HeatmapEstimate | None:
    ctx = _Context(at)
    grid = GridProvider().heatmap(layer, bbox, resolution_m, ctx)
    if grid is not None:
        return grid
    for provider in (ModelProvider(), IdwProvider()):
        estimate = provider.heatmap(layer, bbox, resolution_m, ctx, points)
        if estimate is not None:
            return estimate
    return None
