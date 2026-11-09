"""
Ingestion des données du pipeline (Kafka, historique) : architecture Strategy.
- adapters.py : un adaptateur par format de message (AirGradient brut, measurement.v1, ligne d'historique) ;
- validation.py : règles communes (documentées en tête du module) ;
- service.py : enregistrement idempotent, IQA, compteurs des sources, hook d'alertes ;
- registry.py : un traitement par topic, extensible ;
- stream.py : boucle Kafka (commit après traitement, dead-letter).
"""
