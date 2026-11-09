"""
Contrôle et préparation des médias d'articles (D28, règles de packages/core/src/domain/media.ts) :
type déclaré et type réel (signature), taille, texte alternatif, puis pour les photos vérification Pillow
et réencodage sans métadonnées (EXIF, position GPS), orientation appliquée.
"""

import io
import logging
from dataclasses import dataclass
from pathlib import PurePath

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from senair.common.exceptions import ApiError, validation_error

from .models import MediaAsset

logger = logging.getLogger(__name__)

MB = 1024 * 1024


@dataclass(frozen=True)
class MediaRule:
    kind: str
    max_bytes: int
    too_large: str


IMAGE_RULE = MediaRule(MediaAsset.Kind.IMAGE, 5 * MB, "Photo trop lourde : 5 Mo maximum.")
VIDEO_RULE = MediaRule(MediaAsset.Kind.VIDEO, 50 * MB, "Vidéo trop lourde : 50 Mo maximum.")

# Type MIME déclaré : (règle, extension de stockage, format Pillow attendu).
ACCEPTED: dict[str, tuple[MediaRule, str, str | None]] = {
    "image/jpeg": (IMAGE_RULE, "jpg", "JPEG"),
    "image/png": (IMAGE_RULE, "png", "PNG"),
    "image/webp": (IMAGE_RULE, "webp", "WEBP"),
    "video/mp4": (VIDEO_RULE, "mp4", None),
    "video/webm": (VIDEO_RULE, "webm", None),
}

UNSUPPORTED = "Format non pris en charge : photo JPEG, PNG, WebP ou vidéo MP4, WebM."
MISMATCH = "Le contenu du fichier ne correspond pas à son type déclaré."
UNREADABLE = "Image illisible ou endommagée."
# Au-delà, le décodage consommerait trop de mémoire (protection contre les « bombes de décompression »).
MAX_PIXELS = 40_000_000
MAX_ALT_LENGTH = 300


def sniff(header: bytes) -> str | None:
    """Type réel d'après la signature du fichier (premiers octets), jamais d'après l'extension."""
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    if header[4:8] == b"ftyp":
        return "video/mp4"
    if header.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in header[:64]:
        return "video/webm"
    return None


def _invalid(message: str, field: str = "file") -> ApiError:
    return ApiError("invalid_media", message, 422, fields={field: message})


def _safe_file_name(name: str | None, extension: str) -> str:
    base = PurePath((name or "").replace("\\", "/")).name.strip()
    base = "".join(ch for ch in base if ch.isprintable())[:200]
    return base or f"media.{extension}"


def _clean_image(raw: bytes, pillow_format: str) -> tuple[bytes, int, int]:
    """Vérifie l'image puis la réencode : seuls les pixels sont conservés (aucun EXIF, XMP, ICC ni commentaire)."""
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format != pillow_format:
                raise _invalid(MISMATCH)
            if probe.width * probe.height > MAX_PIXELS:
                raise _invalid("Image trop grande : 40 mégapixels maximum.")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as source:
            source.load()
            image = ImageOps.exif_transpose(source)
    except ApiError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError) as error:
        logger.info("Image refusée : %s", error)
        raise _invalid(UNREADABLE) from error

    image.info = {}
    output = io.BytesIO()
    if pillow_format == "JPEG":
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(output, "JPEG", quality=88, optimize=True)
    elif pillow_format == "PNG":
        image.save(output, "PNG", optimize=True)
    else:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.save(output, "WEBP", quality=88)
    return output.getvalue(), image.width, image.height


def store_upload(upload: UploadedFile | None, alt: str | None, user) -> MediaAsset:
    if upload is None:
        raise validation_error({"file": "Fichier requis."})
    declared = (upload.content_type or "").split(";")[0].strip().lower()
    if declared not in ACCEPTED:
        raise _invalid(UNSUPPORTED)
    rule, extension, pillow_format = ACCEPTED[declared]

    if upload.size == 0:
        raise _invalid("Le fichier est vide.")
    if upload.size > rule.max_bytes:
        raise ApiError("file_too_large", rule.too_large, 413, fields={"file": rule.too_large})

    alt = (alt or "").strip()
    if len(alt) > MAX_ALT_LENGTH:
        raise validation_error({"alt": "300 caractères maximum."})

    upload.seek(0)
    header = upload.read(64)
    upload.seek(0)
    if sniff(header) != declared:
        raise _invalid(MISMATCH)

    asset = MediaAsset(
        kind=rule.kind,
        mime_type=declared,
        file_name=_safe_file_name(upload.name, extension),
        alt=alt,
        uploaded_by=user,
        created_at=timezone.now(),
    )
    if pillow_format:
        content, asset.width, asset.height = _clean_image(upload.read(), pillow_format)
        asset.size_bytes = len(content)
        asset.file.save(f"upload.{extension}", ContentFile(content), save=True)
    else:
        # Vidéo stockée telle quelle ; pas encore de miniature (posterUrl à null).
        asset.size_bytes = upload.size
        asset.file.save(f"upload.{extension}", upload, save=True)
    return asset
