import json
from dotenv import load_dotenv
import os
import requests
import mysql.connector
from datetime import datetime
from kafka import KafkaConsumer

load_dotenv()

API_KEY = os.getenv("API_KEY")
if API_KEY is None:
    raise ValueError("La variable API_KEY n'est pas définie dans le fichier .env")

def parse_timestamp(ts):
    """Convertit un timestamp ISO 8601 ('...Z') en format compatible MySQL DATETIME.
    Retourne None si la conversion échoue ou si ts est vide."""
    if not ts:
        return None
    try:
        # Remplace le 'Z' (UTC) par '+00:00' pour que fromisoformat() le comprenne
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, AttributeError) as e:
        print(f"Timestamp invalide '{ts}': {e}")
        return None
    
def calculate_iqr(data):
   
    iqrs=[]
    LIMITS = {
        "pm02_corrected": 75,      # PM2.5
        "pm10_corrected": 150,     # PM10
        "no2": 200,
        "so2": 50,
        "rco2_corrected": 10000,
        "o3": 100
    }
    
    for key,value in data.items():
       if value is None:
           value = 0
       print(f"Calcul de l'IQR pour {key} avec valeur {value} et limite {LIMITS[key]}")
       iqr=(value *100)/LIMITS[key]
       iqrs.append(iqr)
    return max(iqrs)

def categorie_iqa(iqa):

    if iqa <= 50:
        return "Bonne"

    elif iqa <= 100:
        return "Modérée"

    elif iqa <= 150:
        return "Mauvaise pour les personnes sensibles"

    elif iqa <= 200:
        return "Mauvaise"

    elif iqa <= 300:
        return "Très mauvaise"

    return "Dangereuse"


def safe_deserialize(x):
    """Désérialise le message Kafka en JSON.
    Retourne None si le message n'est pas un JSON valide
    (au lieu de faire crasher tout le consumer)."""
    try:
        return json.loads(x.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"Message ignoré (JSON invalide) : {e}")
        return None


# --- Connexion Kafka ---
try:
    consumer = KafkaConsumer(
        "air-quality",
        bootstrap_servers="localhost:9092",
        auto_offset_reset="earliest",
        group_id="air-group",
        value_deserializer=safe_deserialize
    )
except Exception as e:
    print(f"Erreur sur Kafka Consumer : {e}")
    exit(1)


# --- Connexion MySQL ---
try:
    db = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "042002"),
        database=os.getenv("MYSQL_DB", "air_quality_db")
    )
    cursor = db.cursor()
except Exception as e:
    print(f"Erreur sur MySQL Connector : {e}")
    exit(1)


sql = """
    INSERT INTO air_quality_data(
        location_id, location_name, latitude, longitude, timestamp,
        pm25, pm10, temperature, humidity, co2, tvoc,
        co, no, no2, so2, o3, nh3,vitesse_vent,direction_vent,iqr,categorie_iqa
    )
    VALUES (%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""


# --- Boucle principale ---
try:
    for msg in consumer:
        station = msg.value

        # Ignore les messages qui n'ont pas pu être désérialisés (ex: "hello")
        if station is None:
            continue

        try:
            lat = station["latitude"]
            lon = station["longitude"]
            if lat is None or lon is None:
                continue

            air_url = (
                f"https://api.openweathermap.org/data/2.5/air_pollution"
                f"?lat={lat}&lon={lon}&appid={API_KEY}"
            )
            
            air_url_weather = (
                f"https://api.openweathermap.org/data/2.5/weather?"
                f"lat={lat}&lon={lon}&appid={API_KEY}"
            )
            
            response_weather = requests.get(air_url_weather, timeout=10)
            response_weather.raise_for_status()
            air_weather_data = response_weather.json()
            wind = air_weather_data["wind"]
            #rain = air_weather_data

            
            response = requests.get(air_url, timeout=10)
            response.raise_for_status()
            air_data = response.json()
            components = air_data["list"][0]["components"]
            
            if station.get("pm02_corrected") is None:
                station["pm02_corrected"] = components.get("pm2_5")
                
            if station.get("pm10_corrected") is None:
                station["pm10_corrected"] = components.get("pm10")
                
            if station.get("atmp_corrected") is None:
                station["atmp_corrected"]= components.get("temp")
                
            if station.get("rhum_corrected") is None:
                station["rhum_corrected"] = air_weather_data["main"]["humidity"]
                
            if station.get("rco2_corrected") is None:
                station["rco2_corrected"] = components.get("co2")
                
                
            pollutions = {
                "pm02_corrected":station.get("pm02_corrected"),      # PM2.5
                "pm10_corrected": station.get("pm10_corrected"),     # PM10
                "no2": components.get("no2"),
                "so2": components.get("so2"),
                "rco2_corrected": station.get("rco2_corrected"),
                "o3": components.get("o3")
            }
                
            iqr = calculate_iqr(pollutions)
            
            print(f"IQR calculé pour {station.get('locationName')}: {iqr}")
                
            values = (
                station.get("locationId"),
                station.get("locationName"),
                lat,
                lon,
                parse_timestamp(station.get("timestamp")),
                station.get("pm02_corrected"),
                station.get("pm10_corrected"),
                station.get("atmp_corrected"),
                station.get("rhum_corrected"),
                station.get("rco2_corrected"),
                station.get("tvoc"),
                components.get("co"),
                components.get("no"),
                components.get("no2"),
                components.get("so2"),
                components.get("o3"),
                components.get("nh3"),
                wind["speed"],
                wind["deg"],
                iqr,
                categorie_iqa(iqr)
            )

            cursor.execute(sql, values)
            db.commit()
            print(f"Sauvegardé : {station.get('locationName')}")

        except Exception as e:
            print(f"Erreur sur message {station}: {e}")

finally:
    cursor.close()
    db.close()