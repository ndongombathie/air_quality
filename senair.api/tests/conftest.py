"""Fixtures communes : données de référence, utilisateurs par rôle, clients API authentifiés (JWT)."""

import pyotp
import pytest
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from senair.accounts.models import User

PASSWORD = "MotDePasse-2026!"


@pytest.fixture
def reference(db):
    call_command("seed_reference", verbosity=0)


def make_user(role: str = "citizen", email: str | None = None, **fields) -> User:
    full_name = fields.pop("full_name", f"Test {role}")
    user = User.objects.create_user(email or f"{role}@test.sn", PASSWORD, full_name=full_name, role=role, **fields)
    if user.requires_mfa:
        user.set_mfa_secret(pyotp.random_base32())
        user.mfa_enabled = True
        user.save()
    return user


def client_for(user: User | None = None) -> APIClient:
    client = APIClient()
    if user is not None:
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@pytest.fixture
def anon(db) -> APIClient:
    return client_for()


@pytest.fixture
def citizen(db) -> User:
    return make_user("citizen")


@pytest.fixture
def authority(db) -> User:
    return make_user("authority")


@pytest.fixture
def admin(db) -> User:
    return make_user("admin")


@pytest.fixture
def citizen_client(citizen) -> APIClient:
    return client_for(citizen)


@pytest.fixture
def authority_client(authority) -> APIClient:
    return client_for(authority)


@pytest.fixture
def admin_client(admin) -> APIClient:
    return client_for(admin)
