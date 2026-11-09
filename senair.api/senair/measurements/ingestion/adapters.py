"""
Adaptateurs de format (Strategy) : chacun transforme un message en NormalizedMeasurement.
Ajouter un format = écrire une classe avec `message_format`, `data_source` et `parse()`, puis l'enregistrer
sur un topic dans registry.py.
"""

from collections.abc import Mapping
from typing import Any

from senair.common.domain import UNITS

from . import schemas
from .base import InvalidMessage, NormalizedMeasurement, parse_datetime, to_float

SENSOR = "sensor"
OPENWEATHERMAP = "openweathermap"

# Masses molaires (g/mol) pour convertir des ppb en µg/m³ à 25 °C et 1 atm (volume molaire 24,45 L).
_MOLAR_MASS = {"no2": 46.0055, "so2": 64.066, "o3": 47.997, "co": 28.010, "no": 30.006, "nh3": 17.031}
_MOLAR_VOLUME = 24.45


def _first(payload: Mapping, *keys: str) -> Any:
    """Première clé présente et non nulle (ex. valeur corrigée AirGradient, sinon valeur brute)."""
    for key in keys:
        value = payload.get(key)
        if value is not None and value != "":
            return value
    return None


def _station_name(raw: Any) -> str | None:
    """« Thiès, Hôtel de Ville » vers « Hôtel de Ville » (le préfixe de ville est porté par la plateforme)."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    name = raw.strip()
    head, sep, tail = name.partition(",")
    if sep and head.strip().lower() in {"thiès", "thies"} and tail.strip():
        name = tail.strip()
    return name[:160]


def _coordinates(payload: Mapping, lat_key: str, lon_key: str) -> tuple[float | None, float | None]:
    lat, lon = to_float(payload.get(lat_key)), to_float(payload.get(lon_key))
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, None
    return lat, lon


def _require_mapping(payload: Any) -> Mapping:
    if not isinstance(payload, Mapping):
        raise InvalidMessage("Le message n'est pas un objet JSON.")
    return payload


class AirGradientRawAdapter:
    """
    JSON brut de l'API AirGradient publié tel quel par projet-transversal/producer.py sur le topic `air-quality`.
    Valeurs corrigées (`*_corrected`) en priorité, sinon valeurs brutes. Pas de gaz : uniquement le capteur.
    """

    message_format = "airgradient.raw"
    data_source = "airgradient"

    FIELDS = {
        "pm25": ("pm02_corrected", "pm02"),
        "pm10": ("pm10_corrected", "pm10"),
        "co2": ("rco2_corrected", "rco2"),
        "tvoc": ("tvoc_index", "tvocIndex", "tvoc"),
        "temperature_c": ("atmp_corrected", "atmp"),
        "humidity_pct": ("rhum_corrected", "rhum"),
    }

    def parse(self, payload: Any) -> NormalizedMeasurement:
        payload = _require_mapping(payload)
        location_id = payload.get("locationId")
        if location_id in (None, ""):
            raise InvalidMessage("locationId absent.")
        observed_at = parse_datetime(payload.get("timestamp"))
        lat, lon = _coordinates(payload, "latitude", "longitude")
        values = {name: to_float(_first(payload, *keys)) for name, keys in self.FIELDS.items()}
        return NormalizedMeasurement(
            station_ref=str(location_id),
            station_name=_station_name(payload.get("locationName")),
            latitude=lat,
            longitude=lon,
            observed_at=observed_at,
            message_format=self.message_format,
            data_source=self.data_source,
            values=values,
            sources=dict.fromkeys(values, SENSOR),
        )


class MeasurementV1Adapter:
    """Format enrichi `measurement.v1` (docs/stream/measurement.v1.schema.json), validé par jsonschema."""

    message_format = "measurement.v1"
    data_source = "airgradient"

    WEATHER = {
        "temperatureC": "temperature_c",
        "humidityPct": "humidity_pct",
        "windSpeedMs": "wind_speed_ms",
        "windDirectionDeg": "wind_direction_deg",
        "pressureHpa": "pressure_hpa",
        "precipitationMm": "precipitation_mm",
    }

    def parse(self, payload: Any) -> NormalizedMeasurement:
        schemas.check("measurement.v1", payload)
        observed_at = parse_datetime(payload["observedAt"])
        location = payload.get("location") or {}
        values: dict[str, float | None] = {}
        sources: dict[str, str] = {}
        partial: list[str] = []
        for code, measure in payload["measures"].items():
            value = measure["value"]
            converted = self._convert(code, value, measure["unit"])
            if value is not None and converted is None:
                partial.append(code)  # unité incompatible avec la grandeur : valeur écartée
            values[code] = converted
            sources[code] = measure["source"]
        weather = payload.get("weather") or {}
        weather_source = weather.get("source", OPENWEATHERMAP)
        for key, name in self.WEATHER.items():
            if key in weather:
                values[name] = weather[key]
                sources[name] = weather_source
        return NormalizedMeasurement(
            station_ref=payload["stationId"],
            station_name=_station_name(payload.get("stationName")),
            latitude=location.get("latitude"),
            longitude=location.get("longitude"),
            observed_at=observed_at,
            status=payload.get("status", "measured"),
            message_format=self.message_format,
            data_source=self.data_source,
            values=values,
            sources=sources,
            upstream_aqi=payload.get("upstreamAqi"),
            partial_rejections=partial,
        )

    @staticmethod
    def _convert(code: str, value: float | None, unit: str) -> float | None:
        """Ramène la valeur à l'unité de référence du contrat (domain.UNITS)."""
        if value is None:
            return None
        target = UNITS[code]
        if unit == target:
            return float(value)
        if unit == "µg/m³" and target == "mg/m³":
            return value / 1000
        if unit == "mg/m³" and target == "µg/m³":
            return value * 1000
        if unit == "ppb" and code in _MOLAR_MASS:
            micrograms = value * _MOLAR_MASS[code] / _MOLAR_VOLUME
            return micrograms / 1000 if target == "mg/m³" else micrograms
        if unit == "ppm" and code in _MOLAR_MASS:
            micrograms = value * 1000 * _MOLAR_MASS[code] / _MOLAR_VOLUME
            return micrograms / 1000 if target == "mg/m³" else micrograms
        return None


class HistoryRowAdapter:
    """
    Ligne de la table MySQL `air_quality_data` (projet-transversal/create_db.sql) ou de son export CSV.
    Capteur : pm25, pm10, co2, tvoc, température, humidité. OpenWeatherMap (échelle ville) : gaz et vent,
    CO converti de µg/m³ en mg/m³. La colonne `iqr` du pipeline est conservée dans upstream_aqi.
    """

    message_format = "history.row"
    data_source = "historique"

    SENSOR_COLUMNS = {
        "pm25": "pm25",
        "pm10": "pm10",
        "co2": "co2",
        "tvoc": "tvoc",
        "temperature": "temperature_c",
        "humidity": "humidity_pct",
    }
    OWM_COLUMNS = {
        "no2": "no2",
        "so2": "so2",
        "o3": "o3",
        "no": "no",
        "nh3": "nh3",
        "vitesse_vent": "wind_speed_ms",
        "direction_vent": "wind_direction_deg",
    }

    def parse(self, payload: Any) -> NormalizedMeasurement:
        row = _require_mapping(payload)
        location_id = row.get("location_id")
        if location_id in (None, ""):
            raise InvalidMessage("location_id absent.")
        observed_at = parse_datetime(row.get("timestamp"))
        lat, lon = _coordinates(row, "latitude", "longitude")
        values: dict[str, float | None] = {}
        sources: dict[str, str] = {}
        for column, name in self.SENSOR_COLUMNS.items():
            values[name] = to_float(row.get(column))
            sources[name] = SENSOR
        for column, name in self.OWM_COLUMNS.items():
            values[name] = to_float(row.get(column))
            sources[name] = OPENWEATHERMAP
        co = to_float(row.get("co"))
        values["co"] = co / 1000 if co is not None else None  # OpenWeatherMap : µg/m³ ; contrat : mg/m³
        sources["co"] = OPENWEATHERMAP
        return NormalizedMeasurement(
            station_ref=str(location_id).strip(),
            station_name=_station_name(row.get("location_name")),
            latitude=lat,
            longitude=lon,
            observed_at=observed_at,
            message_format=self.message_format,
            data_source=self.data_source,
            values=values,
            sources=sources,
            upstream_aqi=to_float(row.get("iqr")),
        )
