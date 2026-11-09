"""
Réglages de l'API SEN-AIR, entièrement pilotés par variables d'environnement (voir .env.example).
Aucun secret n'a de valeur par défaut hors mode DEBUG.
"""

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent  # racine du monorepo (docs, packages/core)


def env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return default if value in (None, "") else int(value)


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def database_from_url(url: str) -> dict:
    """postgres://user:mot_de_passe@hote:5432/base  ou  sqlite:///chemin/base.sqlite3"""
    parsed = urlparse(url)
    if parsed.scheme == "sqlite":
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": parsed.path[1:] or BASE_DIR / "db.sqlite3"}
    if parsed.scheme in {"postgres", "postgresql"}:
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": unquote(parsed.username or ""),
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname or "localhost",
            "PORT": str(parsed.port or 5432),
            "CONN_MAX_AGE": env_int("DB_CONN_MAX_AGE", 60),
            "CONN_HEALTH_CHECKS": True,
        }
    raise ValueError(f"DATABASE_URL non pris en charge : {parsed.scheme}")


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY") or ("dev-insecure-change-me" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY est obligatoire hors mode DEBUG.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,10.0.2.2")
if DEBUG and not env("DJANGO_ALLOWED_HOSTS"):
    # Développement : téléphone ou émulateur joignent l'API par l'IP locale de l'ordinateur, qui change selon le Wi-Fi.
    ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "senair.common",
    "senair.network",
    "senair.accounts",
    "senair.measurements",
    "senair.forecasts",
    "senair.alerts",
    "senair.content",
    "senair.reporting",
]

MIDDLEWARE = [
    "senair.common.middleware.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "senair.reporting.middleware.UsageMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {"default": database_from_url(env("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"))}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
# Argon2 si disponible, sinon PBKDF2 (CDC : mots de passe hachés).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
]

LANGUAGE_CODE = "fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", "/media/")
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))
# Les vidéos d'articles peuvent atteindre 50 Mo (domain/media.ts côté front).
DATA_UPLOAD_MAX_MEMORY_SIZE = 55 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["senair.common.camelcase.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "senair.common.camelcase.CamelCaseJSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_PAGINATION_CLASS": None,
    "EXCEPTION_HANDLER": "senair.common.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "auth": env("THROTTLE_AUTH", "10/min"),
        "public": env("THROTTLE_PUBLIC", "600/min"),
        "upload": env("THROTTLE_UPLOAD", "30/min"),
    },
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", 15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", 30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SEN-AIR API",
    "VERSION": "1.0.0",
    "DESCRIPTION": "Contrat de référence : docs/api/openapi.yaml (servi sur /api/v1/openapi.yaml).",
}

# CORS : origines explicites + cookie de refresh (web).
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173")
if DEBUG and not env("CORS_ALLOWED_ORIGINS"):
    # Développement : web de l'app mobile (Expo, port 8081) et clients du réseau local.
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^https?://(localhost|127\.0\.0\.1|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2})(:\d+)?$"]
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"
CORS_EXPOSE_HEADERS = ["X-Request-Id", "Retry-After"]
CORS_ALLOW_HEADERS = ["accept", "authorization", "content-type", "x-client", "x-request-id"]
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", ",".join(CORS_ALLOWED_ORIGINS))

# En-têtes de sécurité (CDC : TLS obligatoire en production).
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 63072000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Envoi d'e-mails (Django 6.1 : MAILERS remplace EMAIL_BACKEND). En développement, affichage dans la console.
MAILERS = {
    "default": {
        "BACKEND": env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"),
        "OPTIONS": {
            key: value
            for key, value in {
                "host": env("EMAIL_HOST"),
                "port": env_int("EMAIL_PORT", 587) if env("EMAIL_HOST") else None,
                "username": env("EMAIL_HOST_USER"),
                "password": env("EMAIL_HOST_PASSWORD"),
                "use_tls": env_bool("EMAIL_USE_TLS", True) if env("EMAIL_HOST") else None,
            }.items()
            if value is not None
        },
    }
}
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "SEN-AIR <no-reply@senair.sn>")

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "senair"}}
if env("REDIS_URL"):
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": env("REDIS_URL")}}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "senair.common.middleware.RequestIdLogFilter"}},
    "formatters": {"standard": {"format": "%(asctime)s %(levelname)s [%(name)s] [req:%(request_id)s] %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "standard", "filters": ["request_id"]}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
    "loggers": {"django.db.backends": {"level": "WARNING"}, "kafka": {"level": "WARNING"}},
}

# ──────────────── Paramètres métier SEN-AIR ────────────────
SENAIR = {
    "API_VERSION": "1.0.0",
    # Cookie httpOnly du refresh token pour le client web (le mobile reçoit le jeton dans le corps).
    "REFRESH_COOKIE_NAME": "senair_refresh",
    "REFRESH_COOKIE_PATH": "/api/v1/auth",
    "REFRESH_COOKIE_SECURE": not DEBUG,
    "MOBILE_CLIENT_HEADER": "senair-mobile",
    "MFA_ISSUER": "SEN-AIR",
    "MFA_CHALLENGE_SECONDS": 300,
    # Clé Fernet (base64 32 octets) qui chiffre les secrets TOTP en base. Dérivée de SECRET_KEY si absente.
    "FIELD_ENCRYPTION_KEY": env("FIELD_ENCRYPTION_KEY"),
    "FRONTEND_URL": env("FRONTEND_URL", "http://localhost:5173"),
    # Flux de données (pipeline de l'équipe data, voir docs/13-backend.md).
    "KAFKA_BOOTSTRAP_SERVERS": env_list("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
    "KAFKA_GROUP_ID": env("KAFKA_GROUP_ID", "senair-api"),
    "TOPIC_MEASUREMENTS_RAW": env("TOPIC_MEASUREMENTS_RAW", "air-quality"),
    "TOPIC_MEASUREMENTS": env("TOPIC_MEASUREMENTS", "senair.measurements.v1"),
    "TOPIC_FORECASTS": env("TOPIC_FORECASTS", "senair.forecasts.v1"),
    "TOPIC_MODELS": env("TOPIC_MODELS", "senair.models.v1"),
    "TOPIC_INTERPOLATIONS": env("TOPIC_INTERPOLATIONS", "senair.interpolations.v1"),
    "TOPIC_DEAD_LETTER": env("TOPIC_DEAD_LETTER", "senair.dead-letter.v1"),
    "STREAM_SCHEMAS_DIR": env("STREAM_SCHEMAS_DIR", str(REPO_DIR / "docs/stream")),
    # Valeurs limites du calcul IQA (sous-indice = concentration / limite × 100). Décision d'équipe :
    # OMS 2021 (24 h) par défaut ; le pipeline actuel utilise 75 µg/m³ pour les PM2.5 (cible intermédiaire).
    "AQI_LIMITS": {
        "pm25": float(env("AQI_LIMIT_PM25", "15")),
        "pm10": float(env("AQI_LIMIT_PM10", "45")),
        "no2": float(env("AQI_LIMIT_NO2", "25")),
        "so2": float(env("AQI_LIMIT_SO2", "40")),
        "co": float(env("AQI_LIMIT_CO", "4")),  # mg/m³
        "o3": float(env("AQI_LIMIT_O3", "100")),
    },
    # Modèles IA chargés depuis des fichiers (en attendant les prévisions publiées sur le flux).
    "MODEL_INTERPOLATION_PATH": env("MODEL_INTERPOLATION_PATH", str(REPO_DIR / "air_quality/airflow/models/knn_model.pkl")),
    "EXPO_PUSH_URL": env("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send"),
    "PUSH_ENABLED": env_bool("PUSH_ENABLED", not DEBUG),
    # Les alertes résolues depuis plus de N jours disparaissent des listes publiques et des notifications (restent en admin).
    "ALERT_HISTORY_DAYS": int(env("ALERT_HISTORY_DAYS", "30")),
    # Au-delà de ce silence (station muette), un nouveau dépassement ouvre une nouvelle alerte au lieu de prolonger l'ancienne.
    "ALERT_GAP_HOURS": int(env("ALERT_GAP_HOURS", "24")),
    "DOWNLOAD_URL_TTL_SECONDS": env_int("DOWNLOAD_URL_TTL_SECONDS", 600),
    "OPENAPI_PATH": env("OPENAPI_PATH", str(REPO_DIR / "docs/api/openapi.yaml")),
}
