/** Valeur affichée quand une donnée est absente (jamais 0, jamais de tiret long). */
export const MISSING_VALUE = 'N/D';

export type Freshness = 'fresh' | 'stale' | 'outdated' | 'unknown';

/** Au-delà de ces durées, une mesure n'est plus présentée comme « temps réel ». */
export const FRESHNESS_LIMITS_MIN = { fresh: 15, stale: 120 } as const;

export function getFreshness(observedAt: string | null | undefined, now: Date = new Date()): Freshness {
  if (!observedAt) return 'unknown';
  const time = Date.parse(observedAt);
  if (Number.isNaN(time)) return 'unknown';
  const ageMin = (now.getTime() - time) / 60_000;
  if (ageMin <= FRESHNESS_LIMITS_MIN.fresh) return 'fresh';
  if (ageMin <= FRESHNESS_LIMITS_MIN.stale) return 'stale';
  return 'outdated';
}

export const FRESHNESS_LABELS: Readonly<Record<Freshness, string>> = {
  fresh: 'À jour',
  stale: 'Données en retard',
  outdated: 'Données anciennes',
  unknown: 'Fraîcheur inconnue',
};

// Créé à la première utilisation : certains moteurs (Hermes) n'exposent pas toujours Intl.RelativeTimeFormat.
let relative: Intl.RelativeTimeFormat | null | undefined;

function formatUnit(value: number, unit: Intl.RelativeTimeFormatUnit, short: string): string {
  if (relative === undefined) {
    relative = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }) : null;
  }
  if (relative) return relative.format(value, unit);
  const abs = Math.abs(value);
  return value <= 0 ? `il y a ${abs} ${short}` : `dans ${abs} ${short}`;
}

export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return MISSING_VALUE;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return MISSING_VALUE;
  const diffSec = Math.round((time - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return formatUnit(diffSec, 'second', 's');
  if (abs < 3600) return formatUnit(Math.round(diffSec / 60), 'minute', 'min');
  if (abs < 86_400) return formatUnit(Math.round(diffSec / 3600), 'hour', 'h');
  return formatUnit(Math.round(diffSec / 86_400), 'day', 'j');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return MISSING_VALUE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING_VALUE;
  return date.toLocaleString('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Une valeur absente s'affiche « N/D », jamais 0 (donnees-metier.md). */
export function formatMeasure(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return MISSING_VALUE;
  return value.toLocaleString('fr-FR', { maximumFractionDigits: fractionDigits });
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return MISSING_VALUE;
  return `${Math.round(ratio * 100)} %`;
}
