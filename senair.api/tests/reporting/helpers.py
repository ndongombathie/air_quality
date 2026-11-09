from datetime import timedelta

from django.utils import timezone

from senair.alerts.models import Alert
from senair.common.domain import aqi_level
from senair.measurements.models import Reading


def reading(station_id: str, aqi: float, ago: timedelta = timedelta(minutes=5), **fields) -> Reading:
    return Reading.objects.create(
        station_id=station_id,
        observed_at=timezone.now() - ago,
        message_format="test",
        pm25=aqi * 0.15,
        aqi=aqi,
        aqi_level=aqi_level(aqi),
        dominant_pollutant="pm25",
        **fields,
    )


def alert(station_id: str | None, severity: str = "unhealthy", status: str = "active", ago: timedelta = timedelta(hours=1)) -> Alert:
    started = timezone.now() - ago
    return Alert.objects.create(
        severity=severity,
        status=status,
        pollutant="pm25",
        value=80,
        unit="µg/m³",
        threshold_value=15,
        reference="WHO_2021",
        station_id=station_id,
        title="Pic de particules fines",
        message="Dépassement",
        started_at=started,
        last_exceeded_at=started,
    )
