"""Le backend et le front partagent les mêmes rôles, permissions et niveaux IQA (packages/core)."""

import re

from django.conf import settings

from senair.common.domain import AQI_LEVEL_IDS, FORECAST_HORIZONS, HEALTH_PROFILES, MEASURE_CODES
from senair.common.permissions import PERMISSIONS, ROLE_PERMISSIONS, ROLES

CORE = settings.REPO_DIR / "packages/core/src"


def _tuple(source: str, name: str) -> tuple[str, ...]:
    match = re.search(rf"export const {name} = \[(.*?)\] as const", source, re.S)
    assert match, f"{name} introuvable dans packages/core"
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


def test_roles_and_permissions_match_front():
    source = (CORE / "auth/permissions.ts").read_text()
    assert _tuple(source, "ROLES") == ROLES
    assert _tuple(source, "PERMISSIONS") == PERMISSIONS
    authority = set(re.findall(r"'([^']+)'", re.search(r"const AUTHORITY.*?\];", source, re.S).group(0)))
    citizen = set(re.findall(r"'([^']+)'", re.search(r"const CITIZEN.*?\];", source, re.S).group(0)))
    assert citizen == set(ROLE_PERMISSIONS["citizen"])
    assert authority | citizen == set(ROLE_PERMISSIONS["authority"])


def test_domain_enums_match_front():
    assert _tuple((CORE / "domain/aqi.ts").read_text(), "AQI_LEVEL_IDS") == AQI_LEVEL_IDS
    assert _tuple((CORE / "domain/forecast.ts").read_text(), "FORECAST_HORIZONS") == FORECAST_HORIZONS
    assert _tuple((CORE / "domain/health.ts").read_text(), "HEALTH_PROFILE_IDS") == HEALTH_PROFILES
    pollutants = (CORE / "domain/pollutants.ts").read_text()
    assert _tuple(pollutants, "POLLUTANT_CODES") + _tuple(pollutants, "AUXILIARY_CODES") == MEASURE_CODES
