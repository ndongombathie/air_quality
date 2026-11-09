"""Importe l'historique du pipeline (export CSV de la table MySQL air_quality_data), par lots et de façon idempotente."""

import csv
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from senair.measurements.ingestion.adapters import HistoryRowAdapter
from senair.measurements.ingestion.base import InvalidMessage, MessageContext
from senair.measurements.ingestion.registry import MeasurementHandler
from senair.measurements.ingestion.service import IngestionService

DEFAULT_PATH = settings.REPO_DIR / "projet-transversal/air_quality.csv"


class Command(BaseCommand):
    help = "Importe un CSV au format air_quality_data (projet-transversal/air_quality.csv par défaut)."

    def add_arguments(self, parser):
        parser.add_argument("path", nargs="?", default=str(DEFAULT_PATH), help="Fichier CSV à importer.")
        parser.add_argument("--batch-size", type=int, default=500)
        parser.add_argument("--skip-alerts", action="store_true", help="N'évalue pas les alertes (import d'archives anciennes).")

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.is_file():
            raise CommandError(f"Fichier introuvable : {path}")
        batch_size = max(1, options["batch_size"])
        service = IngestionService(evaluate_alerts=not options["skip_alerts"])
        handler = MeasurementHandler(HistoryRowAdapter(), service)
        context = MessageContext(topic=f"file:{path.name}")

        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            missing = {"location_id", "timestamp"} - set(reader.fieldnames or [])
            if missing:
                raise CommandError(f"Colonnes manquantes : {', '.join(sorted(missing))}.")
            batch: list[dict] = []
            for row in reader:
                batch.append(row)
                if len(batch) >= batch_size:
                    self._import(batch, handler, context)
                    batch = []
            if batch:
                self._import(batch, handler, context)

        stats = service.stats
        self.stdout.write(
            self.style.SUCCESS(
                f"Import terminé : {stats.accepted} mesure(s) acceptée(s), {stats.duplicates} doublon(s), "
                f"{stats.rejected} rejetée(s), {stats.partial_rejections} valeur(s) écartée(s), "
                f"{stats.stations_created} station(s) créée(s)."
            )
        )
        for reason, count in sorted(stats.reasons.items(), key=lambda item: -item[1]):
            self.stdout.write(f"  rejet : {reason} ({count})")

    @staticmethod
    def _import(rows: list[dict], handler: MeasurementHandler, context: MessageContext) -> None:
        with transaction.atomic():
            for row in rows:
                try:
                    handler.handle(row, context)
                except InvalidMessage:
                    pass  # compté par le service (stats.rejected et raisons)
        handler.service.flush()
