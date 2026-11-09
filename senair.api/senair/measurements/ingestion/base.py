"""Types communs de l'ingestion : mesure normalisée, contexte d'un message, erreurs et interfaces (Strategy)."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

# Champs numériques d'une mesure normalisée : codes de l'IQA, grandeurs secondaires et météo (noms du modèle Reading).
POLLUTANT_FIELDS = ("pm25", "pm10", "no2", "so2", "co", "o3")
AUXILIARY_FIELDS = ("co2", "tvoc", "no", "nh3")
WEATHER_FIELDS = ("temperature_c", "humidity_pct", "wind_speed_ms", "wind_direction_deg", "pressure_hpa", "precipitation_mm")
VALUE_FIELDS = POLLUTANT_FIELDS + AUXILIARY_FIELDS + WEATHER_FIELDS


class InvalidMessage(Exception):  # noqa: N818 (nom métier, lisible dans les journaux)
    """Message refusé en entier : il part sur le topic dead-letter avec cette raison (texte sans donnée personnelle)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class MessageContext:
    """Origine d'un message : topic Kafka (ou fichier importé) et position, pour la traçabilité."""

    topic: str = ""
    partition: int | None = None
    offset: int | None = None


@dataclass
class NormalizedMeasurement:
    """Une mesure d'une station à un horodatage capteur, indépendante du format d'origine."""

    station_ref: str
    observed_at: datetime
    message_format: str
    data_source: str
    station_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str = "measured"
    values: dict[str, float | None] = field(default_factory=dict)
    # Provenance par variable (sensor, openweathermap, satellite, model).
    sources: dict[str, str] = field(default_factory=dict)
    upstream_aqi: float | None = None
    # Variables mises à null par la validation (rejet partiel).
    partial_rejections: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class HandleResult:
    """Issue du traitement d'un message accepté : accepted, duplicate ou skipped (source désactivée)."""

    outcome: str
    detail: str = ""


class MeasurementAdapter(Protocol):
    """Strategy : un adaptateur par format de message, qui produit une mesure normalisée ou lève InvalidMessage."""

    message_format: str
    data_source: str

    def parse(self, payload: Any) -> NormalizedMeasurement: ...


class MessageHandler(Protocol):
    """Traitement complet d'un message d'un topic (mesure, prévision, modèle, grille)."""

    name: str

    def handle(self, payload: Any, context: MessageContext) -> HandleResult: ...


def parse_datetime(value: Any) -> datetime:
    """ISO-8601 (« Z » accepté) ou DATETIME MySQL sans fuseau, interprété en UTC. Lève InvalidMessage sinon."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and value.strip():
        text = value.strip().replace("Z", "+00:00").replace("z", "+00:00")
        try:
            dt = datetime.fromisoformat(text)
        except ValueError as error:
            raise InvalidMessage("Horodatage invalide.") from error
    else:
        raise InvalidMessage("Horodatage absent.")
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def to_float(value: Any) -> float | None:
    """Valeur numérique ou None (chaîne vide, null, texte non numérique, NaN)."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
        if not value:
            return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number or number in (float("inf"), float("-inf")) else number
