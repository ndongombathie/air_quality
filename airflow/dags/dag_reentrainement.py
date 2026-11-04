from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import sys
sys.path.append('/opt/airflow')

from scripts.db_utils import charger_donnees_historique
from scripts.feature_engineering import construire_dataset
from scripts.training import entrainer_tous_les_modeles
from scripts.xgboost_train import entrainer_tous_les_xgboost
from scripts.config import JOURS_HISTORIQUE_ENTRAINEMENT

default_args = {
    'owner': 'airflow',
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def tache_entrainement(**context):
    #creer_tables_si_absentes()
    df_brut = charger_donnees_historique(jours=JOURS_HISTORIQUE_ENTRAINEMENT)
    if df_brut.empty:
        raise ValueError("Aucune donnée historique trouvée")
    
    df_features = construire_dataset(df_brut, avec_target=True)
    resultats = entrainer_tous_les_modeles(df_features)# randomforest
    resultats_xgboost = entrainer_tous_les_xgboost(df_features)
    
    context['ti'].xcom_push(key='resultats_entrainement', value=resultats.to_dict())
    context['ti'].xcom_push(key='resultats_xgboost', value=resultats_xgboost.to_dict())

with DAG(
    'reentrainement_modeles_pollution',
    default_args=default_args,
    description="Réentraîne les modèles de prédiction pour tous les polluants",
    schedule_interval='0 */2 * * * *',   # tous les heures
    start_date=datetime(2026, 7, 1),
    catchup=False,
    tags=['ml', 'training', 'pollution'],
) as dag:

    entrainer = PythonOperator(
        task_id='entrainer_tous_les_modeles',
        python_callable=tache_entrainement,
    )