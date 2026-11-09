"""
Génère le rapport de la dernière période complète (à planifier par cron ou Airflow), visible ensuite en D20.
  generate_reports --period weekly            # semaine précédente (lundi 00:00 UTC au lundi suivant)
  generate_reports --period monthly --format csv
Sans --force, une période déjà générée avec succès dans ce format n'est pas refaite (relances sûres).
"""

from django.core.management.base import BaseCommand, CommandError

from senair.reporting.models import Report
from senair.reporting.reports import generate, previous_period


class Command(BaseCommand):
    help = "Génère le rapport hebdomadaire ou mensuel de la dernière période complète."

    def add_arguments(self, parser):
        parser.add_argument("--period", required=True, choices=[Report.Period.WEEKLY, Report.Period.MONTHLY])
        parser.add_argument("--format", default=Report.Format.PDF, choices=[choice.value for choice in Report.Format])
        parser.add_argument("--force", action="store_true", help="Régénère même si la période a déjà un rapport prêt.")

    def handle(self, *args, period: str, format: str, force: bool = False, **options):
        date_from, date_to = previous_period(period)
        existing = Report.objects.filter(
            period=period, format=format, date_from=date_from, date_to=date_to, status=Report.Status.READY
        ).first()
        if existing and not force:
            self.stdout.write(f"Rapport déjà disponible : {existing.file_name} ({existing.id}).")
            return
        report = generate(Report.objects.create(period=period, format=format, date_from=date_from, date_to=date_to, requested_by=None))
        if report.status != Report.Status.READY:
            raise CommandError(f"Échec de génération du rapport {report.id} : voir les journaux.")
        self.stdout.write(f"Rapport généré : {report.file_name} ({report.id}).")
