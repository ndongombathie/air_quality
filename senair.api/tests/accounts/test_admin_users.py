"""Gestion des utilisateurs (D22 à D24) et commandes de gestion des comptes."""

import io
import re

import pyotp
import pytest
from django.core import mail
from django.core.management import CommandError, call_command
from rest_framework_simplejwt.tokens import RefreshToken

from senair.accounts.models import User
from senair.reporting.models import AuditLogEntry
from tests.conftest import client_for, make_user
from tests.contract import assert_contract, body


def test_list_users_requires_users_manage(authority_client, citizen_client, anon):
    assert authority_client.get("/api/v1/admin/users").status_code == 403
    assert citizen_client.get("/api/v1/admin/users").status_code == 403
    assert anon.get("/api/v1/admin/users").status_code == 401


def test_list_users_filters_and_pagination(admin, admin_client, db):
    make_user("citizen", email="awa@test.sn", full_name="Awa Ndiaye")
    make_user("citizen", email="moussa@test.sn", full_name="Moussa Ba", status="disabled")
    make_user("authority", email="dr@test.sn", full_name="Dr Sarr")
    response = admin_client.get("/api/v1/admin/users")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/users")
    assert body(response)["total"] == 4 and response["Cache-Control"] == "no-store"
    assert [u["email"] for u in body(admin_client.get("/api/v1/admin/users?role=citizen&status=active"))["items"]] == ["awa@test.sn"]
    assert body(admin_client.get("/api/v1/admin/users?search=NDIAYE"))["items"][0]["email"] == "awa@test.sn"
    page = body(admin_client.get("/api/v1/admin/users?limit=3"))
    assert len(page["items"]) == 3 and page["nextCursor"]
    rest = body(admin_client.get(f"/api/v1/admin/users?limit=3&cursor={page['nextCursor']}"))
    assert len(rest["items"]) == 1 and rest["nextCursor"] is None
    assert admin_client.get("/api/v1/admin/users?role=root").status_code == 422


def test_invite_user_pending_with_email(admin, admin_client):
    response = admin_client.post(
        "/api/v1/admin/users", {"email": "Agent@Sante.sn", "fullName": "Agent Santé", "role": "authority"}, format="json"
    )
    assert response.status_code == 201
    assert_contract(response, "post", "/admin/users")
    data = body(response)
    assert data["status"] == "pending" and data["role"] == "authority" and data["email"] == "agent@sante.sn"
    user = User.objects.get(email="agent@sante.sn")
    assert not user.has_usable_password()
    assert AuditLogEntry.objects.filter(action="user.invite", resource_id=str(user.pk), actor=admin).exists()
    assert len(mail.outbox) == 1 and "reinitialiser-mot-de-passe?token=" in mail.outbox[0].body

    token = re.search(r"token=(\S+)", mail.outbox[0].body).group(1)
    accept = client_for().post("/api/v1/auth/password/reset", {"token": token, "password": "Bienvenue-Agent-2026"}, format="json")
    assert accept.status_code == 204
    user.refresh_from_db()
    assert user.status == "active" and user.check_password("Bienvenue-Agent-2026")


def test_invite_validation(admin_client, citizen):
    duplicate = admin_client.post("/api/v1/admin/users", {"email": "citizen@test.sn", "fullName": "X", "role": "citizen"}, format="json")
    assert duplicate.status_code == 422
    assert_contract(duplicate, "post", "/admin/users")
    assert "email" in body(duplicate)["details"]["fields"]
    assert (
        admin_client.post("/api/v1/admin/users", {"email": "x@test.sn", "fullName": "X", "role": "root"}, format="json").status_code == 422
    )


def test_update_user_role_and_status_is_audited(admin, admin_client, citizen):
    refresh = RefreshToken.for_user(citizen)
    response = admin_client.patch(f"/api/v1/admin/users/{citizen.pk}", {"role": "authority", "status": "disabled"}, format="json")
    assert response.status_code == 200
    assert_contract(response, "patch", f"/admin/users/{citizen.pk}")
    assert body(response)["role"] == "authority" and body(response)["status"] == "disabled"
    entry = AuditLogEntry.objects.get(action="user.update")
    assert entry.changes == {"role": {"from": "citizen", "to": "authority"}, "status": {"from": "active", "to": "disabled"}}
    replay = client_for().post("/api/v1/auth/refresh", {"refreshToken": str(refresh)}, format="json")
    assert replay.status_code == 401  # désactivation : sessions révoquées


def test_update_self_forbidden(admin, admin_client):
    response = admin_client.patch(f"/api/v1/admin/users/{admin.pk}", {"role": "citizen"}, format="json")
    assert response.status_code == 403
    assert_contract(response, "patch", f"/admin/users/{admin.pk}")
    assert body(response)["code"] == "self_update"


def test_update_unknown_user(admin_client):
    assert admin_client.patch("/api/v1/admin/users/pas-un-uuid", {"role": "citizen"}, format="json").status_code == 404
    assert admin_client.patch("/api/v1/admin/users/00000000-0000-4000-8000-000000000000", {}, format="json").status_code == 404


# ─────────────── Commandes ───────────────


def test_create_demo_users(reference, settings):
    settings.DEBUG = True
    out = io.StringIO()
    call_command("create_demo_users", stdout=out)
    output = out.getvalue()
    assert output.count("otpauth://totp/") == 2
    citizen = User.objects.get(email="citoyen@senair.sn")
    assert (
        citizen.role == "citizen"
        and citizen.check_password("Demo2026!")
        and list(citizen.zones.values_list("id", flat=True)) == ["centre-ville"]
    )
    admin = User.objects.get(email="admin@senair.sn")
    secret = admin.get_mfa_secret()
    assert " ".join(secret[i : i + 4] for i in range(0, len(secret), 4)) in output and "▀" in output and admin.mfa_enabled
    login = client_for().post(
        "/api/v1/auth/login", {"email": "admin@senair.sn", "password": "Demo2026!", "otp": pyotp.TOTP(secret).now()}, format="json"
    )
    assert login.status_code == 200
    call_command("create_demo_users", "--password", "Autre-Demo-2026", "--no-qr", stdout=io.StringIO())
    admin.refresh_from_db()
    assert admin.get_mfa_secret() == secret and admin.check_password("Autre-Demo-2026")
    call_command("create_demo_users", "--reset-mfa", stdout=io.StringIO())
    admin.refresh_from_db()
    assert admin.get_mfa_secret() != secret


def test_create_demo_users_refused_without_debug(db, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("create_demo_users", stdout=io.StringIO())
    assert not User.objects.exists()


def test_setup_mfa(db):
    user = make_user("authority")
    old = user.get_mfa_secret()
    out = io.StringIO()
    call_command("setup_mfa", "AUTHORITY@test.sn", stdout=out)
    user.refresh_from_db()
    assert user.get_mfa_secret() != old and user.mfa_secret_encrypted and user.get_mfa_secret() not in user.mfa_secret_encrypted
    assert "otpauth://totp/SEN-AIR:authority%40test.sn?secret=" in out.getvalue()
    with pytest.raises(CommandError):
        call_command("setup_mfa", "personne@test.sn", stdout=io.StringIO())
