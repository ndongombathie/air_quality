from datetime import timedelta

import pytest
from django.core.management import call_command
from django.http import JsonResponse
from django.utils import timezone

from senair.common.camelcase import camelize
from senair.measurements.models import Reading
from senair.measurements.presenters import station_payload
from senair.network.models import Station
from tests.contract import assert_contract

pytestmark = pytest.mark.django_db


def test_station_with_latest_matches_contract():
    call_command("seed_reference", verbosity=0)
    station = Station.objects.get(id="168373")
    reading = Reading.objects.create(
        station=station,
        observed_at=timezone.now() - timedelta(minutes=5),
        message_format="test",
        pm25=20.5,
        pm10=None,
        o3=59.6,
        temperature_c=34.5,
        humidity_pct=52,
        aqi=137,
        aqi_level="unhealthy_sensitive",
        dominant_pollutant="pm25",
        sources={"pm25": "sensor", "pm10": "sensor", "o3": "openweathermap", "temperature_c": "sensor"},
    )
    payload = camelize([station_payload(station, reading, include_latest=True)])
    assert payload[0]["latest"]["measures"][1] == {"code": "pm10", "value": None, "unit": "µg/m³", "source": "sensor", "subIndex": None}
    assert_contract(JsonResponse(payload, safe=False), "get", "/stations?include=latest")
