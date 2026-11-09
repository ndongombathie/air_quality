"""Alertes et seuils : lecture publique (P12 à P15) et administration (D5 à D10)."""

import uuid

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from senair.common.domain import AQI_LEVEL_IDS, HEALTH_PROFILES, PERIODS, POLLUTANT_CODES, REFERENCES, UNITS
from senair.common.exceptions import ApiError, validation_error
from senair.common.pagination import paginate
from senair.common.permissions import require
from senair.network.models import Station, Zone
from senair.reporting import audit

from .models import Alert, HealthGuidance, Threshold
from .presenters import admin_alert_payload, alert_payload, guidance_payload, threshold_payload
from .queries import filter_alerts, recent
from .services import create_manual_alert


class NoStoreMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class PublicView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "public"


def _uuid_or_404(value: str, message: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise ApiError("not_found", message, 404) from None


# ─────────────── P12 à P15 ───────────────


class AlertsView(PublicView):
    def get(self, request):
        return Response(paginate(request, recent(filter_alerts(request)), alert_payload))


class AlertDetailView(PublicView):
    def get(self, request, alert_id: str):
        alert = Alert.objects.select_related("station", "zone").filter(pk=_uuid_or_404(alert_id, "Alerte introuvable.")).first()
        if alert is None:
            raise ApiError("not_found", "Alerte introuvable.", 404)
        return Response(alert_payload(alert))


class ThresholdsView(PublicView):
    def get(self, request):
        thresholds = Threshold.objects.filter(enabled=True).select_related("updated_by")
        return Response([threshold_payload(t) for t in thresholds])


class HealthGuidanceView(PublicView):
    def get(self, request):
        params = request.query_params
        guidance = HealthGuidance.objects.all()
        errors = {}
        if profile := params.get("profile"):
            if profile not in HEALTH_PROFILES:
                errors["profile"] = "Profil inconnu."
            guidance = guidance.filter(profile=profile)
        if level := params.get("level"):
            if level not in AQI_LEVEL_IDS:
                errors["level"] = "Niveau inconnu."
            guidance = guidance.filter(level=level)
        if errors:
            raise validation_error(errors)
        ordered = sorted(guidance, key=lambda g: (HEALTH_PROFILES.index(g.profile), AQI_LEVEL_IDS.index(g.level)))
        return Response([guidance_payload(g) for g in ordered])


# ─────────────── D5 à D8 : seuils ───────────────


class ThresholdInputSerializer(serializers.Serializer):
    pollutant = serializers.ChoiceField(choices=POLLUTANT_CODES)
    reference = serializers.ChoiceField(choices=[code for code, _ in REFERENCES])
    period = serializers.ChoiceField(choices=[code for code, _ in PERIODS])
    value = serializers.FloatField()
    unit = serializers.ChoiceField(choices=sorted(set(UNITS.values()) | {"ppb"}))
    zone_id = serializers.CharField(allow_null=True, max_length=80)
    alert_level = serializers.ChoiceField(choices=AQI_LEVEL_IDS)
    enabled = serializers.BooleanField()

    def validate_value(self, value: float) -> float:
        if value <= 0:
            raise serializers.ValidationError("La valeur doit être strictement positive.")
        return value

    def validate_zone_id(self, value):
        if value is not None and not Zone.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Zone inconnue.")
        return value


def _threshold_fields(instance: Threshold | None, data: dict) -> dict:
    """Champs du modèle après fusion (PATCH partiel), avec contrôle de cohérence unité / polluant et d'unicité."""
    fields = {key: data[key] for key in data}
    merged = {
        name: fields.get(name, getattr(instance, name) if instance else None)
        for name in ("pollutant", "reference", "period", "unit", "zone_id")
    }
    expected = UNITS[merged["pollutant"]]
    if merged["unit"] != expected:
        raise validation_error({"unit": f"Unité attendue pour ce polluant : {expected}."})
    duplicate = Threshold.objects.filter(
        pollutant=merged["pollutant"], reference=merged["reference"], period=merged["period"], zone_id=merged["zone_id"]
    )
    if instance is not None:
        duplicate = duplicate.exclude(pk=instance.pk)
    if duplicate.exists():
        raise validation_error({"period": "Un seuil existe déjà pour ce polluant, ce référentiel, cette période et cette zone."})
    return fields


class AdminThresholdsView(NoStoreMixin, APIView):
    def get_permissions(self):
        return [require("admin:access" if self.request.method == "GET" else "thresholds:manage")()]

    def get(self, request):
        thresholds = Threshold.objects.select_related("updated_by")
        return Response([threshold_payload(t) for t in thresholds])

    def post(self, request):
        serializer = ThresholdInputSerializer(data=request.data if isinstance(request.data, dict) else {})
        serializer.is_valid(raise_exception=True)
        fields = _threshold_fields(None, serializer.validated_data)
        threshold = Threshold.objects.create(**fields, updated_by=request.user)
        audit.record(request, "threshold.create", "threshold", threshold.pk, {k: {"from": None, "to": v} for k, v in fields.items()})
        return Response(threshold_payload(threshold), status=status.HTTP_201_CREATED)


class AdminThresholdDetailView(NoStoreMixin, APIView):
    permission_classes = [require("thresholds:manage")]

    def _get(self, threshold_id: str) -> Threshold:
        threshold = Threshold.objects.filter(pk=_uuid_or_404(threshold_id, "Seuil introuvable.")).first()
        if threshold is None:
            raise ApiError("not_found", "Seuil introuvable.", 404)
        return threshold

    def patch(self, request, threshold_id: str):
        threshold = self._get(threshold_id)
        serializer = ThresholdInputSerializer(data=request.data if isinstance(request.data, dict) else {}, partial=True)
        serializer.is_valid(raise_exception=True)
        fields = _threshold_fields(threshold, serializer.validated_data)
        changes = audit.diff(threshold, fields)
        if changes:
            for name, value in fields.items():
                setattr(threshold, name, value)
            threshold.updated_by = request.user
            threshold.save()
            audit.record(request, "threshold.update", "threshold", threshold.pk, changes)
        return Response(threshold_payload(threshold))

    def delete(self, request, threshold_id: str):
        threshold = self._get(threshold_id)
        snapshot = threshold_payload(threshold)
        threshold.delete()
        audit.record(request, "threshold.delete", "threshold", threshold_id, {k: {"from": v, "to": None} for k, v in snapshot.items()})
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────── D9, D10 : alertes ───────────────


class AlertUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Alert.Status.ACKNOWLEDGED, Alert.Status.RESOLVED])
    incident_note = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class AlertCreateSerializer(serializers.Serializer):
    zone_id = serializers.CharField(max_length=80)
    station_id = serializers.CharField(max_length=40, required=False, allow_null=True)
    severity = serializers.ChoiceField(choices=[level for level in AQI_LEVEL_IDS if level != "good"])
    pollutant = serializers.ChoiceField(choices=POLLUTANT_CODES)
    value = serializers.FloatField(required=False, allow_null=True, min_value=0)
    title = serializers.CharField(min_length=5, max_length=200)
    message = serializers.CharField(min_length=10, max_length=2000)
    recommendations = serializers.ListField(child=serializers.CharField(max_length=200), max_length=5, required=False)

    def validate_zone_id(self, value):
        if not Zone.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Zone inconnue.")
        return value

    def validate(self, attrs):
        station_id = attrs.get("station_id")
        if station_id and not Station.objects.filter(pk=station_id, zone_id=attrs["zone_id"]).exists():
            raise serializers.ValidationError({"station_id": "Station inconnue dans cette zone."})
        return attrs


def get_alert(alert_id: str) -> Alert:
    alert = Alert.objects.select_related("station", "zone", "handled_by").filter(pk=_uuid_or_404(alert_id, "Alerte introuvable.")).first()
    if alert is None:
        raise ApiError("not_found", "Alerte introuvable.", 404)
    return alert


class AdminAlertsView(NoStoreMixin, APIView):
    def get_permissions(self):
        return [require("admin:access" if self.request.method == "GET" else "alerts:manage")()]

    def get(self, request):
        return Response(paginate(request, filter_alerts(request), admin_alert_payload, default_limit=50))

    def post(self, request):
        serializer = AlertCreateSerializer(data=request.data if isinstance(request.data, dict) else {})
        serializer.is_valid(raise_exception=True)
        alert = create_manual_alert(serializer.validated_data, request.user)
        changes = {
            key: {"from": None, "to": value}
            for key, value in {
                "severity": alert.severity,
                "pollutant": alert.pollutant,
                "zone_id": alert.zone_id,
                "title": alert.title,
            }.items()
        }
        audit.record(request, "alert.create", "alert", alert.pk, changes)
        return Response(admin_alert_payload(get_alert(str(alert.pk))), status=status.HTTP_201_CREATED)


class AdminAlertDetailView(NoStoreMixin, APIView):
    permission_classes = [require("alerts:manage")]

    def delete(self, request, alert_id: str):
        alert = get_alert(alert_id)
        snapshot = {"title": alert.title, "severity": alert.severity, "status": alert.status, "zone_id": alert.zone_id}
        alert.delete()
        audit.record(request, "alert.delete", "alert", alert_id, {k: {"from": v, "to": None} for k, v in snapshot.items()})
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, alert_id: str):
        alert = get_alert(alert_id)
        serializer = AlertUpdateSerializer(data=request.data if isinstance(request.data, dict) else {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if alert.status == Alert.Status.RESOLVED and data["status"] != Alert.Status.RESOLVED:
            raise validation_error({"status": "Une alerte résolue ne peut pas être rouverte."})

        now = timezone.now()
        updates: dict = {"status": data["status"], "handled_by_id": request.user.pk}
        if "incident_note" in data:
            updates["incident_note"] = data["incident_note"] or None
        if data["status"] == Alert.Status.ACKNOWLEDGED and alert.acknowledged_at is None:
            updates["acknowledged_at"] = now
        if data["status"] == Alert.Status.RESOLVED and alert.resolved_at is None:
            updates["resolved_at"] = now
        changes = audit.diff(alert, updates)
        for name, value in updates.items():
            setattr(alert, name, value)
        alert.handled_by = request.user
        alert.save(update_fields=list(updates))
        if changes:
            audit.record(request, "alert.update", "alert", alert.pk, changes)
        return Response(admin_alert_payload(alert))
