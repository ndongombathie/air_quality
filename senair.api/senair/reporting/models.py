"""Rapports générés, fréquentation (anonymisée) et journal d'audit des actions d'administration."""

import uuid

from django.conf import settings
from django.db import models


class Report(models.Model):
    class Period(models.TextChoices):
        WEEKLY = "weekly", "Hebdomadaire"
        MONTHLY = "monthly", "Mensuel"
        CUSTOM = "custom", "Personnalisé"

    class Status(models.TextChoices):
        QUEUED = "queued", "En attente"
        RUNNING = "running", "En cours"
        READY = "ready", "Prêt"
        FAILED = "failed", "Échec"

    class Format(models.TextChoices):
        PDF = "pdf", "PDF"
        CSV = "csv", "CSV"
        JSON = "json", "JSON"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period = models.CharField(max_length=8, choices=Period.choices)
    date_from = models.DateTimeField()
    date_to = models.DateTimeField()
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.QUEUED)
    format = models.CharField(max_length=4, choices=Format.choices)
    file = models.FileField(upload_to="reports/%Y/%m/", null=True, blank=True)
    file_name = models.CharField(max_length=200, null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class UsageVisit(models.Model):
    """Une ligne par visiteur et par jour et plateforme. Le visiteur est un hachage salé quotidien : aucune IP stockée."""

    day = models.DateField()
    platform = models.CharField(max_length=10)
    visitor_hash = models.CharField(max_length=64)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    requests = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["day", "platform", "visitor_hash"], name="unique_daily_visit")]
        indexes = [models.Index(fields=["day"])]


class AuditLogEntry(models.Model):
    """Traçabilité (CDC §2.2) : toute écriture d'administration, avec auteur, horodatage et valeurs avant / après."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    actor_email = models.EmailField()
    action = models.CharField(max_length=60)
    resource = models.CharField(max_length=40)
    resource_id = models.CharField(max_length=80, null=True, blank=True)
    changes = models.JSONField(null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    request_id = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["-at"]
