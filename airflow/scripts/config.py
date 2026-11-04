import os

POLLUANTS = ['pm25', 'pm10', 'co2', 'tvoc', 'co', 'no', 'no2', 'so2', 'o3', 'nh3']
FEATURES_METEO = ['temperature', 'humidity', 'vitesse_vent']

FREQ_MIN = 10
HORIZON_MIN = 30
LAGS_MIN = [10, 20, 30, 60]
JOURS_HISTORIQUE_ENTRAINEMENT = 30
MODELS_DIR = "/opt/airflow/models"
