from django.urls import path

from . import views

urlpatterns = [
    path("zones", views.ZoneListView.as_view(), name="zones"),
    path("stations", views.StationListView.as_view(), name="stations"),
    path("stations/<str:station_id>", views.StationDetailView.as_view(), name="station"),
    path("admin/stations", views.AdminStationListView.as_view(), name="admin-stations"),
    path("admin/stations/<str:station_id>", views.AdminStationDetailView.as_view(), name="admin-station"),
    path("admin/data-sources", views.DataSourceListView.as_view(), name="admin-data-sources"),
    path("admin/data-sources/<str:source_id>", views.DataSourceDetailView.as_view(), name="admin-data-source"),
]
