"""Pilotage : tableau de bord (D1), rapports (D20, D21), statistiques d'usage (D25), journal d'audit (D26)."""

import uuid
from datetime import UTC, datetime, time, timedelta

from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from senair.alerts.models import NotificationDelivery
from senair.common.domain import iso
from senair.common.downloads import signed_url
from senair.common.exceptions import validation_error
from senair.common.pagination import paginate
from senair.common.permissions import require

from . import audit, reports
from .dashboard import dashboard
from .models import AuditLogEntry, Report, UsageVisit

MAX_REPORT_DAYS = 366
MAX_USAGE_DAYS = 366
PLATFORMS = ("android", "ios", "web")


class AdminView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


def parse_instant(raw: str | None, name: str, required: bool = False, end_of_day: bool = False) -> datetime | None:
    """Date ISO-8601 (« Z » ou décalage). Une date seule vaut minuit UTC (ou fin de journée pour une borne de fin)."""
    if raw in (None, ""):
        if required:
            raise validation_error({name: "Date requise (ISO-8601)."})
        return None
    raw = raw.strip().replace(" ", "+")  # « + » d'un décalage non encodé dans l'URL
    try:
        value = parse_datetime(raw)
        if value is None and (day := parse_date(raw)) is not None:
            value = datetime.combine(day, time.max if end_of_day else time.min)
    except ValueError:
        value = None
    if value is None:
        raise validation_error({name: "Date invalide (ISO-8601 attendu)."})
    return value.replace(tzinfo=UTC) if timezone.is_naive(value) else value


def _check_range(date_from: datetime, date_to: datetime, max_days: int) -> None:
    if date_from > date_to:
        raise validation_error({"to": "La date de fin doit suivre la date de début."})
    if date_to - date_from > timedelta(days=max_days):
        raise validation_error({"to": f"Période limitée à {max_days} jours."})


class DashboardView(AdminView):
    permission_classes = [require("admin:access")]

    def get(self, request):
        return Response(dashboard())


# ─── Rapports ───


def report_payload(request, report: Report) -> dict:
    ready = report.status == Report.Status.READY and bool(report.file)
    download_url = signed_url(request, report.file.name, report.file_name or report.file.name.rsplit("/", 1)[-1])[0] if ready else None
    return {
        "id": str(report.id),
        "period": report.period,
        "from": iso(report.date_from),
        "to": iso(report.date_to),
        "status": report.status,
        "format": report.format,
        "download_url": download_url,
        "file_name": report.file_name if ready else None,
        "generated_at": iso(report.generated_at),
        "requested_by": report.requested_by.email if report.requested_by else None,
    }


class ReportRequestSerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=Report.Period.choices)
    to = serializers.DateTimeField()
    format = serializers.ChoiceField(choices=Report.Format.choices)

    def get_fields(self):
        # « from » est un mot réservé Python : champ ajouté ici plutôt que déclaré.
        return {"from": serializers.DateTimeField(), **super().get_fields()}


class ReportListView(AdminView):
    def get_permissions(self):
        return [require("reports:generate" if self.request.method == "POST" else "reports:read")()]

    def get(self, request):
        items = Report.objects.select_related("requested_by")[:200]
        return Response([report_payload(request, report) for report in items])

    def post(self, request):
        serializer = ReportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        _check_range(data["from"], data["to"], MAX_REPORT_DAYS)
        report = Report.objects.create(
            period=data["period"], date_from=data["from"], date_to=data["to"], format=data["format"], requested_by=request.user
        )
        reports.generate(report)
        audit.record(
            request,
            "report.generate",
            "report",
            report.id,
            {
                "period": {"from": None, "to": report.period},
                "format": {"from": None, "to": report.format},
                "status": {"from": None, "to": report.status},
            },
        )
        return Response(report_payload(request, report), status=status.HTTP_202_ACCEPTED)


# ─── Statistiques d'usage ───


class UsageView(AdminView):
    permission_classes = [require("analytics:read")]

    def get(self, request):
        date_from = parse_instant(request.query_params.get("from"), "from", required=True)
        date_to = parse_instant(request.query_params.get("to"), "to", required=True, end_of_day=True)
        _check_range(date_from, date_to, MAX_USAGE_DAYS)
        first_day, last_day = date_from.astimezone(UTC).date(), date_to.astimezone(UTC).date()
        visits = UsageVisit.objects.filter(day__gte=first_day, day__lte=last_day)

        # Session = un visiteur un jour donné (le hachage du visiteur change chaque jour).
        per_day = {
            row["day"]: row
            for row in visits.values("day")
            .annotate(sessions=Count("visitor_hash", distinct=True), active_users=Count("user", distinct=True))
            .order_by()
        }
        by_platform = dict(visits.values_list("platform").annotate(n=Count("pk")).order_by())
        daily = []
        day = first_day
        while day <= last_day:
            row = per_day.get(day, {})
            daily.append({"day": day.isoformat(), "sessions": row.get("sessions", 0), "active_users": row.get("active_users", 0)})
            day += timedelta(days=1)

        return Response(
            {
                "from": iso(date_from),
                "to": iso(date_to),
                "active_users": visits.exclude(user=None).values("user").distinct().count(),
                "sessions": sum(item["sessions"] for item in daily),
                "push_sent": NotificationDelivery.objects.filter(
                    status=NotificationDelivery.Status.SENT, created_at__gte=date_from, created_at__lte=date_to
                ).count(),
                "by_platform": [{"platform": platform, "sessions": by_platform.get(platform, 0)} for platform in PLATFORMS],
                "daily": daily,
            }
        )


# ─── Journal d'audit ───


def audit_payload(entry: AuditLogEntry) -> dict:
    return {
        "id": str(entry.id),
        "at": iso(entry.at),
        # null pour une tâche planifiée ou un compte supprimé (valeur absente = null).
        "actor_id": str(entry.actor_id) if entry.actor_id else None,
        "actor_email": entry.actor_email,
        "action": entry.action,
        "resource": entry.resource,
        "resource_id": entry.resource_id,
        "changes": entry.changes,
        "ip": entry.ip,
    }


class AuditLogView(AdminView):
    permission_classes = [require("audit:read")]

    def get(self, request):
        entries = AuditLogEntry.objects.all()
        actor_id = request.query_params.get("actorId")
        if actor_id:
            try:
                entries = entries.filter(actor_id=uuid.UUID(actor_id))
            except ValueError:
                raise validation_error({"actorId": "Identifiant invalide."}) from None
        resource = request.query_params.get("resource")
        if resource:
            entries = entries.filter(resource=resource)
        date_from = parse_instant(request.query_params.get("from"), "from")
        date_to = parse_instant(request.query_params.get("to"), "to", end_of_day=True)
        if date_from:
            entries = entries.filter(at__gte=date_from)
        if date_to:
            entries = entries.filter(at__lte=date_to)
        if date_from and date_to and date_from > date_to:
            raise validation_error({"to": "La date de fin doit suivre la date de début."})
        return Response(paginate(request, entries.order_by("-at"), audit_payload))
