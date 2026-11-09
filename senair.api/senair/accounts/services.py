"""
Sessions JWT, révocation, MFA TOTP, verrouillage et e-mails de compte.

Détection du client (web ou mobile), même règle pour toutes les routes /auth :
- mobile si l'en-tête `X-Client` contient « mobile » (le client mobile envoie `X-Client: senair-mobile`),
  ou si un `refreshToken` est fourni dans le corps de la requête ;
- web sinon (le client web envoie `X-Client: senair-web` et `credentials: 'include'`).
Le web reçoit le refresh token dans un cookie HttpOnly, SameSite=Strict, limité à REFRESH_COOKIE_PATH, jamais dans le corps ;
le mobile le reçoit dans le corps (`refreshToken`) et le garde dans le trousseau.
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from urllib.parse import urlsplit

import pyotp
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenBackendError, TokenError
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from senair.common.domain import POLLUTANT_CODES, iso
from senair.common.exceptions import ApiError
from senair.common.permissions import permissions_for

from .models import MfaChallenge, NotificationPreferences, User

logger = logging.getLogger("senair.auth")

MAX_FAILED_LOGINS = 5
LOCK_DURATION = timedelta(minutes=15)
MAX_MFA_ATTEMPTS = 5
# Lien « mot de passe oublié » : 30 min (docs/08 §3). Les invitations gardent PASSWORD_RESET_TIMEOUT (3 jours par défaut).
RESET_LINK_SECONDS = 30 * 60

INVALID_CREDENTIALS_MESSAGE = "E-mail ou mot de passe incorrect. Après plusieurs échecs, la connexion est suspendue pendant 15 minutes."


def senair(key: str):
    return settings.SENAIR[key]


# ─────────────── Présentation ───────────────


def user_payload(user: User) -> dict:
    return {
        "id": str(user.pk),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status,
        "zone_ids": sorted(user.zones.values_list("id", flat=True)),
        "health_profile": user.health_profile,
        "mfa_enabled": user.mfa_enabled,
        "created_at": iso(user.created_at),
        "last_login_at": iso(user.last_login_at),
    }


def me_payload(user: User) -> dict:
    return {**user_payload(user), "permissions": permissions_for(user)}


# ─────────────── Client web / mobile ───────────────


def is_mobile_client(request) -> bool:
    if "mobile" in request.headers.get("X-Client", "").lower():
        return True
    data = request.data if isinstance(request.data, dict) else {}
    return bool(data.get("refresh_token"))


def _trusted_origins(request) -> set[str]:
    origins = {o.rstrip("/") for o in (*settings.CORS_ALLOWED_ORIGINS, *settings.CSRF_TRUSTED_ORIGINS)}
    origins.add(f"{request.scheme}://{request.get_host()}")
    return origins


def check_origin(request) -> None:
    """Protection CSRF du refresh par cookie : `Origin` (ou à défaut `Referer`) doit être une origine autorisée."""
    origin = request.headers.get("Origin")
    if not origin and (referer := request.headers.get("Referer")):
        parts = urlsplit(referer)
        origin = f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None
    if not origin or origin.rstrip("/") not in _trusted_origins(request):
        raise ApiError("origin_not_allowed", "Origine de la requête non autorisée.", 403)


def set_refresh_cookie(response: Response, refresh: str) -> None:
    response.set_cookie(
        senair("REFRESH_COOKIE_NAME"),
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=senair("REFRESH_COOKIE_PATH"),
        secure=senair("REFRESH_COOKIE_SECURE"),
        httponly=True,
        samesite="Strict",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(senair("REFRESH_COOKIE_NAME"), path=senair("REFRESH_COOKIE_PATH"), samesite="Strict")


def session_response(request, user: User, http_status: int = 200, *, login: bool = True) -> Response:
    """Ouvre une session : jeton d'accès dans le corps, refresh dans le cookie (web) ou le corps (mobile)."""
    if login:
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    body = {
        "access_token": str(access),
        "access_token_expires_at": iso(datetime.fromtimestamp(access["exp"], tz=UTC)),
        "user": me_payload(user),
    }
    mobile = is_mobile_client(request)
    if mobile:
        body["refresh_token"] = str(refresh)
    response = Response(body, status=http_status)
    if not mobile:
        set_refresh_cookie(response, str(refresh))
    return response


# ─────────────── Refresh, rotation, révocation ───────────────


def invalid_session() -> ApiError:
    return ApiError("invalid_token", "Session expirée ou invalide. Reconnectez-vous.", 401)


def revoke_all_sessions(user: User) -> int:
    """Blackliste tous les refresh tokens encore valides de l'utilisateur."""
    count = 0
    for outstanding in OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now()):
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
        count += int(created)
    return count


def rotate_refresh(raw: str) -> User:
    """
    Valide le refresh token, le blackliste (rotation) et retourne l'utilisateur.
    Un refresh déjà blacklisté mais correctement signé signale un vol probable : toutes les sessions sont révoquées.
    """
    try:
        token = RefreshToken(raw)
    except TokenError:
        _detect_reuse(raw)
        raise invalid_session() from None
    user = User.objects.filter(pk=token.get(settings.SIMPLE_JWT["USER_ID_CLAIM"])).first()
    token.blacklist()
    if user is None or not user.is_active:
        raise invalid_session()
    return user


def _detect_reuse(raw: str) -> None:
    try:
        payload = token_backend.decode(raw, verify=True)
    except TokenBackendError:
        return
    if payload.get("token_type") != "refresh":
        return
    if not BlacklistedToken.objects.filter(token__jti=payload.get("jti")).exists():
        return
    user = User.objects.filter(pk=payload.get(settings.SIMPLE_JWT["USER_ID_CLAIM"])).first()
    if user is not None:
        revoked = revoke_all_sessions(user)
        logger.warning("Réutilisation d'un refresh token révoqué pour %s : %d session(s) révoquée(s).", user.pk, revoked)


def blacklist_quietly(raw: str | None) -> None:
    if not raw:
        return
    try:
        RefreshToken(raw).blacklist()
    except TokenError:
        pass


# ─────────────── Verrouillage et MFA ───────────────


def is_locked(user: User) -> bool:
    return bool(user.locked_until and user.locked_until > timezone.now())


def register_failure(user: User) -> None:
    user.failed_login_count += 1
    if user.failed_login_count >= MAX_FAILED_LOGINS:
        user.locked_until = timezone.now() + LOCK_DURATION
        user.failed_login_count = 0
        logger.warning("Compte %s verrouillé 15 minutes après %d échecs.", user.pk, MAX_FAILED_LOGINS)
    user.save(update_fields=["failed_login_count", "locked_until"])


def reset_failures(user: User) -> None:
    if user.failed_login_count or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_count", "locked_until"])


def needs_mfa(user: User) -> bool:
    return user.requires_mfa or user.mfa_enabled


def verify_otp(user: User, otp: str) -> bool:
    secret = user.get_mfa_secret()
    return bool(secret) and pyotp.TOTP(secret).verify(otp, valid_window=1)


def create_challenge(user: User, client: str) -> MfaChallenge:
    return MfaChallenge.objects.create(
        id=secrets.token_urlsafe(32),
        user=user,
        client=client,
        expires_at=timezone.now() + timedelta(seconds=senair("MFA_CHALLENGE_SECONDS")),
    )


def provisioning_uri(user: User, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=senair("MFA_ISSUER"))


def enroll_mfa(user: User) -> str:
    """Génère un nouveau secret TOTP, le chiffre en base et retourne le secret en clair (affiché une seule fois)."""
    secret = pyotp.random_base32()
    user.set_mfa_secret(secret)
    user.mfa_enabled = True
    user.save(update_fields=["mfa_secret_encrypted", "mfa_enabled"])
    return secret


# ─────────────── Réinitialisation du mot de passe et invitations ───────────────


def reset_token(user: User) -> str:
    return f"{urlsafe_base64_encode(force_bytes(user.pk))}.{default_token_generator.make_token(user)}"


def reset_link(user: User) -> str:
    return f"{senair('FRONTEND_URL').rstrip('/')}/reinitialiser-mot-de-passe?token={reset_token(user)}"


def user_from_reset_token(raw: str) -> User | None:
    """Jeton `<uidb64>.<token>` : usage unique (il dépend du hachage du mot de passe), 30 min hors invitation."""
    uidb64, _, token = (raw or "").partition(".")
    try:
        user = User.objects.filter(pk=force_str(urlsafe_base64_decode(uidb64))).first()
    except (ValueError, TypeError, OverflowError, UnicodeDecodeError):
        return None
    if user is None or user.status == User.Status.DISABLED or not default_token_generator.check_token(user, token):
        return None
    if user.status != User.Status.PENDING:
        try:
            issued = base36_to_int(token.split("-")[0])
        except ValueError:
            return None
        age = default_token_generator._num_seconds(default_token_generator._now()) - issued
        if age > RESET_LINK_SECONDS:
            return None
    return user


def _send(subject: str, body: str, to: str) -> None:
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to])
    except Exception:  # l'envoi d'e-mail ne doit pas révéler l'existence du compte ni casser la requête
        logger.exception("Échec d'envoi d'e-mail (%s)", subject)


def send_password_reset(user: User) -> None:
    _send(
        "SEN-AIR : réinitialisation de votre mot de passe",
        f"Bonjour {user.full_name},\n\n"
        "Une demande de réinitialisation du mot de passe de votre compte SEN-AIR a été reçue.\n"
        f"Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes, utilisable une seule fois) :\n\n{reset_link(user)}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\nL'équipe SEN-AIR",
        user.email,
    )


def send_invitation(user: User, inviter: User) -> None:
    _send(
        "SEN-AIR : invitation à rejoindre la plateforme",
        f"Bonjour {user.full_name},\n\n"
        f"{inviter.full_name} vous invite à rejoindre la plateforme SEN-AIR de surveillance de la qualité de l'air à Thiès.\n"
        f"Pour activer votre compte, choisissez votre mot de passe en ouvrant ce lien :\n\n{reset_link(user)}\n\n"
        "Les comptes autorité et administrateur nécessitent ensuite une application d'authentification (code à 6 chiffres).\n\n"
        "L'équipe SEN-AIR",
        user.email,
    )


# ─────────────── Préférences de notification ───────────────

DEFAULT_QUIET_HOURS = ("22:00", "06:30")  # identique au mode démonstration du front


def preferences_payload(user: User, prefs: NotificationPreferences | None = None) -> dict:
    """Préférences enregistrées, ou valeurs par défaut si l'utilisateur n'en a pas encore."""
    if prefs is None:
        prefs = NotificationPreferences.objects.filter(user=user).first()
    if prefs is None:
        return {
            "push_enabled": True,
            "email_enabled": False,
            "zone_ids": sorted(user.zones.values_list("id", flat=True)),
            "min_level": "unhealthy_sensitive",
            "pollutants": list(POLLUTANT_CODES),
            "quiet_hours": {"start": DEFAULT_QUIET_HOURS[0], "end": DEFAULT_QUIET_HOURS[1]},
        }
    quiet = None
    if prefs.quiet_start is not None and prefs.quiet_end is not None:
        quiet = {"start": prefs.quiet_start.strftime("%H:%M"), "end": prefs.quiet_end.strftime("%H:%M")}
    return {
        "push_enabled": prefs.push_enabled,
        "email_enabled": prefs.email_enabled,
        "zone_ids": sorted(z.id for z in prefs.zones.all()),
        "min_level": prefs.min_level,
        "pollutants": [code for code in POLLUTANT_CODES if code in (prefs.pollutants or POLLUTANT_CODES)],
        "quiet_hours": quiet,
    }


@dataclass(frozen=True)
class EffectivePreferences:
    """Préférences appliquées par le moteur de notifications (valeurs par défaut si l'utilisateur n'a rien enregistré)."""

    push_enabled: bool
    min_level: str
    pollutants: frozenset[str]
    zone_ids: frozenset[str]
    quiet_hours: tuple[time, time] | None


def effective_preferences(user: User) -> EffectivePreferences:
    """Zones : celles des préférences, sinon celles du profil, sinon toutes (ensemble vide). Utilise les données préchargées."""
    try:
        prefs = user.notification_preferences
    except NotificationPreferences.DoesNotExist:
        prefs = None
    profile_zones = frozenset(z.id for z in user.zones.all())
    if prefs is None:
        return EffectivePreferences(
            push_enabled=True,
            min_level="unhealthy_sensitive",
            pollutants=frozenset(POLLUTANT_CODES),
            zone_ids=profile_zones,
            quiet_hours=(time.fromisoformat(DEFAULT_QUIET_HOURS[0]), time.fromisoformat(DEFAULT_QUIET_HOURS[1])),
        )
    zones = frozenset(z.id for z in prefs.zones.all()) or profile_zones
    quiet = (prefs.quiet_start, prefs.quiet_end) if prefs.quiet_start is not None and prefs.quiet_end is not None else None
    return EffectivePreferences(
        push_enabled=prefs.push_enabled,
        min_level=prefs.min_level,
        pollutants=frozenset(prefs.pollutants or POLLUTANT_CODES),
        zone_ids=zones,
        quiet_hours=quiet,
    )


def in_quiet_hours(quiet: tuple[time, time] | None, moment: time) -> bool:
    """Plage [début, fin) en heure UTC (heure locale de Thiès) ; une plage qui passe minuit est gérée."""
    if quiet is None:
        return False
    start, end = quiet
    if start == end:
        return False
    if start < end:
        return start <= moment < end
    return moment >= start or moment < end
