"""Articles publics (P16, P17) et gestion des articles (D11 à D15)."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image

from senair.content.models import Article
from senair.reporting.models import AuditLogEntry
from tests.contract import assert_contract, body

VALID = {
    "title": "Qualité de l'air à Thiès",
    "excerpt": "Un résumé suffisamment long.",
    "content": "Un contenu Markdown d'au moins vingt caractères.",
    "category": "info",
    "status": "draft",
    "featured": False,
    "coverImageUrl": None,
    "mediaIds": [],
    "tags": ["pm25"],
}


@pytest.fixture
def demo(db):
    call_command("seed_demo_content", "--fixtures-only", verbosity=0)


def _photo_id(client) -> str:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 6), "red").save(buffer, "JPEG")
    upload = SimpleUploadedFile("photo.jpg", buffer.getvalue(), content_type="image/jpeg")
    response = client.post("/api/v1/admin/media", {"file": upload, "alt": "Une photo"}, format="multipart")
    assert response.status_code == 201, response.content
    return body(response)["id"]


# ─── Public ───


def test_public_list_only_published(anon, demo):
    response = anon.get("/api/v1/articles")
    assert response.status_code == 200
    assert_contract(response, "get", "/articles")
    data = body(response)
    assert data["total"] == 4
    assert all(item["status"] == "published" for item in data["items"])
    assert "content" not in data["items"][0]
    assert data["items"][0]["slug"] == "pic-pollution-hotel-de-ville"  # le plus récent d'abord
    assert response["Cache-Control"] == "public, max-age=60"


def test_public_filters_and_pagination(anon, demo):
    assert body(anon.get("/api/v1/articles?category=education"))["total"] == 1
    assert body(anon.get("/api/v1/articles?featured=true"))["items"][0]["featured"] is True
    assert body(anon.get("/api/v1/articles?featured=false"))["total"] == 3
    assert body(anon.get("/api/v1/articles?search=HARMATTAN"))["total"] == 1
    assert body(anon.get("/api/v1/articles?search=sahariennes"))["total"] == 1  # chapô
    page = anon.get("/api/v1/articles?limit=3")
    assert_contract(page, "get", "/articles?limit=3")
    first = body(page)
    assert len(first["items"]) == 3 and first["nextCursor"]
    second = body(anon.get(f"/api/v1/articles?limit=3&cursor={first['nextCursor']}"))
    assert len(second["items"]) == 1 and second["nextCursor"] is None


def test_public_invalid_filter(anon, demo):
    response = anon.get("/api/v1/articles?category=sport")
    assert response.status_code == 422
    assert body(response)["details"]["fields"] == {"category": "Valeur non reconnue."}


def test_public_detail(anon, demo):
    response = anon.get("/api/v1/articles/harmattan-comprendre-les-poussieres")
    assert response.status_code == 200
    assert_contract(response, "get", "/articles/harmattan-comprendre-les-poussieres")
    assert body(response)["content"].startswith("## L'harmattan")
    assert body(response)["author"] == {"id": None, "name": "Équipe SEN-AIR", "role": "Rédaction"}


def test_public_detail_hides_drafts(anon, demo):
    response = anon.get("/api/v1/articles/journee-sensibilisation-qualite-air")
    assert response.status_code == 404
    assert_contract(response, "get", "/articles/journee-sensibilisation-qualite-air")
    assert anon.get("/api/v1/articles/inconnu").status_code == 404


def test_seed_is_idempotent(db):
    call_command("seed_demo_content", verbosity=0)
    before = {a.slug: a.updated_at for a in Article.objects.all()}
    call_command("seed_demo_content", verbosity=0)
    assert {a.slug: a.updated_at for a in Article.objects.all()} == before
    assert Article.objects.count() == 20
    illustrated = Article.objects.filter(slug="masques-lequel-choisir-poussieres").get()
    photo = illustrated.media.get()
    assert photo.kind == "image" and photo.alt and photo.width and illustrated.content.endswith("via Wikimedia Commons.")
    assert Article.objects.filter(media__isnull=False).count() == 15


def test_seed_editorial_content_is_clean():
    from senair.content.seed_articles import ARTICLES

    assert len(ARTICLES) == 15 and len({a.slug for a in ARTICLES}) == 15
    for article in ARTICLES:
        # Charte : pas de tiret long ; textes dans les limites du modèle.
        assert not any(dash in article.title + article.excerpt + article.content for dash in ("\u2014", "\u2013"))
        assert len(article.title) <= 160 and len(article.excerpt) <= 300 and len(article.slug) <= 80


# ─── Administration ───


def test_admin_list_all_statuses(authority_client, demo):
    response = authority_client.get("/api/v1/admin/articles")
    assert response.status_code == 200
    assert_contract(response, "get", "/admin/articles")
    assert body(response)["total"] == 5
    assert response["Cache-Control"] == "no-store"
    drafts = authority_client.get("/api/v1/admin/articles?status=draft")
    assert_contract(drafts, "get", "/admin/articles?status=draft")
    assert [a["slug"] for a in body(drafts)["items"]] == ["journee-sensibilisation-qualite-air"]


def test_create_article(authority_client, authority):
    response = authority_client.post("/api/v1/admin/articles", {**VALID, "status": "published"}, format="json")
    assert response.status_code == 201, response.content
    assert_contract(response, "post", "/admin/articles")
    data = body(response)
    assert data["slug"] == "qualite-de-l-air-a-thies"
    assert data["publishedAt"] is not None
    assert data["author"] == {"id": str(authority.id), "name": authority.full_name, "role": "Autorité sanitaire"}
    entry = AuditLogEntry.objects.get(action="article.create")
    assert entry.resource_id == data["id"] and entry.actor == authority

    detail = authority_client.get(f"/api/v1/admin/articles/{data['id']}")
    assert detail.status_code == 200
    assert_contract(detail, "get", f"/admin/articles/{data['id']}")


def test_generated_slug_is_unique(authority_client):
    first = body(authority_client.post("/api/v1/admin/articles", VALID, format="json"))
    second = body(authority_client.post("/api/v1/admin/articles", {**VALID, "slug": ""}, format="json"))
    assert first["slug"] == "qualite-de-l-air-a-thies"
    assert second["slug"] == "qualite-de-l-air-a-thies-2"
    assert second["publishedAt"] is None


def test_slug_taken(authority_client):
    authority_client.post("/api/v1/admin/articles", {**VALID, "slug": "mon-article"}, format="json")
    response = authority_client.post("/api/v1/admin/articles", {**VALID, "slug": "mon-article"}, format="json")
    assert response.status_code == 422
    assert_contract(response, "post", "/admin/articles")
    data = body(response)
    assert data["code"] == "slug_taken" and "slug" in data["details"]["fields"]


def test_create_validation(authority_client):
    response = authority_client.post(
        "/api/v1/admin/articles",
        {**VALID, "title": "Abc", "slug": "Pas Bon", "coverImageUrl": "http://exemple.sn/a.jpg", "mediaIds": ["x"] * 11},
        format="json",
    )
    assert response.status_code == 422
    assert_contract(response, "post", "/admin/articles")
    fields = body(response)["details"]["fields"]
    assert {"title", "slug", "coverImageUrl", "mediaIds"} <= set(fields)
    assert fields["coverImageUrl"] == "HTTPS requis."


def test_unknown_media_id(authority_client):
    unknown = "9b0c3c0e-0000-4000-8000-000000000000"
    response = authority_client.post("/api/v1/admin/articles", {**VALID, "mediaIds": [unknown]}, format="json")
    assert response.status_code == 422
    assert "mediaIds" in body(response)["details"]["fields"]


def test_media_order_and_cover(authority_client):
    first, second = _photo_id(authority_client), _photo_id(authority_client)
    response = authority_client.post("/api/v1/admin/articles", {**VALID, "mediaIds": [second, first]}, format="json")
    assert response.status_code == 201
    data = body(response)
    assert [m["id"] for m in data["media"]] == [second, first]
    assert data["coverImageUrl"] == data["media"][0]["url"]
    assert data["coverImageUrl"].startswith("http://testserver/")

    explicit = body(
        authority_client.post(
            "/api/v1/admin/articles", {**VALID, "coverImageUrl": "https://cdn.senair.sn/c.jpg", "mediaIds": [first]}, format="json"
        )
    )
    assert explicit["coverImageUrl"] == "https://cdn.senair.sn/c.jpg"


def test_patch_keeps_media_and_sets_published_at_once(authority_client):
    media_id = _photo_id(authority_client)
    article = body(authority_client.post("/api/v1/admin/articles", {**VALID, "mediaIds": [media_id]}, format="json"))
    url = f"/api/v1/admin/articles/{article['id']}"

    published = authority_client.patch(url, {"status": "published", "title": "Nouveau titre d'article"}, format="json")
    assert published.status_code == 200
    assert_contract(published, "patch", f"/admin/articles/{article['id']}")
    data = body(published)
    assert [m["id"] for m in data["media"]] == [media_id]
    assert data["slug"] == article["slug"]  # le lien ne change pas avec le titre
    first_published_at = data["publishedAt"]
    assert first_published_at

    authority_client.patch(url, {"status": "archived"}, format="json")
    again = body(authority_client.patch(url, {"status": "published", "mediaIds": []}, format="json"))
    assert again["publishedAt"] == first_published_at
    assert again["media"] == [] and again["coverImageUrl"] is None

    entry = AuditLogEntry.objects.filter(action="article.update").order_by("at").first()
    assert entry.changes["status"] == {"from": "draft", "to": "published"}
    assert entry.changes["title"]["to"] == "Nouveau titre d'article"


def test_patch_slug_taken(authority_client):
    authority_client.post("/api/v1/admin/articles", {**VALID, "slug": "pris"}, format="json")
    other = body(authority_client.post("/api/v1/admin/articles", VALID, format="json"))
    response = authority_client.patch(f"/api/v1/admin/articles/{other['id']}", {"slug": "pris"}, format="json")
    assert response.status_code == 422 and body(response)["code"] == "slug_taken"


def test_delete_article(authority_client):
    article = body(authority_client.post("/api/v1/admin/articles", VALID, format="json"))
    url = f"/api/v1/admin/articles/{article['id']}"
    response = authority_client.delete(url)
    assert response.status_code == 204
    assert_contract(response, "delete", f"/admin/articles/{article['id']}")
    assert authority_client.get(url).status_code == 404
    assert authority_client.get("/api/v1/admin/articles/pas-un-uuid").status_code == 404
    assert AuditLogEntry.objects.filter(action="article.delete", resource_id=article["id"]).exists()


def test_permissions(anon, citizen_client, admin_client):
    assert anon.get("/api/v1/admin/articles").status_code == 401
    forbidden = citizen_client.post("/api/v1/admin/articles", VALID, format="json")
    assert forbidden.status_code == 403 and body(forbidden)["code"] == "forbidden"
    assert citizen_client.get("/api/v1/admin/articles").status_code == 403
    assert admin_client.post("/api/v1/admin/articles", VALID, format="json").status_code == 201
