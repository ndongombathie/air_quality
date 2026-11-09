"""
Règles de validation appliquées à toute mesure, quel que soit son format d'origine (après l'adaptateur) :

1. Horodatage absent ou invalide : le message est rejeté en entier (InvalidMessage, envoyé en dead-letter).
   Les adaptateurs lèvent cette erreur via base.parse_datetime ; un horodatage plus de 10 minutes dans le
   futur est aussi rejeté (horloge du capteur déréglée).
2. Valeur négative ou hors plage physique (PHYSICAL_RANGES) : la valeur est mise à null, la variable garde sa
   provenance (le front affiche « N/D ») et elle est comptée comme rejet partiel (NormalizedMeasurement.partial_rejections).
   Le message reste accepté.
3. pm10 à 0.0 alors que pm25 > 0 : physiquement impossible (PM10 inclut les PM2.5), constaté sur les données
   réelles (projet-transversal/air_quality.csv) : pm10 est traité comme absent (null), sans compter de rejet.
4. Station inconnue : enregistrée automatiquement par le service d'ingestion (service.py), rattachée à la zone
   dont le centroïde est le plus proche ; sans coordonnées, le message est rejeté.
5. Une mesure sans aucune valeur exploitable (tout est null) est rejetée.
"""

from datetime import datetime, timedelta

from django.utils import timezone

from .base import VALUE_FIELDS, InvalidMessage, NormalizedMeasurement

# Bornes physiques plausibles (incluses), dans l'unité du modèle Reading (CO en mg/m³, CO₂ en ppm, COV en indice).
PHYSICAL_RANGES: dict[str, tuple[float, float]] = {
    "pm25": (0, 1000),
    "pm10": (0, 2000),
    "no2": (0, 2000),
    "so2": (0, 2000),
    "co": (0, 100),
    "o3": (0, 1000),
    "co2": (250, 10000),
    "tvoc": (0, 500),
    "no": (0, 2000),
    "nh3": (0, 2000),
    "temperature_c": (-40, 60),
    "humidity_pct": (0, 100),
    "wind_speed_ms": (0, 75),
    "wind_direction_deg": (0, 360),
    "pressure_hpa": (800, 1100),
    "precipitation_mm": (0, 500),
}
MAX_CLOCK_SKEW = timedelta(minutes=10)


def validate(measurement: NormalizedMeasurement, now: datetime | None = None) -> NormalizedMeasurement:
    if measurement.observed_at > (now or timezone.now()) + MAX_CLOCK_SKEW:
        raise InvalidMessage("Horodatage dans le futur.")
    if not measurement.station_ref:
        raise InvalidMessage("Identifiant de station absent.")

    values = measurement.values
    for name, value in list(values.items()):
        if name not in VALUE_FIELDS:
            values.pop(name)
            continue
        if value is None:
            continue
        low, high = PHYSICAL_RANGES[name]
        if not low <= value <= high:
            values[name] = None
            measurement.partial_rejections.append(name)

    if values.get("pm10") == 0 and (values.get("pm25") or 0) > 0:
        values["pm10"] = None

    if all(value is None for value in values.values()):
        raise InvalidMessage("Aucune valeur exploitable.")
    return measurement
