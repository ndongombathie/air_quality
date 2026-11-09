"""Validation des messages contre les schémas JSON du contrat de flux (docs/stream/*.schema.json, Draft 2020-12)."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings
from jsonschema import Draft202012Validator

from .base import InvalidMessage


@lru_cache(maxsize=8)
def validator(name: str) -> Draft202012Validator:
    """`name` : measurement.v1, forecast.v1, interpolation.v1 ou model.v1."""
    path = Path(settings.SENAIR["STREAM_SCHEMAS_DIR"]) / f"{name}.schema.json"
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def check(name: str, payload: Any) -> None:
    """Lève InvalidMessage avec la première erreur (chemin JSON + message), sans recopier les valeurs reçues."""
    errors = sorted(validator(name).iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        error = errors[0]
        where = "/".join(str(part) for part in error.absolute_path) or "(racine)"
        if error.validator == "required" and isinstance(error.instance, dict):
            missing = [name for name in error.validator_value if name not in error.instance]
            raise InvalidMessage(f"Schéma {name} non respecté en {where} : champ(s) obligatoire(s) absent(s) {', '.join(missing)}.")
        raise InvalidMessage(f"Schéma {name} non respecté en {where} : {error.validator} {_short(error.validator_value)}.")


def _short(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= 80 else text[:77] + "..."
