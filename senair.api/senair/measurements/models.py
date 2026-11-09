"""Mesures reçues du flux de données (pipeline de l'équipe data), une ligne par station et par horodatage capteur."""

from django.db import models

from senair.common.domain import AQI_LEVEL_CHOICES, POLLUTANT_CHOICES
from senair.network.models import Station


class Reading(models.Model):
    class Status(models.TextChoices):
        MEASURED = "measured", "Mesuré"
        ESTIMATED = "estimated", "Estimé"

    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name="readings")
    # Horodatage du capteur (« timestamp » AirGradient), jamais l'heure d'insertion.
    observed_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    # Format du message d'origine (adaptateur d'ingestion) et traçabilité Kafka.
    message_format = models.CharField(max_length=40)
    kafka_topic = models.CharField(max_length=120, blank=True, default="")
    kafka_partition = models.IntegerField(null=True, blank=True)
    kafka_offset = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.MEASURED)

    # Polluants de l'IQA (µg/m³, CO en mg/m³).
    pm25 = models.FloatField(null=True, blank=True)
    pm10 = models.FloatField(null=True, blank=True)
    no2 = models.FloatField(null=True, blank=True)
    so2 = models.FloatField(null=True, blank=True)
    co = models.FloatField(null=True, blank=True)
    o3 = models.FloatField(null=True, blank=True)
    # Grandeurs secondaires.
    co2 = models.FloatField(null=True, blank=True)
    tvoc = models.FloatField(null=True, blank=True)
    no = models.FloatField(null=True, blank=True)
    nh3 = models.FloatField(null=True, blank=True)
    # Météo.
    temperature_c = models.FloatField(null=True, blank=True)
    humidity_pct = models.FloatField(null=True, blank=True)
    wind_speed_ms = models.FloatField(null=True, blank=True)
    wind_direction_deg = models.FloatField(null=True, blank=True)
    pressure_hpa = models.FloatField(null=True, blank=True)
    precipitation_mm = models.FloatField(null=True, blank=True)
    # Provenance par variable : { "pm25": "sensor", "o3": "openweathermap", "temperature_c": "sensor", ... }.
    sources = models.JSONField(default=dict)

    # Calculé à l'ingestion par le backend (domain.compute_aqi).
    aqi = models.FloatField(null=True, blank=True)
    aqi_level = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES, null=True, blank=True)
    dominant_pollutant = models.CharField(max_length=8, choices=POLLUTANT_CHOICES, null=True, blank=True)
    # IQA transmis par le pipeline (colonne « iqr » historique), conservé pour comparaison.
    upstream_aqi = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-observed_at"]
        constraints = [
            # Le pipeline réinsère parfois la même mesure (même timestamp capteur) : une seule ligne.
            models.UniqueConstraint(fields=["station", "observed_at"], name="unique_reading_per_station_time"),
        ]
        indexes = [models.Index(fields=["station", "-observed_at"]), models.Index(fields=["-observed_at"])]

    def __str__(self) -> str:
        return f"{self.station_id} @ {self.observed_at:%Y-%m-%d %H:%M}"
