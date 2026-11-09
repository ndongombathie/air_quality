"""
Validation des réponses de l'API contre le contrat docs/api/openapi.yaml (source partagée avec le front).
Usage dans un test :  assert_contract(response, "get", "/stations")
"""

import json
from functools import lru_cache
from urllib.parse import parse_qsl, urlsplit

from django.conf import settings
from openapi_core import OpenAPI
from openapi_core.testing import MockRequest, MockResponse

HOST = "http://localhost:8000"
PREFIX = "/api/v1"


@lru_cache(maxsize=1)
def _spec() -> OpenAPI:
    return OpenAPI.from_file_path(settings.SENAIR["OPENAPI_PATH"])


def assert_contract(response, method: str, url: str) -> None:
    """`url` relatif à /api/v1 (avec sa query string), comme dans la spécification."""
    parts = urlsplit(url)
    request = MockRequest(HOST, method.lower(), PREFIX + parts.path, args=dict(parse_qsl(parts.query)))
    content_type = response.get("Content-Type", "application/json").split(";")[0]
    body = response.content if response.content else b""
    mock = MockResponse(body, status_code=response.status_code, content_type=content_type)
    _spec().validate_response(request, mock)


def body(response):
    return json.loads(response.content) if response.content else None
