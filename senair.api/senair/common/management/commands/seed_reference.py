"""Charge les données de référence (stations, zones, sources, seuils, conseils santé, modèles connus). Idempotent."""

from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from senair.alerts.models import HealthGuidance, Threshold
from senair.common import reference_data as ref
from senair.common.domain import AQI_LEVEL_IDS, HEALTH_PROFILES
from senair.forecasts.models import AiModel
from senair.network.models import DataSource, Station, Zone


class Command(BaseCommand):
    help = "Charge ou met à jour les données de référence SEN-AIR."

    @transaction.atomic
    def handle(self, *args, **options):
        for station_id, name, short, zone_name, lat, lon, kind in ref.STATIONS:
            zone, _ = Zone.objects.update_or_create(
                id=slugify(zone_name), defaults={"name": zone_name, "centroid_latitude": lat, "centroid_longitude": lon}
            )
            Station.objects.update_or_create(
                id=station_id,
                defaults={
                    "external_id": station_id,
                    "provider": "AirGradient",
                    "name": name,
                    "short_name": short,
                    "zone": zone,
                    "latitude": lat,
                    "longitude": lon,
                    "type": kind,
                },
            )

        for source_id, name, kind, enabled, description in ref.DATA_SOURCES:
            DataSource.objects.update_or_create(
                id=source_id,
                defaults={
                    "name": name,
                    "kind": kind,
                    "description": description,
                    "enabled": enabled,
                    **({} if enabled else {"status": DataSource.Status.DISABLED}),
                },
            )

        for pollutant, reference, period, value, unit, level in ref.THRESHOLDS:
            Threshold.objects.get_or_create(
                pollutant=pollutant,
                reference=reference,
                period=period,
                zone=None,
                defaults={"value": value, "unit": unit, "alert_level": level, "enabled": True},
            )

        for profile in HEALTH_PROFILES:
            for level in AQI_LEVEL_IDS:
                title, actions = ref.GUIDANCE_BY_LEVEL[level]
                extra = ref.PROFILE_EXTRA.get(profile) if level != "good" else None
                HealthGuidance.objects.update_or_create(
                    profile=profile, level=level, defaults={"title": title, "actions": [extra, *actions] if extra else actions}
                )

        knn = Path(settings.SENAIR["MODEL_INTERPOLATION_PATH"])
        if knn.is_file():
            AiModel.objects.update_or_create(
                id="knn-interpolation",
                defaults={
                    "name": "Interpolation spatiale (KNN, pipeline Airflow)",
                    "task": AiModel.Task.INTERPOLATION,
                    "algorithm": "KNeighborsRegressor (k=3, pondéré par la distance)",
                    "version": "airflow",
                    "trained_at": datetime.fromtimestamp(knn.stat().st_mtime, tz=UTC),
                    "artifact_uri": str(knn),
                    "signature": {"inputs": ["latitude", "longitude"], "outputs": ["iqr", "pm25", "pm10", "co2", "no2", "so2", "o3"]},
                },
            )
            AiModel.objects.filter(id="knn-interpolation", status=AiModel.Status.CANDIDATE).update(status=AiModel.Status.ACTIVE)

        self.stdout.write(
            self.style.SUCCESS(
                f"Référence : {Zone.objects.count()} zones, {Station.objects.count()} stations, {DataSource.objects.count()} sources, "
                f"{Threshold.objects.count()} seuils, {HealthGuidance.objects.count()} conseils, {AiModel.objects.count()} modèle(s)."
            )
        )
