"""
URL de téléchargement signées et temporaires (rapports, exports) : le lien suffit à télécharger,
sans jeton d'accès, mais il expire (DOWNLOAD_URL_TTL_SECONDS) et ne peut pas être falsifié.
"""

from datetime import timedelta
from pathlib import PurePosixPath

from django.conf import settings
from django.core import signing
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils import timezone

from .domain import iso
from .files import CONTENT_TYPES

_SALT = "senair.downloads"


def signed_url(request, storage_name: str, file_name: str) -> tuple[str, str]:
    """Retourne (url absolue, expiration ISO) pour un fichier du stockage."""
    token = signing.dumps({"p": storage_name, "n": file_name}, salt=_SALT, compress=True)
    ttl = settings.SENAIR["DOWNLOAD_URL_TTL_SECONDS"]
    url = request.build_absolute_uri(reverse("signed-download", args=[token]))
    return url, iso(timezone.now() + timedelta(seconds=ttl))


def download_view(request, token: str):
    try:
        payload = signing.loads(token, salt=_SALT, max_age=settings.SENAIR["DOWNLOAD_URL_TTL_SECONDS"])
    except signing.BadSignature as error:  # inclut SignatureExpired
        raise Http404 from error
    storage_name = payload["p"]
    if not default_storage.exists(storage_name):
        raise Http404
    extension = PurePosixPath(payload["n"]).suffix.lstrip(".")
    response = FileResponse(default_storage.open(storage_name, "rb"), as_attachment=True, filename=payload["n"])
    response["Content-Type"] = CONTENT_TYPES.get(extension, "application/octet-stream")
    response["Cache-Control"] = "private, no-store"
    return response


urlpatterns = [path("downloads/<str:token>", download_view, name="signed-download")]
