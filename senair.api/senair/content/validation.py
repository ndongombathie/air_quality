"""Validation d'ArticleInput, alignée sur articleSchema (packages/core/src/validation/schemas.ts)."""

import re
import unicodedata

from django.core.validators import RegexValidator
from rest_framework import serializers

from .models import Article

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
MAX_MEDIA_PER_ARTICLE = 10


def slugify(value: str, max_length: int = 80) -> str:
    """Même transformation que le front (zoneIdOf) : accents retirés, minuscules, tirets."""
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:max_length].strip("-")


def _https_only(value: str | None) -> None:
    if value and not value.lower().startswith("https://"):
        raise serializers.ValidationError("HTTPS requis.")


class ArticleInputSerializer(serializers.Serializer):
    title = serializers.CharField(
        min_length=5, max_length=160, error_messages={"min_length": "5 caractères minimum.", "max_length": "160 caractères maximum."}
    )
    slug = serializers.CharField(
        max_length=80,
        required=False,
        allow_blank=True,
        validators=[RegexValidator(SLUG_PATTERN, "Minuscules, chiffres et tirets uniquement.")],
        error_messages={"max_length": "80 caractères maximum."},
    )
    excerpt = serializers.CharField(
        min_length=10, max_length=300, error_messages={"min_length": "10 caractères minimum.", "max_length": "300 caractères maximum."}
    )
    content = serializers.CharField(
        min_length=20,
        max_length=50_000,
        trim_whitespace=True,
        error_messages={"min_length": "20 caractères minimum.", "max_length": "50 000 caractères maximum."},
    )
    category = serializers.ChoiceField(choices=Article.Category.choices)
    status = serializers.ChoiceField(choices=Article.Status.choices)
    featured = serializers.BooleanField(required=False, default=False)
    # Le modèle limite l'URL à 200 caractères (URLField).
    cover_image_url = serializers.URLField(
        required=False, allow_null=True, default=None, max_length=200, validators=[_https_only], error_messages={"invalid": "URL invalide."}
    )
    media_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        max_length=MAX_MEDIA_PER_ARTICLE,
        error_messages={"max_length": "10 médias maximum."},
    )
    tags = serializers.ListField(
        child=serializers.CharField(min_length=1, max_length=30),
        required=False,
        default=list,
        max_length=10,
        error_messages={"max_length": "10 mots-clés maximum."},
    )

    def validate_tags(self, tags: list[str]) -> list[str]:
        return list(dict.fromkeys(tags))

    def validate_media_ids(self, ids: list[str]) -> list[str]:
        return list(dict.fromkeys(ids))
