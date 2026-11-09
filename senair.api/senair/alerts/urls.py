from django.urls import path

from . import views

urlpatterns = [
    path("alerts", views.AlertsView.as_view(), name="alerts"),
    path("alerts/<str:alert_id>", views.AlertDetailView.as_view(), name="alert"),
    path("thresholds", views.ThresholdsView.as_view(), name="thresholds"),
    path("health-guidance", views.HealthGuidanceView.as_view(), name="health-guidance"),
    path("admin/thresholds", views.AdminThresholdsView.as_view(), name="admin-thresholds"),
    path("admin/thresholds/<str:threshold_id>", views.AdminThresholdDetailView.as_view(), name="admin-threshold"),
    path("admin/alerts", views.AdminAlertsView.as_view(), name="admin-alerts"),
    path("admin/alerts/<str:alert_id>", views.AdminAlertDetailView.as_view(), name="admin-alert"),
]
