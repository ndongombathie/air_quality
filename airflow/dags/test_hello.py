from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

def hello():
    print("Airflow fonctionne !")

with DAG(
    dag_id="test_hello",
    start_date=datetime(2026, 1, 1),
    schedule="@daily",
    catchup=False,
) as dag:
    task = PythonOperator(task_id="say_hello", python_callable=hello)