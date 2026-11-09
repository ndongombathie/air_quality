"""Modèles IA (registre) et prévisions produites par l'équipe data, reçues par le flux ou calculées par un modèle chargé."""

from django.db import models

from senair.common.domain import AQI_LEVEL_CHOICES, POLLUTANT_CHOICES


class AiModel(models.Model):
    class Task(models.TextChoices):
        FORECAST = "forecast", "Prévision"
        INTERPOLATION = "interpolation", "Interpolation spatiale"
        CLASSIFICATION = "classification", "Classification"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        CANDIDATE = "candidate", "Candidat"
        ARCHIVED = "archived", "Archivé"

    id = models.SlugField(primary_key=True, max_length=80)
    name = models.CharField(max_length=160)
    task = models.CharField(max_length=20, choices=Task.choices)
    algorithm = models.CharField(max_length=80)
    version = models.CharField(max_length=40)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CANDIDATE)
    r2 = models.FloatField(null=True, blank=True)
    rmse = models.FloatField(null=True, blank=True)
    mae = models.FloatField(null=True, blank=True)
    trained_at = models.DateTimeField()
    tracking_url = models.URLField(null=True, blank=True)
    # Fichier du modèle (chemin local, s3://, minio://) si le backend l'exécute lui-même ; vide si les
    # prédictions arrivent toutes calculées par le flux.
    artifact_uri = models.CharField(max_length=500, blank=True, default="")
    # Contrat d'entrée/sortie déclaré par l'équipe IA (colonnes attendues, cibles).
    signature = models.JSONField(default=dict, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["task", "-trained_at"]

    def __str__(self) -> str:
        return f"{self.name} {self.version}"


class ForecastRun(models.Model):
    """Un lot de prévisions pour une portée (ville, zone ou station), généré par un modèle à un instant donné."""

    class Scope(models.TextChoices):
        CITY = "city", "Ville"
        ZONE = "zone", "Zone"
        STATION = "station", "Station"

    scope = models.CharField(max_length=10, choices=Scope.choices)
    scope_id = models.CharField(max_length=80)
    model = models.ForeignKey(AiModel, on_delete=models.PROTECT, related_name="runs")
    generated_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [models.Index(fields=["scope", "scope_id", "-generated_at"])]
        constraints = [
            models.UniqueConstraint(fields=["scope", "scope_id", "model", "generated_at"], name="unique_forecast_run"),
        ]


class ForecastPoint(models.Model):
    run = models.ForeignKey(ForecastRun, on_delete=models.CASCADE, related_name="points")
    horizon = models.CharField(max_length=4)
    valid_at = models.DateTimeField()
    aqi = models.FloatField(null=True, blank=True)
    level = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES, null=True, blank=True)
    dominant_pollutant = models.CharField(max_length=8, choices=POLLUTANT_CHOICES, null=True, blank=True)
    values = models.JSONField(default=dict)
    # Fournis par le modèle, jamais calculés par l'API.
    confidence = models.FloatField(null=True, blank=True)
    interval_low = models.FloatField(null=True, blank=True)
    interval_high = models.FloatField(null=True, blank=True)
    drivers = models.JSONField(default=list)

    class Meta:
        ordering = ["valid_at"]
        constraints = [models.UniqueConstraint(fields=["run", "horizon"], name="unique_horizon_per_run")]


class InterpolationGrid(models.Model):
    """Grille estimée d'une couche (IQA ou polluant) reçue par le flux (topic senair.interpolations.v1)."""

    # Nombre de grilles conservées par couche : les plus anciennes sont supprimées à la réception.
    KEPT_PER_LAYER = 5

    model = models.ForeignKey(AiModel, on_delete=models.PROTECT, related_name="grids")
    model_version = models.CharField(max_length=40)
    layer = models.CharField(max_length=8)
    at = models.DateTimeField()
    resolution_m = models.PositiveIntegerField()
    method = models.CharField(max_length=20)
    # Liste de cellules { latitude, longitude, value, aqi, uncertainty }.
    cells = models.JSONField(default=list)
    message_id = models.CharField(max_length=80, blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]
        indexes = [models.Index(fields=["layer", "-at"])]
        constraints = [models.UniqueConstraint(fields=["model", "layer", "at"], name="unique_grid_per_model_layer_time")]
