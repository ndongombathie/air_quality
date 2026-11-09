"""Envoi de médias (D28) : signature, taille, texte alternatif, retrait des métadonnées EXIF."""

import io

import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import ExifTags, Image

from senair.content.media import sniff
from senair.content.models import MediaAsset
from senair.reporting.models import AuditLogEntry
from tests.contract import assert_contract, body

URL = "/api/v1/admin/media"
MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 64
WEBM = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04\x42\xf3\x81\x08\x42\x82\x84webm" + b"\x00" * 64


def jpeg_with_gps(size=(40, 20), orientation: int | None = None) -> bytes:
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "TestPhone"
    if orientation:
        exif[ExifTags.Base.Orientation] = orientation
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps[ExifTags.GPS.GPSLatitude] = (14.0, 47.0, 30.0)
    gps[ExifTags.GPS.GPSLongitudeRef] = "W"
    gps[ExifTags.GPS.GPSLongitude] = (16.0, 55.0, 30.0)
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, "JPEG", exif=exif)
    data = buffer.getvalue()
    assert Image.open(io.BytesIO(data)).getexif().get_ifd(ExifTags.IFD.GPSInfo)  # le fichier source porte bien une position
    return data


def upload(client, data: bytes, name: str, content_type: str, alt: str | None = "Vue du centre-ville"):
    payload = {"file": SimpleUploadedFile(name, data, content_type=content_type)}
    if alt is not None:
        payload["alt"] = alt
    return client.post(URL, payload, format="multipart")


def test_photo_exif_and_gps_removed(authority_client, authority):
    response = upload(authority_client, jpeg_with_gps(), "IMG_0001 secret.jpg", "image/jpeg")
    assert response.status_code == 201, response.content
    assert_contract(response, "post", "/admin/media")
    data = body(response)
    assert data["kind"] == "image" and data["mimeType"] == "image/jpeg"
    assert (data["width"], data["height"]) == (40, 20)
    assert data["posterUrl"] is None and data["durationSec"] is None
    assert data["fileName"] == "IMG_0001 secret.jpg"
    assert data["url"].startswith("http://testserver/media/")

    asset = MediaAsset.objects.get(pk=data["id"])
    assert asset.file.name.endswith(f"{asset.id}.jpg")  # nom de stockage neutre
    assert "secret" not in asset.file.name
    stored = default_storage.open(asset.file.name).read()
    assert data["sizeBytes"] == len(stored)
    assert b"Exif" not in stored and b"TestPhone" not in stored
    image = Image.open(io.BytesIO(stored))
    assert not image.getexif()
    assert not image.getexif().get_ifd(ExifTags.IFD.GPSInfo)
    assert AuditLogEntry.objects.filter(action="media.upload", resource_id=data["id"], actor=authority).exists()


def test_orientation_applied(authority_client):
    response = upload(authority_client, jpeg_with_gps(size=(40, 20), orientation=6), "p.jpg", "image/jpeg")
    assert response.status_code == 201
    assert (body(response)["width"], body(response)["height"]) == (20, 40)


@pytest.mark.parametrize("fmt,mime", [("PNG", "image/png"), ("WEBP", "image/webp")])
def test_png_and_webp(authority_client, fmt, mime):
    buffer = io.BytesIO()
    Image.new("RGBA", (12, 9), (0, 0, 255, 128)).save(buffer, fmt)
    response = upload(authority_client, buffer.getvalue(), f"img.{fmt.lower()}", mime)
    assert response.status_code == 201, response.content
    assert body(response)["mimeType"] == mime and body(response)["width"] == 12


def test_video_stored_as_is(authority_client):
    response = upload(authority_client, MP4, "clip.mp4", "video/mp4", alt="")
    assert response.status_code == 201, response.content
    assert_contract(response, "post", "/admin/media")
    data = body(response)
    assert data["kind"] == "video" and data["posterUrl"] is None and data["width"] is None
    asset = MediaAsset.objects.get(pk=data["id"])
    assert default_storage.open(asset.file.name).read() == MP4
    assert upload(authority_client, WEBM, "clip.webm", "video/webm").status_code == 201


def test_signature_mismatch(authority_client):
    png = io.BytesIO()
    Image.new("RGB", (4, 4)).save(png, "PNG")
    response = upload(authority_client, png.getvalue(), "faux.jpg", "image/jpeg")
    assert response.status_code == 422
    assert_contract(response, "post", "/admin/media")
    assert body(response)["code"] == "invalid_media" and "file" in body(response)["details"]["fields"]
    # Un exécutable déguisé en vidéo, une image déclarée vidéo.
    assert upload(authority_client, b"MZ\x90\x00" + b"\x00" * 100, "clip.mp4", "video/mp4").status_code == 422
    assert upload(authority_client, MP4, "clip.webm", "video/webm").status_code == 422


def test_corrupted_image(authority_client):
    response = upload(authority_client, b"\xff\xd8\xff\xe0" + b"\x00" * 200, "casse.jpg", "image/jpeg")
    assert response.status_code == 422
    assert body(response)["details"]["fields"]["file"] == "Image illisible ou endommagée."


def test_unsupported_type(authority_client):
    response = upload(authority_client, b"GIF89a" + b"\x00" * 20, "a.gif", "image/gif")
    assert response.status_code == 422
    assert "Format non pris en charge" in body(response)["details"]["fields"]["file"]


def test_too_large(authority_client):
    big = b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024)
    response = upload(authority_client, big, "lourde.jpg", "image/jpeg")
    assert response.status_code == 413
    assert_contract(response, "post", "/admin/media")
    assert body(response)["code"] == "file_too_large"
    assert body(response)["details"]["fields"]["file"] == "Photo trop lourde : 5 Mo maximum."


def test_alt_optional_for_photo(authority_client):
    # La légende est facultative : la photo s'envoie dès qu'elle est choisie.
    response = upload(authority_client, jpeg_with_gps(), "p.jpg", "image/jpeg", alt=None)
    assert response.status_code == 201
    assert_contract(response, "post", "/admin/media")
    assert body(response)["alt"] == ""
    response = upload(authority_client, jpeg_with_gps(), "p.jpg", "image/jpeg", alt="x" * 301)
    assert response.status_code == 422 and "alt" in body(response)["details"]["fields"]


def test_missing_file(authority_client):
    response = authority_client.post(URL, {"alt": "Une photo"}, format="multipart")
    assert response.status_code == 422 and "file" in body(response)["details"]["fields"]


def test_upload_permissions(anon, citizen_client):
    assert upload(anon, jpeg_with_gps(), "p.jpg", "image/jpeg").status_code == 401
    response = upload(citizen_client, jpeg_with_gps(), "p.jpg", "image/jpeg")
    assert response.status_code == 403 and body(response)["code"] == "forbidden"


def test_sniff():
    assert sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert sniff(b"\xff\xd8\xff\xdb") == "image/jpeg"
    assert sniff(b"<svg xmlns") is None
