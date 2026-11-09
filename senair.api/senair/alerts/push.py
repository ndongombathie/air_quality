"""
Notifications push des nouvelles alertes via l'API Expo (docs/08 §4).

Destinataires : comptes actifs avec `pushEnabled`, sévérité au moins égale à `minLevel`, polluant suivi, zone suivie
(zones des préférences, sinon zones du profil, sinon toutes) et hors heures calmes (heure UTC, celle de Thiès).
Une `NotificationDelivery` par alerte et par appareil empêche tout doublon. L'envoi n'échoue jamais vers l'appelant.
"""

import json
import logging
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime
from itertools import islice

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone

from senair.accounts.models import Device, User
from senair.accounts.services import effective_preferences, in_quiet_hours
from senair.common.domain import AQI_LEVEL_LABELS, FORMULAS, level_rank

from .models import Alert, NotificationDelivery

logger = logging.getLogger("senair.push")

BATCH_SIZE = 100  # limite de l'API Expo par requête
TIMEOUT_SECONDS = 10
EXPO_TOKEN_PREFIXES = ("ExponentPushToken[", "ExpoPushToken[")

Transport = Callable[[str, list[dict]], list[dict]]


def expo_transport(url: str, messages: list[dict]) -> list[dict]:
    """POST JSON vers Expo ; retourne les tickets (un par message, dans le même ordre)."""
    if not url.startswith(("https://", "http://")):
        raise ValueError("EXPO_PUSH_URL doit être une URL http(s).")
    request = urllib.request.Request(  # noqa: S310 (schéma vérifié ci-dessus)
        url,
        data=json.dumps(messages).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
        return json.loads(response.read().decode()).get("data", [])


# Remplaçable dans les tests (faux transport injecté) : aucun appel réseau réel.
transport: Transport = expo_transport


def push_body(alert: Alert) -> str:
    unit = alert.unit
    return (
        f"{AQI_LEVEL_LABELS.get(alert.severity, alert.severity)} : {FORMULAS.get(alert.pollutant, alert.pollutant)} "
        f"{_number(alert.value)} {unit} (seuil {_number(alert.threshold_value)} {unit}). Ouvrez l'alerte pour les recommandations."
    )


def _number(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def _chunks(items: list, size: int):
    iterator = iter(items)
    while chunk := list(islice(iterator, size)):
        yield chunk


def recipients(alert: Alert, now: datetime | None = None) -> tuple[list[tuple[User, Device]], list[tuple[User, Device]]]:
    """(à notifier, en heures calmes) : couples utilisateur et appareil valides selon les préférences."""
    users = (
        User.objects.filter(status=User.Status.ACTIVE, devices__invalid_at__isnull=True)
        .distinct()
        .select_related("notification_preferences")
        .prefetch_related(
            "zones", "notification_preferences__zones", Prefetch("devices", queryset=Device.objects.filter(invalid_at__isnull=True))
        )
    )
    moment = (now or timezone.now()).astimezone(UTC).time()
    send, quiet = [], []
    for user in users:
        prefs = effective_preferences(user)
        if not prefs.push_enabled or level_rank(alert.severity) < level_rank(prefs.min_level):
            continue
        if alert.pollutant not in prefs.pollutants:
            continue
        if prefs.zone_ids and alert.zone_id not in prefs.zone_ids:
            continue
        target = quiet if in_quiet_hours(prefs.quiet_hours, moment) else send
        target.extend((user, device) for device in user.devices.all())
    return send, quiet


def notify_new_alert(alert_id, push_transport: Transport | None = None, now: datetime | None = None) -> list[NotificationDelivery]:
    try:
        return _notify(alert_id, push_transport or transport, now)
    except Exception:
        logger.exception("Notifications push de l'alerte %s non envoyées", alert_id)
        return []


def _notify(alert_id, push_transport: Transport, now: datetime | None) -> list[NotificationDelivery]:
    alert = Alert.objects.select_related("station", "zone").filter(pk=alert_id).first()
    if alert is None:
        return []
    already = set(NotificationDelivery.objects.filter(alert=alert).values_list("device_token", flat=True))
    send, quiet = recipients(alert, now)
    send = [(u, d) for u, d in send if d.token not in already]
    quiet = [(u, d) for u, d in quiet if d.token not in already]

    deliveries = [
        NotificationDelivery(alert=alert, user=u, device_token=d.token, status=NotificationDelivery.Status.SKIPPED, detail="Heures calmes")
        for u, d in quiet
    ]
    if not settings.SENAIR["PUSH_ENABLED"]:
        deliveries += [
            NotificationDelivery(
                alert=alert,
                user=u,
                device_token=d.token,
                status=NotificationDelivery.Status.SKIPPED,
                detail="Push désactivé (PUSH_ENABLED)",
            )
            for u, d in send
        ]
        send = []

    expo = [(u, d) for u, d in send if d.token.startswith(EXPO_TOKEN_PREFIXES)]
    deliveries += [
        NotificationDelivery(alert=alert, user=u, device_token=d.token, status=NotificationDelivery.Status.FAILED, detail="Jeton non Expo")
        for u, d in send
        if not d.token.startswith(EXPO_TOKEN_PREFIXES)
    ]
    invalid_tokens: list[str] = []
    for chunk in _chunks(expo, BATCH_SIZE):
        messages = [
            {
                "to": d.token,
                "title": alert.title,
                "body": push_body(alert),
                "data": {"alertId": str(alert.pk)},
                "sound": "default",
                "priority": "high",
            }
            for _, d in chunk
        ]
        try:
            tickets = push_transport(settings.SENAIR["EXPO_PUSH_URL"], messages)
        except Exception as error:  # panne réseau ou réponse illisible : on trace, l'ingestion continue
            logger.warning("Envoi Expo impossible pour l'alerte %s : %s", alert.pk, error)
            tickets = [{"status": "error", "message": "Erreur de transport"}] * len(chunk)
        for index, (user, device) in enumerate(chunk):
            ticket = (
                tickets[index]
                if index < len(tickets) and isinstance(tickets[index], dict)
                else {"status": "error", "message": "Ticket absent"}
            )
            if ticket.get("status") == "ok":
                deliveries.append(
                    NotificationDelivery(
                        alert=alert,
                        user=user,
                        device_token=device.token,
                        status=NotificationDelivery.Status.SENT,
                        detail=str(ticket.get("id", ""))[:255],
                    )
                )
                continue
            error_code = (ticket.get("details") or {}).get("error", "")
            if error_code == "DeviceNotRegistered":
                invalid_tokens.append(device.token)
            deliveries.append(
                NotificationDelivery(
                    alert=alert,
                    user=user,
                    device_token=device.token,
                    status=NotificationDelivery.Status.FAILED,
                    detail=(error_code or str(ticket.get("message", "Erreur")))[:255],
                )
            )

    if invalid_tokens:
        Device.objects.filter(token__in=invalid_tokens).update(invalid_at=timezone.now())
    NotificationDelivery.objects.bulk_create(deliveries, ignore_conflicts=True)
    return deliveries
