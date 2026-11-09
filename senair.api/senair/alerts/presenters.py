"""Représentations JSON des alertes, seuils et conseils santé (snake_case, converties en camelCase par le renderer)."""

from senair.common.domain import MEDICAL_DISCLAIMER, iso

from .models import Alert, HealthGuidance, Threshold


def alert_payload(alert: Alert, *, admin: bool = False, read: bool | None = None) -> dict:
    station = alert.station
    zone = alert.zone
    data = {
        "id": str(alert.pk),
        "origin": alert.origin,
        "severity": alert.severity,
        "status": alert.status,
        "pollutant": alert.pollutant,
        "value": alert.value,
        "unit": alert.unit,
        "threshold": alert.threshold_value,
        "reference": alert.reference,
        "station_id": station.pk if station else None,
        "station_name": station.name if station else None,
        "zone_id": zone.pk if zone else None,
        "zone_name": zone.name if zone else None,
        "title": alert.title,
        "message": alert.message,
        "recommendations": list(alert.recommendations or []),
        "started_at": iso(alert.started_at),
        "acknowledged_at": iso(alert.acknowledged_at),
        "resolved_at": iso(alert.resolved_at),
    }
    if admin:  # informations d'incident : routes /admin uniquement
        data["incident_note"] = alert.incident_note
        data["handled_by"] = alert.handled_by.email if alert.handled_by else None
    if read is not None:  # routes /me uniquement
        data["read"] = read
    return data


def admin_alert_payload(alert: Alert) -> dict:
    return alert_payload(alert, admin=True)


def threshold_payload(threshold: Threshold) -> dict:
    return {
        "id": str(threshold.pk),
        "pollutant": threshold.pollutant,
        "reference": threshold.reference,
        "period": threshold.period,
        "value": threshold.value,
        "unit": threshold.unit,
        "zone_id": threshold.zone_id,
        "alert_level": threshold.alert_level,
        "enabled": threshold.enabled,
        "updated_at": iso(threshold.updated_at),
        "updated_by": threshold.updated_by.email if threshold.updated_by else None,
    }


def guidance_payload(guidance: HealthGuidance) -> dict:
    return {
        "profile": guidance.profile,
        "level": guidance.level,
        "title": guidance.title,
        "actions": list(guidance.actions or []),
        "disclaimer": MEDICAL_DISCLAIMER,
    }
