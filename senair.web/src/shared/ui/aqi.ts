import { AQI_LEVELS, getAqiLevel, MISSING_VALUE, type AqiLevel, type AqiLevelInfo } from '@senair/core';

/** Niveau fourni par l'API en priorité ; sinon classement de la valeur via @senair/core. */
export function resolveLevel(aqi: number | null | undefined, level?: AqiLevel | null): AqiLevelInfo | null {
  return level ? AQI_LEVELS[level] : getAqiLevel(aqi);
}

export function formatAqi(aqi: number | null | undefined): string {
  return aqi == null || !Number.isFinite(aqi) ? MISSING_VALUE : String(Math.round(aqi));
}
