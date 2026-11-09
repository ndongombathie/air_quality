from django.urls import path

from . import views

urlpatterns = [
    path("forecasts", views.ForecastView.as_view(), name="forecasts"),
    path("admin/models", views.ModelListView.as_view(), name="admin-models"),
    path("admin/models/<str:model_id>", views.ModelDetailView.as_view(), name="admin-model"),
]
