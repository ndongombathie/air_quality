"""Seuils d'alerte (OMS 2021, NS 05-062), alertes sanitaires, recommandations par profil, notifications envoyées."""

import uuid

from django.conf import settings
from django.db import models

from senair.common.domain import AQI_LEVEL_CHOICES, HEALTH_PROFILES, PERIODS, POLLUTANT_CHOICES, REFERENCES, UNIT_CHOICES
from senair.network.models import Station, Zone


class Threshold(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pollutant = models.CharField(max_length=8, choices=POLLUTANT_CHOICES)
    reference = models.CharField(max_length=12, choices=REFERENCES)
    period = models.CharField(max_length=4, choices=PERIODS)
    value = models.FloatField()
    unit = models.CharField(max_length=8, choices=UNIT_CHOICES)
    # Null : seuil global ville ; sinon seuil propre à une zone (prioritaire).
    zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.CASCADE, related_name="thresholds")
    alert_level = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["pollutant", "reference", "period"]


class Alert(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "En cours"
        ACKNOWLEDGED = "acknowledged", "Prise en charge"
        RESOLVED = "resolved", "Résolue"

    class Origin(models.TextChoices):
        SENSOR = "sensor", "Mesure"
        MANUAL = "manual", "Publiée manuellement"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Une alerte manuelle n'est jamais modifiée ni résolue par le moteur d'évaluation des mesures.
    origin = models.CharField(max_length=8, choices=Origin.choices, default=Origin.SENSOR)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    severity = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.ACTIVE)
    pollutant = models.CharField(max_length=8, choices=POLLUTANT_CHOICES)
    value = models.FloatField()
    unit = models.CharField(max_length=8, choices=UNIT_CHOICES)
    threshold_value = models.FloatField()
    reference = models.CharField(max_length=12, choices=REFERENCES)
    threshold = models.ForeignKey(Threshold, null=True, blank=True, on_delete=models.SET_NULL, related_name="alerts")
    station = models.ForeignKey(Station, null=True, blank=True, on_delete=models.SET_NULL, related_name="alerts")
    zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.SET_NULL, related_name="alerts")
    title = models.CharField(max_length=200)
    message = models.TextField()
    recommendations = models.JSONField(default=list)
    started_at = models.DateTimeField()
    # Dernière mesure ayant confirmé le dépassement (sert à la résolution automatique).
    last_exceeded_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    # Réservés au back-office (jamais exposés sur les routes publiques).
    incident_note = models.TextField(null=True, blank=True)
    handled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["status", "-started_at"]), models.Index(fields=["zone", "-started_at"])]


class AlertReceipt(models.Model):
    """État d'une alerte pour un utilisateur, comme une notification : lue, ou retirée de sa liste."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alert_receipts")
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE, related_name="receipts")
    read_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "alert"], name="one_receipt_per_user_alert")]


class HealthGuidance(models.Model):
    profile = models.CharField(max_length=20, choices=[(p, p) for p in HEALTH_PROFILES])
    level = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES)
    title = models.CharField(max_length=160)
    actions = models.JSONField(default=list)

    class Meta:
        ordering = ["profile", "level"]
        constraints = [models.UniqueConstraint(fields=["profile", "level"], name="unique_guidance")]


class NotificationDelivery(models.Model):
    """Trace des notifications push envoyées (une par alerte et par appareil) : évite les doublons."""

    class Status(models.TextChoices):
        SENT = "sent", "Envoyée"
        FAILED = "failed", "Échec"
        SKIPPED = "skipped", "Non envoyée (préférences, heures calmes)"

    alert = models.ForeignKey(Alert, on_delete=models.CASCADE, related_name="deliveries")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    device_token = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=Status.choices)
    detail = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["alert", "device_token"], name="one_push_per_alert_device")]
