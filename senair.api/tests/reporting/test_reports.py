"""Rapports (D20, D21) et commande generate_reports."""

import json
from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from senair.common.domain import iso
from senair.reporting import reports
from senair.reporting.models import AuditLogEntry, Report
from tests.contract import assert_contract, body

from .helpers import alert, reading

URL = "/api/v1/admin/reports"


def _request(fmt: str = "pdf", period: str = "weekly") -> dict:
    now = timezone.now()
    return {"period": period, "from": iso(now - timedelta(days=7)), "to": iso(now), "format": fmt}


def _download(client, url: str):
    response = client.get(url.replace("http://testserver", ""))
    assert response.status_code == 200
    return response


@pytest.fixture
def measures(reference):
    for hours in (1, 2, 3):
        reading("168373", 150, ago=timedelta(hours=hours))
    reading("168393", 60, ago=timedelta(hours=2), status="estimated")
    reading("89441", 90, ago=timedelta(days=20))  # hors période
    alert("168373", ago=timedelta(hours=2))
    alert("168373", ago=timedelta(days=20))


def test_generate_pdf_and_download(authority_client, authority, measures):
    response = authority_client.post(URL, _request("pdf"), format="json")
    assert response.status_code == 202, response.content
    assert_contract(response, "post", "/admin/reports")
    data = body(response)
    assert data["status"] == "ready" and data["requestedBy"] == authority.email
    assert data["fileName"].startswith("senair-rapport-weekly-") and data["fileName"].endswith(".pdf")

    file = _download(authority_client, data["downloadUrl"])
    assert file["Content-Type"] == "application/pdf"
    pdf = b"".join(file.streaming_content).decode("latin-1")
    assert pdf.startswith("%PDF-1.4")
    start = int(pdf.rsplit("startxref\n", 1)[1].split("\n")[0])
    assert pdf[start : start + 4] == "xref"
    assert r"Hôtel de Ville \(Centre-ville\) : IQA moyen 150, maximum 150" in pdf  # parenthèses échappées en PDF
    assert "Alertes sur la p" in pdf and "Provenance des donn" in pdf and "Dangereux" in pdf

    entry = AuditLogEntry.objects.get(action="report.generate")
    assert entry.resource_id == data["id"] and entry.actor == authority

    listing = authority_client.get(URL)
    assert listing.status_code == 200
    assert_contract(listing, "get", "/admin/reports")
    assert body(listing)[0]["id"] == data["id"] and body(listing)[0]["downloadUrl"]


def test_generate_csv_and_json(authority_client, measures):
    csv_report = body(authority_client.post(URL, _request("csv"), format="json"))
    content = b"".join(_download(authority_client, csv_report["downloadUrl"]).streaming_content).decode("utf-8")
    header, *rows = content.lstrip("﻿").strip().split("\r\n")
    assert header.startswith("station_id,station,quartier,iqa_moyen,iqa_max")
    hdv = next(row for row in rows if row.startswith("168373,"))
    assert hdv.endswith(",150,150,Mauvais pour les groupes sensibles,3,3,1")
    assert len(rows) == 9

    json_report = body(authority_client.post(URL, _request("json", "custom"), format="json"))
    payload = json.loads(b"".join(_download(authority_client, json_report["downloadUrl"]).streaming_content))
    assert payload["rapport"] == "personnalisé" and payload["alertes"] == 1
    assert "dont 1 estimée(s)" in payload["provenance"]
    medina = next(s for s in payload["stations"] if s["id"] == "168393")
    assert medina["iqaMoyen"] == 60 and medina["heuresIqaSuperieur100"] == 0
    univ = next(s for s in payload["stations"] if s["id"] == "89441")
    assert univ["iqaMoyen"] is None and univ["mesures"] == 0


def test_generation_failure(authority_client, reference):
    with mock.patch.object(reports, "render", side_effect=RuntimeError("disque plein")):
        response = authority_client.post(URL, _request(), format="json")
    assert response.status_code == 202
    assert_contract(response, "post", "/admin/reports")
    data = body(response)
    assert data["status"] == "failed" and data["downloadUrl"] is None and data["fileName"] is None
    assert "disque plein" in Report.objects.get(pk=data["id"]).error


def test_report_validation(authority_client):
    response = authority_client.post(URL, {"period": "daily", "format": "docx", "to": "hier"}, format="json")
    assert response.status_code == 422
    assert set(body(response)["details"]["fields"]) == {"period", "format", "to", "from"}
    reversed_range = {**_request(), "from": iso(timezone.now()), "to": iso(timezone.now() - timedelta(days=1))}
    assert authority_client.post(URL, reversed_range, format="json").status_code == 422


def test_report_permissions(anon, citizen_client, authority_client):
    assert anon.get(URL).status_code == 401
    assert citizen_client.get(URL).status_code == 403
    assert citizen_client.post(URL, _request(), format="json").status_code == 403
    assert authority_client.get(URL).status_code == 200


def test_signed_url_tampered(authority_client, reference):
    data = body(authority_client.post(URL, _request("csv"), format="json"))
    assert authority_client.get(data["downloadUrl"].replace("http://testserver", "") + "x").status_code == 404


def test_previous_period():
    now = datetime(2026, 11, 4, 15, 30, tzinfo=UTC)  # mercredi
    assert reports.previous_period("weekly", now) == (datetime(2026, 10, 26, tzinfo=UTC), datetime(2026, 11, 2, tzinfo=UTC))
    assert reports.previous_period("monthly", now) == (datetime(2026, 10, 1, tzinfo=UTC), datetime(2026, 11, 1, tzinfo=UTC))
    jan = datetime(2027, 1, 10, tzinfo=UTC)
    assert reports.previous_period("monthly", jan) == (datetime(2026, 12, 1, tzinfo=UTC), datetime(2027, 1, 1, tzinfo=UTC))


def test_generate_reports_command(reference):
    call_command("generate_reports", "--period", "weekly", stdout=mock.MagicMock())
    report = Report.objects.get()
    assert report.status == "ready" and report.requested_by is None and report.format == "pdf"
    assert report.file.name.startswith("reports/")
    call_command("generate_reports", "--period", "weekly", stdout=mock.MagicMock())  # déjà fait : pas de doublon
    assert Report.objects.count() == 1
    call_command("generate_reports", "--period", "monthly", "--format", "csv", stdout=mock.MagicMock())
    assert Report.objects.filter(period="monthly", format="csv", status="ready").exists()
    with mock.patch.object(reports, "render", side_effect=RuntimeError("panne")), pytest.raises(CommandError):
        call_command("generate_reports", "--period", "weekly", "--force", stdout=mock.MagicMock())
