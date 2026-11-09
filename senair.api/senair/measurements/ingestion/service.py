"""
Service d'ingestion des mesures, idempotent :
- une seule Reading par station et horodatage capteur (contrainte unique) : un doublon est ignoré et compté ;
- IQA calculé par le backend (domain.compute_aqi), l'IQA du pipeline est gardé dans upstream_aqi ;
- Station.last_observed_at ne fait qu'avancer (maximum des horodatages reçus) ;
- compteurs DataSource sur une fenêtre de 24 h remise à zéro quand elle expire, statut selon le taux de rejet ;
- le moteur d'alertes (senair.alerts.services.evaluate_reading) est appelé après chaque mesure enregistrée.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from senair.common.domain import compute_aqi
from senair.measurements.geo import distance_m
from senair.measurements.models import Reading
from senair.network.models import DataSource, Station, Zone

from .base import VALUE_FIELDS, InvalidMessage, MessageContext, NormalizedMeasurement
from .validation import validate

logger = logging.getLogger("senair.ingestion")

COUNTER_WINDOW = timedelta(hours=24)
# Taux de rejet sur 24 h au-delà duquel une source passe « dégradée », puis « en panne ».
DEGRADED_RATE = 0.10
DOWN_RATE = 0.50


def source_status(accepted: int, rejected: int) -> str:
    total = accepted + rejected
    rate = rejected / total if total else 0.0
    if rate >= DOWN_RATE:
        return DataSource.Status.DOWN
    if rate >= DEGRADED_RATE:
        return DataSource.Status.DEGRADED
    return DataSource.Status.HEALTHY


@dataclass
class IngestStats:
    accepted: int = 0
    duplicates: int = 0
    rejected: int = 0
    skipped: int = 0
    partial_rejections: int = 0
    stations_created: int = 0
    reasons: dict[str, int] = field(default_factory=lambda: defaultdict(int))


@dataclass
class _Counter:
    accepted: int = 0
    rejected: int = 0
    last_sync_at: datetime | None = None


class IngestionService:
    """À instancier pour un lot (import, session de consommation) : met en cache stations et zones, regroupe les compteurs."""

    def __init__(self, evaluate_alerts: bool = True):
        self.evaluate_alerts = evaluate_alerts
        self.stats = IngestStats()
        self._stations: dict[str, Station] = {}
        self._zones: list[Zone] | None = None
        self._counters: dict[str, _Counter] = defaultdict(_Counter)
        self._enabled: dict[str, bool] = {}

    # ─── API publique ───

    def ingest(self, measurement: NormalizedMeasurement, context: MessageContext | None = None) -> str:
        """Retourne « accepted », « duplicate » ou « skipped » ; lève InvalidMessage (compté comme rejet)."""
        try:
            validate(measurement)
            if not self._source_enabled(measurement.data_source):
                self.stats.skipped += 1
                return "skipped"
            station = self._resolve_station(measurement)
            reading = self._store(station, measurement, context or MessageContext())
        except InvalidMessage as error:
            self.reject(measurement.data_source, error.reason)
            raise
        self._touch(measurement.data_source)
        if reading is None:
            self.stats.duplicates += 1
            return "duplicate"
        self.stats.accepted += 1
        self.stats.partial_rejections += len(measurement.partial_rejections)
        self._counters[measurement.data_source].accepted += 1
        if any(source == "openweathermap" for source in measurement.sources.values()) and measurement.data_source != "historique":
            self._counters["openweathermap"].accepted += 1
            self._touch("openweathermap")
        self._evaluate(reading)
        return "accepted"

    def reject(self, data_source: str, reason: str) -> None:
        """Rejet complet d'un message (y compris avant adaptation : JSON illisible, schéma non respecté)."""
        self.stats.rejected += 1
        self.stats.reasons[reason] += 1
        self._counters[data_source].rejected += 1
        self._touch(data_source)

    def flush(self) -> None:
        """Reporte les compteurs accumulés sur les DataSource (fenêtre glissante de 24 h)."""
        now = timezone.now()
        for source_id, counter in self._counters.items():
            with transaction.atomic():
                source = DataSource.objects.select_for_update().filter(pk=source_id).first()
                if source is None:
                    continue
                if source.counters_reset_at is None or now - source.counters_reset_at >= COUNTER_WINDOW:
                    source.accepted_24h = source.rejected_24h = 0
                    source.counters_reset_at = now
                source.accepted_24h += counter.accepted
                source.rejected_24h += counter.rejected
                if counter.last_sync_at and (source.last_sync_at is None or counter.last_sync_at > source.last_sync_at):
                    source.last_sync_at = counter.last_sync_at
                if source.enabled:
                    source.status = source_status(source.accepted_24h, source.rejected_24h)
                source.save(update_fields=["accepted_24h", "rejected_24h", "counters_reset_at", "last_sync_at", "status"])
        self._counters.clear()
        # Les caches ne vivent que le temps d'un lot : une modification d'administration est vue au lot suivant.
        self._enabled.clear()
        self._stations.clear()
        self._zones = None

    # ─── Étapes ───

    def _source_enabled(self, source_id: str) -> bool:
        if source_id not in self._enabled:
            source = DataSource.objects.filter(pk=source_id).only("enabled").first()
            # Une source non déclarée n'est pas bloquée : seule une désactivation explicite coupe l'ingestion.
            self._enabled[source_id] = source.enabled if source else True
        return self._enabled[source_id]

    def _touch(self, source_id: str) -> None:
        self._counters[source_id].last_sync_at = timezone.now()

    def _resolve_station(self, m: NormalizedMeasurement) -> Station:
        cached = self._stations.get(m.station_ref)
        if cached is not None:
            return cached
        station = Station.objects.select_related("zone").filter(Q(external_id=m.station_ref) | Q(pk=m.station_ref)).first()
        if station is None:
            station = self._register_station(m)
        self._stations[m.station_ref] = station
        return station

    def _register_station(self, m: NormalizedMeasurement) -> Station:
        if m.latitude is None or m.longitude is None:
            raise InvalidMessage("Station inconnue sans coordonnées.")
        zone = self._nearest_zone(m.latitude, m.longitude)
        name = m.station_name or f"Station {m.station_ref}"
        station_id = (
            m.station_ref if len(m.station_ref) <= 64 and not Station.objects.filter(pk=m.station_ref).exists() else Station.new_id()
        )
        try:
            with transaction.atomic():
                station = Station.objects.create(
                    id=station_id,
                    external_id=m.station_ref[:100],
                    provider="AirGradient" if m.data_source in {"airgradient", "historique"} else m.data_source,
                    name=name,
                    short_name=name[:40],
                    zone=zone,
                    latitude=m.latitude,
                    longitude=m.longitude,
                )
        except IntegrityError:  # créée entre-temps par un autre consommateur
            return Station.objects.select_related("zone").get(external_id=m.station_ref[:100])
        self.stats.stations_created += 1
        logger.info("Station %s enregistrée automatiquement (zone %s).", station.pk, zone.pk)
        return station

    def _nearest_zone(self, lat: float, lon: float) -> Zone:
        if self._zones is None:
            self._zones = list(Zone.objects.all())
        if not self._zones:
            zone, _ = Zone.objects.get_or_create(
                id=slugify("Thiès"), defaults={"name": "Thiès", "centroid_latitude": lat, "centroid_longitude": lon}
            )
            self._zones = [zone]
        return min(self._zones, key=lambda z: distance_m(lat, lon, z.centroid_latitude, z.centroid_longitude))

    def _store(self, station: Station, m: NormalizedMeasurement, context: MessageContext) -> Reading | None:
        if Reading.objects.filter(station=station, observed_at=m.observed_at).exists():
            return None
        values = {name: m.values.get(name) for name in VALUE_FIELDS}
        result = compute_aqi(values)
        sources = {name: source for name, source in m.sources.items() if name in VALUE_FIELDS}
        try:
            with transaction.atomic():
                reading = Reading.objects.create(
                    station=station,
                    observed_at=m.observed_at,
                    message_format=m.message_format,
                    kafka_topic=context.topic[:120],
                    kafka_partition=context.partition,
                    kafka_offset=context.offset,
                    status=m.status,
                    sources=sources,
                    aqi=result.aqi,
                    aqi_level=result.level,
                    dominant_pollutant=result.dominant,
                    upstream_aqi=m.upstream_aqi,
                    **values,
                )
        except IntegrityError:
            return None
        Station.objects.filter(pk=station.pk).filter(Q(last_observed_at__isnull=True) | Q(last_observed_at__lt=m.observed_at)).update(
            last_observed_at=m.observed_at
        )
        return reading

    def _evaluate(self, reading: Reading) -> None:
        if not self.evaluate_alerts:
            return
        try:
            from senair.alerts.services import evaluate_reading

            evaluate_reading(reading)
        except Exception:  # le moteur d'alertes ne doit jamais bloquer l'ingestion
            logger.exception("Évaluation des alertes en échec pour la mesure %s.", reading.pk)


def ingest(measurement: NormalizedMeasurement, context: MessageContext | None = None) -> str:
    """Ingestion unitaire (compteurs reportés immédiatement)."""
    service = IngestionService()
    try:
        return service.ingest(measurement, context)
    finally:
        service.flush()
