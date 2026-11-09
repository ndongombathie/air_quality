"""
Règles métier partagées par le backend, miroir de packages/core/src/domain (énumérations vérifiées par tests/test_parity.py).
Le backend est la source de vérité de l'IQA : sous-indice = concentration / valeur limite × 100,
IQA d'une station = max des sous-indices, IQA d'une zone ou de la ville = max des stations (présentation §8).
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.utils import timezone

# ─── Échelle IQA ───
AQI_LEVELS: tuple[tuple[str, int, float, str], ...] = (
    ("good", 0, 50, "Bon"),
    ("moderate", 51, 100, "Modéré"),
    ("unhealthy_sensitive", 101, 150, "Mauvais pour les groupes sensibles"),
    ("unhealthy", 151, 200, "Mauvais"),
    ("very_unhealthy", 201, 300, "Très mauvais"),
    ("hazardous", 301, float("inf"), "Dangereux"),
)
AQI_LEVEL_IDS = tuple(level[0] for level in AQI_LEVELS)
AQI_LEVEL_CHOICES = [(level[0], level[3]) for level in AQI_LEVELS]
AQI_LEVEL_LABELS = {level[0]: level[3] for level in AQI_LEVELS}


def aqi_level(aqi: float | None) -> str | None:
    if aqi is None or aqi < 0:
        return None
    rounded = round(aqi)
    for level_id, _min, max_value, _label in AQI_LEVELS:
        if rounded <= max_value:
            return level_id
    return "hazardous"


def level_rank(level: str) -> int:
    return AQI_LEVEL_IDS.index(level)


# ─── Polluants et mesures ───
POLLUTANT_CODES = ("pm25", "pm10", "no2", "so2", "co", "o3")
AUXILIARY_CODES = ("co2", "tvoc", "nh3", "no")
MEASURE_CODES = POLLUTANT_CODES + AUXILIARY_CODES
POLLUTANT_CHOICES = [(code, code) for code in POLLUTANT_CODES]

UNITS = {
    "pm25": "µg/m³",
    "pm10": "µg/m³",
    "no2": "µg/m³",
    "so2": "µg/m³",
    "co": "mg/m³",
    "o3": "µg/m³",
    "co2": "ppm",
    "tvoc": "index",
    "nh3": "µg/m³",
    "no": "µg/m³",
}
UNIT_CHOICES = [(unit, unit) for unit in ("µg/m³", "mg/m³", "ppm", "ppb", "index")]
FORMULAS = {"pm25": "PM2.5", "pm10": "PM10", "no2": "NO₂", "so2": "SO₂", "co": "CO", "o3": "O₃"}
POLLUTANT_NAMES = {
    "pm25": "particules fines",
    "pm10": "particules grossières",
    "no2": "dioxyde d'azote",
    "so2": "dioxyde de soufre",
    "co": "monoxyde de carbone",
    "o3": "ozone",
}

MEASURE_SOURCES = ("sensor", "openweathermap", "satellite", "model")
DATA_STATUSES = ("measured", "estimated", "forecast")
REFERENCES = (("WHO_2021", "OMS 2021"), ("NS_05_062", "NS 05-062"))
PERIODS = (("1h", "1 heure"), ("8h", "8 heures"), ("24h", "24 heures"), ("1y", "Annuelle"))
FORECAST_HORIZONS = ("1h", "2h", "3h", "1d", "2d", "3d")
HORIZON_HOURS = {"1h": 1, "2h": 2, "3h": 3, "1d": 24, "2d": 48, "3d": 72}
HEALTH_PROFILES = ("general", "children", "elderly", "asthma", "cardiac", "pregnant", "outdoor_worker", "athlete")
MEDICAL_DISCLAIMER = (
    "Ces conseils sont informatifs et ne remplacent pas l'avis d'un professionnel de santé. En cas de symptômes, consultez un médecin."
)


def aqi_limits() -> dict[str, float]:
    return settings.SENAIR["AQI_LIMITS"]


def sub_index(code: str, value: float | None, limits: dict[str, float] | None = None) -> float | None:
    limits = limits or aqi_limits()
    if value is None or code not in limits or limits[code] <= 0:
        return None
    return round(value / limits[code] * 100, 1)


@dataclass(frozen=True)
class AqiResult:
    aqi: float | None
    level: str | None
    dominant: str | None
    sub_indices: dict[str, float]


def compute_aqi(values: dict[str, float | None], limits: dict[str, float] | None = None) -> AqiResult:
    indices = {code: idx for code in POLLUTANT_CODES if (idx := sub_index(code, values.get(code), limits)) is not None}
    if not indices:
        return AqiResult(None, None, None, {})
    dominant = max(indices, key=indices.get)
    aqi = round(indices[dominant])
    return AqiResult(aqi, aqi_level(aqi), dominant, indices)


# ─── Fraîcheur (packages/core/src/domain/format.ts) ───
FRESH_MINUTES = 15
STALE_MINUTES = 120


def freshness(observed_at: datetime | None, now: datetime | None = None) -> str:
    if observed_at is None:
        return "unknown"
    age = (now or timezone.now()) - observed_at
    if age <= timedelta(minutes=FRESH_MINUTES):
        return "fresh"
    if age <= timedelta(minutes=STALE_MINUTES):
        return "stale"
    return "outdated"


def iso(dt: datetime | None) -> str | None:
    """Dates du contrat : ISO-8601 UTC avec « Z »."""
    if dt is None:
        return None
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
