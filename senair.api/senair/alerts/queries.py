"""Filtres communs des listes d'alertes (P12, C8, D9) : listes séparées par des virgules, zone, période."""

from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone

from senair.common.domain import AQI_LEVEL_IDS, POLLUTANT_CODES
from senair.common.exceptions import validation_error

from .models import Alert, AlertReceipt


def _csv(params, name: str, allowed, errors: dict) -> list[str]:
    values = [item.strip() for item in params.get(name, "").split(",") if item.strip()]
    if any(value not in allowed for value in values):
        errors[name] = f"Valeurs possibles : {', '.join(allowed)}."
    return values


def _datetime(params, name: str, errors: dict) -> datetime | None:
    raw = params.get(name)
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace(" ", "+"))  # « + » d'un fuseau décodé en espace dans l'URL
    except ValueError:
        errors[name] = "Date ISO-8601 attendue."
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def recent(alerts: QuerySet) -> QuerySet:
    """
    Alertes des ALERT_HISTORY_DAYS derniers jours. Une alerte ouverte plus ancienne reste visible tant qu'une mesure
    la confirme ; celle d'une station qui n'émet plus (aucune confirmation depuis la même durée) disparaît.
    """
    cutoff = timezone.now() - timedelta(days=settings.SENAIR["ALERT_HISTORY_DAYS"])
    return alerts.filter(Q(started_at__gte=cutoff) | (~Q(status=Alert.Status.RESOLVED) & Q(last_exceeded_at__gte=cutoff)))


def for_user(alerts: QuerySet, user) -> QuerySet:
    """Ajoute l'état lu et retire les alertes que l'utilisateur a supprimées de sa liste."""
    receipts = AlertReceipt.objects.filter(user=user, alert=OuterRef("pk"))
    return alerts.exclude(Exists(receipts.filter(dismissed_at__isnull=False))).annotate(
        is_read=Exists(receipts.filter(read_at__isnull=False))
    )


def filter_alerts(request, alerts: QuerySet | None = None) -> QuerySet:
    params = request.query_params
    errors: dict[str, str] = {}
    statuses = _csv(params, "status", Alert.Status.values, errors)
    severities = _csv(params, "severity", AQI_LEVEL_IDS, errors)
    pollutants = _csv(params, "pollutant", POLLUTANT_CODES, errors)
    date_from = _datetime(params, "from", errors)
    date_to = _datetime(params, "to", errors)
    if date_from and date_to and date_from > date_to:
        errors["to"] = "La date de fin doit suivre la date de début."
    if errors:
        raise validation_error(errors)

    alerts = (alerts if alerts is not None else Alert.objects.all()).select_related("station", "zone", "handled_by")
    if statuses:
        alerts = alerts.filter(status__in=statuses)
    if severities:
        alerts = alerts.filter(severity__in=severities)
    if pollutants:
        alerts = alerts.filter(pollutant__in=pollutants)
    if zone_id := params.get("zoneId"):
        alerts = alerts.filter(zone_id=zone_id)
    if date_from:
        alerts = alerts.filter(started_at__gte=date_from)
    if date_to:
        alerts = alerts.filter(started_at__lte=date_to)
    return alerts.order_by("-started_at", "-pk")
