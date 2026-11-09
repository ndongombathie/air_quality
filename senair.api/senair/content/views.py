"""Articles publics (P16, P17), gestion des articles (D11 à D15) et envoi de médias (D28)."""

import uuid

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from senair.common.exceptions import ApiError, validation_error
from senair.common.pagination import paginate
from senair.common.permissions import require
from senair.reporting import audit

from .media import store_upload
from .models import Article, ArticleMedia, MediaAsset
from .presenters import article_payload, media_payload, ordered_media, summary_payload, with_media
from .validation import ArticleInputSerializer, slugify

SLUG_TAKEN = "Ce lien est déjà utilisé."
TRUE_VALUES, FALSE_VALUES = {"true", "1"}, {"false", "0"}


class PublicView(APIView):
    """Lecture publique : cache court partagé (docs/08-api-endpoints.md)."""

    throttle_scope = "public"

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code == 200:
            response["Cache-Control"] = "public, max-age=60"
        return response


class AdminView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


def _choice(request, name: str, choices) -> str | None:
    value = request.query_params.get(name)
    if value in (None, ""):
        return None
    if value not in choices.values:
        raise validation_error({name: "Valeur non reconnue."})
    return value


def _filtered(request, queryset):
    category = _choice(request, "category", Article.Category)
    if category:
        queryset = queryset.filter(category=category)
    featured = request.query_params.get("featured")
    if featured not in (None, ""):
        if featured.lower() not in TRUE_VALUES | FALSE_VALUES:
            raise validation_error({"featured": "Booléen attendu (true ou false)."})
        queryset = queryset.filter(featured=featured.lower() in TRUE_VALUES)
    search = (request.query_params.get("search") or "").strip()
    if len(search) > 100:
        raise validation_error({"search": "100 caractères maximum."})
    if search:
        queryset = queryset.filter(Q(title__icontains=search) | Q(excerpt__icontains=search))
    return queryset


class ArticleListView(PublicView):
    def get(self, request):
        articles = _filtered(request, Article.objects.filter(status=Article.Status.PUBLISHED)).order_by("-published_at", "-updated_at")
        return Response(paginate(request, with_media(articles), lambda a: summary_payload(request, a)))


class ArticleDetailView(PublicView):
    def get(self, request, slug: str):
        article = get_object_or_404(with_media(Article.objects.filter(status=Article.Status.PUBLISHED)), slug=slug)
        return Response(article_payload(request, article))


# ─── Administration ───


def _get_article(article_id: str) -> Article:
    try:
        uuid.UUID(article_id)
    except ValueError as error:
        raise ApiError("not_found", "Élément introuvable.", 404) from error
    return get_object_or_404(Article, pk=article_id)


def _resolve_media(ids: list[str]) -> list[MediaAsset]:
    valid = []
    for media_id in ids:
        try:
            valid.append(uuid.UUID(media_id))
        except ValueError:
            raise validation_error({"mediaIds": f"Média introuvable : {media_id}."}) from None
    found = MediaAsset.objects.in_bulk(valid)
    missing = [str(media_id) for media_id in valid if media_id not in found]
    if missing:
        raise validation_error({"mediaIds": f"Média introuvable : {', '.join(missing)}."})
    return [found[media_id] for media_id in valid]


def _unique_slug(base: str, exclude_id=None) -> str:
    base = base or "article"
    candidate, counter = base, 2
    others = Article.objects.exclude(pk=exclude_id) if exclude_id else Article.objects.all()
    while others.filter(slug=candidate).exists():
        suffix = f"-{counter}"
        candidate = f"{base[: 80 - len(suffix)].rstrip('-')}{suffix}"
        counter += 1
    return candidate


def _slug_taken() -> ApiError:
    return ApiError("slug_taken", SLUG_TAKEN, 422, fields={"slug": SLUG_TAKEN})


def _set_media(article: Article, media: list[MediaAsset]) -> None:
    ArticleMedia.objects.filter(article=article).delete()
    ArticleMedia.objects.bulk_create(ArticleMedia(article=article, media=asset, position=index) for index, asset in enumerate(media))


def _validated(request, partial: bool) -> dict:
    serializer = ArticleInputSerializer(data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


AUDITED_FIELDS = ("title", "slug", "excerpt", "content", "category", "status", "featured", "cover_image_url", "tags")


class AdminArticleListView(AdminView):
    permission_classes = [require("articles:manage")]

    def get(self, request):
        articles = _filtered(request, Article.objects.all())
        state = _choice(request, "status", Article.Status)
        if state:
            articles = articles.filter(status=state)
        articles = with_media(articles.order_by("-updated_at"))
        return Response(paginate(request, articles, lambda a: summary_payload(request, a)))

    def post(self, request):
        data = _validated(request, partial=False)
        media = _resolve_media(data.pop("media_ids", []))
        requested_slug = data.pop("slug", "") or ""
        if requested_slug:
            if Article.objects.filter(slug=requested_slug).exists():
                raise _slug_taken()
            slug = requested_slug
        else:
            slug = _unique_slug(slugify(data["title"]))
        user = request.user
        article = Article(
            **data,
            slug=slug,
            author=user,
            author_name=user.full_name,
            author_role=user.get_role_display(),
            published_at=timezone.now() if data["status"] == Article.Status.PUBLISHED else None,
        )
        try:
            with transaction.atomic():
                article.save()
                _set_media(article, media)
        except IntegrityError as error:
            raise _slug_taken() from error
        created = {"title": article.title, "slug": slug, "status": article.status}
        changes = {field: {"from": None, "to": value} for field, value in created.items()}
        audit.record(request, "article.create", "article", article.id, changes)
        return Response(article_payload(request, article), status=status.HTTP_201_CREATED)


class AdminArticleDetailView(AdminView):
    permission_classes = [require("articles:manage")]

    def get(self, request, article_id: str):
        return Response(article_payload(request, _get_article(article_id)))

    def patch(self, request, article_id: str):
        article = _get_article(article_id)
        data = _validated(request, partial=True)
        media = _resolve_media(data.pop("media_ids")) if "media_ids" in data else None
        slug = data.pop("slug", "") or ""
        if slug and slug != article.slug:
            if Article.objects.exclude(pk=article.pk).filter(slug=slug).exists():
                raise _slug_taken()
            data["slug"] = slug

        changes = audit.diff(article, {field: data[field] for field in AUDITED_FIELDS if field in data})
        if media is not None:
            before = [str(asset.id) for asset in ordered_media(article)]
            after = [str(asset.id) for asset in media]
            if before != after:
                changes["media_ids"] = {"from": before, "to": after}

        for field, value in data.items():
            setattr(article, field, value)
        if article.status == Article.Status.PUBLISHED and article.published_at is None:
            article.published_at = timezone.now()
        try:
            with transaction.atomic():
                article.save()
                if media is not None:
                    _set_media(article, media)
        except IntegrityError as error:
            raise _slug_taken() from error
        audit.record(request, "article.update", "article", article.id, changes)
        return Response(article_payload(request, article))

    def delete(self, request, article_id: str):
        article = _get_article(article_id)
        snapshot = {"title": {"from": article.title, "to": None}, "slug": {"from": article.slug, "to": None}}
        article_pk = article.pk
        article.delete()
        audit.record(request, "article.delete", "article", article_pk, snapshot)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaUploadView(AdminView):
    permission_classes = [require("articles:manage")]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "upload"

    def post(self, request):
        asset = store_upload(request.FILES.get("file"), request.data.get("alt"), request.user)
        audit.record(
            request,
            "media.upload",
            "media",
            asset.id,
            {"kind": {"from": None, "to": asset.kind}, "size_bytes": {"from": None, "to": asset.size_bytes}},
        )
        return Response(media_payload(request, asset), status=status.HTTP_201_CREATED)
