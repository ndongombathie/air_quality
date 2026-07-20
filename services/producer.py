import json
import time
from dotenv import load_dotenv
import requests
from kafka import KafkaProducer
import os


load_dotenv()

if os.getenv("KEY_AIGRADIENT") is None:
    raise ValueError("La variable KEY_AIGRADIENT n'est pas définie dans le fichier .env")

KEY_AIGRADIENT = os.getenv("KEY_AIGRADIENT")
if KEY_AIGRADIENT is None:
    raise ValueError("La variable KEY_AIGRADIENT n'est pas définie dans le fichier .env")

API_URL = f"https://api.airgradient.com/public/api/v1/locations/measures/current?token={KEY_AIGRADIENT}"


producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v:
    json.dumps(v).encode("utf-8")
)

while True:

    try:
        stations = requests.get(API_URL).json()
        for station in stations:
            location_name = station.get("locationName", "")

                
            if (
                "thiès" not in location_name.lower()
                and "thies" not in location_name.lower()
            ):
                continue
            
            if "Lycee medina Fall" in station.get("locationName"):
                station["latitude"] = 14.8006029
                station["longitude"] = -16.9074725
                
            if "Ecole élémentaire kaba sall" in station.get("locationName"):
                station["latitude"] = 14.7777094
                station["longitude"] = -16.9147503
                
            if "Collège Cité Lamy" in station.get("locationName"):
                station["latitude"] = 14.7755516
                station["longitude"] = -16.9317663
                
            if  "Lycée de FAHU" in station.get("locationName"):
                station["latitude"] = 14.765215
                station["longitude"] = -16.9445212
                
            producer.send(
                "air-quality",
                station
            )
            print(
                f"Envoyé : {location_name}"
            )

        producer.flush()
    except Exception as e:
        print(e)

    time.sleep(60)