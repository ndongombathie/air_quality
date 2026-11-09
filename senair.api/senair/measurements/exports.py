"""
Export des données brutes (D27) : mesures, alertes ou prévisions en CSV ou JSON, déposées dans default_storage
sous exports/ et servies par une URL signée temporaire. Colonnes identiques au mode démonstration du front
(packages/core/src/mock/api.ts, buildExport) ; l'export des prévisions ajoute modele et genere_a.
"""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import serializers

from senair.alerts.models import Alert
from senair.common.domain import AQI_LEVEL_LABELS, MEASURE_CODES, iso
from senair.common.downloads import signed_url
from senair.common.exceptions import validation_error
from senair.common.files import to_csv
from senair.forecasts.models import ForecastPoint
from senair.network.models import Station, Zone
from senair.reporting.audit import record

from .models import Reading

MAX_SPAN = timedelta(days=366)


class ExportQuerySerializer(serializers.Serializer):
    dataset = serializers.ChoiceField(choices=["readings", "alerts", "forecasts"])
    format = serializers.ChoiceField(choices=["csv", "json"])
    # « from » est un mot réservé Python : champ renommé, source de la clé JSON conservée.
    from_ = serializers.DateTimeField()
    to = serializers.DateTimeField()
    station_ids = serializers.ListField(child=serializers.CharField(max_length=64), required=False, allow_empty=True, max_length=200)

    def get_fields(self):
        fields = super().get_fields()
        fields["from"] = fields.pop("from_")
        return fields

    def validate(self, attrs):
        if attrs["from"] > attrs["to"]:
            raise serializers.ValidationError({"from": "La date de début doit précéder la date de fin."})
        if attrs["to"] - attrs["from"] > MAX_SPAN:
            raise serializers.ValidationError({"to": "Période trop longue (366 jours au plus)."})
        return attrs


@dataclass(frozen=True)
class ExportQuery:
    dataset: str
    format: str
    start: datetime
    end: datetime
    station_ids: tuple[str, ...]


def parse_query(data) -> ExportQuery:
    if not isinstance(data, dict):
        raise validation_error({"_form": "Objet JSON attendu."})
    serializer = ExportQuerySerializer(data=data)
    serializer.is_valid(raise_exception=True)
    v = serializer.validated_data
    return ExportQuery(v["dataset"], v["format"], v["from"], v["to"], tuple(v.get("station_ids") or ()))


def _label(level: str | None) -> str | None:
    return AQI_LEVEL_LABELS.get(level) if level else None


def readings_table(q: ExportQuery) -> tuple[list[str], list[list]]:
    header = ["location_id", "location_name", "latitude", "longitude", "timestamp", *MEASURE_CODES, "iqa", "categorie_iqa"]
    rows = Reading.objects.select_related("station").filter(observed_at__gte=q.start, observed_at__lte=q.end)
    if q.station_ids:
        rows = rows.filter(station_id__in=q.station_ids)
    table = [
        [
            r.station.external_id or r.station_id,
            r.station.name,
            r.station.latitude,
            r.station.longitude,
            iso(r.observed_at),
            *(getattr(r, code) for code in MEASURE_CODES),
            r.aqi,
            _label(r.aqi_level),
        ]
        for r in rows.order_by("station_id", "observed_at").iterator(chunk_size=2000)
    ]
    return header, table


def alerts_table(q: ExportQuery) -> tuple[list[str], list[list]]:
    header = ["id", "debut", "fin", "statut", "niveau", "polluant", "valeur", "unite", "seuil", "referentiel", "station", "quartier"]
    rows = Alert.objects.select_related("station", "zone").filter(started_at__gte=q.start, started_at__lte=q.end)
    if q.station_ids:
        rows = rows.filter(station_id__in=q.station_ids)
    table = [
        [
            str(a.id),
            iso(a.started_at),
            iso(a.resolved_at),
            a.status,
            _label(a.severity),
            a.pollutant,
            a.value,
            a.unit,
            a.threshold_value,
            a.reference,
            a.station.name if a.station else None,
            a.zone.name if a.zone else None,
        ]
        for a in rows.order_by("started_at")
    ]
    return header, table


def forecasts_table(q: ExportQuery) -> tuple[list[str], list[list]]:
    header = [
        "station_id",
        "station",
        "horizon",
        "valide_a",
        "iqa",
        "niveau",
        "confiance",
        "intervalle_bas",
        "intervalle_haut",
        "modele",
        "genere_a",
    ]
    points = ForecastPoint.objects.select_related("run", "run__model").filter(run__generated_at__gte=q.start, run__generated_at__lte=q.end)
    if q.station_ids:
        points = points.filter(run__scope="station", run__scope_id__in=q.station_ids)
    names = {
        "city": {"thies": "Thiès"},
        "zone": dict(Zone.objects.values_list("id", "name")),
        "station": dict(Station.objects.values_list("id", "name")),
    }
    table = [
        [
            p.run.scope_id,
            names.get(p.run.scope, {}).get(p.run.scope_id, p.run.scope_id),
            p.horizon,
            iso(p.valid_at),
            p.aqi,
            _label(p.level),
            p.confidence,
            p.interval_low,
            p.interval_high,
            f"{p.run.model_id}@{p.run.model.version}",
            iso(p.run.generated_at),
        ]
        for p in points.order_by("run__generated_at", "valid_at")
    ]
    return header, table


TABLES = {"readings": readings_table, "alerts": alerts_table, "forecasts": forecasts_table}


def render(q: ExportQuery, header: list[str], rows: list[list]) -> bytes:
    if q.format == "csv":
        return to_csv(header, rows)
    document = {
        "dataset": q.dataset,
        "du": iso(q.start),
        "au": iso(q.end),
        "provenance": "SEN-AIR (données enregistrées par l'API)",
        "lignes": [dict(zip(header, row, strict=True)) for row in rows],
    }
    return json.dumps(document, ensure_ascii=False, indent=2).encode("utf-8")


def build_export(request, q: ExportQuery) -> dict:
    header, rows = TABLES[q.dataset](q)
    file_name = f"senair-{q.dataset}-{q.start:%Y-%m-%d}-au-{q.end:%Y-%m-%d}.{q.format}"
    storage_name = default_storage.save(f"exports/{uuid.uuid4().hex}-{file_name}", ContentFile(render(q, header, rows)))
    url, expires_at = signed_url(request, storage_name, file_name)
    record(
        request,
        "data.export",
        "export",
        q.dataset,
        {
            "dataset": {"from": None, "to": q.dataset},
            "format": {"from": None, "to": q.format},
            "period_start": {"from": None, "to": iso(q.start)},
            "period_end": {"from": None, "to": iso(q.end)},
            "rows": {"from": None, "to": len(rows)},
            **({"station_ids": {"from": None, "to": list(q.station_ids)}} if q.station_ids else {}),
        },
    )
    return {"download_url": url, "file_name": file_name, "expires_at": expires_at}
