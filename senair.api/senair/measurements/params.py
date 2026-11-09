"""Lecture des paramètres de requête (noms camelCase du client packages/core) et en-têtes de cache des vues."""

import hashlib
from collections.abc import Iterable
from datetime import datetime

from django.http import HttpResponseNotModified
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView

from senair.common.exceptions import validation_error
from senair.common.permissions import IsActiveUser
from senair.measurements.ingestion.base import to_float


def required(request, name: str) -> str:
    value = request.query_params.get(name)
    if value in (None, ""):
        raise validation_error({name: "Paramètre obligatoire."})
    return value


def datetime_param(request, name: str, is_required: bool = False) -> datetime | None:
    raw = required(request, name) if is_required else request.query_params.get(name)
    if raw in (None, ""):
        return None
    value = parse_datetime(raw.strip().replace(" ", "+"))  # « + » d'un fuseau décodé en espace dans l'URL
    if value is None or value.tzinfo is None:
        raise validation_error({name: "Date ISO-8601 avec fuseau attendue (ex. 2026-11-02T14:00:00Z)."})
    return value


def float_param(request, name: str, low: float, high: float, is_required: bool = True) -> float | None:
    raw = required(request, name) if is_required else request.query_params.get(name)
    if raw in (None, ""):
        return None
    value = to_float(raw)
    if value is None or not low <= value <= high:
        raise validation_error({name: f"Nombre entre {low:g} et {high:g} attendu."})
    return value


def int_param(request, name: str, low: int, high: int, default: int) -> int:
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise validation_error({name: "Nombre entier attendu."}) from error
    if not low <= value <= high:
        raise validation_error({name: f"Valeur entre {low} et {high} attendue."})
    return value


def list_param(request, name: str, allowed: Iterable[str]) -> list[str]:
    raw = request.query_params.get(name) or ""
    items = [item.strip() for item in raw.split(",") if item.strip()]
    allowed = tuple(allowed)
    unknown = [item for item in items if item not in allowed]
    if unknown:
        raise validation_error({name: f"Valeur(s) inconnue(s) : {', '.join(unknown)}. Valeurs possibles : {', '.join(allowed)}."})
    return list(dict.fromkeys(items))


def choice_param(request, name: str, allowed: Iterable[str], default: str | None = None) -> str | None:
    value = request.query_params.get(name) or default
    allowed = tuple(allowed)
    if value is not None and value not in allowed:
        raise validation_error({name: f"Valeurs possibles : {', '.join(allowed)}."})
    return value


class PublicReadView(APIView):
    """Lecture publique : `Cache-Control: public, max-age=60` et ETag (réponse 304 si inchangé)."""

    authentication_classes: list = []
    permission_classes: list = []
    throttle_scope = "public"

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if request.method != "GET" or response.status_code != 200:
            return response
        response.render()
        etag = '"' + hashlib.sha256(response.content).hexdigest()[:32] + '"'
        if etag in [tag.strip() for tag in request.headers.get("If-None-Match", "").split(",")]:
            not_modified = HttpResponseNotModified()
            not_modified["ETag"] = etag
            not_modified["Cache-Control"] = "public, max-age=60"
            return not_modified
        response["ETag"] = etag
        response["Cache-Control"] = "public, max-age=60"
        return response


class AdminView(APIView):
    """Routes /admin : authentification, compte actif et permission vérifiée par méthode ; jamais mises en cache."""

    read_permission = "admin:access"
    write_permission: str | None = None

    def get_permissions(self):
        from senair.common.permissions import require

        permission = (
            self.read_permission if self.request.method in ("GET", "HEAD", "OPTIONS") else (self.write_permission or self.read_permission)
        )
        return [IsActiveUser(), require(permission)()]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response
