# Projet transversal

# copier le fichier .env.example en .env
cp .env.example .env

# creer un venv
python -m venv venv
# activate un venv
source venv/bin/activate

# install les dependencies
pip install -r requirements.txt

# lancer docker-compose
docker-compose up -d

# creer un topic kafka nommé "air-quality"   
docker exec kafka kafka-topics --create --topic air-quality --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

# lancer le producer
python producer.py

# lancer le consumer
python consumer.py

# extraire les données
python extrait.py
