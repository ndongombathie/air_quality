"""
Historiques (P6 station, P10 zone, P18 ville).
- raw : une mesure = un point ; hour / day : moyenne arithmétique des mesures du pas (UTC), IQA compris ;
- zone et ville : à chaque pas, IQA = max des stations et chaque grandeur = max des stations (règle de l'IQA
  zone/ville de la présentation, même agrégation que le mode démonstration du front).
"""

from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Avg, QuerySet
from django.db.models.functions import TruncDay, TruncHour

from senair.common.domain import MEASURE_CODES, iso

# Période maximale par granularité (protège la base et le client).
MAX_SPAN = {"raw": timedelta(days=31), "hour": timedelta(days=366), "day": timedelta(days=5 * 366)}
TRUNC = {"hour": TruncHour, "day": TruncDay}


def _round(value: float | None, digits: int) -> float | None:
    return None if value is None else round(value, digits)


def station_series(readings: QuerySet, granularity: str, codes: list[str]) -> dict[str, dict[datetime, dict]]:
    """{ station_id: { pas: { "aqi": x, "values": {code: v} } } } pour les mesures données."""
    series: dict[str, dict[datetime, dict]] = defaultdict(dict)
    if granularity == "raw":
        for row in readings.order_by("observed_at").values("station_id", "observed_at", "aqi", "sources", *codes):
            present = {code: row[code] for code in codes if row[code] is not None or code in row["sources"]}
            series[row["station_id"]][row["observed_at"]] = {"aqi": row["aqi"], "values": present}
        return series

    aggregates = {"aqi_avg": Avg("aqi"), **{f"{code}_avg": Avg(code) for code in codes}}
    rows = (
        readings.annotate(bucket=TRUNC[granularity]("observed_at")).values("station_id", "bucket").annotate(**aggregates).order_by("bucket")
    )
    for row in rows:
        series[row["station_id"]][row["bucket"]] = {
            "aqi": _round(row["aqi_avg"], 0),
            "values": {code: _round(row[f"{code}_avg"], 2) for code in codes if row[f"{code}_avg"] is not None},
        }
    return series


def points_for_station(series: dict[datetime, dict], codes: list[str], explicit: bool) -> list[dict]:
    points = []
    for at in sorted(series):
        values = series[at]["values"]
        if explicit:
            values = {code: values.get(code) for code in codes}
        points.append({"at": iso(at), "aqi": series[at]["aqi"], "values": values})
    return points


def points_max(all_series: dict[str, dict[datetime, dict]], codes: list[str], explicit: bool) -> list[dict]:
    buckets: dict[datetime, list[dict]] = defaultdict(list)
    for series in all_series.values():
        for at, point in series.items():
            buckets[at].append(point)
    points = []
    for at in sorted(buckets):
        group = buckets[at]
        aqis = [p["aqi"] for p in group if p["aqi"] is not None]
        values: dict[str, float | None] = {}
        for code in codes:
            known = [p["values"][code] for p in group if code in p["values"]]
            if known or explicit:
                numbers = [v for v in known if v is not None]
                values[code] = max(numbers) if numbers else None
        points.append({"at": iso(at), "aqi": max(aqis) if aqis else None, "values": values})
    return points


def build_history(
    scope: str, scope_id: str, readings: QuerySet, start: datetime, end: datetime, granularity: str, pollutants: list[str]
) -> dict:
    codes = pollutants or list(MEASURE_CODES)
    readings = readings.filter(observed_at__gte=start, observed_at__lte=end)
    series = station_series(readings, granularity, codes)
    explicit = bool(pollutants)
    if scope == "station":
        points = points_for_station(series.get(scope_id, {}), codes, explicit)
    else:
        points = points_max(series, codes, explicit)
    return {"scope": scope, "scope_id": scope_id, "granularity": granularity, "from": iso(start), "to": iso(end), "points": points}
