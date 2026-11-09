"""Alertes et seuils : lecture publique (P12 à P15) et administration (D5 à D10)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from senair.alerts.models import Alert, HealthGuidance, Threshold
from senair.common.domain import MEDICAL_DISCLAIMER
from senair.network.models import Station
from senair.reporting.models import AuditLogEntry
from tests.contract import assert_contract, body


def make_alert(station_id="168373", severity="unhealthy", hours_ago=1, **fields) -> Alert:
    station = Station.objects.get(pk=station_id)
    started = timezone.now() - timedelta(hours=hours_ago)
    values = {
        "status": "active",
        "pollutant": "pm25",
        "value": 40.0,
        "unit": "µg/m³",
        "threshold_value": 15.0,
        "reference": "WHO_2021",
        "title": "PM2.5 au-dessus du seuil OMS à Hôtel de Ville",
        "message": "Message",
        "recommendations": ["Limitez les efforts"],
        "started_at": started,
        "last_exceeded_at": started,
        "incident_note": "Note interne",
    }
    values.update(fields)
    return Alert.objects.create(severity=severity, station=station, zone=station.zone, **values)


# ─────────────── P12, P13 ───────────────


def test_public_alerts_hide_incident_fields(reference, anon, admin):
    alert = make_alert(handled_by=admin)
    response = anon.get("/api/v1/alerts")
    assert response.status_code == 200
    assert_contract(response, "get", "/alerts")
    item = body(response)["items"][0]
    assert item["id"] == str(alert.pk) and item["stationName"] == "Hôtel de Ville" and item["zoneName"] == "Centre-ville"
    assert "incidentNote" not in item and "handledBy" not in item
    detail = anon.get(f"/api/v1/alerts/{alert.pk}")
    assert detail.status_code == 200
    assert_contract(detail, "get", f"/alerts/{alert.pk}")
    assert "incidentNote" not in body(detail)


def test_public_alert_not_found(reference, anon):
    for alert_id in ("inconnue", "00000000-0000-4000-8000-000000000000"):
        response = anon.get(f"/api/v1/alerts/{alert_id}")
        assert response.status_code == 404
        assert_contract(response, "get", f"/alerts/{alert_id}")


def test_public_alert_filters_and_pagination(reference, anon):
    a = make_alert(severity="unhealthy", hours_ago=1)
    b = make_alert(severity="hazardous", hours_ago=2, status="acknowledged", pollutant="pm10")
    c = make_alert(station_id="168401", severity="moderate", hours_ago=30, status="resolved")

    def ids(query):
        response = anon.get(f"/api/v1/alerts?{query}")
        assert response.status_code == 200, body(response)
        assert_contract(response, "get", f"/alerts?{query}")
        return [item["id"] for item in body(response)["items"]]

    assert ids("") == [str(a.pk), str(b.pk), str(c.pk)]
    assert ids("status=active,acknowledged") == [str(a.pk), str(b.pk)]
    assert ids("severity=hazardous,moderate") == [str(b.pk), str(c.pk)]
    assert ids("pollutant=pm10") == [str(b.pk)]
    assert ids("zoneId=fahu") == [str(c.pk)]
    since = (timezone.now() - timedelta(hours=3)).isoformat().replace("+00:00", "Z")
    assert ids(f"from={since}") == [str(a.pk), str(b.pk)]
    until = (timezone.now() - timedelta(hours=10)).isoformat().replace("+00:00", "Z")
    assert ids(f"to={until}") == [str(c.pk)]
    page = body(anon.get("/api/v1/alerts?limit=2"))
    assert len(page["items"]) == 2 and page["total"] == 3 and page["nextCursor"]


@pytest.mark.parametrize("query", ["status=open", "severity=bad", "pollutant=co2", "from=hier"])
def test_public_alert_filters_validation(reference, anon, query):
    response = anon.get(f"/api/v1/alerts?{query}")
    assert response.status_code == 422


# ─────────────── P14, P15 ───────────────


def test_public_thresholds_only_enabled(reference, anon):
    Threshold.objects.filter(pollutant="o3").update(enabled=False)
    response = anon.get("/api/v1/thresholds")
    assert response.status_code == 200
    assert_contract(response, "get", "/thresholds")
    data = body(response)
    assert len(data) == 10 and all(t["enabled"] for t in data)
    co = next(t for t in data if t["pollutant"] == "co")
    assert co["unit"] == "mg/m³" and co["zoneId"] is None


def test_health_guidance_filters(reference, anon):
    response = anon.get("/api/v1/health-guidance?profile=asthma&level=unhealthy")
    assert response.status_code == 200
    assert_contract(response, "get", "/health-guidance?profile=asthma&level=unhealthy")
    data = body(response)
    assert len(data) == 1 and data[0]["disclaimer"] == MEDICAL_DISCLAIMER
    assert data[0]["actions"] == HealthGuidance.objects.get(profile="asthma", level="unhealthy").actions
    assert len(body(anon.get("/api/v1/health-guidance"))) == 48
    assert len(body(anon.get("/api/v1/health-guidance?level=good"))) == 8
    assert anon.get("/api/v1/health-guidance?profile=robot").status_code == 422


# ─────────────── D5 à D8 : seuils ───────────────

THRESHOLD = {
    "pollutant": "pm25",
    "reference": "WHO_2021",
    "period": "1h",
    "value": 35,
    "unit": "µg/m³",
    "zoneId": "centre-ville",
    "alertLevel": "unhealthy",
    "enabled": True,
}


def test_admin_thresholds_list_includes_disabled(reference, authority_client, citizen_client):
    Threshold.objects.filter(pollutant="o3").update(enabled=False)
    response = authority_client.get("/api/v1/admin/thresholds")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/thresholds")
    assert len(body(response)) == 12
    assert citizen_client.get("/api/v1/admin/thresholds").status_code == 403


def test_admin_threshold_crud_is_audited(reference, admin, admin_client):
    created = admin_client.post("/api/v1/admin/thresholds", THRESHOLD, format="json")
    assert created.status_code == 201, body(created)
    assert_contract(created, "post", "/admin/thresholds")
    data = body(created)
    assert data["zoneId"] == "centre-ville" and data["updatedBy"] == "admin@test.sn"
    threshold_id = data["id"]
    assert AuditLogEntry.objects.filter(action="threshold.create", resource_id=threshold_id).exists()

    updated = admin_client.patch(f"/api/v1/admin/thresholds/{threshold_id}", {"value": 40, "enabled": False}, format="json")
    assert updated.status_code == 200
    assert_contract(updated, "patch", f"/admin/thresholds/{threshold_id}")
    assert body(updated)["value"] == 40 and body(updated)["enabled"] is False
    entry = AuditLogEntry.objects.get(action="threshold.update")
    assert entry.changes == {"value": {"from": 35.0, "to": 40.0}, "enabled": {"from": True, "to": False}}

    deleted = admin_client.delete(f"/api/v1/admin/thresholds/{threshold_id}")
    assert deleted.status_code == 204
    assert_contract(deleted, "delete", f"/admin/thresholds/{threshold_id}")
    assert not Threshold.objects.filter(pk=threshold_id).exists()
    assert AuditLogEntry.objects.filter(action="threshold.delete", resource_id=threshold_id).exists()
    assert admin_client.delete(f"/api/v1/admin/thresholds/{threshold_id}").status_code == 404


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"pollutant": "co"}, "unit"),  # CO en mg/m³
        ({"unit": "ppm"}, "unit"),
        ({"value": 0}, "value"),
        ({"zoneId": "inconnue"}, "zoneId"),
        ({"period": "2h"}, "period"),
        ({"zoneId": None, "period": "24h"}, "period"),  # doublon du seuil ville OMS 24 h
    ],
)
def test_admin_threshold_validation(reference, admin_client, change, field):
    response = admin_client.post("/api/v1/admin/thresholds", {**THRESHOLD, **change}, format="json")
    assert response.status_code == 422
    assert_contract(response, "post", "/admin/thresholds")
    assert field in body(response)["details"]["fields"]


def test_admin_threshold_patch_checks_unit_consistency(reference, admin_client):
    threshold = Threshold.objects.get(pollutant="pm25", reference="WHO_2021")
    response = admin_client.patch(f"/api/v1/admin/thresholds/{threshold.pk}", {"pollutant": "co"}, format="json")
    assert response.status_code == 422 and "unit" in body(response)["details"]["fields"]
    ok = admin_client.patch(f"/api/v1/admin/thresholds/{threshold.pk}", {"pollutant": "co", "unit": "mg/m³", "period": "1h"}, format="json")
    assert ok.status_code == 200


def test_admin_threshold_write_requires_thresholds_manage(reference, authority_client):
    threshold = Threshold.objects.first()
    assert authority_client.post("/api/v1/admin/thresholds", THRESHOLD, format="json").status_code == 403
    assert authority_client.patch(f"/api/v1/admin/thresholds/{threshold.pk}", {"value": 1}, format="json").status_code == 403
    assert authority_client.delete(f"/api/v1/admin/thresholds/{threshold.pk}").status_code == 403


# ─────────────── D9, D10 : alertes ───────────────


def test_admin_alerts_include_incident_fields(reference, authority, authority_client, citizen_client):
    make_alert(handled_by=authority)
    response = authority_client.get("/api/v1/admin/alerts?status=active")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/alerts?status=active")
    item = body(response)["items"][0]
    assert item["incidentNote"] == "Note interne" and item["handledBy"] == "authority@test.sn"
    assert citizen_client.get("/api/v1/admin/alerts").status_code == 403


def test_admin_acknowledge_then_resolve(reference, authority, authority_client):
    alert = make_alert(incident_note=None)
    response = authority_client.patch(
        f"/api/v1/admin/alerts/{alert.pk}", {"status": "acknowledged", "incidentNote": "Équipe envoyée"}, format="json"
    )
    assert response.status_code == 200
    assert_contract(response, "patch", f"/admin/alerts/{alert.pk}")
    data = body(response)
    assert data["status"] == "acknowledged" and data["acknowledgedAt"] and data["resolvedAt"] is None
    assert data["incidentNote"] == "Équipe envoyée" and data["handledBy"] == "authority@test.sn"
    entry = AuditLogEntry.objects.get(action="alert.update")
    assert entry.changes["status"] == {"from": "active", "to": "acknowledged"}

    resolved = body(authority_client.patch(f"/api/v1/admin/alerts/{alert.pk}", {"status": "resolved"}, format="json"))
    assert resolved["status"] == "resolved" and resolved["resolvedAt"] and resolved["incidentNote"] == "Équipe envoyée"
    reopen = authority_client.patch(f"/api/v1/admin/alerts/{alert.pk}", {"status": "acknowledged"}, format="json")
    assert reopen.status_code == 422


def test_admin_alert_update_validation_and_permissions(reference, authority_client, citizen_client):
    alert = make_alert()
    assert authority_client.patch(f"/api/v1/admin/alerts/{alert.pk}", {"status": "active"}, format="json").status_code == 422
    long_note = {"status": "acknowledged", "incidentNote": "x" * 2001}
    assert authority_client.patch(f"/api/v1/admin/alerts/{alert.pk}", long_note, format="json").status_code == 422
    assert citizen_client.patch(f"/api/v1/admin/alerts/{alert.pk}", {"status": "resolved"}, format="json").status_code == 403
    assert authority_client.patch("/api/v1/admin/alerts/inconnue", {"status": "resolved"}, format="json").status_code == 404


# ─────────────── Historique limité, alertes manuelles, alertes comme notifications ───────────────


def test_old_resolved_alerts_leave_public_lists(reference, anon, authority_client):
    old = make_alert(status="resolved", hours_ago=24 * 120, resolved_at=timezone.now() - timedelta(days=119))
    still_open = make_alert(hours_ago=24 * 120, last_exceeded_at=timezone.now() - timedelta(hours=1))
    silent_station = make_alert(hours_ago=24 * 120)  # ouverte, mais plus aucune mesure depuis 120 jours
    recent_alert = make_alert(hours_ago=2)
    ids = {item["id"] for item in body(anon.get("/api/v1/alerts"))["items"]}
    assert ids == {str(still_open.pk), str(recent_alert.pk)}
    assert str(silent_station.pk) not in ids
    # Le back-office garde tout l'historique.
    assert str(old.pk) in {item["id"] for item in body(authority_client.get("/api/v1/admin/alerts"))["items"]}


def test_authority_creates_manual_alert_and_notifies(
    reference, authority, authority_client, citizen_client, monkeypatch, django_capture_on_commit_callbacks
):
    notified = []
    monkeypatch.setattr("senair.alerts.services._notify", notified.append)
    payload = {
        "zoneId": "centre-ville",
        "severity": "unhealthy",
        "pollutant": "pm10",
        "title": "Épisode de poussières attendu demain",
        "message": "L'harmattan va charger l'air en poussières dès demain matin.",
    }
    assert citizen_client.post("/api/v1/admin/alerts", payload, format="json").status_code == 403
    with django_capture_on_commit_callbacks(execute=True):
        response = authority_client.post("/api/v1/admin/alerts", payload, format="json")
    assert response.status_code == 201, response.content
    assert_contract(response, "post", "/admin/alerts")
    created = body(response)
    assert created["origin"] == "manual" and created["status"] == "active" and created["zoneName"] == "Centre-ville"
    assert created["recommendations"]  # conseils santé du niveau par défaut
    assert created["unit"] == "µg/m³" and created["threshold"] > 0
    assert notified == [Alert.objects.get(pk=created["id"]).pk]
    assert AuditLogEntry.objects.filter(action="alert.create", actor=authority).exists()


def test_manual_alert_validation(reference, authority_client):
    response = authority_client.post(
        "/api/v1/admin/alerts", {"zoneId": "inconnue", "severity": "good", "pollutant": "pm25", "title": "x", "message": "y"}, format="json"
    )
    assert response.status_code == 422
    assert_contract(response, "post", "/admin/alerts")
    assert set(body(response)["details"]["fields"]) >= {"zoneId", "severity", "title", "message"}


def test_manual_alert_is_not_resolved_by_measurements(reference, authority, authority_client):
    from senair.alerts.services import evaluate_reading
    from senair.measurements.models import Reading

    response = authority_client.post(
        "/api/v1/admin/alerts",
        {
            "zoneId": "centre-ville",
            "stationId": "168373",
            "severity": "unhealthy",
            "pollutant": "pm25",
            "title": "Alerte manuelle",
            "message": "Message de l'autorité sanitaire.",
        },
        format="json",
    )
    alert_id = body(response)["id"]
    reading = Reading.objects.create(station_id="168373", observed_at=timezone.now(), received_at=timezone.now(), pm25=2.0, sources=[])
    evaluate_reading(reading)
    assert Alert.objects.get(pk=alert_id).status == "active"


def test_admin_deletes_alert(reference, authority, authority_client, citizen_client):
    alert = make_alert()
    assert citizen_client.delete(f"/api/v1/admin/alerts/{alert.pk}").status_code == 403
    response = authority_client.delete(f"/api/v1/admin/alerts/{alert.pk}")
    assert response.status_code == 204
    assert not Alert.objects.filter(pk=alert.pk).exists()
    assert AuditLogEntry.objects.filter(action="alert.delete", actor=authority).exists()
    missing = authority_client.delete(f"/api/v1/admin/alerts/{alert.pk}")
    assert missing.status_code == 404
    assert_contract(missing, "delete", f"/admin/alerts/{alert.pk}")


def test_my_alerts_read_and_dismiss(reference, citizen, citizen_client):
    first, second, third = make_alert(hours_ago=1), make_alert(hours_ago=2), make_alert(hours_ago=3)
    page = citizen_client.get("/api/v1/me/alerts")
    assert_contract(page, "get", "/me/alerts")
    assert [item["read"] for item in body(page)["items"]] == [False, False, False]

    assert citizen_client.post(f"/api/v1/me/alerts/{first.pk}/read").status_code == 204
    assert citizen_client.post(f"/api/v1/me/alerts/{first.pk}/read").status_code == 204  # idempotent
    unread = body(citizen_client.get("/api/v1/me/alerts?unread=true"))
    assert {item["id"] for item in unread["items"]} == {str(second.pk), str(third.pk)}

    assert citizen_client.delete(f"/api/v1/me/alerts/{second.pk}").status_code == 204
    items = body(citizen_client.get("/api/v1/me/alerts"))["items"]
    assert [item["id"] for item in items] == [str(first.pk), str(third.pk)]
    # Retirée pour moi seulement : toujours publique.
    assert Alert.objects.filter(pk=second.pk).exists()

    assert citizen_client.post("/api/v1/me/alerts/read-all").status_code == 204
    assert body(citizen_client.get("/api/v1/me/alerts?unread=true"))["total"] == 0
    missing = citizen_client.post("/api/v1/me/alerts/inconnue/read")
    assert missing.status_code == 404
    assert_contract(missing, "post", "/me/alerts/inconnue/read")
    assert citizen_client.get("/api/v1/me/alerts?unread=peut-etre").status_code == 422


def test_my_alert_actions_require_account(reference, anon):
    alert = make_alert()
    assert anon.post(f"/api/v1/me/alerts/{alert.pk}/read").status_code == 401
    assert anon.delete(f"/api/v1/me/alerts/{alert.pk}").status_code == 401
