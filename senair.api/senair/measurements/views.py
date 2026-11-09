"""Qualité de l'air : métadonnées, dernières mesures, historiques, synthèse, estimation spatiale, export (D27)."""

from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from senair.common.domain import MEASURE_CODES, POLLUTANT_CODES, REFERENCES, UNITS, aqi_level, freshness, iso, sub_index
from senair.common.exceptions import ApiError, validation_error
from senair.forecasts.interpolation import IDW_VERSION, estimate_heatmap, estimate_point
from senair.forecasts.models import AiModel
from senair.network.models import Station, Zone
from senair.network.views import get_station

from . import exports
from .geo import THIES_BBOX, distance_m, grid_points, grid_size
from .history import MAX_SPAN, build_history
from .models import Reading
from .params import AdminView, PublicReadView, choice_param, datetime_param, float_param, int_param, list_param
from .presenters import snapshot, weather
from .queries import latest_readings

CITY_ID = "thies"
CITY_NAME = "Thiès"
COVERAGE_RADIUS_M = 15_000
COMPARISON_WINDOW = timedelta(hours=2)
MAX_HEATMAP_CELLS = 20_000


def get_zone(zone_id: str) -> Zone:
    zone = Zone.objects.filter(pk=zone_id).first()
    if zone is None:
        raise ApiError("not_found", "Zone introuvable.", status.HTTP_404_NOT_FOUND)
    return zone


class MetadataView(PublicReadView):
    def get(self, request):
        updated = Reading.objects.aggregate(last=Max("observed_at"))["last"]
        models = AiModel.objects.filter(status=AiModel.Status.ACTIVE).order_by("task", "name")
        return Response(
            {
                "api_version": settings.SENAIR["API_VERSION"],
                "data_updated_at": iso(updated),
                "models": [{"name": m.name, "task": m.task, "version": m.version} for m in models],
                "references": [code for code, _label in REFERENCES],
            }
        )


class StationLatestView(PublicReadView):
    def get(self, request, station_id: str):
        station = get_station(station_id)
        return Response(snapshot(latest_readings([station.pk]).get(station.pk)))


# ─── Historiques ───


def history_query(request) -> tuple[datetime, datetime, str, list[str]]:
    start = datetime_param(request, "from", is_required=True)
    end = datetime_param(request, "to", is_required=True)
    granularity = choice_param(request, "granularity", ("raw", "hour", "day"), default="hour")
    pollutants = list_param(request, "pollutants", MEASURE_CODES)
    if start > end:
        raise validation_error({"from": "La date de début doit précéder la date de fin."})
    if end - start > MAX_SPAN[granularity]:
        raise validation_error(
            {"to": f"Période trop longue pour la granularité {granularity} ({MAX_SPAN[granularity].days} jours au plus)."}
        )
    return start, end, granularity, pollutants


class StationHistoryView(PublicReadView):
    def get(self, request, station_id: str):
        station = get_station(station_id)
        start, end, granularity, pollutants = history_query(request)
        readings = Reading.objects.filter(station=station)
        return Response(build_history("station", station.pk, readings, start, end, granularity, pollutants))


class ZoneHistoryView(PublicReadView):
    def get(self, request, zone_id: str):
        zone = get_zone(zone_id)
        start, end, granularity, pollutants = history_query(request)
        readings = Reading.objects.filter(station__zone=zone).exclude(station__status=Station.Status.OFFLINE)
        return Response(build_history("zone", zone.pk, readings, start, end, granularity, pollutants))


class CityHistoryView(PublicReadView):
    def get(self, request):
        start, end, granularity, pollutants = history_query(request)
        readings = Reading.objects.exclude(station__status=Station.Status.OFFLINE)
        return Response(build_history("city", CITY_ID, readings, start, end, granularity, pollutants))


# ─── Synthèse (P7) ───


def scope_aqi_at(at: datetime, station_ids: list[str]) -> float | None:
    """IQA de la portée à un instant passé : max des stations sur leur dernière mesure des 2 h précédentes."""
    rows = (
        Reading.objects.filter(station_id__in=station_ids, observed_at__lte=at, observed_at__gt=at - COMPARISON_WINDOW, aqi__isnull=False)
        .order_by("station_id", "observed_at")
        .values_list("station_id", "aqi")
    )
    last = dict(rows)  # la dernière valeur de chaque station l'emporte (tri croissant)
    return max(last.values()) if last else None


def _delta(current: float | None, past: float | None) -> float | None:
    return None if current is None or past is None else round(current - past, 1)


class SummaryView(PublicReadView):
    def get(self, request):
        zone_id = request.query_params.get("zoneId") or None
        stations = Station.objects.select_related("zone")
        zone = get_zone(zone_id) if zone_id else None
        if zone is not None:
            stations = stations.filter(zone=zone)
        stations = list(stations)
        online = [s for s in stations if s.status == Station.Status.ONLINE]
        latest = latest_readings([s.pk for s in online])
        reporting = [s for s in online if s.pk in latest and freshness(latest[s.pk].observed_at) in ("fresh", "stale")]
        # Sans station qui remonte, on montre la dernière donnée connue (le front l'affiche « en retard »).
        basis = reporting or [s for s in online if s.pk in latest]
        readings = [latest[s.pk] for s in basis]
        top = max(readings, key=lambda r: -1 if r.aqi is None else r.aqi, default=None)
        snap = snapshot(top)
        aqi = top.aqi if top is not None else None
        ids = [s.pk for s in basis]
        comparison = {"vs_yesterday": None, "vs_last_week": None}
        if top is not None and aqi is not None:
            comparison = {
                "vs_yesterday": _delta(aqi, scope_aqi_at(top.observed_at - timedelta(days=1), ids)),
                "vs_last_week": _delta(aqi, scope_aqi_at(top.observed_at - timedelta(days=7), ids)),
            }
        return Response(
            {
                "scope": "zone" if zone else "city",
                "scope_id": zone.pk if zone else CITY_ID,
                "name": zone.name if zone else CITY_NAME,
                **snap,
                "stations_reporting": len(reporting),
                "stations_total": len(stations),
                "comparison": comparison,
                "worst_zones": worst_zones(basis, latest),
            }
        )


def worst_zones(stations: list[Station], latest: dict[str, Reading], limit: int = 5) -> list[dict]:
    by_zone: dict[str, Reading] = {}
    names: dict[str, str] = {}
    for station in stations:
        reading = latest[station.pk]
        names[station.zone_id] = station.zone.name
        current = by_zone.get(station.zone_id)
        if current is None or (reading.aqi or -1) > (current.aqi or -1):
            by_zone[station.zone_id] = reading
    ranked = sorted(by_zone.items(), key=lambda item: -1 if item[1].aqi is None else item[1].aqi, reverse=True)[:limit]
    return [
        {"zone_id": zone_id, "zone_name": names[zone_id], "aqi": r.aqi, "level": r.aqi_level, "dominant_pollutant": r.dominant_pollutant}
        for zone_id, r in ranked
    ]


# ─── Estimation spatiale (P8, P9) ───


class LocationView(PublicReadView):
    def get(self, request):
        lat = float_param(request, "lat", -90, 90)
        lon = float_param(request, "lon", -180, 180)
        stations = [s for s in Station.objects.select_related("zone") if s.status == Station.Status.ONLINE] or list(
            Station.objects.select_related("zone")
        )
        ranked = sorted(((distance_m(lat, lon, s.latitude, s.longitude), s) for s in stations), key=lambda item: item[0])
        if not ranked or ranked[0][0] > COVERAGE_RADIUS_M:
            raise ApiError(
                "out_of_coverage", "Cette position est hors de la zone couverte par les stations de Thiès.", status.HTTP_404_NOT_FOUND
            )
        distance, nearest = ranked[0]
        estimate, _ctx = estimate_point(lat, lon)
        if estimate is None:
            raise ApiError(
                "no_data", "Aucune mesure disponible pour estimer la qualité de l'air à cette position.", status.HTTP_404_NOT_FOUND
            )
        nearest_reading = latest_readings([nearest.pk]).get(nearest.pk)
        measures = [
            {"code": code, "value": value, "unit": UNITS[code], "source": "model", "sub_index": sub_index(code, value)}
            for code, value in estimate.values.items()
        ]
        return Response(
            {
                "aqi": estimate.aqi,
                "level": aqi_level(estimate.aqi),
                "dominant_pollutant": estimate.dominant,
                "measures": measures,
                "weather": weather(nearest_reading) if nearest_reading else None,
                "observed_at": iso(estimate.observed_at),
                "status": "estimated",
                "freshness": freshness(estimate.observed_at),
                "location": {"latitude": lat, "longitude": lon},
                "zone_id": nearest.zone_id,
                "zone_name": nearest.zone.name,
                "nearest_station_id": nearest.pk,
                "distance_to_nearest_station_m": round(distance),
                "confidence": estimate.confidence,
            }
        )


def bbox_param(request) -> tuple[float, float, float, float]:
    raw = request.query_params.get("bbox")
    if not raw:
        return THIES_BBOX
    try:
        min_lon, min_lat, max_lon, max_lat = (float(part) for part in raw.split(","))
    except ValueError as error:
        raise validation_error({"bbox": "Format attendu : minLon,minLat,maxLon,maxLat."}) from error
    if not (-180 <= min_lon < max_lon <= 180 and -90 <= min_lat < max_lat <= 90):
        raise validation_error({"bbox": "Emprise invalide (minimum strictement inférieur au maximum)."})
    return min_lon, min_lat, max_lon, max_lat


class HeatmapView(PublicReadView):
    def get(self, request):
        layer = request.query_params.get("layer")
        if not layer:
            raise validation_error({"layer": "Paramètre obligatoire."})
        layer = choice_param(request, "layer", ("aqi", *POLLUTANT_CODES))
        at = datetime_param(request, "at")
        bbox = bbox_param(request)
        resolution_m = int_param(request, "resolutionM", 100, 5000, 400)
        if grid_size(bbox, resolution_m) > MAX_HEATMAP_CELLS:
            raise validation_error({"resolutionM": f"Grille trop fine pour cette emprise ({MAX_HEATMAP_CELLS} cellules au plus)."})
        estimate = estimate_heatmap(layer, bbox, resolution_m, grid_points(bbox, resolution_m), at)
        if estimate is None:
            now = timezone.now()
            return Response(
                {
                    "layer": layer,
                    "at": iso(at or now),
                    "resolution_m": resolution_m,
                    "method": "idw",
                    "model_version": IDW_VERSION,
                    "generated_at": iso(now),
                    "status": "estimated",
                    "cells": [],
                }
            )
        cells = [
            {
                "location": {"latitude": c["latitude"], "longitude": c["longitude"]},
                "value": c["value"],
                "aqi": c["aqi"],
                "level": aqi_level(c["aqi"]),
                "uncertainty": c["uncertainty"],
            }
            for c in estimate.cells
        ]
        return Response(
            {
                "layer": layer,
                "at": iso(estimate.at),
                "resolution_m": estimate.resolution_m,
                "method": estimate.method,
                "model_version": estimate.model_version,
                "generated_at": iso(estimate.generated_at),
                "status": "estimated",
                "cells": cells,
            }
        )


# ─── Export des données brutes (D27) ───


class ExportView(AdminView):
    read_permission = "data:export_raw"

    def post(self, request):
        query = exports.parse_query(request.data)
        link = exports.build_export(request, query)
        return Response(link, status=status.HTTP_200_OK)
