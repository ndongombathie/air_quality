from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import pandas as pd
import joblib

from scripts.extrait import extract 
from scripts.modelKNN import modelKNN

RAW_PATH = "/opt/airflow/data/raw_data.csv"
CLEAN_PATH = "/opt/airflow/data/clean_data.csv"
IQR_PATH = "/opt/airflow/data/iqr_data.csv"
MODEL_PATH = "/opt/airflow/models/knn_model.pkl"


def extract_data(**context):
    df = extract()
    df = df.sort_values(["location_id", "timestamp"])
    df = df.groupby("location_id", as_index=False).first()
    df.to_csv(RAW_PATH, index=False)
    print("Extraction OK:", df.shape)


def clean_data(**context):
    df = pd.read_csv(RAW_PATH)
    # Un même capteur peut réinsérer plusieurs fois la même mesure (timestamp
    # de mesure inchangé) si created_at avance sans nouvelle valeur réelle.
    # On garde une seule occurrence par (location_id, timestamp de mesure).
    if {"location_id", "timestamp"}.issubset(df.columns):
        df = df.drop_duplicates(subset=["location_id", "timestamp"], keep="last")
    df = df.fillna(df.mean(numeric_only=True))
    df.to_csv(CLEAN_PATH, index=False)
    print("Cleaning OK:", df.shape)


def iqr_filter(df: pd.DataFrame) -> pd.DataFrame:
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.empty:
        return df

    Q1 = numeric_df.quantile(0.25)
    Q3 = numeric_df.quantile(0.75)
    IQR = Q3 - Q1

    mask = ~((numeric_df < (Q1 - 1.5 * IQR)) | (numeric_df > (Q3 + 1.5 * IQR))).any(axis=1)
    return df[mask]


def detect_outliers(**context):
    df = pd.read_csv(CLEAN_PATH)
    before = len(df)
    df = iqr_filter(df)
    print(f"IQR OK: {before} -> {len(df)} lignes après filtrage")
    df.to_csv(IQR_PATH, index=False)


def train_predict_knn(**context):
    df = pd.read_csv(IQR_PATH)

    # Garde-fou : pas assez de données pour un split train/test fiable
    """ MIN_ROWS = 10
    if len(df) < MIN_ROWS:
        print(f"Seulement {len(df)} lignes (< {MIN_ROWS}), entraînement reporté au prochain cycle.")
        return """

    model = modelKNN(df)
    joblib.dump(model, MODEL_PATH)
    print("KNN OK, modèle sauvegardé dans", MODEL_PATH)


default_args = {
    "owner": "airflow",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="air_quality_pipeline_model",
    default_args=default_args,
    start_date=datetime(2024, 1, 1),
    schedule_interval="*/5 * * * *",
    catchup=False,
    max_active_runs=1,
) as dag:

    t1 = PythonOperator(task_id="extract_data", python_callable=extract_data)
    t2 = PythonOperator(task_id="clean_data", python_callable=clean_data)
    t3 = PythonOperator(task_id="iqr_filter", python_callable=detect_outliers)
    t4 = PythonOperator(task_id="knn_predict", python_callable=train_predict_knn)

    t1 >> t2 >> t3 >> t4
    
if __name__ == "__main__":
    extract_data()
    