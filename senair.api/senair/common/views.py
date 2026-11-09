from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404


def openapi_contract(request):
    """Sert le contrat de référence docs/api/openapi.yaml (source unique partagée avec le front)."""
    path = Path(settings.SENAIR["OPENAPI_PATH"])
    if not path.is_file():
        raise Http404
    return FileResponse(path.open("rb"), content_type="application/yaml")
