"""
Données de référence chargées par `manage.py seed_reference` (idempotent).
Stations : réseau AirGradient de Thiès, tel que publié par le producer de l'équipe data (location_id).
Textes de santé et seuils : identiques au mode démonstration du front (packages/core/src/mock).
"""

STATIONS = [
    # location_id, nom, nom court, quartier (zone), latitude, longitude, type
    ("89441", "Université Iba Der Thiam", "Univ. Iba Der Thiam", "Université", 14.794498116325476, -16.96105368259619, "residential"),
    ("166062", "École élémentaire Sud Stade", "Sud Stade", "Sud Stade", 14.767584195764858, -16.943624763523218, "residential"),
    ("168373", "Hôtel de Ville", "Hôtel de Ville", "Centre-ville", 14.791343, -16.924869, "road"),
    ("168377", "Lycée Malick Sy", "Lycée Malick Sy", "Malick Sy", 14.784821362711984, -16.939469998191395, "residential"),
    ("168388", "Lycée Jules Sagna", "Jules Sagna", "Jules Sagna", 14.796931104490659, -16.92713209381339, "road"),
    ("168393", "Lycée Médina Fall", "Médina Fall", "Médina Fall", 14.8006029, -16.9074725, "industrial"),
    ("168394", "École élémentaire Kaba Sall", "Kaba Sall", "Kaba Sall", 14.7777094, -16.9147503, "residential"),
    ("168397", "Collège Cité Lamy", "Cité Lamy", "Cité Lamy", 14.7755516, -16.9317663, "residential"),
    ("168401", "Lycée de Fahu", "Fahu", "Fahu", 14.765215, -16.9445212, "residential"),
]

DATA_SOURCES = [
    (
        "airgradient",
        "Capteurs AirGradient (Thiès)",
        "sensor_network",
        True,
        "PM2.5, PM10, CO₂, COV, température et humidité, via le topic Kafka du pipeline.",
    ),
    (
        "openweathermap",
        "OpenWeatherMap",
        "weather_api",
        True,
        "Gaz (CO, NO, NO₂, SO₂, O₃, NH₃) et vent à l'échelle de la ville, ajoutés par le pipeline.",
    ),
    ("sentinel-5p", "Sentinel-5P TROPOMI", "satellite", False, "Colonnes NO₂, SO₂, CO, O₃, mises à jour chaque jour (évolution prévue)."),
    (
        "historique",
        "Historique air_quality.csv",
        "dataset",
        True,
        "Archive d'entraînement des modèles, importable avec `manage.py import_history`.",
    ),
]

# pollutant, reference, period, value, unit, alert_level
THRESHOLDS = [
    ("pm25", "WHO_2021", "24h", 15, "µg/m³", "unhealthy_sensitive"),
    ("pm25", "NS_05_062", "24h", 25, "µg/m³", "unhealthy"),
    ("pm10", "WHO_2021", "24h", 45, "µg/m³", "unhealthy_sensitive"),
    ("pm10", "NS_05_062", "24h", 50, "µg/m³", "unhealthy"),
    ("no2", "WHO_2021", "24h", 25, "µg/m³", "unhealthy_sensitive"),
    ("no2", "NS_05_062", "1h", 200, "µg/m³", "unhealthy"),
    ("so2", "WHO_2021", "24h", 40, "µg/m³", "unhealthy_sensitive"),
    ("so2", "NS_05_062", "24h", 50, "µg/m³", "unhealthy"),
    ("o3", "WHO_2021", "8h", 100, "µg/m³", "unhealthy_sensitive"),
    ("o3", "NS_05_062", "8h", 100, "µg/m³", "unhealthy"),
    ("co", "WHO_2021", "24h", 4, "mg/m³", "unhealthy_sensitive"),
    ("co", "NS_05_062", "8h", 10, "mg/m³", "unhealthy"),
]

GUIDANCE_BY_LEVEL = {
    "good": ("Qualité de l'air idéale", ["Profitez des activités en plein air", "Aérez votre logement", "Aucune précaution particulière"]),
    "moderate": (
        "Qualité de l'air acceptable",
        ["Activités extérieures possibles", "Aérez en début de journée", "Restez attentif si vous êtes sensible"],
    ),
    "unhealthy_sensitive": (
        "Prudence recommandée",
        ["Limitez les efforts intenses en extérieur", "Privilégiez l'activité en intérieur", "Aérez tôt le matin (entre 6 h et 8 h)"],
    ),
    "unhealthy": (
        "Évitez l'extérieur",
        ["Restez à l'intérieur autant que possible", "Fermez portes et fenêtres", "Portez un masque FFP2 si vous sortez"],
    ),
    "very_unhealthy": (
        "Alerte sanitaire",
        ["Restez impérativement à l'intérieur", "Évitez toute activité physique", "Portez un masque FFP2 pour toute sortie"],
    ),
    "hazardous": ("Conditions d'urgence", ["Ne sortez pas", "Calfeutrez le logement", "Contactez un médecin au moindre symptôme"]),
}

PROFILE_EXTRA = {
    "children": "Suspendez les jeux et le sport en extérieur ; surveillez toux et gêne respiratoire.",
    "elderly": "Évitez les sorties aux heures chaudes et de trafic.",
    "asthma": "Gardez votre bronchodilatateur à portée de main ; consultez en cas de crise.",
    "cardiac": "Évitez les efforts ; surveillez tension et rythme cardiaque.",
    "pregnant": "Limitez le temps passé près des axes routiers.",
    "outdoor_worker": "Faites des pauses en intérieur toutes les 2 heures et portez un masque FFP2.",
    "athlete": "Réduisez l'intensité ou entraînez-vous en salle.",
}
