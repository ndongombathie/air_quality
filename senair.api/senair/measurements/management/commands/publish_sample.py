"""Publie un message exemple sur chaque topic du pipeline (démonstrations)."""

import json
import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from senair.measurements.ingestion import samples


class Command(BaseCommand):
    help = "Publie un message exemple de chaque topic (air-quality, measurements, models, forecasts, interpolations)."

    def add_arguments(self, parser):
        parser.add_argument("--only", default="", help="Topics à publier, séparés par des virgules (par défaut : tous).")

    def handle(self, *args, **options):
        try:
            from kafka import KafkaProducer
            from kafka.errors import KafkaError
        except ImportError as error:  # pragma: no cover
            raise CommandError("kafka-python n'est pas installé (requirements.txt).") from error

        if options["verbosity"] < 2:
            logging.getLogger("kafka").setLevel(logging.WARNING)
        conf = settings.SENAIR
        now = timezone.now()
        # Le modèle est déclaré avant ses prévisions (il arrive en « candidate » ; activation dans le back-office).
        messages = [
            (conf["TOPIC_MEASUREMENTS_RAW"], "168373", samples.airgradient_raw(now - timedelta(minutes=1))),  # distincte de la mesure v1
            (conf["TOPIC_MEASUREMENTS"], "168373", samples.measurement_v1(now)),
            (conf["TOPIC_MODELS"], "xgboost-forecast", samples.model_v1()),
            (conf["TOPIC_FORECASTS"], "city:thies", samples.forecast_v1()),
            (conf["TOPIC_INTERPOLATIONS"], "aqi", samples.interpolation_v1()),
        ]
        only = {t.strip() for t in options["only"].split(",") if t.strip()}
        if only:
            messages = [m for m in messages if m[0] in only]

        try:
            producer = KafkaProducer(bootstrap_servers=conf["KAFKA_BOOTSTRAP_SERVERS"], acks="all", client_id="senair-api-samples")
            for topic, key, payload in messages:
                producer.send(topic, key=key.encode(), value=json.dumps(payload, ensure_ascii=False).encode("utf-8")).get(timeout=30)
                self.stdout.write(f"Publié sur {topic}.")
            producer.flush()
            producer.close()
        except KafkaError as error:
            raise CommandError(f"Publication impossible ({type(error).__name__}).") from error
        self.stdout.write(self.style.SUCCESS(f"{len(messages)} message(s) publié(s)."))
