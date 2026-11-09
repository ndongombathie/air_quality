"""Mesures vers JSON du contrat (AirQualitySnapshot, Measure, Weather, Station). Clés en snake_case : le rendu les convertit."""

from datetime import datetime

from senair.common.domain import MEASURE_CODES, UNITS, freshness, iso, sub_index
from senair.network.models import Station, Zone

from .models import Reading

WEATHER_FIELDS = ("temperature_c", "humidity_pct", "wind_speed_ms", "wind_direction_deg", "pressure_hpa", "precipitation_mm")


def measures(reading: Reading) -> list[dict]:
    out = []
    for code in MEASURE_CODES:
        value = getattr(reading, code)
        if value is None and code not in reading.sources:
            continue
        out.append(
            {
                "code": code,
                "value": value,
                "unit": UNITS[code],
                "source": reading.sources.get(code, "sensor"),
                "sub_index": sub_index(code, value),
            }
        )
    return out


def weather(reading: Reading) -> dict | None:
    if all(getattr(reading, field) is None for field in WEATHER_FIELDS):
        return None
    # « sensor » si la température/humidité viennent du capteur, sinon la source déclarée par le pipeline.
    source = "sensor" if reading.sources.get("temperature_c", "sensor") == "sensor" else "openweathermap"
    return {**{field: getattr(reading, field) for field in WEATHER_FIELDS}, "source": source, "observed_at": iso(reading.observed_at)}


def snapshot(reading: Reading | None, now: datetime | None = None) -> dict:
    if reading is None:
        return {
            "aqi": None,
            "level": None,
            "dominant_pollutant": None,
            "measures": [],
            "weather": None,
            "observed_at": None,
            "status": "measured",
            "freshness": "unknown",
        }
    return {
        "aqi": reading.aqi,
        "level": reading.aqi_level,
        "dominant_pollutant": reading.dominant_pollutant,
        "measures": measures(reading),
        "weather": weather(reading),
        "observed_at": iso(reading.observed_at),
        "status": reading.status,
        "freshness": freshness(reading.observed_at, now),
    }


def station_payload(station: Station, latest: Reading | None = None, include_latest: bool = False) -> dict:
    payload = {
        "id": station.id,
        "external_id": station.external_id,
        "name": station.name,
        "short_name": station.short_name,
        "zone_id": station.zone_id,
        "zone_name": station.zone.name,
        "location": {"latitude": station.latitude, "longitude": station.longitude},
        "type": station.type,
        "status": station.status,
        "provider": station.provider,
        "last_observed_at": iso(station.last_observed_at),
    }
    if include_latest:
        payload["latest"] = snapshot(latest) if latest else None
    return payload


def zone_payload(zone: Zone) -> dict:
    payload = {"id": zone.id, "name": zone.name, "centroid": {"latitude": zone.centroid_latitude, "longitude": zone.centroid_longitude}}
    if zone.geometry:
        payload["geometry"] = zone.geometry
    return payload
