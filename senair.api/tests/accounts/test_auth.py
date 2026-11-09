"""Authentification (A1 à A7) : inscription, connexion, MFA, refresh rotatif, déconnexion, mot de passe."""

from datetime import timedelta

import pyotp
import pytest
from django.conf import settings
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from senair.accounts import services
from senair.accounts.models import MfaChallenge, User
from tests.conftest import PASSWORD, make_user
from tests.contract import assert_contract, body

COOKIE = settings.SENAIR["REFRESH_COOKIE_NAME"]
WEB_ORIGIN = "http://localhost:5173"


def web() -> APIClient:
    client = APIClient(HTTP_X_CLIENT="senair-web", HTTP_ORIGIN=WEB_ORIGIN)
    return client


def mobile() -> APIClient:
    return APIClient(HTTP_X_CLIENT="senair-mobile")


def register_payload(**overrides):
    payload = {
        "email": "Awa@Exemple.sn",
        "password": "Qualite-Air-2026",
        "fullName": "Awa Ndiaye",
        "zoneIds": ["centre-ville"],
        "healthProfile": "asthma",
        "consent": {"terms": True, "healthData": True},
    }
    payload.update(overrides)
    return payload


def otp_for(user: User) -> str:
    return pyotp.TOTP(user.get_mfa_secret()).now()


# ─────────────── A1 : inscription ───────────────


def test_register_web_sets_cookie_and_returns_session(reference):
    response = web().post("/api/v1/auth/register", register_payload(), format="json")
    assert response.status_code == 201
    assert_contract(response, "post", "/auth/register")
    data = body(response)
    assert "refreshToken" not in data
    assert data["user"]["role"] == "citizen" and data["user"]["email"] == "awa@exemple.sn"
    assert data["user"]["healthProfile"] == "asthma" and data["user"]["zoneIds"] == ["centre-ville"]
    assert data["user"]["permissions"] == ["profile:manage", "notifications:manage"]
    cookie = response.cookies[COOKIE]
    assert cookie["httponly"] and cookie["samesite"] == "Strict" and cookie["path"] == "/api/v1/auth"
    assert int(cookie["max-age"]) == 30 * 24 * 3600
    assert response["Cache-Control"] == "no-store"
    user = User.objects.get(email="awa@exemple.sn")
    assert user.terms_accepted_at and user.health_consent_at


def test_register_forces_citizen_role_and_drops_health_profile_without_consent(reference):
    payload = register_payload(role="admin", consent={"terms": True, "healthData": False})
    response = mobile().post("/api/v1/auth/register", payload, format="json")
    assert response.status_code == 201
    data = body(response)
    assert data["refreshToken"] and COOKIE not in response.cookies
    user = User.objects.get(email="awa@exemple.sn")
    assert user.role == "citizen" and user.health_profile is None and user.health_consent_at is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"consent": {"terms": False, "healthData": False}}, "consent.terms"),
        ({"zoneIds": ["inconnue"]}, "zoneIds"),
        ({"password": "1234567890"}, "password"),
        ({"password": "awa@exemple.sn"}, "password"),
        ({"healthProfile": "inconnu"}, "healthProfile"),
    ],
)
def test_register_validation_errors(reference, overrides, field):
    response = web().post("/api/v1/auth/register", register_payload(**overrides), format="json")
    assert response.status_code == 422
    assert_contract(response, "post", "/auth/register")
    assert field in body(response)["details"]["fields"]


def test_register_duplicate_email(reference, citizen):
    response = web().post("/api/v1/auth/register", register_payload(email="CITIZEN@test.sn"), format="json")
    assert response.status_code == 422
    assert_contract(response, "post", "/auth/register")
    assert body(response)["code"] == "email_taken" and "email" in body(response)["details"]["fields"]


# ─────────────── A2 : connexion ───────────────


def test_login_citizen_web(citizen):
    response = web().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/login")
    assert "refreshToken" not in body(response) and response.cookies[COOKIE].value
    citizen.refresh_from_db()
    assert citizen.last_login_at is not None


def test_login_mobile_returns_refresh_in_body(citizen):
    response = mobile().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 200
    assert body(response)["refreshToken"] and COOKIE not in response.cookies


def test_login_failure_is_generic(citizen):
    unknown = web().post("/api/v1/auth/login", {"email": "personne@test.sn", "password": PASSWORD}, format="json")
    wrong = web().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": "mauvais"}, format="json")
    for response in (unknown, wrong):
        assert response.status_code == 401
        assert_contract(response, "post", "/auth/login")
    assert body(unknown)["code"] == body(wrong)["code"] == "invalid_credentials"
    assert body(unknown)["message"] == body(wrong)["message"]


def test_login_disabled_account_is_generic(db):
    make_user("citizen", status="disabled")
    response = web().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 401 and body(response)["code"] == "invalid_credentials"


def test_login_locks_after_five_failures(citizen):
    client = web()
    for _ in range(5):
        client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": "mauvais"}, format="json")
    citizen.refresh_from_db()
    assert citizen.locked_until > timezone.now() + timedelta(minutes=14)
    response = client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 401 and body(response)["code"] == "invalid_credentials"
    citizen.locked_until = timezone.now() - timedelta(seconds=1)
    citizen.save()
    assert client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json").status_code == 200


def test_login_privileged_requires_mfa_challenge(authority):
    response = web().post("/api/v1/auth/login", {"email": "authority@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/login")
    data = body(response)
    assert data["mfaRequired"] is True and data["challengeId"]
    assert "accessToken" not in data and COOKIE not in response.cookies


def test_login_privileged_with_valid_otp_opens_session(admin):
    payload = {"email": "admin@test.sn", "password": PASSWORD, "otp": otp_for(admin)}
    response = web().post("/api/v1/auth/login", payload, format="json")
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/login")
    assert "users:manage" in body(response)["user"]["permissions"]


def test_login_privileged_with_wrong_otp(admin):
    response = web().post("/api/v1/auth/login", {"email": "admin@test.sn", "password": PASSWORD, "otp": "000000"}, format="json")
    if response.status_code == 200:  # « 000000 » est exceptionnellement le code courant
        pytest.skip("code TOTP courant égal au code de test")
    assert response.status_code == 401 and body(response)["code"] == "invalid_otp"
    admin.refresh_from_db()
    assert admin.failed_login_count == 1


def test_login_privileged_without_secret(db):
    user = make_user("authority")
    user.mfa_secret_encrypted = ""
    user.save()
    response = web().post("/api/v1/auth/login", {"email": "authority@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 403 and body(response)["code"] == "mfa_setup_required"


def test_login_ignores_stale_bearer(citizen):
    client = web()
    client.credentials(HTTP_AUTHORIZATION="Bearer jeton.perime.invalide")
    response = client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    assert response.status_code == 200


# ─────────────── A3 : vérification MFA ───────────────


def _challenge(client, email="authority@test.sn") -> str:
    return body(client.post("/api/v1/auth/login", {"email": email, "password": PASSWORD}, format="json"))["challengeId"]


def test_mfa_verify_success_is_single_use(authority):
    client = web()
    challenge = _challenge(client)
    response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": otp_for(authority)}, format="json")
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/mfa/verify")
    assert body(response)["user"]["role"] == "authority" and response.cookies[COOKIE].value
    again = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": otp_for(authority)}, format="json")
    assert again.status_code == 401
    assert_contract(again, "post", "/auth/mfa/verify")


def test_mfa_verify_mobile(authority):
    client = mobile()
    challenge = _challenge(client)
    response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": otp_for(authority)}, format="json")
    assert response.status_code == 200 and body(response)["refreshToken"]


def test_mfa_verify_accepts_previous_step(authority):
    client = web()
    challenge = _challenge(client)
    previous = pyotp.TOTP(authority.get_mfa_secret()).at(timezone.now() - timedelta(seconds=30))
    response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": previous}, format="json")
    assert response.status_code == 200


def test_mfa_verify_expired(authority):
    client = web()
    challenge = _challenge(client)
    MfaChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() - timedelta(seconds=1))
    response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": otp_for(authority)}, format="json")
    assert response.status_code == 401 and body(response)["code"] == "invalid_challenge"


def test_mfa_verify_five_attempts_max(authority):
    client = web()
    challenge = _challenge(client)
    good = otp_for(authority)
    wrong = "111111" if good != "111111" else "222222"
    for _ in range(5):
        response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": wrong}, format="json")
        assert response.status_code == 401
    assert MfaChallenge.objects.get(pk=challenge).attempts == 5
    response = client.post("/api/v1/auth/mfa/verify", {"challengeId": challenge, "otp": good}, format="json")
    assert response.status_code == 401
    authority.refresh_from_db()
    assert authority.locked_until is not None  # 5 codes faux comptent comme 5 échecs de connexion


def test_mfa_verify_rejects_malformed_otp(authority):
    response = web().post("/api/v1/auth/mfa/verify", {"challengeId": "x", "otp": "12ab"}, format="json")
    assert response.status_code == 422


# ─────────────── A4 : refresh ───────────────


def _login_web(client):
    response = client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    return response.cookies[COOKIE].value


def test_refresh_web_rotates_cookie(citizen):
    client = web()
    first = _login_web(client)
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/refresh")
    assert "refreshToken" not in body(response)
    second = response.cookies[COOKIE].value
    assert second and second != first


def test_refresh_mobile_body(citizen):
    login = mobile().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json")
    first = body(login)["refreshToken"]
    response = APIClient().post("/api/v1/auth/refresh", {"refreshToken": first}, format="json")  # détecté par le corps
    assert response.status_code == 200
    assert_contract(response, "post", "/auth/refresh")
    assert body(response)["refreshToken"] != first and COOKIE not in response.cookies


def test_refresh_reuse_revokes_every_session(citizen):
    client = mobile()
    first = body(client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json"))["refreshToken"]
    other = body(client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json"))["refreshToken"]
    rotated = body(client.post("/api/v1/auth/refresh", {"refreshToken": first}, format="json"))["refreshToken"]
    replay = client.post("/api/v1/auth/refresh", {"refreshToken": first}, format="json")
    assert replay.status_code == 401
    assert_contract(replay, "post", "/auth/refresh")
    for token in (rotated, other):
        assert client.post("/api/v1/auth/refresh", {"refreshToken": token}, format="json").status_code == 401


def test_refresh_without_token_or_with_garbage(citizen):
    assert web().post("/api/v1/auth/refresh").status_code == 401
    response = mobile().post("/api/v1/auth/refresh", {"refreshToken": "nimporte.quoi.ici"}, format="json")
    assert response.status_code == 401
    assert_contract(response, "post", "/auth/refresh")


def test_refresh_cookie_requires_trusted_origin(citizen):
    client = web()
    _login_web(client)
    client.defaults["HTTP_ORIGIN"] = "https://malveillant.example"
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 403 and body(response)["code"] == "origin_not_allowed"
    del client.defaults["HTTP_ORIGIN"]
    assert client.post("/api/v1/auth/refresh").status_code == 403  # pas d'Origin ni de Referer
    client.defaults["HTTP_REFERER"] = f"{WEB_ORIGIN}/compte"
    assert client.post("/api/v1/auth/refresh").status_code == 200


def test_refresh_disabled_user(citizen):
    client = mobile()
    token = body(client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json"))["refreshToken"]
    User.objects.filter(pk=citizen.pk).update(status="disabled")
    assert client.post("/api/v1/auth/refresh", {"refreshToken": token}, format="json").status_code == 401


# ─────────────── A5 : déconnexion ───────────────


def test_logout_web_blacklists_and_clears_cookie(citizen):
    client = web()
    token = _login_web(client)
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert_contract(response, "post", "/auth/logout")
    assert response.cookies[COOKIE].value == "" and response.cookies[COOKIE]["path"] == "/api/v1/auth"
    assert mobile().post("/api/v1/auth/refresh", {"refreshToken": token}, format="json").status_code == 401


def test_logout_mobile(citizen):
    client = mobile()
    token = body(client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json"))["refreshToken"]
    assert client.post("/api/v1/auth/logout", {"refreshToken": token}, format="json").status_code == 204
    assert client.post("/api/v1/auth/refresh", {"refreshToken": token}, format="json").status_code == 401
    assert client.post("/api/v1/auth/logout", {"refreshToken": "invalide"}, format="json").status_code == 204


# ─────────────── A6, A7 : mot de passe ───────────────


def _reset_token_from_mail() -> str:
    link = next(line for line in mail.outbox[-1].body.splitlines() if "reinitialiser-mot-de-passe?token=" in line)
    assert link.startswith(f"{settings.SENAIR['FRONTEND_URL']}/reinitialiser-mot-de-passe?token=")
    return link.split("token=", 1)[1].strip()


def test_forgot_password_always_204(citizen):
    unknown = web().post("/api/v1/auth/password/forgot", {"email": "personne@test.sn"}, format="json")
    assert unknown.status_code == 204 and len(mail.outbox) == 0
    known = web().post("/api/v1/auth/password/forgot", {"email": "citizen@test.sn"}, format="json")
    assert known.status_code == 204
    assert_contract(known, "post", "/auth/password/forgot")
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["citizen@test.sn"]
    uidb64, _, token = _reset_token_from_mail().partition(".")
    assert uidb64 and token


def test_reset_password_revokes_sessions_and_is_single_use(citizen):
    client = mobile()
    refresh = body(client.post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": PASSWORD}, format="json"))["refreshToken"]
    web().post("/api/v1/auth/password/forgot", {"email": "citizen@test.sn"}, format="json")
    token = _reset_token_from_mail()
    response = web().post("/api/v1/auth/password/reset", {"token": token, "password": "Nouveau-Secret-2026"}, format="json")
    assert response.status_code == 204
    assert_contract(response, "post", "/auth/password/reset")
    assert client.post("/api/v1/auth/refresh", {"refreshToken": refresh}, format="json").status_code == 401
    again = web().post("/api/v1/auth/password/reset", {"token": token, "password": "Encore-Autre-2026"}, format="json")
    assert again.status_code == 422
    assert_contract(again, "post", "/auth/password/reset")
    login = web().post("/api/v1/auth/login", {"email": "citizen@test.sn", "password": "Nouveau-Secret-2026"}, format="json")
    assert login.status_code == 200


def test_reset_password_rejects_weak_password_and_bad_token(citizen):
    token = services.reset_token(citizen)
    weak = web().post("/api/v1/auth/password/reset", {"token": token, "password": "1234567890"}, format="json")
    assert weak.status_code == 422 and "password" in body(weak)["details"]["fields"]
    bad = web().post("/api/v1/auth/password/reset", {"token": "abc.def", "password": "Nouveau-Secret-2026"}, format="json")
    assert bad.status_code == 422 and "token" in body(bad)["details"]["fields"]


def test_reset_link_expires_after_30_minutes(citizen, monkeypatch):
    token = services.reset_token(citizen)
    later = timezone.now().replace(tzinfo=None) + timedelta(minutes=31)
    monkeypatch.setattr(type(services.default_token_generator), "_now", lambda self: later)
    response = web().post("/api/v1/auth/password/reset", {"token": token, "password": "Nouveau-Secret-2026"}, format="json")
    assert response.status_code == 422


def test_auth_routes_are_throttled(citizen, settings):
    from rest_framework.throttling import ScopedRateThrottle

    from senair.accounts.views import AuthView

    assert AuthView.throttle_scope == "auth"
    assert ScopedRateThrottle in [type(t) for t in AuthView().get_throttles()]
