"""Requêtes de lecture partagées sur les mesures."""

from collections.abc import Iterable

from django.db.models import Max

from .models import Reading


def latest_readings(station_ids: Iterable[str] | None = None) -> dict[str, Reading]:
    """Dernière mesure de chaque station (une requête pour les maxima, une pour les lignes)."""
    scope = Reading.objects.all()
    if station_ids is not None:
        scope = scope.filter(station_id__in=list(station_ids))
    maxima = scope.values("station_id").annotate(last=Max("observed_at"))
    pairs = {(row["station_id"], row["last"]) for row in maxima}
    if not pairs:
        return {}
    rows = Reading.objects.filter(station_id__in={s for s, _ in pairs}, observed_at__in={t for _, t in pairs})
    return {r.station_id: r for r in rows if (r.station_id, r.observed_at) in pairs}
