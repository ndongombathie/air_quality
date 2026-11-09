"""Indicateurs du tableau de bord (D1), calculés sur les données réelles."""

from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from senair.accounts.models import User
from senair.alerts.models import Alert
from senair.common.domain import aqi_level, freshness, iso
from senair.content.models import Article
from senair.measurements.queries import latest_readings
from senair.network.models import DataSource, Station

ALERT_LEVELS = ("moderate", "unhealthy_sensitive", "unhealthy", "very_unhealthy", "hazardous")
TOP_ZONES = 5


def _counts(queryset, field: str) -> dict[str, int]:
    return {row[field]: row["n"] for row in queryset.values(field).annotate(n=Count("pk")).order_by()}


def top_zones(stations: list[Station], latest: dict, limit: int = TOP_ZONES) -> list[dict]:
    """IQA de zone = max des stations de la zone (dernière mesure), zones les plus exposées d'abord."""
    worst: dict[str, tuple[Station, object]] = {}
    for station in stations:
        reading = latest.get(station.id)
        if reading is None or reading.aqi is None:
            continue
        current = worst.get(station.zone_id)
        if current is None or reading.aqi > current[1].aqi:
            worst[station.zone_id] = (station, reading)
    ranked = sorted(worst.values(), key=lambda pair: pair[1].aqi, reverse=True)[:limit]
    return [
        {
            "zone_id": station.zone_id,
            "zone_name": station.zone.name,
            "aqi": reading.aqi,
            "level": reading.aqi_level or aqi_level(reading.aqi),
            "dominant_pollutant": reading.dominant_pollutant,
        }
        for station, reading in ranked
    ]


def dashboard() -> dict:
    now = timezone.now()
    stations = list(Station.objects.select_related("zone"))
    online = [s for s in stations if s.status == Station.Status.ONLINE]
    latest = latest_readings([s.id for s in online])

    # IQA ville = max des stations en ligne dont la dernière mesure a moins de 2 h ;
    # IQA max = max des dernières mesures des stations en ligne, quelle que soit leur fraîcheur.
    # Les zones classées suivent la même règle que l'IQA ville.
    all_values = [r.aqi for r in latest.values() if r.aqi is not None]
    recent = {sid: r for sid, r in latest.items() if r.aqi is not None and freshness(r.observed_at, now) in ("fresh", "stale")}
    city_aqi = max(r.aqi for r in recent.values()) if recent else None

    station_counts = _counts(Station.objects.all(), "status")
    alert_counts = _counts(Alert.objects.all(), "status")
    open_by_level = _counts(Alert.objects.exclude(status=Alert.Status.RESOLVED), "severity")
    article_counts = _counts(Article.objects.all(), "status")
    source_counts = _counts(DataSource.objects.all(), "status")

    return {
        "generated_at": iso(now),
        "city_aqi": city_aqi,
        "city_level": aqi_level(city_aqi),
        "max_aqi": max(all_values) if all_values else None,
        "stations": {
            "total": len(stations),
            "online": station_counts.get(Station.Status.ONLINE, 0),
            "offline": station_counts.get(Station.Status.OFFLINE, 0),
            "maintenance": station_counts.get(Station.Status.MAINTENANCE, 0),
        },
        "alerts": {
            "active": alert_counts.get(Alert.Status.ACTIVE, 0),
            "acknowledged": alert_counts.get(Alert.Status.ACKNOWLEDGED, 0),
            "last24h": Alert.objects.filter(started_at__gte=now - timedelta(hours=24)).count(),
            "by_level": [{"level": level, "count": open_by_level.get(level, 0)} for level in ALERT_LEVELS],
        },
        "articles": {
            "published": article_counts.get(Article.Status.PUBLISHED, 0),
            "drafts": article_counts.get(Article.Status.DRAFT, 0),
        },
        "users": {
            "total": User.objects.count(),
            "new_last7d": User.objects.filter(created_at__gte=now - timedelta(days=7)).count(),
        },
        "top_zones": top_zones(online, recent),
        "data_sources": {
            "healthy": source_counts.get(DataSource.Status.HEALTHY, 0),
            "degraded": source_counts.get(DataSource.Status.DEGRADED, 0),
            "down": source_counts.get(DataSource.Status.DOWN, 0),
        },
    }
