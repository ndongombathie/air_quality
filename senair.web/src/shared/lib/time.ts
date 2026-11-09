const HOUR_MS = 3_600_000;

export type HistoryRange = '24h' | '7d';

export const HISTORY_RANGE_LABELS: Readonly<Record<HistoryRange, string>> = {
  '24h': '24 heures',
  '7d': '7 jours',
};

/**
 * Fenêtre temporelle arrondie à l'heure : la clé de requête reste stable pendant une heure
 * (pas de nouvelle requête à chaque rendu).
 */
export function historyWindow(range: HistoryRange, now: Date = new Date()) {
  const to = new Date(Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS);
  const hours = range === '24h' ? 24 : 24 * 7;
  return {
    from: new Date(to.getTime() - hours * HOUR_MS).toISOString(),
    to: to.toISOString(),
    granularity: range === '24h' ? ('hour' as const) : ('day' as const),
  };
}

/** Plage de jours [from, to] au format ISO, bornée à minuit UTC. */
export function lastDays(days: number, now: Date = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const from = new Date(to.getTime() - days * 24 * HOUR_MS);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Valeur `yyyy-mm-dd` pour un champ `<input type="date">`. */
export function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function fromDateInput(value: string, endOfDay = false): string {
  return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`).toISOString();
}

export function formatHourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}
