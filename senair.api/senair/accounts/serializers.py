"""Validation des corps de requête (les erreurs deviennent des 422 avec `details.fields` en camelCase)."""

import re

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from senair.common.domain import AQI_LEVEL_IDS, HEALTH_PROFILES, POLLUTANT_CODES
from senair.network.models import Zone

from .models import Device, User

OTP = re.compile(r"^\d{6}$")
HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_ZONES = 5


def _otp(value: str) -> str:
    if not OTP.match(value):
        raise serializers.ValidationError("Le code doit comporter 6 chiffres.")
    return value


def validate_zone_ids(value: list[str]) -> list[str]:
    ids = list(dict.fromkeys(value))
    if len(ids) > MAX_ZONES:
        raise serializers.ValidationError(f"{MAX_ZONES} zones au maximum.")
    known = set(Zone.objects.filter(id__in=ids).values_list("id", flat=True))
    unknown = [zone_id for zone_id in ids if zone_id not in known]
    if unknown:
        raise serializers.ValidationError(f"Zone inconnue : {', '.join(unknown)}.")
    return ids


def check_password_strength(password: str, user: User) -> None:
    try:
        password_validation.validate_password(password, user=user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({"password": " ".join(error.messages)}) from error


class ConsentSerializer(serializers.Serializer):
    terms = serializers.BooleanField()
    health_data = serializers.BooleanField()

    def validate_terms(self, value: bool) -> bool:
        if value is not True:
            raise serializers.ValidationError("L'acceptation des conditions d'utilisation est obligatoire.")
        return value


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(min_length=10, max_length=128, trim_whitespace=False)
    full_name = serializers.CharField(max_length=120)
    zone_ids = serializers.ListField(child=serializers.CharField(max_length=80), allow_empty=True)
    health_profile = serializers.ChoiceField(choices=HEALTH_PROFILES, allow_null=True)
    consent = ConsentSerializer()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_zone_ids(self, value):
        return validate_zone_ids(value)

    def validate(self, attrs):
        check_password_strength(attrs["password"], User(email=attrs["email"], full_name=attrs["full_name"]))
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    otp = serializers.CharField(required=False, allow_blank=True, validators=[])

    def validate_otp(self, value: str) -> str:
        return _otp(value) if value else value


class MfaVerifySerializer(serializers.Serializer):
    challenge_id = serializers.CharField(max_length=64)
    otp = serializers.CharField(validators=[_otp])


class ForgotSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class ResetSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=512)
    password = serializers.CharField(min_length=10, max_length=128, trim_whitespace=False)


class ProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120, required=False)
    zone_ids = serializers.ListField(child=serializers.CharField(max_length=80), required=False)
    health_profile = serializers.ChoiceField(choices=HEALTH_PROFILES, allow_null=True, required=False)

    def validate_zone_ids(self, value):
        return validate_zone_ids(value)


class QuietHoursSerializer(serializers.Serializer):
    start = serializers.RegexField(HHMM, error_messages={"invalid": "Format attendu : HH:MM."})
    end = serializers.RegexField(HHMM, error_messages={"invalid": "Format attendu : HH:MM."})


class NotificationPreferencesSerializer(serializers.Serializer):
    push_enabled = serializers.BooleanField()
    email_enabled = serializers.BooleanField()
    zone_ids = serializers.ListField(child=serializers.CharField(max_length=80), allow_empty=True)
    min_level = serializers.ChoiceField(choices=AQI_LEVEL_IDS)
    pollutants = serializers.ListField(child=serializers.ChoiceField(choices=POLLUTANT_CODES), allow_empty=False)
    quiet_hours = QuietHoursSerializer(allow_null=True)

    def validate_zone_ids(self, value):
        return validate_zone_ids(value)


class DeviceSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=Device.Platform.values)


class UserInviteSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    full_name = serializers.CharField(max_length=120)
    role = serializers.ChoiceField(choices=User.Role.values)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class UserUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.values, required=False)
    status = serializers.ChoiceField(choices=User.Status.values, required=False)
