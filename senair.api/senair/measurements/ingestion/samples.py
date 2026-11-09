"""Messages exemples de chaque topic (démonstrations, tests), conformes aux schémas de docs/stream/."""

import uuid
from datetime import datetime, timedelta

from django.utils import timezone

from senair.common.domain import iso
from senair.measurements.geo import THIES_BBOX, grid_points


def _now(now: datetime | None) -> datetime:
    return (now or timezone.now()).replace(microsecond=0)


def airgradient_raw(now: datetime | None = None, location_id: int = 168373) -> dict:
    """Forme du JSON publié par projet-transversal/producer.py (API AirGradient « measures/current »)."""
    return {
        "locationId": location_id,
        "locationName": "Thiès, Hôtel de Ville",
        "latitude": 14.791343,
        "longitude": -16.924869,
        "pm01": 12.1,
        "pm02": 24.0,
        "pm10": 31.0,
        "pm02_corrected": 20.5,
        "pm10_corrected": 28.4,
        "atmp": 34.9,
        "atmp_corrected": 34.5,
        "rhum": 50,
        "rhum_corrected": 52,
        "rco2": 420,
        "rco2_corrected": 415,
        "tvoc": 108.5,
        "noxIndex": 1,
        "wifi": -61,
        "timestamp": iso(_now(now)).replace("Z", ".000Z"),
        "serialno": "demo",
        "model": "O-1PST",
    }


def measurement_v1(now: datetime | None = None, station_id: str = "168373") -> dict:
    return {
        "schemaVersion": "1",
        "messageId": str(uuid.uuid4()),
        "stationId": station_id,
        "stationName": "Thiès, Hôtel de Ville",
        "location": {"latitude": 14.791343, "longitude": -16.924869},
        "observedAt": iso(_now(now)),
        "status": "measured",
        "measures": {
            "pm25": {"value": 20.5, "unit": "µg/m³", "source": "sensor"},
            "pm10": {"value": 28.4, "unit": "µg/m³", "source": "sensor"},
            "co2": {"value": 415, "unit": "ppm", "source": "sensor"},
            "co": {"value": 77.5, "unit": "µg/m³", "source": "openweathermap"},
            "no2": {"value": 0.17, "unit": "µg/m³", "source": "openweathermap"},
            "o3": {"value": 59.62, "unit": "µg/m³", "source": "openweathermap"},
        },
        "weather": {"temperatureC": 34.5, "humidityPct": 52, "windSpeedMs": 7.15, "windDirectionDeg": 235, "source": "openweathermap"},
        "upstreamAqi": 59.62,
        "pipeline": {"job": "publish_sample"},
    }


def forecast_v1(now: datetime | None = None, model_id: str = "xgboost-forecast") -> dict:
    generated = _now(now).replace(minute=0, second=0)
    horizons = {"1h": 1, "2h": 2, "3h": 3, "1d": 24, "2d": 48, "3d": 72}
    forecasts = []
    for index, (horizon, hours) in enumerate(horizons.items()):
        aqi = 118 - index * 4
        forecasts.append(
            {
                "horizon": horizon,
                "validAt": iso(generated + timedelta(hours=hours)),
                "aqi": aqi,
                "dominantPollutant": "pm25",
                "values": {"pm25": round(aqi * 0.15, 1)},
                "confidence": round(0.92 - index * 0.05, 2),
                "interval": {"low": aqi - 6 - index * 3, "high": aqi + 6 + index * 3},
                "drivers": ["Heure de pointe du trafic" if hours < 24 else "Vent de nord-est (harmattan) modéré"],
            }
        )
    return {
        "schemaVersion": "1",
        "messageId": str(uuid.uuid4()),
        "model": {"id": model_id, "name": "Prévision IQA", "algorithm": "XGBoost", "version": "1.0.0"},
        "scope": "city",
        "scopeId": "thies",
        "generatedAt": iso(generated),
        "forecasts": forecasts,
    }


def model_v1(now: datetime | None = None, model_id: str = "xgboost-forecast") -> dict:
    return {
        "schemaVersion": "1",
        "messageId": str(uuid.uuid4()),
        "id": model_id,
        "name": "Prévision IQA court et moyen terme",
        "task": "forecast",
        "algorithm": "XGBoost",
        "version": "1.0.0",
        "metrics": {"r2": 0.82, "rmse": 9.4, "mae": 6.8},
        "trainedAt": iso(_now(now) - timedelta(hours=12)),
        "trackingUrl": None,
        "artifactUri": None,
        "signature": {"inputs": ["latitude", "longitude", "heure"], "outputs": ["aqi"]},
    }


def interpolation_v1(now: datetime | None = None, layer: str = "aqi", resolution_m: int = 1000, model_id: str = "kriging-demo") -> dict:
    cells = []
    for lat, lon in grid_points(THIES_BBOX, resolution_m):
        value = round(60 + (lat - 14.74) * 400 + (lon + 16.99) * 150, 1)
        cells.append({"latitude": lat, "longitude": lon, "value": value, "aqi": round(value), "uncertainty": 0.2})
    return {
        "schemaVersion": "1",
        "messageId": str(uuid.uuid4()),
        "model": {"id": model_id, "version": "0.1.0"},
        "layer": layer,
        "at": iso(_now(now).replace(minute=0, second=0)),
        "resolutionM": resolution_m,
        "method": "kriging",
        "cells": cells,
    }
