"""Chiffrement symétrique des secrets stockés en base (secrets TOTP)."""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet
from django.conf import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.SENAIR.get("FIELD_ENCRYPTION_KEY")
    if not key:
        # Repli : clé dérivée de SECRET_KEY. En production, fournir FIELD_ENCRYPTION_KEY (rotation indépendante).
        key = base64.urlsafe_b64encode(hashlib.sha256(f"senair-fields:{settings.SECRET_KEY}".encode()).digest()).decode()
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
