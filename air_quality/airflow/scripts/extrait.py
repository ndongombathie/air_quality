"""
Extraction des données MySQL des 5 dernières minutes.
Retourne un pandas.DataFrame (pas de JSON, ce DAG passe les données par CSV).
"""
import os
from datetime import datetime, timedelta

import pymysql
import pandas as pd

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
PASSWORD = os.getenv("PASSWORD", "042002")
MYSQL_DB = os.getenv("MYSQL_DB", "air_quality_db")
TABLE_NAME = os.getenv("MYSQL_TABLE", "air_quality_data")
# created_at = date d'insertion en base (fraîcheur réelle de la ligne).
# timestamp = date de la mesure côté capteur, qui peut rester figée si un
# capteur ne remonte plus de nouvelles valeurs. On filtre donc sur created_at
# pour capter "toute nouvelle ligne insérée depuis 5 minutes", même si la
# mesure elle-même est ancienne.
TIMESTAMP_COLUMN = os.getenv("MYSQL_TIMESTAMP_COL", "created_at")


def extract() -> pd.DataFrame:
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)

    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=PASSWORD,
        database=MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor,
    )

    query = f"""
        SELECT *
        FROM {TABLE_NAME}
        WHERE created_at >= %s
        ORDER BY created_at DESC
    """

    try:
        with conn.cursor() as cur:
            cur.execute(query, (five_minutes_ago,))
            rows = cur.fetchall()
    finally:
        conn.close()

    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = extract()
    if df is not None:
        print(df.head())