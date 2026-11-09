import { MISSING_VALUE, formatMeasure, getPollutant, type Measure } from '@senair/core';

/** IQA entier ou « N/D ». */
export function formatAqi(aqi: number | null | undefined): string {
  return formatMeasure(aqi, 0);
}

/** « 12,4 µg/m³ », ou « N/D » seul si la valeur manque (jamais « N/D µg/m³ »). */
export function withUnit(value: number | null | undefined, unit: string, digits = 1): string {
  const text = formatMeasure(value, digits);
  return text === MISSING_VALUE ? MISSING_VALUE : `${text} ${unit}`;
}

export function pollutantLabel(code: string | null | undefined): string {
  if (!code) return MISSING_VALUE;
  return getPollutant(code)?.formula ?? code.toUpperCase();
}

export function measureText(measure: Pick<Measure, 'value' | 'unit'> | null | undefined, digits = 1): string {
  return measure ? withUnit(measure.value, measure.unit, digits) : MISSING_VALUE;
}

/** Écart signé : « +12 », « -3 », « 0 », « N/D ». */
export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return MISSING_VALUE;
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '-'}${formatMeasure(Math.abs(delta), 0)}`;
}

/** Intervalle « 114 à 124 ». */
export function formatRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low == null || high == null) return MISSING_VALUE;
  return `${formatMeasure(low, 0)} à ${formatMeasure(high, 0)}`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

export function formatWindDirection(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return MISSING_VALUE;
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? MISSING_VALUE;
}
