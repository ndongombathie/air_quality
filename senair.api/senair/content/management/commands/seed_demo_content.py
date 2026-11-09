"""
Articles de démonstration. Idempotent.
- les 5 premiers sont identiques à packages/core/src/mock/fixtures.ts (createMockArticles) ;
- les 15 articles éditoriaux de `senair/content/seed_articles.py`, illustrés par une photo libre de droits.
"""

import json
from datetime import timedelta
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from senair.content.media import store_upload
from senair.content.models import Article, ArticleMedia
from senair.content.seed_articles import ARTICLES, SeedArticle

SEED_MEDIA = Path(__file__).resolve().parents[2] / "seed_media"

H = timedelta(hours=1)
D = timedelta(days=1)

# (slug, titre, chapô, contenu, catégorie, statut, à la une, mots-clés, auteur, rôle, publié il y a, créé il y a, modifié il y a)
DEMO_ARTICLES = (
    (
        "pic-pollution-hotel-de-ville",
        "Pic de particules fines à l'Hôtel de Ville",
        "Une forte concentration de PM2.5 a été mesurée au centre-ville. Les personnes sensibles sont invitées à limiter leurs sorties.",
        "## Que se passe-t-il ?\n\nLa station **Hôtel de Ville** enregistre depuis ce matin des concentrations de PM2.5 supérieures"
        " au seuil OMS de 15 µg/m³ (moyenne 24 h).\n\n## Recommandations\n\n- Limitez les efforts physiques en extérieur\n"
        "- Aérez tôt le matin (entre 6 h et 8 h)\n- Les personnes asthmatiques gardent leur traitement à portée de main",
        "alert",
        "published",
        True,
        ["pm25", "centre-ville"],
        "Direction de la Santé de Thiès",
        "Autorité sanitaire",
        2 * H,
        3 * H,
        2 * H,
    ),
    (
        "harmattan-comprendre-les-poussieres",
        "Harmattan : comprendre les épisodes de poussières",
        "De novembre à mai, l'harmattan transporte des poussières sahariennes qui font grimper les PM10.",
        "## L'harmattan\n\nVent sec et chaud venu du Sahara, il soulève de grandes quantités de poussières.\n\n## Effets\n\n"
        "Les PM10 peuvent dépasser plusieurs fois la valeur guide OMS (45 µg/m³ sur 24 h).\n\n## Se protéger\n\n"
        "- Fermer les fenêtres aux heures de vent fort\n- Porter un masque en tissu épais ou FFP2 à l'extérieur",
        "education",
        "published",
        False,
        ["pm10", "harmattan"],
        "Équipe SEN-AIR",
        "Rédaction",
        2 * D,
        3 * D,
        2 * D,
    ),
    (
        "rapport-mensuel-octobre-2026",
        "Rapport mensuel de qualité de l'air : octobre 2026",
        "Synthèse des mesures des 9 stations de Thiès, dépassements de seuils et tendances.",
        "## Synthèse\n\nIQA moyen mensuel : **modéré**. La station Hôtel de Ville reste la plus exposée (trafic).\n\n"
        "## Dépassements\n\n- PM2.5 : 6 jours au-dessus du seuil OMS\n- PM10 : 3 jours au-dessus de la norme NS 05-062",
        "report",
        "published",
        False,
        ["rapport", "mensuel"],
        "Équipe SEN-AIR",
        "Analyste",
        4 * D,
        5 * D,
        4 * D,
    ),
    (
        "normes-oms-2021",
        "Normes OMS 2021 et norme sénégalaise NS 05-062",
        "Ce que signifient les valeurs guides et comment SEN-AIR les utilise pour vous alerter.",
        "## Deux référentiels\n\nSEN-AIR compare chaque mesure aux **valeurs guides OMS 2021** et à la **norme sénégalaise NS 05-062**.\n\n"
        "## Pourquoi deux ?\n\nL'OMS fixe un objectif sanitaire ; la norme nationale fixe le cadre réglementaire.",
        "regulation",
        "published",
        False,
        ["oms", "normes"],
        "Équipe SEN-AIR",
        "Rédaction",
        10 * D,
        11 * D,
        10 * D,
    ),
    (
        "journee-sensibilisation-qualite-air",
        "Journée de sensibilisation à la qualité de l'air",
        "Une journée d'ateliers est prévue à l'Université Iba Der Thiam.",
        "## Programme\n\n- 9 h : présentation du réseau SEN-AIR\n- 10 h : ateliers santé\n- 14 h : démonstration des capteurs",
        "event",
        "draft",
        False,
        ["événement"],
        "Équipe SEN-AIR",
        "Rédaction",
        None,
        5 * H,
        5 * H,
    ),
)


def credit_line(credit: dict) -> str:
    return f"Photo : {credit['author']}, licence {credit['license']}, via Wikimedia Commons."


def attach_photo(article: Article, seed: SeedArticle, credit: dict) -> None:
    """Passe la photo par le même contrôle qu'un envoi d'administrateur (signature, EXIF supprimées)."""
    path = SEED_MEDIA / credit["file"]
    upload = SimpleUploadedFile(path.name, path.read_bytes(), content_type="image/jpeg")
    asset = store_upload(upload, seed.alt, None)
    ArticleMedia.objects.create(article=article, media=asset, position=0)


class Command(BaseCommand):
    help = "Charge les articles de démonstration et leurs photos (sans écraser les dates des articles déjà présents)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fixtures-only",
            action="store_true",
            help="Seulement les 5 articles identiques au mode démo du front (tests), sans les 15 articles illustrés.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()
        created = 0
        for row in DEMO_ARTICLES:
            slug, title, excerpt, content, category, state, featured, tags, author, role, published, created_ago, updated_ago = row
            fields = {
                "title": title,
                "excerpt": excerpt,
                "content": content,
                "category": category,
                "status": state,
                "featured": featured,
                "cover_image_url": None,
                "tags": tags,
                "author_name": author,
                "author_role": role,
            }
            article, is_new = Article.objects.get_or_create(slug=slug, defaults=fields)
            if is_new:
                created += 1
                # created_at / updated_at sont automatiques : on les recale comme dans les fixtures du front.
                Article.objects.filter(pk=article.pk).update(
                    published_at=now - published if published is not None else None,
                    created_at=now - created_ago,
                    updated_at=now - updated_ago,
                )
                continue
            changed = {field: value for field, value in fields.items() if getattr(article, field) != value}
            if changed:
                if state == Article.Status.PUBLISHED and article.published_at is None:
                    changed["published_at"] = now - published
                Article.objects.filter(pk=article.pk).update(**changed, updated_at=now)
        editorial = not options.get("fixtures_only", False)
        if editorial:
            created += self.seed_editorial(now)
        total = len(DEMO_ARTICLES) + (len(ARTICLES) if editorial else 0)
        if options.get("verbosity", 1):
            self.stdout.write(f"Articles de démonstration : {created} créé(s), {total - created} déjà présent(s).")

    def seed_editorial(self, now) -> int:
        credits = json.loads((SEED_MEDIA / "credits.json").read_text(encoding="utf-8"))
        created = 0
        for seed in ARTICLES:
            credit = credits[seed.photo]
            fields = {
                "title": seed.title,
                "excerpt": seed.excerpt,
                "content": f"{seed.content}\n\n{credit_line(credit)}",
                "category": seed.category,
                "status": Article.Status.PUBLISHED,
                "featured": seed.featured,
                "cover_image_url": None,
                "tags": list(seed.tags),
                "author_name": seed.author,
                "author_role": seed.role,
            }
            article, is_new = Article.objects.get_or_create(slug=seed.slug, defaults=fields)
            if is_new:
                created += 1
                Article.objects.filter(pk=article.pk).update(
                    published_at=seed.published_at, created_at=seed.published_at, updated_at=seed.published_at
                )
            else:
                changed = {field: value for field, value in fields.items() if getattr(article, field) != value}
                if changed:
                    Article.objects.filter(pk=article.pk).update(**changed, updated_at=now)
            # Une photo seulement si l'article n'en a pas déjà (celles ajoutées par l'admin sont conservées).
            if not article.media.exists():
                attach_photo(article, seed, credit)
        return created
