"""Articles publiés par les autorités et médias associés (photos, vidéos)."""

import uuid

from django.conf import settings
from django.db import models


class Article(models.Model):
    class Category(models.TextChoices):
        ALERT = "alert", "Alerte"
        INFO = "info", "Information"
        REPORT = "report", "Rapport"
        REGULATION = "regulation", "Réglementation"
        EVENT = "event", "Événement"
        EDUCATION = "education", "Sensibilisation"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publié"
        ARCHIVED = "archived", "Archivé"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=160)
    excerpt = models.CharField(max_length=300)
    # Markdown ; le HTML brut n'est jamais interprété par les clients.
    content = models.TextField()
    category = models.CharField(max_length=12, choices=Category.choices, default=Category.INFO)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    featured = models.BooleanField(default=False)
    cover_image_url = models.URLField(null=True, blank=True)
    tags = models.JSONField(default=list)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="articles")
    author_name = models.CharField(max_length=120)
    author_role = models.CharField(max_length=120, blank=True, default="")
    media = models.ManyToManyField("MediaAsset", through="ArticleMedia", related_name="articles", blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-updated_at"]
        indexes = [models.Index(fields=["status", "-published_at"]), models.Index(fields=["category"])]


def media_upload_path(instance: "MediaAsset", filename: str) -> str:
    # Nom de fichier neutre : jamais le nom fourni par l'utilisateur dans le chemin.
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"media/{instance.created_at:%Y/%m}/{instance.id}.{extension}"


class MediaAsset(models.Model):
    class Kind(models.TextChoices):
        IMAGE = "image", "Photo"
        VIDEO = "video", "Vidéo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=5, choices=Kind.choices)
    file = models.FileField(upload_to=media_upload_path)
    poster = models.FileField(upload_to=media_upload_path, null=True, blank=True)
    mime_type = models.CharField(max_length=40)
    size_bytes = models.PositiveBigIntegerField()
    file_name = models.CharField(max_length=255)
    alt = models.CharField(max_length=300, blank=True, default="")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_sec = models.FloatField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField()


class ArticleMedia(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE)
    media = models.ForeignKey(MediaAsset, on_delete=models.CASCADE)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [models.UniqueConstraint(fields=["article", "media"], name="unique_media_per_article")]
