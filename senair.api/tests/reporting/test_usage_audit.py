"""Statistiques d'usage (D25) et journal d'audit (D26)."""

from datetime import timedelta

from django.utils import timezone

from senair.alerts.models import NotificationDelivery
from senair.reporting.models import AuditLogEntry, UsageVisit
from tests.conftest import make_user
from tests.contract import assert_contract, body

from .helpers import alert


def test_usage_stats(reference, authority_client):
    UsageVisit.objects.all().delete()  # ignore les visites comptées par le middleware pendant la préparation
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    user = make_user("citizen", "c1@test.sn")
    UsageVisit.objects.create(day=yesterday, platform="android", visitor_hash="a", user=user)
    UsageVisit.objects.create(day=yesterday, platform="web", visitor_hash="b")
    UsageVisit.objects.create(day=today, platform="android", visitor_hash="c", user=user)
    UsageVisit.objects.create(day=today, platform="ios", visitor_hash="d")
    UsageVisit.objects.create(day=today - timedelta(days=10), platform="web", visitor_hash="e")  # hors période
    pushed = alert("168373")
    NotificationDelivery.objects.create(alert=pushed, user=user, device_token="t1", status="sent")
    NotificationDelivery.objects.create(alert=pushed, user=user, device_token="t2", status="failed")

    query = f"from={yesterday.isoformat()}T00:00:00Z&to={today.isoformat()}T23:59:59Z"
    response = authority_client.get(f"/api/v1/admin/analytics/usage?{query}")
    assert response.status_code == 200, response.content
    assert_contract(response, "get", f"/admin/analytics/usage?{query}")
    data = body(response)
    # La requête du test elle-même n'est comptée qu'après la réponse.
    assert data["activeUsers"] == 1 and data["sessions"] == 4 and data["pushSent"] == 1
    assert {p["platform"]: p["sessions"] for p in data["byPlatform"]} == {"android": 2, "web": 1, "ios": 1}
    assert data["daily"] == [
        {"day": yesterday.isoformat(), "sessions": 2, "activeUsers": 1},
        {"day": today.isoformat(), "sessions": 2, "activeUsers": 1},
    ]


def test_usage_requires_dates(authority_client):
    response = authority_client.get("/api/v1/admin/analytics/usage")
    assert response.status_code == 422
    assert set(body(response)["details"]["fields"]) == {"from"}
    assert authority_client.get("/api/v1/admin/analytics/usage?from=2026-11-02&to=2026-10-01").status_code == 422
    assert authority_client.get("/api/v1/admin/analytics/usage?from=demain&to=2026-10-01").status_code == 422


def test_usage_forbidden_for_citizen(citizen_client):
    assert citizen_client.get("/api/v1/admin/analytics/usage?from=2026-11-01&to=2026-11-02").status_code == 403


def test_audit_logs(authority_client, admin_client, authority):
    authority_client.post(
        "/api/v1/admin/articles",
        {
            "title": "Article audité",
            "excerpt": "Chapô assez long.",
            "content": "Contenu de plus de vingt caractères.",
            "category": "info",
            "status": "draft",
        },
        format="json",
    )
    AuditLogEntry.objects.create(actor=None, actor_email="systeme@senair.sn", action="station.update", resource="station")

    response = admin_client.get("/api/v1/admin/audit-logs")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/audit-logs")
    data = body(response)
    assert data["total"] == 2
    assert data["items"][0]["actorId"] is None  # action sans auteur, plus récente

    mine = admin_client.get(f"/api/v1/admin/audit-logs?actorId={authority.id}&resource=article")
    assert_contract(mine, "get", f"/admin/audit-logs?actorId={authority.id}&resource=article")
    items = body(mine)["items"]
    assert len(items) == 1 and items[0]["action"] == "article.create" and items[0]["actorEmail"] == authority.email
    assert items[0]["changes"]["status"] == {"from": None, "to": "draft"}
    assert items[0]["ip"] == "127.0.0.1"

    future = (timezone.now() + timedelta(days=1)).date().isoformat()
    assert body(admin_client.get(f"/api/v1/admin/audit-logs?from={future}"))["total"] == 0
    page = body(admin_client.get("/api/v1/admin/audit-logs?limit=1"))
    assert len(page["items"]) == 1 and page["nextCursor"]
    assert admin_client.get("/api/v1/admin/audit-logs?actorId=abc").status_code == 422


def test_audit_forbidden_for_authority(authority_client, citizen_client):
    assert authority_client.get("/api/v1/admin/audit-logs").status_code == 403
    assert citizen_client.get("/api/v1/admin/audit-logs").status_code == 403
