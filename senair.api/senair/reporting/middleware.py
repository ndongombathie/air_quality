"""Mesure de fréquentation anonymisée (GET /admin/analytics/usage) : aucune adresse IP n'est conservée."""

import hashlib
import logging

from django.conf import settings
from django.db import IntegrityError
from django.db.models import F
from django.utils import timezone

from .models import UsageVisit

logger = logging.getLogger(__name__)


def platform_of(request) -> str:
    client = request.headers.get("X-Client", "").lower()
    if "ios" in client:
        return "ios"
    if "android" in client or "mobile" in client:
        return "android"
    return "web"


class UsageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/v1/") and response.status_code < 400:
            try:
                self._count(request)
            except Exception:  # la mesure d'audience ne doit jamais casser une requête
                logger.debug("Comptage de fréquentation ignoré", exc_info=True)
        return response

    def _count(self, request) -> None:
        today = timezone.now().date()
        user = getattr(request, "user", None)
        identity = (
            str(user.pk)
            if user is not None and user.is_authenticated
            else (f"{request.META.get('REMOTE_ADDR', '')}|{request.headers.get('User-Agent', '')}")
        )
        visitor = hashlib.sha256(f"{today}|{settings.SECRET_KEY}|{identity}".encode()).hexdigest()
        platform = platform_of(request)
        updated = UsageVisit.objects.filter(day=today, platform=platform, visitor_hash=visitor).update(requests=F("requests") + 1)
        if not updated:
            try:
                UsageVisit.objects.create(
                    day=today, platform=platform, visitor_hash=visitor, user=user if user is not None and user.is_authenticated else None
                )
            except IntegrityError:
                pass
