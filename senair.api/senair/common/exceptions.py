"""
Format d'erreur unique : { code, message, details?: { fields }, requestId }.
Les messages ne révèlent jamais de détail technique (traces, SQL).
"""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .camelcase import to_camel
from .middleware import current_request_id

logger = logging.getLogger("senair.api")


class ApiError(exceptions.APIException):
    """Erreur métier explicite : `raise ApiError('slug_taken', 'Ce lien est déjà utilisé.', 422, fields={'slug': ...})`."""

    def __init__(self, code: str, message: str, http_status: int = 400, fields: dict | None = None, details: dict | None = None):
        super().__init__(detail=message, code=code)
        self.status_code = http_status
        self.error_code = code
        self.fields = fields
        self.extra = details


def validation_error(fields: dict[str, str], message: str = "Certaines informations sont invalides.") -> ApiError:
    return ApiError("validation_error", message, status.HTTP_422_UNPROCESSABLE_ENTITY, fields=fields)


def _flatten_fields(detail, path: tuple[str, ...] = ()) -> dict[str, str]:
    """Erreurs DRF imbriquées vers { "consent.healthData": "message" } (noms en camelCase)."""
    out: dict[str, str] = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            name = "_form" if key == "non_field_errors" else to_camel(str(key))
            out.update(_flatten_fields(value, (*path, name)))
    elif isinstance(detail, list) and detail and all(not isinstance(item, (dict, list)) for item in detail):
        out[".".join(path) or "_form"] = str(detail[0])
    elif isinstance(detail, list):
        for index, item in enumerate(detail):
            out.update(_flatten_fields(item, (*path, str(index))))
    else:
        out[".".join(path) or "_form"] = str(detail)
    return out


_STATUS_CODES = {
    400: ("bad_request", "Requête invalide."),
    401: ("unauthorized", "Authentification requise."),
    403: ("forbidden", "Vous n'avez pas les droits nécessaires pour cette action."),
    404: ("not_found", "Élément introuvable."),
    405: ("method_not_allowed", "Méthode non autorisée."),
    409: ("conflict", "Conflit avec l'état actuel de la ressource."),
    413: ("payload_too_large", "Fichier ou requête trop volumineux."),
    415: ("unsupported_media_type", "Format de contenu non pris en charge."),
    422: ("validation_error", "Certaines informations sont invalides."),
    429: ("rate_limited", "Trop de requêtes. Réessayez dans un instant."),
}


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Erreur non gérée", exc_info=exc)
        return Response(
            {"code": "server_error", "message": "Le service est momentanément indisponible.", "request_id": current_request_id()},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    body: dict = {"request_id": current_request_id()}
    if isinstance(exc, ApiError):
        body.update(code=exc.error_code, message=str(exc.detail))
        details = dict(exc.extra or {})
        if exc.fields:
            details["fields"] = exc.fields
        if details:
            body["details"] = details
    elif isinstance(exc, exceptions.ValidationError):
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        body.update(code="validation_error", message=_STATUS_CODES[422][1], details={"fields": _flatten_fields(exc.detail)})
    else:
        code, message = _STATUS_CODES.get(response.status_code, ("error", "Une erreur est survenue."))
        if isinstance(exc, exceptions.NotAuthenticated | exceptions.AuthenticationFailed):
            code = "unauthorized"
            response.status_code = status.HTTP_401_UNAUTHORIZED
        body.update(code=code, message=message)
    response.data = body
    return response
