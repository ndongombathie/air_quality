"""Réglages des tests : base SQLite en mémoire, hachage rapide, aucun appel réseau sortant."""

import os
import tempfile

os.environ.setdefault("DJANGO_DEBUG", "1")
os.environ.setdefault("DJANGO_SECRET_KEY", "tests-only-secret-key-long-enough-for-hmac-sha256")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ["MEDIA_ROOT"] = tempfile.mkdtemp(prefix="senair-media-")
os.environ["PUSH_ENABLED"] = "0"

from .settings import *  # noqa: E402,F403

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"auth": "1000/min", "public": "10000/min", "upload": "1000/min"}  # noqa: F405
