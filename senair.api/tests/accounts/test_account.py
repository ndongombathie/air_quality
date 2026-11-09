"""Compte citoyen (C1 à C8)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from senair.accounts.models import Device, NotificationPreferences, User
from senair.alerts.models import Alert
from senair.network.models import Station
from tests.conftest import client_for, make_user
from tests.contract import assert_contract, body


def test_me_requires_authentication(anon):
    response = anon.get("/api/v1/me")
    assert response.status_code == 401
    assert_contract(response, "get", "/me")


def test_me_returns_user_and_permissions(citizen_client, admin_client):
    response = citizen_client.get("/api/v1/me")
    assert response.status_code == 200
    assert_contract(response, "get", "/me")
    assert body(response)["permissions"] == ["profile:manage", "notifications:manage"]
    assert response["Cache-Control"] == "no-store"
    admin = body(admin_client.get("/api/v1/me"))
    assert admin["mfaEnabled"] is True and "audit:read" in admin["permissions"]


def test_me_disabled_account_loses_access(citizen, citizen_client):
    User.objects.filter(pk=citizen.pk).update(status="disabled")
    assert citizen_client.get("/api/v1/me").status_code == 401


def test_patch_me_updates_profile(reference, citizen, citizen_client):
    response = citizen_client.patch(
        "/api/v1/me", {"fullName": "  Awa Ndiaye ", "zoneIds": ["centre-ville", "fahu"], "healthProfile": "asthma"}, format="json"
    )
    assert response.status_code == 200
    assert_contract(response, "patch", "/me")
    data = body(response)
    assert data["fullName"] == "Awa Ndiaye" and data["zoneIds"] == ["centre-ville", "fahu"] and data["healthProfile"] == "asthma"
    citizen.refresh_from_db()
    assert citizen.health_consent_at is not None
    cleared = body(citizen_client.patch("/api/v1/me", {"healthProfile": None}, format="json"))
    citizen.refresh_from_db()
    assert cleared["healthProfile"] is None and citizen.health_consent_at is None


@pytest.mark.parametrize(
    "payload",
    [{"zoneIds": ["inconnue"]}, {"zoneIds": ["a", "b", "c", "d", "e", "f"]}, {"healthProfile": "x"}, {"fullName": "x" * 121}],
)
def test_patch_me_validation(reference, citizen_client, payload):
    response = citizen_client.patch("/api/v1/me", payload, format="json")
    assert response.status_code == 422
    assert_contract(response, "patch", "/me")


def test_delete_me_erases_account_devices_and_preferences(citizen, citizen_client):
    Device.objects.create(token="ExponentPushToken[abc]", user=citizen, platform="android")
    NotificationPreferences.objects.create(user=citizen)
    refresh = RefreshToken.for_user(citizen)
    response = citizen_client.delete("/api/v1/me")
    assert response.status_code == 204
    assert_contract(response, "delete", "/me")
    assert not User.objects.filter(pk=citizen.pk).exists()
    assert not Device.objects.exists() and not NotificationPreferences.objects.exists()
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()


# ─────────────── Préférences ───────────────


def test_preferences_defaults(reference, citizen, citizen_client):
    citizen.zones.set(["fahu"])
    response = citizen_client.get("/api/v1/me/notification-preferences")
    assert response.status_code == 200
    assert_contract(response, "get", "/me/notification-preferences")
    data = body(response)
    assert data["pushEnabled"] is True and data["emailEnabled"] is False
    assert data["zoneIds"] == ["fahu"] and data["minLevel"] == "unhealthy_sensitive"
    assert data["pollutants"] == ["pm25", "pm10", "no2", "so2", "co", "o3"]
    assert data["quietHours"] == {"start": "22:00", "end": "06:30"}


def test_preferences_put_roundtrip(reference, citizen_client):
    payload = {
        "pushEnabled": False,
        "emailEnabled": True,
        "zoneIds": ["centre-ville"],
        "minLevel": "unhealthy",
        "pollutants": ["pm10", "pm25"],
        "quietHours": None,
    }
    response = citizen_client.put("/api/v1/me/notification-preferences", payload, format="json")
    assert response.status_code == 200
    assert_contract(response, "put", "/me/notification-preferences")
    assert body(response) == {**payload, "pollutants": ["pm25", "pm10"]}
    assert body(citizen_client.get("/api/v1/me/notification-preferences")) == body(response)
    payload["quietHours"] = {"start": "23:00", "end": "07:15"}
    assert body(citizen_client.put("/api/v1/me/notification-preferences", payload, format="json"))["quietHours"] == payload["quietHours"]


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"pollutants": []}, "pollutants"),
        ({"pollutants": ["co2"]}, "pollutants.0"),
        ({"minLevel": "terrible"}, "minLevel"),
        ({"quietHours": {"start": "25:00", "end": "06:00"}}, "quietHours.start"),
        ({"zoneIds": ["inconnue"]}, "zoneIds"),
    ],
)
def test_preferences_validation(reference, citizen_client, change, field):
    payload = {
        "pushEnabled": True,
        "emailEnabled": False,
        "zoneIds": [],
        "minLevel": "moderate",
        "pollutants": ["pm25"],
        "quietHours": None,
    }
    response = citizen_client.put("/api/v1/me/notification-preferences", {**payload, **change}, format="json")
    assert response.status_code == 422
    assert field in body(response)["details"]["fields"]


def test_preferences_require_authentication(anon):
    assert anon.get("/api/v1/me/notification-preferences").status_code == 401


# ─────────────── Appareils ───────────────


def test_register_device_changes_owner(citizen, citizen_client, db):
    token = "ExponentPushToken[xyz]"
    response = citizen_client.post("/api/v1/me/devices", {"token": token, "platform": "android"}, format="json")
    assert response.status_code == 204
    assert_contract(response, "post", "/me/devices")
    Device.objects.filter(pk=token).update(invalid_at=timezone.now())
    other = make_user("citizen", email="autre@test.sn")
    client_for(other).post("/api/v1/me/devices", {"token": token, "platform": "ios"}, format="json")
    device = Device.objects.get(pk=token)
    assert device.user == other and device.platform == "ios" and device.invalid_at is None


def test_register_device_validation(citizen_client):
    response = citizen_client.post("/api/v1/me/devices", {"token": "t", "platform": "windows"}, format="json")
    assert response.status_code == 422


def test_unregister_device_only_own(citizen, citizen_client, db):
    other = make_user("citizen", email="autre@test.sn")
    Device.objects.create(token="ExponentPushToken[mine]", user=citizen, platform="android")
    Device.objects.create(token="ExponentPushToken[theirs]", user=other, platform="android")
    response = citizen_client.delete("/api/v1/me/devices/ExponentPushToken[mine]")
    assert response.status_code == 204
    assert_contract(response, "delete", "/me/devices/ExponentPushToken[mine]")
    assert citizen_client.delete("/api/v1/me/devices/ExponentPushToken[theirs]").status_code == 204
    assert list(Device.objects.values_list("token", flat=True)) == ["ExponentPushToken[theirs]"]


# ─────────────── Mes alertes ───────────────


def _alert(station_id: str, severity: str, **fields) -> Alert:
    station = Station.objects.get(pk=station_id)
    now = timezone.now()
    defaults = {
        "status": "active",
        "pollutant": "pm25",
        "value": 40,
        "unit": "µg/m³",
        "threshold_value": 15,
        "reference": "WHO_2021",
        "title": "PM2.5",
        "message": "Message",
        "started_at": now - timedelta(hours=1),
        "last_exceeded_at": now,
    }
    defaults.update(fields)
    return Alert.objects.create(severity=severity, station=station, zone=station.zone, **defaults)


def test_my_alerts_filtered_by_zones_and_min_level(reference, citizen, citizen_client):
    citizen.zones.set(["centre-ville"])
    kept = _alert("168373", "unhealthy")  # Hôtel de Ville, centre-ville
    _alert("168373", "moderate")  # sous le niveau minimum par défaut
    _alert("168401", "hazardous")  # autre zone
    response = citizen_client.get("/api/v1/me/alerts")
    assert response.status_code == 200
    assert_contract(response, "get", "/me/alerts")
    data = body(response)
    assert [a["id"] for a in data["items"]] == [str(kept.pk)] and data["total"] == 1
    assert "incidentNote" not in data["items"][0]


def test_my_alerts_use_preferences_and_all_zones_when_none(reference, citizen, citizen_client):
    _alert("168373", "moderate")
    _alert("168401", "unhealthy")
    payload = {
        "pushEnabled": True,
        "emailEnabled": False,
        "zoneIds": [],
        "minLevel": "moderate",
        "pollutants": ["pm25"],
        "quietHours": None,
    }
    citizen_client.put("/api/v1/me/notification-preferences", payload, format="json")
    assert body(citizen_client.get("/api/v1/me/alerts"))["total"] == 2
    assert body(citizen_client.get("/api/v1/me/alerts?severity=unhealthy"))["total"] == 1
