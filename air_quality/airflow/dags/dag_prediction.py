from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import sys
sys.path.append('/opt/airflow')
RAW_PATH = "/opt/airflow/data/df_brut.csv"
predire_xgboost_path = "/opt/airflow/data/predictions_xgboost.csv"

from scripts.db_utils import charger_donnees_recentes, sauvegarder_predictions
from scripts.feature_engineering import construire_dataset
from scripts.prediction import predire_tous_polluants
from scripts.xgboost_prediction import predire_tous_polluants as predire_xgboost

default_args = {
    'owner': 'airflow',
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
}

def tache_prediction(**context):
    df_brut = charger_donnees_recentes(heures=1)
    df_brut.to_csv(RAW_PATH, index=False)
    if df_brut.empty:
        print("Pas de données récentes, on skip ce cycle")
        return
    
    df_features = construire_dataset(df_brut, avec_target=False)
    print(f"Nombre de features: {len(df_features)}")
    if df_features.empty:
        print("Pas assez de données pour calculer les features")
        return
    
    df_predictions = predire_tous_polluants(df_features)
    predictions_xgboost = predire_xgboost(df_features)
    predictions_xgboost.to_csv(predire_xgboost_path, index=False)
    df_predictions.to_csv("/opt/airflow/data/predictions_randomforest.csv", index=False)
    
    sauvegarder_predictions(df_predictions)
    print(f"{len(df_predictions)} prédictions sauvegardées")

with DAG(
    'prediction_pollution_temps_reel',
    default_args=default_args,
    description="Prédit tous les polluants à horizon +30min",
    schedule_interval='*/30 * * * *',   # toutes les 30 minutes
    start_date=datetime(2026, 7, 1),
    catchup=False,
    tags=['ml', 'prediction', 'pollution'],
) as dag:

    predire = PythonOperator(
        task_id='predire_tous_polluants',
        python_callable=tache_prediction,
    )