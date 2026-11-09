/**
 * Horizons de prévision (présentation §9). Les valeurs filaires évitent « J+1 »
 * car `+` est décodé en espace dans une query string.
 */
export const FORECAST_HORIZONS = ['1h', '2h', '3h', '1d', '2d', '3d'] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export const FORECAST_HORIZON_LABELS: Readonly<Record<ForecastHorizon, { short: string; long: string }>> = {
  '1h': { short: '+1 h', long: 'Dans 1 heure' },
  '2h': { short: '+2 h', long: 'Dans 2 heures' },
  '3h': { short: '+3 h', long: 'Dans 3 heures' },
  '1d': { short: 'J+1', long: 'Demain' },
  '2d': { short: 'J+2', long: 'Après-demain' },
  '3d': { short: 'J+3', long: 'Dans 3 jours' },
};

export function isShortTermHorizon(horizon: ForecastHorizon): boolean {
  return horizon.endsWith('h');
}
