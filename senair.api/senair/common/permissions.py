"""
Rôles et permissions : miroir exact de packages/core/src/auth/permissions.ts (vérifié par tests/test_parity.py).
Ici, c'est l'autorisation qui fait foi ; côté front, elle ne sert qu'à adapter l'interface.
"""

from rest_framework.permissions import BasePermission

ROLES = ("citizen", "authority", "admin")

PERMISSIONS = (
    "profile:manage",
    "notifications:manage",
    "admin:access",
    "alerts:manage",
    "articles:manage",
    "reports:read",
    "reports:generate",
    "analytics:read",
    "stations:manage",
    "thresholds:manage",
    "sources:manage",
    "models:manage",
    "users:manage",
    "audit:read",
    "data:export_raw",
)

_CITIZEN = ("profile:manage", "notifications:manage")
_AUTHORITY = (*_CITIZEN, "admin:access", "alerts:manage", "articles:manage", "reports:read", "reports:generate", "analytics:read")

ROLE_PERMISSIONS: dict[str, tuple[str, ...]] = {
    "citizen": _CITIZEN,
    "authority": _AUTHORITY,
    "admin": PERMISSIONS,
}


def permissions_for(user) -> list[str]:
    if not user or not user.is_authenticated or getattr(user, "status", "active") != "active":
        return []
    return list(ROLE_PERMISSIONS.get(user.role, ()))


def has_permission(user, permission: str) -> bool:
    return permission in permissions_for(user)


class IsActiveUser(BasePermission):
    """Authentifié et compte actif (un compte désactivé perd l'accès même avec un jeton valide)."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "status", "active") == "active")


def require(permission: str) -> type[BasePermission]:
    """Fabrique de classe de permission : `permission_classes = [require('alerts:manage')]`."""

    class _Require(IsActiveUser):
        def has_permission(self, request, view) -> bool:
            return super().has_permission(request, view) and has_permission(request.user, permission)

    _Require.__name__ = f"Require[{permission}]"
    return _Require
