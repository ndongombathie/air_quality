import pytest
from django.http import JsonResponse
from openapi_core.exceptions import OpenAPIError

from tests.contract import assert_contract


def test_valid_payload_passes():
    zone = {"id": "centre-ville", "name": "Centre-ville", "centroid": {"latitude": 14.79, "longitude": -16.92}}
    response = JsonResponse([zone], safe=False)
    assert_contract(response, "get", "/zones")


def test_invalid_payload_is_rejected():
    response = JsonResponse([{"id": "centre-ville"}], safe=False)
    with pytest.raises(OpenAPIError):
        assert_contract(response, "get", "/zones")
