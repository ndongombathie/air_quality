from django.urls import path

from . import views

urlpatterns = [
    path("admin/dashboard", views.DashboardView.as_view(), name="admin-dashboard"),
    path("admin/reports", views.ReportListView.as_view(), name="admin-reports"),
    path("admin/analytics/usage", views.UsageView.as_view(), name="admin-usage"),
    path("admin/audit-logs", views.AuditLogView.as_view(), name="admin-audit-logs"),
]
