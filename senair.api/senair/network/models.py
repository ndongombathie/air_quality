"""Référentiel du réseau : zones (quartiers), stations, sources de données du pipeline."""

import uuid

from django.db import models


class Zone(models.Model):
    id = models.SlugField(primary_key=True, max_length=80)
    name = models.CharField(max_length=120)
    centroid_latitude = models.FloatField()
    centroid_longitude = models.FloatField()
    # GeoJSON Polygon/MultiPolygon facultatif (contour du quartier).
    geometry = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Station(models.Model):
    class Type(models.TextChoices):
        INDUSTRIAL = "industrial", "Industrielle"
        RESIDENTIAL = "residential", "Résidentielle"
        ROAD = "road", "Trafic routier"
        REFERENCE = "reference", "Référence"

    class Status(models.TextChoices):
        ONLINE = "online", "En ligne"
        OFFLINE = "offline", "Hors ligne"
        MAINTENANCE = "maintenance", "Maintenance"

    # Identifiant SEN-AIR stable (pour AirGradient : le location_id, compatible avec les données existantes).
    id = models.CharField(primary_key=True, max_length=64)
    external_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    provider = models.CharField(max_length=60, default="AirGradient")
    name = models.CharField(max_length=160)
    short_name = models.CharField(max_length=60)
    zone = models.ForeignKey(Zone, on_delete=models.PROTECT, related_name="stations")
    latitude = models.FloatField()
    longitude = models.FloatField()
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.RESIDENTIAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ONLINE)
    # Mis à jour à chaque mesure ingérée (horodatage capteur, jamais l'heure d'insertion).
    last_observed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @staticmethod
    def new_id() -> str:
        return f"st-{uuid.uuid4().hex[:10]}"


class DataSource(models.Model):
    class Kind(models.TextChoices):
        SENSOR_NETWORK = "sensor_network", "Réseau de capteurs"
        WEATHER_API = "weather_api", "API météo"
        SATELLITE = "satellite", "Satellite"
        DATASET = "dataset", "Jeu de données"

    class Status(models.TextChoices):
        HEALTHY = "healthy", "Opérationnelle"
        DEGRADED = "degraded", "Dégradée"
        DOWN = "down", "En panne"
        DISABLED = "disabled", "Désactivée"

    id = models.SlugField(primary_key=True, max_length=60)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.HEALTHY)
    enabled = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")
    last_sync_at = models.DateTimeField(null=True, blank=True)
    # Compteurs glissants 24 h alimentés par l'ingestion (messages acceptés / rejetés).
    accepted_24h = models.PositiveIntegerField(default=0)
    rejected_24h = models.PositiveIntegerField(default=0)
    counters_reset_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def rejection_rate_24h(self) -> float | None:
        total = self.accepted_24h + self.rejected_24h
        return round(self.rejected_24h / total, 4) if total else None
