"""Journal d'audit : à appeler pour toute écriture d'administration (CDC « Traçabilité »)."""

from typing import Any

from senair.common.middleware import current_request_id

from .models import AuditLogEntry


def client_ip(request) -> str | None:
    # Derrière un proxy de confiance, la première adresse de X-Forwarded-For est celle du client.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded.split(",")[0].strip() or None) if forwarded else request.META.get("REMOTE_ADDR")


def diff(instance: Any, updates: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """{ champ: { from, to } } pour les seuls champs réellement modifiés."""
    changes = {}
    for field, new_value in updates.items():
        old_value = getattr(instance, field, None)
        if old_value != new_value:
            changes[field] = {"from": old_value, "to": new_value}
    return changes


def record(request, action: str, resource: str, resource_id: Any = None, changes: dict | None = None) -> AuditLogEntry:
    user = request.user
    return AuditLogEntry.objects.create(
        actor=user if user.is_authenticated else None,
        actor_email=getattr(user, "email", "") or "",
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id is not None else None,
        changes=_jsonable(changes) if changes else None,
        ip=client_ip(request),
        request_id=current_request_id(),
    )


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
