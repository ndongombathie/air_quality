"""Comptes : citoyens, autorités sanitaires, administrateurs (CDC §2.1.5)."""

import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from senair.common import crypto
from senair.common.domain import AQI_LEVEL_CHOICES, HEALTH_PROFILES
from senair.network.models import Zone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **fields):
        if not email:
            raise ValueError("L'e-mail est obligatoire.")
        user = self.model(email=self.normalize_email(email).lower(), **fields)
        user.set_password(password) if password else user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **fields):
        fields.setdefault("role", User.Role.ADMIN)
        fields.setdefault("is_staff", True)
        fields.setdefault("is_superuser", True)
        fields.setdefault("full_name", "Administrateur")
        return self.create_user(email, password, **fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CITIZEN = "citizen", "Citoyen"
        AUTHORITY = "authority", "Autorité sanitaire"
        ADMIN = "admin", "Administrateur"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        DISABLED = "disabled", "Désactivé"
        PENDING = "pending", "Invitation en attente"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=120)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CITIZEN)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    zones = models.ManyToManyField(Zone, blank=True, related_name="followers")
    # Donnée de santé : enregistrée uniquement avec consentement explicite (minimisation, CDC §2.2).
    health_profile = models.CharField(max_length=20, choices=[(p, p) for p in HEALTH_PROFILES], null=True, blank=True)
    health_consent_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    # Secret TOTP chiffré (Fernet). Obligatoire pour les rôles authority/admin.
    mfa_secret_encrypted = models.TextField(blank=True, default="")
    mfa_enabled = models.BooleanField(default=False)
    failed_login_count = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    last_login_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email

    @property
    def is_active(self) -> bool:  # utilisé par Django et SimpleJWT
        return self.status == self.Status.ACTIVE

    @property
    def requires_mfa(self) -> bool:
        return self.role in (self.Role.AUTHORITY, self.Role.ADMIN)

    def set_mfa_secret(self, secret: str) -> None:
        self.mfa_secret_encrypted = crypto.encrypt(secret)

    def get_mfa_secret(self) -> str | None:
        return crypto.decrypt(self.mfa_secret_encrypted) if self.mfa_secret_encrypted else None


class MfaChallenge(models.Model):
    """Étape intermédiaire de connexion : mot de passe validé, code TOTP attendu (usage unique, 5 min)."""

    id = models.CharField(primary_key=True, max_length=64)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mfa_challenges")
    client = models.CharField(max_length=20, default="web")
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)


class NotificationPreferences(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="notification_preferences")
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    zones = models.ManyToManyField(Zone, blank=True, related_name="+")
    min_level = models.CharField(max_length=24, choices=AQI_LEVEL_CHOICES, default="unhealthy_sensitive")
    pollutants = models.JSONField(default=list)
    quiet_start = models.TimeField(null=True, blank=True)
    quiet_end = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Device(models.Model):
    """Jeton de notification push (Expo / FCM) d'un appareil."""

    class Platform(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"
        WEB = "web", "Web"

    token = models.CharField(primary_key=True, max_length=255)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    platform = models.CharField(max_length=10, choices=Platform.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    invalid_at = models.DateTimeField(null=True, blank=True)
