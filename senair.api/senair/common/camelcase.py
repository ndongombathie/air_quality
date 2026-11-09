"""
Contrat JSON en camelCase (docs/08-api-endpoints.md) avec un code Python en snake_case.
Seules les clés sont converties, jamais les valeurs.
"""

import re
from typing import Any

from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer

_CAMEL = re.compile(r"(?<!^)(?=[A-Z])")


def to_camel(key: str) -> str:
    head, *rest = key.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in rest)


def to_snake(key: str) -> str:
    return _CAMEL.sub("_", key).lower()


def camelize(data: Any) -> Any:
    if isinstance(data, dict):
        return {to_camel(k) if isinstance(k, str) else k: camelize(v) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [camelize(item) for item in data]
    return data


def snakify(data: Any) -> Any:
    if isinstance(data, dict):
        return {to_snake(k) if isinstance(k, str) else k: snakify(v) for k, v in data.items()}
    if isinstance(data, list):
        return [snakify(item) for item in data]
    return data


class CamelCaseJSONRenderer(JSONRenderer):
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return super().render(camelize(data), accepted_media_type, renderer_context)


class CamelCaseJSONParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        return snakify(super().parse(stream, media_type, parser_context))
