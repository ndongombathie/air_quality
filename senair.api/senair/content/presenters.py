"""Articles et médias vers JSON du contrat (ArticleSummary, Article, MediaAsset). Clés en snake_case."""

from django.db.models import Prefetch, QuerySet

from senair.common.domain import iso

from .models import Article, ArticleMedia, MediaAsset


def absolute_url(request, file_field) -> str | None:
    if not file_field:
        return None
    url = file_field.url
    return request.build_absolute_uri(url) if request is not None else url


def media_payload(request, asset: MediaAsset) -> dict:
    return {
        "id": str(asset.id),
        "kind": asset.kind,
        "url": absolute_url(request, asset.file),
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "file_name": asset.file_name,
        "alt": asset.alt,
        "width": asset.width,
        "height": asset.height,
        "duration_sec": asset.duration_sec,
        "poster_url": absolute_url(request, asset.poster),
        "created_at": iso(asset.created_at),
    }


def with_media(queryset: QuerySet[Article]) -> QuerySet[Article]:
    """Précharge les médias dans l'ordre d'affichage (une requête pour toute la page)."""
    links = ArticleMedia.objects.select_related("media").order_by("position")
    return queryset.prefetch_related(Prefetch("articlemedia_set", queryset=links, to_attr="ordered_media"))


def ordered_media(article: Article) -> list[MediaAsset]:
    links = getattr(article, "ordered_media", None)
    if links is None:
        links = list(ArticleMedia.objects.filter(article=article).select_related("media").order_by("position"))
    return [link.media for link in links]


def summary_payload(request, article: Article) -> dict:
    media = ordered_media(article)
    cover = article.cover_image_url
    if not cover:
        first_photo = next((asset for asset in media if asset.kind == MediaAsset.Kind.IMAGE), None)
        cover = absolute_url(request, first_photo.file) if first_photo else None
    return {
        "id": str(article.id),
        "slug": article.slug,
        "title": article.title,
        "excerpt": article.excerpt,
        "category": article.category,
        "status": article.status,
        "featured": article.featured,
        "cover_image_url": cover,
        "media": [media_payload(request, asset) for asset in media],
        "tags": list(article.tags or []),
        "author": {
            "id": str(article.author_id) if article.author_id else None,
            "name": article.author_name,
            "role": article.author_role,
        },
        "published_at": iso(article.published_at),
        "created_at": iso(article.created_at),
        "updated_at": iso(article.updated_at),
    }


def article_payload(request, article: Article) -> dict:
    return {**summary_payload(request, article), "content": article.content}
