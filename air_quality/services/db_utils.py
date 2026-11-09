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
    engine = get_engine()
    df.to_sql('predictions', engine, if_exists='append', index=False)

def creer_tables_si_absentes():
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(pymysql.text("""
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
                location_id BIGINT,
                timestamp TIMESTAMP,
                predicted_for TIMESTAMP,
                pm25 FLOAT, pm10 FLOAT, co2 FLOAT, tvoc FLOAT,
                co FLOAT, no FLOAT, no2 FLOAT, so2 FLOAT,
                o3 FLOAT, nh3 FLOAT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.commit()
        
if __name__ == "__main__":
    print(charger_donnees_historique(jours=1).head())
