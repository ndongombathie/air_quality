"""Tableau de bord (D1) calculé sur les données réelles."""

from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone

from senair.accounts.models import User
from senair.network.models import DataSource, Station
from tests.conftest import make_user
from tests.contract import assert_contract, body

from .helpers import alert, reading


def test_dashboard_real_data(reference, authority_client):
    call_command("seed_demo_content", "--fixtures-only", verbosity=0)
    Station.objects.filter(pk="168401").update(status="maintenance")
    Station.objects.filter(pk="166062").update(status="offline")
    DataSource.objects.filter(pk="openweathermap").update(status="degraded")
    reading("168373", 140)  # Hôtel de Ville, centre-ville
    reading("168393", 120)
    reading("89441", 175, ago=timedelta(hours=5))  # ancienne : compte pour le max, pas pour l'IQA ville ni le classement
    reading("166062", 300)  # station hors ligne : ignorée
    alert("168373", "unhealthy", "active")
    alert("168393", "unhealthy_sensitive", "acknowledged", ago=timedelta(hours=30))
    alert("168393", "hazardous", "resolved")
    old = make_user("citizen", "ancien@test.sn")
    User.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=30))

    response = authority_client.get("/api/v1/admin/dashboard")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/dashboard")
    data = body(response)
    assert data["cityAqi"] == 140 and data["cityLevel"] == "unhealthy_sensitive"
    assert data["maxAqi"] == 175
    assert data["stations"] == {"total": 9, "online": 7, "offline": 1, "maintenance": 1}
    assert data["alerts"]["active"] == 1 and data["alerts"]["acknowledged"] == 1 and data["alerts"]["last24h"] == 2
    levels = {item["level"]: item["count"] for item in data["alerts"]["byLevel"]}
    assert levels["unhealthy"] == 1 and levels["unhealthy_sensitive"] == 1 and levels["hazardous"] == 0
    assert data["articles"] == {"published": 4, "drafts": 1}
    assert data["users"] == {"total": 2, "newLast7d": 1}
    assert [z["zoneId"] for z in data["topZones"]] == ["centre-ville", "medina-fall"]
    assert data["topZones"][0] == {
        "zoneId": "centre-ville",
        "zoneName": "Centre-ville",
        "aqi": 140,
        "level": "unhealthy_sensitive",
        "dominantPollutant": "pm25",
    }
    assert data["dataSources"] == {"healthy": 2, "degraded": 1, "down": 0}


def test_dashboard_without_data(reference, admin_client):
    response = admin_client.get("/api/v1/admin/dashboard")
    assert_contract(response, "get", "/admin/dashboard")
    data = body(response)
    assert data["cityAqi"] is None and data["cityLevel"] is None and data["maxAqi"] is None and data["topZones"] == []


def test_dashboard_forbidden(citizen_client):
    response = citizen_client.get("/api/v1/admin/dashboard")
    assert response.status_code == 403
    assert_contract(response, "get", "/admin/dashboard")
