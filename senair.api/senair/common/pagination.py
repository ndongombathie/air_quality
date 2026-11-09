"""Pagination par curseur opaque : { items, nextCursor, total } (docs/08-api-endpoints.md)."""

import base64
from collections.abc import Callable, Sequence
from typing import Any

from django.db.models import QuerySet

from .exceptions import validation_error

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def _decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return max(0, int(base64.urlsafe_b64decode(cursor.encode()).decode()))
    except (ValueError, UnicodeDecodeError) as error:
        raise validation_error({"cursor": "Curseur invalide."}) from error


def _encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(str(offset).encode()).decode()


def read_limit(request, default: int = DEFAULT_LIMIT) -> int:
    raw = request.query_params.get("limit")
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise validation_error({"limit": "Nombre entier attendu."}) from error
    return min(max(value, 1), MAX_LIMIT)


def paginate(request, items: QuerySet | Sequence, serialize: Callable[[Any], dict], default_limit: int = DEFAULT_LIMIT) -> dict:
    offset = _decode_cursor(request.query_params.get("cursor"))
    limit = read_limit(request, default_limit)
    total = items.count() if isinstance(items, QuerySet) else len(items)
    page = list(items[offset : offset + limit])
    next_offset = offset + limit
    return {
        "items": [serialize(item) for item in page],
        "next_cursor": _encode_cursor(next_offset) if next_offset < total else None,
        "total": total,
    }
