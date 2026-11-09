"""Consomme les topics du pipeline (mesures, prévisions, modèles, grilles) et les enregistre. Voir docs/14-integration-donnees-ia.md."""

import logging
import signal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from senair.measurements.ingestion.registry import build_registry
from senair.measurements.ingestion.service import IngestionService
from senair.measurements.ingestion.stream import StreamRunner


class Command(BaseCommand):
    help = "Lit le flux Kafka du pipeline de l'équipe data (groupe KAFKA_GROUP_ID) et enregistre les messages."

    def add_arguments(self, parser):
        parser.add_argument("--max-messages", type=int, default=None, help="Arrêt après ce nombre de messages traités.")
        parser.add_argument("--timeout", type=float, default=None, help="Durée maximale d'exécution, en secondes.")
        parser.add_argument("--from-beginning", action="store_true", help="Relit chaque partition depuis le début (ingestion idempotente).")
        parser.add_argument(
            "--topics", default="", help="Liste de topics séparés par des virgules (par défaut : tous les topics déclarés)."
        )

    def handle(self, *args, **options):
        try:
            from kafka import KafkaConsumer, KafkaProducer
            from kafka.consumer.subscription_state import ConsumerRebalanceListener
            from kafka.errors import KafkaError
        except ImportError as error:  # pragma: no cover
            raise CommandError("kafka-python n'est pas installé (requirements.txt).") from error

        if options["verbosity"] < 2:
            logging.getLogger("kafka").setLevel(logging.WARNING)  # journaux de connexion de kafka-python très bavards
        conf = settings.SENAIR
        service = IngestionService()
        registry = build_registry(service)
        topics = [t.strip() for t in options["topics"].split(",") if t.strip()] or registry.topics()
        unknown = set(topics) - set(registry.topics())
        if unknown:
            raise CommandError(f"Topic(s) sans traitement déclaré : {', '.join(sorted(unknown))}.")

        try:
            consumer = KafkaConsumer(
                bootstrap_servers=conf["KAFKA_BOOTSTRAP_SERVERS"],
                group_id=conf["KAFKA_GROUP_ID"],
                client_id="senair-api",
                enable_auto_commit=False,
                auto_offset_reset="earliest",
                max_poll_records=100,
            )
        except KafkaError as error:
            raise CommandError(f"Connexion à Kafka impossible ({type(error).__name__}).") from error

        class _FromBeginning(ConsumerRebalanceListener):
            def __init__(self):
                self.done = set()

            def on_partitions_assigned(self, assigned):
                fresh = [tp for tp in assigned if tp not in self.done]
                if fresh:
                    consumer.seek_to_beginning(*fresh)
                    self.done.update(fresh)

            def on_partitions_revoked(self, revoked):
                pass

        if options["from_beginning"]:
            consumer.subscribe(topics, listener=_FromBeginning())
        else:
            consumer.subscribe(topics)

        def producer_factory():
            return KafkaProducer(bootstrap_servers=conf["KAFKA_BOOTSTRAP_SERVERS"], acks="all", client_id="senair-api-dlq")

        runner = StreamRunner(
            consumer,
            registry,
            service,
            producer_factory,
            dead_letter_topic=conf["TOPIC_DEAD_LETTER"],
            group_id=conf["KAFKA_GROUP_ID"],
            max_messages=options["max_messages"],
            timeout=options["timeout"],
        )
        previous = {sig: signal.signal(sig, runner.stop) for sig in (signal.SIGTERM, signal.SIGINT)}
        self.stdout.write(f"Lecture de {', '.join(topics)} (groupe {conf['KAFKA_GROUP_ID']}).")
        try:
            stats = runner.run()
        finally:
            for sig, handler in previous.items():
                signal.signal(sig, handler)
        self.stdout.write(
            self.style.SUCCESS(
                f"Messages traités : {stats.processed} (acceptés {stats.accepted}, doublons {stats.duplicates}, "
                f"ignorés {stats.skipped}, dead-letter {stats.dead_lettered}, nouveaux essais {stats.retries})."
            )
        )
