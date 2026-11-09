"""
Génération des rapports (D21, commande generate_reports) à partir des mesures et alertes réelles de la période.
Contenu repris de buildReport (packages/core/src/mock/api.ts) : synthèse ville, détail par station, échelle IQA, provenance.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import Avg, Count, Max, Q
from django.db.models.functions import TruncHour
from django.utils import timezone

from senair.alerts.models import Alert
from senair.common.domain import AQI_LEVEL_LABELS, AQI_LEVELS, FORMULAS, aqi_level, iso
from senair.common.files import PdfLine, to_csv, to_pdf
from senair.measurements.models import Reading
from senair.network.models import Station

from .models import Report

logger = logging.getLogger(__name__)

PERIOD_TITLES = {"weekly": "hebdomadaire", "monthly": "mensuel", "custom": "personnalisé"}
HEALTH_IMPACTS = {
    "good": "Risque négligeable.",
    "moderate": "Symptômes légers possibles pour les personnes sensibles.",
    "unhealthy_sensitive": "Réduire les activités prolongées en extérieur.",
    "unhealthy": "Toute la population peut ressentir des effets.",
    "very_unhealthy": "Alerte sanitaire : limiter les sorties.",
    "hazardous": "Rester à l'intérieur : conditions d'urgence.",
}
ND = "N/D"


@dataclass
class StationStats:
    station: Station
    mean: int | None
    max: int | None
    hours_above_100: int
    readings: int
    estimated: int
    alerts: int

    @property
    def level_label(self) -> str | None:
        level = aqi_level(self.mean)
        return AQI_LEVEL_LABELS[level] if level else None


def _round(value: float | None) -> int | None:
    return None if value is None else round(value)


def station_stats(date_from: datetime, date_to: datetime) -> list[StationStats]:
    readings = Reading.objects.filter(observed_at__gte=date_from, observed_at__lte=date_to)
    totals = {
        row["station_id"]: row
        for row in readings.values("station_id")
        .annotate(mean=Avg("aqi"), max=Max("aqi"), n=Count("pk"), estimated=Count("pk", filter=Q(status=Reading.Status.ESTIMATED)))
        .order_by()
    }
    # Heures dont l'IQA moyen dépasse 100 (moyennes horaires calculées en base).
    hours_above: dict[str, int] = {}
    hourly = (
        readings.exclude(aqi=None).annotate(hour=TruncHour("observed_at")).values("station_id", "hour").annotate(mean=Avg("aqi")).order_by()
    )
    for row in hourly:
        if row["mean"] is not None and row["mean"] > 100:
            hours_above[row["station_id"]] = hours_above.get(row["station_id"], 0) + 1
    alerts = {
        row["station_id"]: row["n"]
        for row in Alert.objects.filter(started_at__gte=date_from, started_at__lte=date_to, station__isnull=False)
        .values("station_id")
        .annotate(n=Count("pk"))
        .order_by()
    }
    stats = []
    for station in Station.objects.select_related("zone").order_by("name"):
        row = totals.get(station.id, {})
        stats.append(
            StationStats(
                station=station,
                mean=_round(row.get("mean")),
                max=_round(row.get("max")),
                hours_above_100=hours_above.get(station.id, 0),
                readings=row.get("n", 0),
                estimated=row.get("estimated", 0),
                alerts=alerts.get(station.id, 0),
            )
        )
    return stats


def file_name_for(report: Report) -> str:
    return f"senair-rapport-{report.period}-{report.date_from:%Y-%m-%d}-au-{report.date_to:%Y-%m-%d}.{report.format}"


def provenance(stats: list[StationStats]) -> str:
    total = sum(s.readings for s in stats)
    estimated = sum(s.estimated for s in stats)
    limits = settings.SENAIR["AQI_LIMITS"]
    pm25 = limits.get("pm25")
    text = (
        f"Mesures du réseau de capteurs de Thiès ({total} mesure(s) reçue(s) du pipeline de données, dont {estimated} estimée(s)). "
        f"IQA calculé par SEN-AIR : sous-indice = concentration / valeur limite × 100, valeur limite {FORMULAS['pm25']} : {pm25:g} µg/m³."
    )
    return text


def _render_csv(stats: list[StationStats]) -> bytes:
    return to_csv(
        ["station_id", "station", "quartier", "iqa_moyen", "iqa_max", "niveau_moyen", "heures_iqa_superieur_100", "mesures", "alertes"],
        [
            [s.station.id, s.station.name, s.station.zone.name, s.mean, s.max, s.level_label, s.hours_above_100, s.readings, s.alerts]
            for s in stats
        ],
    )


def _render_json(report: Report, stats: list[StationStats], generated_at: datetime, alert_total: int) -> bytes:
    payload = {
        "rapport": PERIOD_TITLES[report.period],
        "periode": {"du": iso(report.date_from), "au": iso(report.date_to)},
        "genereLe": iso(generated_at),
        "provenance": provenance(stats),
        "alertes": alert_total,
        "stations": [
            {
                "id": s.station.id,
                "nom": s.station.name,
                "quartier": s.station.zone.name,
                "iqaMoyen": s.mean,
                "iqaMax": s.max,
                "niveauMoyen": s.level_label,
                "heuresIqaSuperieur100": s.hours_above_100,
                "mesures": s.readings,
                "alertes": s.alerts,
            }
            for s in stats
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def _render_pdf(report: Report, stats: list[StationStats], generated_at: datetime, alert_total: int) -> bytes:
    measured = [s for s in stats if s.mean is not None]
    worst = max(measured, key=lambda s: s.mean, default=None)
    city_mean = round(sum(s.mean for s in measured) / len(measured)) if measured else None
    city_level = aqi_level(city_mean)
    lines = [
        PdfLine("SEN-AIR : qualité de l'air à Thiès", size=10),
        PdfLine(f"Rapport {PERIOD_TITLES[report.period]}", size=20, bold=True, gap_before=6),
        PdfLine(f"Période du {report.date_from:%Y-%m-%d} au {report.date_to:%Y-%m-%d}, généré le {generated_at:%Y-%m-%d}.", gap_before=4),
        PdfLine("Synthèse", size=14, bold=True, gap_before=14),
        PdfLine(
            f"IQA moyen des stations : {city_mean if city_mean is not None else ND} ({AQI_LEVEL_LABELS.get(city_level, ND)}).", gap_before=2
        ),
        PdfLine(
            f"Station la plus exposée : {worst.station.name}, IQA moyen {worst.mean}." if worst else f"Station la plus exposée : {ND}."
        ),
        PdfLine(f"Stations ayant transmis des mesures : {len(measured)} sur {len(stats)}."),
        PdfLine(f"Alertes sur la période : {alert_total}."),
        PdfLine("Détail par station", size=14, bold=True, gap_before=14),
        *[
            PdfLine(
                f"{s.station.name} ({s.station.zone.name}) : IQA moyen {s.mean if s.mean is not None else ND}, "
                f"maximum {s.max if s.max is not None else ND}, {s.level_label or ND}, {s.alerts} alerte(s).",
                size=10,
                gap_before=2,
            )
            for s in stats
        ],
        PdfLine("Échelle IQA", size=14, bold=True, gap_before=14),
        *[
            PdfLine(f"{low} à {high if high != float('inf') else '500 et plus'} : {label}. {HEALTH_IMPACTS[level_id]}", size=10)
            for level_id, low, high, label in AQI_LEVELS
        ],
        PdfLine("Provenance des données", size=14, bold=True, gap_before=14),
        PdfLine(provenance(stats), size=9),
    ]
    return to_pdf(lines)


def render(report: Report, generated_at: datetime) -> bytes:
    stats = station_stats(report.date_from, report.date_to)
    alert_total = Alert.objects.filter(started_at__gte=report.date_from, started_at__lte=report.date_to).count()
    if report.format == Report.Format.CSV:
        return _render_csv(stats)
    if report.format == Report.Format.JSON:
        return _render_json(report, stats, generated_at, alert_total)
    return _render_pdf(report, stats, generated_at, alert_total)


def generate(report: Report) -> Report:
    """Produit le fichier et met le rapport à « ready », ou « failed » (erreur journalisée, jamais renvoyée au client)."""
    report.status = Report.Status.RUNNING
    report.save(update_fields=["status"])
    try:
        generated_at = timezone.now()
        content = render(report, generated_at)
        report.file_name = file_name_for(report)
        report.file.save(f"{report.id}.{report.format}", ContentFile(content), save=False)
        report.generated_at = generated_at
        report.status = Report.Status.READY
        report.error = ""
    except Exception as error:
        logger.exception("Échec de génération du rapport %s", report.id)
        report.status = Report.Status.FAILED
        report.error = f"{type(error).__name__}: {error}"[:2000]
    report.save()
    return report


def previous_period(period: str, now: datetime | None = None) -> tuple[datetime, datetime]:
    """Dernière période complète (UTC, fuseau de Thiès) : semaine du lundi au lundi, ou mois civil précédent."""
    now = now or timezone.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == Report.Period.WEEKLY:
        end = today - timedelta(days=today.weekday())
        return end - timedelta(days=7), end
    end = today.replace(day=1)
    start = (end - timedelta(days=1)).replace(day=1)
    return start, end
