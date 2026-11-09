"""Authentification (A1 à A7), compte citoyen (C1 à C8) et gestion des utilisateurs (D22 à D24)."""

import uuid
from datetime import time

from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from senair.alerts.models import Alert, AlertReceipt
from senair.alerts.presenters import alert_payload
from senair.alerts.queries import filter_alerts, for_user, recent
from senair.common.domain import AQI_LEVEL_IDS, level_rank
from senair.common.exceptions import ApiError, validation_error
from senair.common.pagination import paginate
from senair.common.permissions import IsActiveUser, require
from senair.reporting import audit

from . import services
from .models import Device, MfaChallenge, NotificationPreferences, User
from .serializers import (
    DeviceSerializer,
    ForgotSerializer,
    LoginSerializer,
    MfaVerifySerializer,
    NotificationPreferencesSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    ResetSerializer,
    UserInviteSerializer,
    UserUpdateSerializer,
    check_password_strength,
)


def validated(serializer_class, data, **kwargs) -> dict:
    serializer = serializer_class(data=data if isinstance(data, dict) else {}, **kwargs)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class NoStoreMixin:
    """Réponses personnelles : jamais mises en cache (docs/08 §1)."""

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class AuthView(NoStoreMixin, APIView):
    """Routes publiques d'authentification : aucun jeton lu (un Bearer périmé ne bloque pas la connexion), throttle `auth`."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"


# ─────────────── A1 à A7 ───────────────


class RegisterView(AuthView):
    def post(self, request):
        data = validated(RegisterSerializer, request.data)
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise ApiError(
                "email_taken", "Un compte existe déjà avec cet e-mail.", 422, fields={"email": "Un compte existe déjà avec cet e-mail."}
            )
        now = timezone.now()
        health_consent = data["consent"]["health_data"]
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    data["email"],
                    data["password"],
                    full_name=data["full_name"].strip(),
                    role=User.Role.CITIZEN,
                    status=User.Status.ACTIVE,
                    terms_accepted_at=now,
                    health_profile=data["health_profile"] if health_consent else None,
                    health_consent_at=now if health_consent and data["health_profile"] else None,
                )
                user.zones.set(data["zone_ids"])
        except IntegrityError:
            raise ApiError(
                "email_taken", "Un compte existe déjà avec cet e-mail.", 422, fields={"email": "Un compte existe déjà avec cet e-mail."}
            ) from None
        return services.session_response(request, user, status.HTTP_201_CREATED)


class LoginView(AuthView):
    def post(self, request):
        data = validated(LoginSerializer, request.data)
        generic = ApiError("invalid_credentials", services.INVALID_CREDENTIALS_MESSAGE, 401)
        user = User.objects.filter(email__iexact=data["email"].strip()).first()
        if user is None:
            make_password(data["password"])  # temps de réponse comparable : pas d'énumération de comptes
            raise generic
        password_ok = user.check_password(data["password"])
        if services.is_locked(user) or not user.is_active:
            raise generic
        if not password_ok:
            services.register_failure(user)
            raise generic

        if services.needs_mfa(user):
            if not user.get_mfa_secret():
                raise ApiError(
                    "mfa_setup_required",
                    "La double authentification doit être configurée pour ce compte. Contactez un administrateur.",
                    403,
                )
            otp = data.get("otp")
            if not otp:
                challenge = services.create_challenge(user, "mobile" if services.is_mobile_client(request) else "web")
                return Response({"mfa_required": True, "challenge_id": challenge.id})
            if not services.verify_otp(user, otp):
                services.register_failure(user)
                raise ApiError("invalid_otp", "Code de vérification invalide.", 401)

        services.reset_failures(user)
        return services.session_response(request, user)


class MfaVerifyView(AuthView):
    def post(self, request):
        data = validated(MfaVerifySerializer, request.data)
        invalid = ApiError("invalid_challenge", "Vérification expirée ou invalide. Reconnectez-vous.", 401)
        error = None
        with transaction.atomic():  # verrou : un challenge ne sert qu'une fois, même sous requêtes concurrentes
            challenge = MfaChallenge.objects.select_for_update().select_related("user").filter(id=data["challenge_id"]).first()
            user = challenge.user if challenge else None
            if (
                challenge is None
                or challenge.used_at is not None
                or challenge.expires_at <= timezone.now()
                or challenge.attempts >= services.MAX_MFA_ATTEMPTS
                or not user.is_active
                or services.is_locked(user)
            ):
                error = invalid
            elif not services.verify_otp(user, data["otp"]):
                challenge.attempts += 1
                challenge.save(update_fields=["attempts"])
                services.register_failure(user)
                error = ApiError("invalid_otp", "Code de vérification invalide.", 401)
            else:
                challenge.used_at = timezone.now()
                challenge.save(update_fields=["used_at"])
        if error is not None:
            raise error
        services.reset_failures(user)
        return services.session_response(request, user)


class RefreshView(AuthView):
    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        raw = body.get("refresh_token")
        if not raw:
            services.check_origin(request)
            raw = request.COOKIES.get(services.senair("REFRESH_COOKIE_NAME"))
        if not raw:
            raise services.invalid_session()
        user = services.rotate_refresh(raw)
        return services.session_response(request, user, login=False)

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if isinstance(exc, ApiError) and exc.status_code == 401 and not services.is_mobile_client(self.request):
            services.clear_refresh_cookie(response)
        return response


class LogoutView(AuthView):
    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        raw = body.get("refresh_token")
        if not raw and services.senair("REFRESH_COOKIE_NAME") in request.COOKIES:
            services.check_origin(request)
            raw = request.COOKIES.get(services.senair("REFRESH_COOKIE_NAME"))
        services.blacklist_quietly(raw)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        services.clear_refresh_cookie(response)
        return response


class PasswordForgotView(AuthView):
    def post(self, request):
        data = validated(ForgotSerializer, request.data)
        user = User.objects.filter(email__iexact=data["email"].strip()).exclude(status=User.Status.DISABLED).first()
        if user is not None:
            services.send_password_reset(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetView(AuthView):
    def post(self, request):
        data = validated(ResetSerializer, request.data)
        user = services.user_from_reset_token(data["token"])
        if user is None:
            raise ApiError(
                "invalid_token",
                "Ce lien n'est plus valide. Faites une nouvelle demande.",
                422,
                fields={"token": "Lien invalide ou expiré."},
            )
        check_password_strength(data["password"], user)
        user.set_password(data["password"])
        if user.status == User.Status.PENDING:
            user.status = User.Status.ACTIVE  # l'invitation est acceptée au premier choix de mot de passe
        user.failed_login_count = 0
        user.locked_until = None
        user.save()
        services.revoke_all_sessions(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────── C1 à C8 ───────────────


class AccountView(NoStoreMixin, APIView):
    permission_classes = [IsActiveUser]


class MeView(AccountView):
    def get_permissions(self):
        if self.request.method == "PATCH":
            return [require("profile:manage")()]
        return super().get_permissions()

    def get(self, request):
        return Response(services.me_payload(request.user))

    def patch(self, request):
        data = validated(ProfileUpdateSerializer, request.data)
        user: User = request.user
        with transaction.atomic():
            if "full_name" in data:
                user.full_name = data["full_name"].strip()
            if "health_profile" in data:
                # Choisir un profil santé depuis son compte vaut consentement explicite ; le retirer efface la donnée.
                profile = data["health_profile"]
                if profile and profile != user.health_profile:
                    user.health_consent_at = timezone.now()
                if profile is None:
                    user.health_consent_at = None
                user.health_profile = profile
            user.save()
            if "zone_ids" in data:
                user.zones.set(data["zone_ids"])
        return Response(services.me_payload(user))

    def delete(self, request):
        user: User = request.user
        with transaction.atomic():
            services.revoke_all_sessions(user)
            user.delete()  # appareils, préférences et challenges MFA supprimés en cascade
        response = Response(status=status.HTTP_204_NO_CONTENT)
        services.clear_refresh_cookie(response)
        return response


class NotificationPreferencesView(AccountView):
    def get_permissions(self):
        return [require("notifications:manage")()]

    def get(self, request):
        return Response(services.preferences_payload(request.user))

    def put(self, request):
        data = validated(NotificationPreferencesSerializer, request.data)
        quiet = data["quiet_hours"]
        with transaction.atomic():
            prefs, _ = NotificationPreferences.objects.update_or_create(
                user=request.user,
                defaults={
                    "push_enabled": data["push_enabled"],
                    "email_enabled": data["email_enabled"],
                    "min_level": data["min_level"],
                    "pollutants": list(dict.fromkeys(data["pollutants"])),
                    "quiet_start": time.fromisoformat(quiet["start"]) if quiet else None,
                    "quiet_end": time.fromisoformat(quiet["end"]) if quiet else None,
                },
            )
            prefs.zones.set(data["zone_ids"])
        return Response(services.preferences_payload(request.user, prefs))


class DevicesView(AccountView):
    def post(self, request):
        data = validated(DeviceSerializer, request.data)
        # Un jeton est propre à l'appareil : réenregistré par un autre compte, il change de propriétaire.
        Device.objects.update_or_create(
            token=data["token"], defaults={"user": request.user, "platform": data["platform"], "invalid_at": None}
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceDetailView(AccountView):
    def delete(self, request, token: str):
        Device.objects.filter(token=token, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyAlertsView(AccountView):
    def get(self, request):
        prefs = services.preferences_payload(request.user)
        zones = prefs["zone_ids"] or sorted(request.user.zones.values_list("id", flat=True))
        alerts = for_user(recent(filter_alerts(request)), request.user)
        if zones:
            alerts = alerts.filter(zone_id__in=zones)
        minimum = level_rank(prefs["min_level"])
        alerts = alerts.filter(severity__in=[lvl for lvl in AQI_LEVEL_IDS if level_rank(lvl) >= minimum])
        unread = request.query_params.get("unread")
        if unread not in (None, "", "true", "false"):
            raise validation_error({"unread": "true ou false attendu."})
        if unread == "true":
            alerts = alerts.filter(is_read=False)
        return Response(paginate(request, alerts, lambda alert: alert_payload(alert, read=alert.is_read)))


def _my_alert(alert_id: str) -> Alert:
    try:
        alert = Alert.objects.filter(pk=uuid.UUID(alert_id)).first()
    except ValueError:
        alert = None
    if alert is None:
        raise ApiError("not_found", "Alerte introuvable.", 404)
    return alert


class MyAlertReadView(AccountView):
    def post(self, request, alert_id: str):
        receipt, _ = AlertReceipt.objects.get_or_create(user=request.user, alert=_my_alert(alert_id))
        if receipt.read_at is None:
            receipt.read_at = timezone.now()
            receipt.save(update_fields=["read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyAlertsReadAllView(AccountView):
    def post(self, request):
        now = timezone.now()
        AlertReceipt.objects.filter(user=request.user, read_at__isnull=True).update(read_at=now)
        known = AlertReceipt.objects.filter(user=request.user).values("alert_id")
        missing = recent(Alert.objects.all()).exclude(pk__in=known).values_list("pk", flat=True)
        AlertReceipt.objects.bulk_create(
            [AlertReceipt(user=request.user, alert_id=pk, read_at=now) for pk in missing], ignore_conflicts=True
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyAlertDetailView(AccountView):
    def delete(self, request, alert_id: str):
        now = timezone.now()
        receipt, _ = AlertReceipt.objects.get_or_create(user=request.user, alert=_my_alert(alert_id))
        receipt.dismissed_at = now
        receipt.read_at = receipt.read_at or now
        receipt.save(update_fields=["dismissed_at", "read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────── D22 à D24 ───────────────


class AdminUsersView(NoStoreMixin, APIView):
    permission_classes = [require("users:manage")]

    def get(self, request):
        params = request.query_params
        users = User.objects.prefetch_related("zones").order_by("-created_at")
        errors = {}
        if role := params.get("role"):
            if role not in User.Role.values:
                errors["role"] = "Rôle inconnu."
            users = users.filter(role=role)
        if status_ := params.get("status"):
            if status_ not in User.Status.values:
                errors["status"] = "Statut inconnu."
            users = users.filter(status=status_)
        if search := params.get("search", "").strip():
            if len(search) > 100:
                errors["search"] = "100 caractères au maximum."
            users = users.filter(Q(email__icontains=search) | Q(full_name__icontains=search))
        if errors:
            raise validation_error(errors)
        return Response(paginate(request, users, services.user_payload, default_limit=50))

    def post(self, request):
        data = validated(UserInviteSerializer, request.data)
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise ApiError(
                "email_taken", "Un compte existe déjà avec cet e-mail.", 422, fields={"email": "Un compte existe déjà avec cet e-mail."}
            )
        user = User.objects.create_user(
            data["email"], None, full_name=data["full_name"].strip(), role=data["role"], status=User.Status.PENDING
        )
        audit.record(
            request, "user.invite", "user", user.pk, {"email": {"from": None, "to": user.email}, "role": {"from": None, "to": user.role}}
        )
        services.send_invitation(user, request.user)
        return Response(services.user_payload(user), status=status.HTTP_201_CREATED)


class AdminUserDetailView(NoStoreMixin, APIView):
    permission_classes = [require("users:manage")]

    def patch(self, request, user_id: str):
        user = _get_user(user_id)
        if user.pk == request.user.pk:
            raise ApiError("self_update", "Vous ne pouvez pas modifier votre propre rôle ni votre propre statut.", 403)
        data = validated(UserUpdateSerializer, request.data)
        changes = audit.diff(user, data)
        if changes:
            for field, value in data.items():
                setattr(user, field, value)
            user.save(update_fields=list(data))
            if user.status != User.Status.ACTIVE:
                services.revoke_all_sessions(user)
            audit.record(request, "user.update", "user", user.pk, changes)
        return Response(services.user_payload(user))


def _get_user(user_id: str) -> User:
    try:
        user = User.objects.filter(pk=uuid.UUID(user_id)).first()
    except ValueError:  # identifiant mal formé
        user = None
    if user is None:
        raise ApiError("not_found", "Utilisateur introuvable.", 404)
    return user
