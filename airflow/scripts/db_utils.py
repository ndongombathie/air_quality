import pymysql
import pandas as pd
import os


MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3308"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
PASSWORD = os.getenv("PASSWORD", "042002")
MYSQL_DB = os.getenv("MYSQL_DB", "air_quality_db")
TABLE_NAME = os.getenv("MYSQL_TABLE", "air_quality_data")
def get_engine():
    
    conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=PASSWORD,
            database=MYSQL_DB,
            cursorclass=pymysql.cursors.DictCursor,
        )
    return conn

def charger_donnees_historique(jours: int) -> pd.DataFrame:
    engine = get_engine()

    query = f"""
        SELECT *
        FROM {TABLE_NAME}
        WHERE `timestamp` >= NOW() - INTERVAL {jours} DAY
        ORDER BY location_id, `timestamp`
    """

    try:
        with engine.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    finally:
        engine.close()

    return pd.DataFrame(rows)

def charger_donnees_recentes(heures: int = 2) -> pd.DataFrame:
    engine = get_engine()

    query = f"""
        SELECT *
        FROM {TABLE_NAME}
        WHERE `timestamp` >= NOW() - INTERVAL {int(heures)} HOUR
        ORDER BY location_id, `timestamp`
    """

    try:
        with engine.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    finally:
        engine.close()

    return pd.DataFrame(rows)

def sauvegarder_predictions(df: pd.DataFrame):
    conn = get_engine()
    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO predictions (
                    location_id,
                    timestamp,
                    predicted_for,
                    pm25,
                    pm10,
                    co2,
                    tvoc,
                    co,
                    no,
                    no2,
                    so2,
                    o3,
                    nh3
                )
                VALUES (
                    %(location_id)s,
                    %(timestamp)s,
                    %(predicted_for)s,
                    %(pm25)s,
                    %(pm10)s,
                    %(co2)s,
                    %(tvoc)s,
                    %(co)s,
                    %(no)s,
                    %(no2)s,
                    %(so2)s,
                    %(o3)s,
                    %(nh3)s
                )
            """
            cur.executemany(query, df.to_dict("records"))
            conn.commit()

    finally:
        conn.close()
        
        
if __name__ == "__main__":
    print(charger_donnees_recentes(heures=1).head(20))
