import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import RequestFactory

from senair.common.downloads import signed_url
from senair.common.files import PdfLine, to_csv, to_pdf


def test_pdf_xref_points_to_table():
    pdf = to_pdf([PdfLine("Qualité de l’air : NO₂", bold=True), *[PdfLine(f"Ligne {i}") for i in range(80)]]).decode("latin-1")
    start = int(pdf.rsplit("startxref\n", 1)[1].split("\n")[0])
    assert pdf[start : start + 4] == "xref"
    assert "/Count 2" in pdf and "NO2" in pdf


def test_csv_has_bom_and_escapes():
    data = to_csv(["a", "b"], [["x,y", None]]).decode("utf-8")
    assert data.startswith("﻿a,b\r\n") and '"x,y",' in data


@pytest.mark.django_db
def test_signed_download_roundtrip(client):
    name = default_storage.save("exports/test.csv", ContentFile(b"a,b\r\n"))
    url, expires = signed_url(RequestFactory().get("/"), name, "rapport.csv")
    response = client.get(url.replace("http://testserver", ""))
    assert response.status_code == 200
    assert response["Content-Disposition"].startswith('attachment; filename="rapport.csv"')
    assert expires.endswith("Z")
    assert client.get("/api/v1/downloads/falsifie").status_code == 404


def test_error_format_has_request_id(client):
    response = client.get("/api/v1/inexistant", HTTP_X_REQUEST_ID="trace-abc-123")
    assert response["X-Request-Id"] == "trace-abc-123"
