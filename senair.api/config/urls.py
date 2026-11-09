from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularSwaggerView

from senair.common.views import openapi_contract

api_v1 = [
    path("openapi.yaml", openapi_contract, name="openapi-contract"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="openapi-contract"), name="swagger-ui"),
    path("", include("senair.common.downloads")),
    path("", include("senair.network.urls")),
    path("", include("senair.measurements.urls")),
    path("", include("senair.forecasts.urls")),
    path("", include("senair.alerts.urls")),
    path("", include("senair.content.urls")),
    path("", include("senair.accounts.urls")),
    path("", include("senair.reporting.urls")),
]

urlpatterns = [
    path("api/v1/", include(api_v1)),
    path("django-admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
