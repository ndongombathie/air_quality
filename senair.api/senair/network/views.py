"""Référentiel : zones, stations (public et administration), sources de données."""

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from senair.common.domain import iso
from senair.common.exceptions import ApiError, validation_error
from senair.measurements.ingestion.service import COUNTER_WINDOW, source_status
from senair.measurements.params import AdminView, PublicReadView, choice_param
from senair.measurements.presenters import station_payload, zone_payload
from senair.measurements.queries import latest_readings
from senair.reporting.audit import diff, record

from .models import DataSource, Station, Zone


def _stations_payload(stations, include_latest: bool) -> list[dict]:
    stations = list(stations)
    latest = latest_readings([s.pk for s in stations]) if include_latest else {}
    return [station_payload(s, latest.get(s.pk), include_latest=include_latest) for s in stations]


def get_station(station_id: str) -> Station:
    station = Station.objects.select_related("zone").filter(pk=station_id).first()
    if station is None:
        raise ApiError("not_found", "Station introuvable.", status.HTTP_404_NOT_FOUND)
    return station


class ZoneListView(PublicReadView):
    def get(self, request):
        return Response([zone_payload(zone) for zone in Zone.objects.all()])


class StationListView(PublicReadView):
    def get(self, request):
        stations = Station.objects.select_related("zone")
        if zone_id := request.query_params.get("zoneId"):
            stations = stations.filter(zone_id=zone_id)
        if kind := choice_param(request, "type", Station.Type.values):
            stations = stations.filter(type=kind)
        include_latest = choice_param(request, "include", ["latest"]) == "latest"
        return Response(_stations_payload(stations, include_latest))


class StationDetailView(PublicReadView):
    def get(self, request, station_id: str):
        station = get_station(station_id)
        return Response(station_payload(station, latest_readings([station.pk]).get(station.pk), include_latest=True))


# ─── Administration des stations (D2 à D4) ───


class GeoPointSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)


class StationInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    short_name = serializers.CharField(max_length=40)
    zone_id = serializers.CharField()
    location = GeoPointSerializer()
    type = serializers.ChoiceField(choices=Station.Type.values)
    status = serializers.ChoiceField(choices=Station.Status.values)
    external_id = serializers.CharField(max_length=100, allow_null=True, allow_blank=True)
    provider = serializers.CharField(max_length=60)

    def validate_zone_id(self, value):
        if not Zone.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Zone inconnue.")
        return value

    def validate_external_id(self, value):
        value = (value or "").strip() or None
        if value is not None:
            others = Station.objects.filter(external_id=value)
            if self.instance is not None:
                others = others.exclude(pk=self.instance.pk)
            if others.exists():
                raise serializers.ValidationError("Identifiant déjà utilisé par une autre station.")
        return value


def _model_fields(data: dict) -> dict:
    fields = {key: value for key, value in data.items() if key != "location"}
    if "location" in data:
        fields["latitude"] = data["location"]["latitude"]
        fields["longitude"] = data["location"]["longitude"]
    return fields


def _validated(serializer: StationInputSerializer) -> dict:
    serializer.is_valid(raise_exception=True)  # 422 validation_error avec details.fields (gestionnaire commun)
    return serializer.validated_data


class AdminStationListView(AdminView):
    write_permission = "stations:manage"

    def get(self, request):
        return Response(_stations_payload(Station.objects.select_related("zone"), include_latest=True))

    def post(self, request):
        fields = _model_fields(_validated(StationInputSerializer(data=request.data)))
        with transaction.atomic():
            station = Station.objects.create(id=Station.new_id(), **fields)
            record(request, "station.create", "station", station.pk, {key: {"from": None, "to": value} for key, value in fields.items()})
        station = get_station(station.pk)
        return Response(station_payload(station, None, include_latest=True), status=status.HTTP_201_CREATED)


class AdminStationDetailView(AdminView):
    read_permission = "stations:manage"

    def patch(self, request, station_id: str):
        station = get_station(station_id)
        fields = _model_fields(_validated(StationInputSerializer(station, data=request.data, partial=True)))
        changes = diff(station, fields)
        with transaction.atomic():
            for name, value in fields.items():
                setattr(station, name, value)
            station.save()
            if changes:
                record(request, "station.update", "station", station.pk, changes)
        station = get_station(station.pk)
        return Response(station_payload(station, latest_readings([station.pk]).get(station.pk), include_latest=True))


# ─── Sources de données (D16, D17) ───


def data_source_payload(source: DataSource) -> dict:
    return {
        "id": source.id,
        "name": source.name,
        "kind": source.kind,
        "status": source.status,
        "enabled": source.enabled,
        "last_sync_at": iso(source.last_sync_at),
        "rejection_rate_24h": rejection_rate(source),
        "description": source.description,
    }


def rejection_rate(source: DataSource) -> float | None:
    if source.counters_reset_at is None or timezone.now() - source.counters_reset_at >= COUNTER_WINDOW:
        return None  # fenêtre expirée : aucun message depuis plus de 24 h
    return source.rejection_rate_24h


class DataSourceListView(AdminView):
    def get(self, request):
        return Response([data_source_payload(source) for source in DataSource.objects.all()])


class DataSourceDetailView(AdminView):
    read_permission = "sources:manage"

    def patch(self, request, source_id: str):
        source = DataSource.objects.filter(pk=source_id).first()
        if source is None:
            raise ApiError("not_found", "Source de données introuvable.", status.HTTP_404_NOT_FOUND)
        enabled = request.data.get("enabled") if isinstance(request.data, dict) else None
        if not isinstance(enabled, bool):
            raise validation_error({"enabled": "Booléen attendu."})
        new_status = source_status(source.accepted_24h, source.rejected_24h) if enabled else DataSource.Status.DISABLED
        changes = diff(source, {"enabled": enabled, "status": new_status})
        with transaction.atomic():
            source.enabled = enabled
            source.status = new_status
            source.save(update_fields=["enabled", "status"])
            if changes:
                record(request, "source.update", "data_source", source.pk, changes)
        return Response(data_source_payload(source))
