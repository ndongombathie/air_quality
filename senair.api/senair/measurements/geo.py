"""Outils géographiques : distance sur la sphère, grilles régulières, pondération inverse à la distance."""

import math
from collections.abc import Iterable, Sequence

EARTH_RADIUS_M = 6_371_000
# Emprise par défaut de la carte de Thiès (minLon, minLat, maxLon, maxLat), identique au mode démonstration du front.
THIES_BBOX = (-16.99, 14.74, -16.88, 14.83)


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance orthodromique (formule de haversine), en mètres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlambda = phi2 - phi1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def grid_points(bbox: Sequence[float], resolution_m: int) -> list[tuple[float, float]]:
    """Centres (latitude, longitude) d'une grille régulière couvrant la bbox au pas demandé."""
    min_lon, min_lat, max_lon, max_lat = bbox
    step_lat = resolution_m / 111_000
    step_lon = resolution_m / (111_000 * math.cos(math.radians((min_lat + max_lat) / 2)))
    rows = int((max_lat - min_lat) / step_lat) + 1
    cols = int((max_lon - min_lon) / step_lon) + 1
    return [(round(min_lat + i * step_lat, 6), round(min_lon + j * step_lon, 6)) for i in range(rows) for j in range(cols)]


def grid_size(bbox: Sequence[float], resolution_m: int) -> int:
    min_lon, min_lat, max_lon, max_lat = bbox
    step_lat = resolution_m / 111_000
    step_lon = resolution_m / (111_000 * math.cos(math.radians((min_lat + max_lat) / 2)))
    return (int((max_lat - min_lat) / step_lat) + 1) * (int((max_lon - min_lon) / step_lon) + 1)


def idw(
    point: tuple[float, float], samples: Iterable[tuple[float, float, float]], power: float = 2, min_distance_m: float = 50
) -> float | None:
    """Pondération inverse à la distance : samples = (latitude, longitude, valeur)."""
    weight_sum = value_sum = 0.0
    for lat, lon, value in samples:
        d = max(distance_m(point[0], point[1], lat, lon), min_distance_m)
        w = 1 / d**power
        weight_sum += w
        value_sum += w * value
    return value_sum / weight_sum if weight_sum else None
