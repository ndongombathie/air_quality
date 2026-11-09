"""
Moteur d'alertes : appelé par l'ingestion après chaque mesure enregistrée.

Règles :
1. Seuils applicables : seuils actifs des polluants présents dans la mesure. Pour un même polluant, référentiel et période,
   un seuil propre à la zone de la station remplace le seuil ville. Les seuils annuels (`1y`) ne déclenchent pas d'alerte
   en temps réel (ils relèvent des rapports).
2. Valeur comparée : moyenne glissante arithmétique des mesures de la station pour ce polluant sur la période du seuil,
   fenêtre ]observed_at - période, observed_at] (mesure courante incluse, mesures sans valeur ignorées, aucune exigence
   de complétude : au démarrage, la moyenne porte sur les seules mesures disponibles). Dépassement : moyenne > seuil.
3. Sévérité : `alert_level` du seuil, rehaussée au niveau IQA du polluant dans la mesure (sous-indice) s'il est plus grave.
   Si plusieurs périodes sont dépassées pour un même polluant et référentiel, on retient la plus grave, puis le plus fort
   rapport valeur / seuil.
4. Une seule alerte ouverte (active ou acquittée) par station, polluant et référentiel : mise à jour ou création.
5. Résolution automatique quand plus aucune période n'est dépassée (ou que le seuil a été désactivé). Une mesure plus
   ancienne que le dernier dépassement confirmé (arrivée dans le désordre) ne modifie pas l'alerte.
6. Robustesse : aucune exception ne remonte vers l'ingestion (journalisation).
7. Push à la création, après validation de la transaction (voir push.py).
"""

import logging
from collections import defaultdict
from datetime import timedelta
from functools import partial

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from senair.common.domain import (
    AQI_LEVEL_LABELS,
    FORMULAS,
    PERIODS,
    POLLUTANT_CODES,
    POLLUTANT_NAMES,
    REFERENCES,
    UNITS,
    aqi_level,
    level_rank,
    sub_index,
)
from senair.measurements.models import Reading

from .models import Alert, HealthGuidance, Threshold

logger = logging.getLogger("senair.alerts")

WINDOWS = {"1h": timedelta(hours=1), "8h": timedelta(hours=8), "24h": timedelta(hours=24)}
OPEN_STATUSES = (Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED)
REFERENCE_SHORT = {"WHO_2021": "OMS", "NS_05_062": "NS 05-062"}
REFERENCE_LABELS = dict(REFERENCES)
PERIOD_LABELS = dict(PERIODS)


def evaluate_reading(reading: Reading) -> list[Alert]:
    """
    Compare la mesure aux seuils actifs (seuil de zone prioritaire sur le seuil ville), crée ou met à jour
    les alertes, résout celles qui ne sont plus dépassées et déclenche les notifications push.
    Retourne les alertes créées. Ne doit jamais lever d'exception vers l'ingestion.
    """
    try:
        return _evaluate(reading)
    except Exception:
        logger.exception("Évaluation des seuils impossible pour la mesure %s", getattr(reading, "pk", None))
        return []


def _evaluate(reading: Reading) -> list[Alert]:
    station = reading.station
    measured = {code: getattr(reading, code) for code in POLLUTANT_CODES if getattr(reading, code) is not None}
    if not measured:
        return []

    grouped: dict[tuple[str, str], list[Threshold]] = defaultdict(list)
    for threshold in applicable_thresholds(station.zone_id, measured):
        grouped[(threshold.pollutant, threshold.reference)].append(threshold)

    created: list[Alert] = []
    still_exceeded: set[tuple[str, str]] = set()
    for key, thresholds in grouped.items():
        try:
            with transaction.atomic():
                outcome = _evaluate_key(reading, station, key, thresholds, measured[key[0]])
        except Exception:
            logger.exception("Évaluation %s/%s impossible pour la station %s", *key, station.pk)
            still_exceeded.add(key)  # en cas d'erreur, on ne résout rien par précaution
            continue
        if outcome is not None:
            alert, is_new = outcome
            still_exceeded.add(key)
            if is_new:
                created.append(alert)

    _resolve(reading, station, measured, still_exceeded)

    for alert in created:
        transaction.on_commit(partial(_notify, alert.pk), robust=True)
    return created


def applicable_thresholds(zone_id: str | None, pollutants) -> list[Threshold]:
    """Seuils actifs ; pour une même clé (polluant, référentiel, période), le seuil de zone l'emporte sur le seuil ville."""
    candidates = (
        Threshold.objects.filter(enabled=True, pollutant__in=list(pollutants), period__in=list(WINDOWS))
        .filter(Q(zone__isnull=True) | Q(zone_id=zone_id))
        .order_by("updated_at")
    )
    chosen: dict[tuple[str, str, str], Threshold] = {}
    for threshold in candidates:
        key = (threshold.pollutant, threshold.reference, threshold.period)
        current = chosen.get(key)
        if current is not None and current.zone_id is not None and threshold.zone_id is None:
            continue
        chosen[key] = threshold
    return list(chosen.values())


def rolling_average(reading: Reading, pollutant: str, period: str) -> float | None:
    """Moyenne des valeurs de la station sur ]observed_at - période, observed_at], mesure courante incluse."""
    window_start = reading.observed_at - WINDOWS[period]
    values = list(
        Reading.objects.filter(station_id=reading.station_id, observed_at__gt=window_start, observed_at__lte=reading.observed_at)
        .exclude(pk=reading.pk)
        .exclude(**{f"{pollutant}__isnull": True})
        .values_list(pollutant, flat=True)
    )
    current = getattr(reading, pollutant)
    if current is not None:
        values.append(current)
    return sum(values) / len(values) if values else None


def severity_for(threshold: Threshold, pollutant: str, instant_value: float) -> str:
    level = threshold.alert_level
    measured_level = aqi_level(sub_index(pollutant, instant_value))
    if measured_level and level_rank(measured_level) > level_rank(level):
        return measured_level
    return level


def _evaluate_key(reading, station, key, thresholds, instant_value) -> tuple[Alert, bool] | None:
    pollutant, reference = key
    exceeded = []
    for threshold in thresholds:
        average = rolling_average(reading, pollutant, threshold.period)
        if average is not None and average > threshold.value:
            exceeded.append((threshold, average, severity_for(threshold, pollutant, instant_value)))
    if not exceeded:
        return None
    threshold, average, severity = max(exceeded, key=lambda item: (level_rank(item[2]), item[1] / item[0].value))

    alert = (
        Alert.objects.select_for_update()
        .filter(origin=Alert.Origin.SENSOR, station=station, pollutant=pollutant, reference=reference, status__in=OPEN_STATUSES)
        .order_by("-started_at")
        .first()
    )
    if alert is not None and reading.observed_at < alert.last_exceeded_at:
        return alert, False  # mesure arrivée en retard : l'état le plus récent fait foi
    if alert is not None and reading.observed_at - alert.last_exceeded_at > timedelta(hours=settings.SENAIR["ALERT_GAP_HOURS"]):
        # Station restée muette : l'ancien épisode se termine à sa dernière confirmation, un nouvel épisode commence.
        alert.status = Alert.Status.RESOLVED
        alert.resolved_at = alert.last_exceeded_at
        alert.save(update_fields=["status", "resolved_at"])
        alert = None

    fields = {
        "severity": severity,
        "value": round(average, 2),
        "unit": threshold.unit,
        "threshold_value": threshold.value,
        "threshold": threshold,
        "zone_id": station.zone_id,
        "title": alert_title(pollutant, reference, station),
        "message": alert_message(pollutant, threshold, average, severity, station),
        "recommendations": recommendations_for(severity),
        "last_exceeded_at": reading.observed_at,
    }
    if alert is not None:
        for name, value in fields.items():
            setattr(alert, name, value)
        alert.save()
        return alert, False
    alert = Alert.objects.create(
        status=Alert.Status.ACTIVE, pollutant=pollutant, reference=reference, station=station, started_at=reading.observed_at, **fields
    )
    return alert, True


def _resolve(reading, station, measured, still_exceeded) -> None:
    for alert in Alert.objects.filter(origin=Alert.Origin.SENSOR, station=station, pollutant__in=list(measured), status__in=OPEN_STATUSES):
        if (alert.pollutant, alert.reference) in still_exceeded or reading.observed_at < alert.last_exceeded_at:
            continue
        alert.status = Alert.Status.RESOLVED
        alert.resolved_at = reading.observed_at
        alert.save(update_fields=["status", "resolved_at"])


def create_manual_alert(data: dict, user) -> Alert:
    """Alerte publiée par une autorité ou un administrateur ; les abonnés de la zone sont notifiés après validation."""
    pollutant, severity = data["pollutant"], data["severity"]
    threshold = (
        Threshold.objects.filter(enabled=True, pollutant=pollutant)
        .filter(Q(zone__isnull=True) | Q(zone_id=data["zone_id"]))
        .order_by("-zone_id", "value")
        .first()
    )
    threshold_value = threshold.value if threshold else (data.get("value") or 0)
    now = timezone.now()
    alert = Alert.objects.create(
        origin=Alert.Origin.MANUAL,
        created_by=user,
        status=Alert.Status.ACTIVE,
        severity=severity,
        pollutant=pollutant,
        value=data.get("value") if data.get("value") is not None else threshold_value,
        unit=threshold.unit if threshold else UNITS[pollutant],
        threshold_value=threshold_value,
        reference=threshold.reference if threshold else "WHO_2021",
        threshold=threshold,
        station_id=data.get("station_id"),
        zone_id=data["zone_id"],
        title=data["title"],
        message=data["message"],
        recommendations=data.get("recommendations") or recommendations_for(severity),
        started_at=now,
        last_exceeded_at=now,
    )
    transaction.on_commit(partial(_notify, alert.pk), robust=True)
    return alert


def _notify(alert_id) -> None:
    from .push import notify_new_alert

    notify_new_alert(alert_id)


# ─────────────── Textes ───────────────


def _number(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def alert_title(pollutant: str, reference: str, station) -> str:
    return f"{FORMULAS[pollutant]} au-dessus du seuil {REFERENCE_SHORT[reference]} à {station.name}"[:200]


def alert_message(pollutant: str, threshold: Threshold, average: float, severity: str, station) -> str:
    unit = threshold.unit
    zone = f" ({station.zone.name})" if station.zone_id else ""
    return (
        f"La concentration moyenne en {POLLUTANT_NAMES[pollutant]} ({FORMULAS[pollutant]}) sur {PERIOD_LABELS[threshold.period]} "
        f"atteint {_number(average)} {unit} à la station {station.name}{zone}, au-dessus du seuil {REFERENCE_LABELS[threshold.reference]} "
        f"de {_number(threshold.value)} {unit}. Niveau : {AQI_LEVEL_LABELS[severity]}."
    )


def recommendations_for(severity: str) -> list[str]:
    guidance = HealthGuidance.objects.filter(profile="general", level=severity).first()
    return list(guidance.actions) if guidance else []
