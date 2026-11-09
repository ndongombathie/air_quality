from django.urls import path

from . import views

urlpatterns = [
    path("metadata", views.MetadataView.as_view(), name="metadata"),
    path("stations/<str:station_id>/latest", views.StationLatestView.as_view(), name="station-latest"),
    path("stations/<str:station_id>/history", views.StationHistoryView.as_view(), name="station-history"),
    path("zones/<str:zone_id>/history", views.ZoneHistoryView.as_view(), name="zone-history"),
    path("air-quality/summary", views.SummaryView.as_view(), name="air-quality-summary"),
    path("air-quality/at", views.LocationView.as_view(), name="air-quality-at"),
    path("air-quality/heatmap", views.HeatmapView.as_view(), name="air-quality-heatmap"),
    path("air-quality/history", views.CityHistoryView.as_view(), name="air-quality-history"),
    path("admin/exports", views.ExportView.as_view(), name="admin-exports"),
]
