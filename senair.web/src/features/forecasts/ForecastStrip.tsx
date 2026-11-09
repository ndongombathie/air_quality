import { Link } from 'react-router-dom';
import { FORECAST_HORIZON_LABELS, formatRelativeTime, type ForecastHorizon } from '@senair/core';
import { LevelChip } from '../../shared/ui/AqiBadge';
import { QueryState } from '../../shared/ui/QueryState';
import { formatAqi, resolveLevel } from '../../shared/ui/aqi';
import { DATA_STATUS_LABELS } from '../../shared/lib/labels';
import { useForecasts } from './hooks';

const SHORT_TERM: ForecastHorizon[] = ['1h', '3h', '1d', '2d'];

/** Aperçu compact des prévisions pour l'accueil et les pages zone. */
export function ForecastStrip({ zoneId }: { zoneId?: string }) {
  const query = useForecasts(zoneId ? { scope: 'zone', scopeId: zoneId, horizons: SHORT_TERM } : { scope: 'city', horizons: SHORT_TERM });
  return (
    <QueryState query={query} isEmpty={(set) => set.forecasts.length === 0} emptyMessage="Aucune prévision disponible.">
      {(set) => (
        <div className="stack stack--sm">
          <ul className="forecast-mini" aria-label="Prévisions">
            {set.forecasts.map((forecast) => {
              const info = resolveLevel(forecast.aqi, forecast.level);
              return (
                <li key={forecast.horizon} className="forecast-mini__item">
                  <span className="forecast-mini__h">{FORECAST_HORIZON_LABELS[forecast.horizon].long}</span>
                  <span className="forecast-mini__v">
                    <span className="level-dot" aria-hidden="true" style={{ backgroundColor: info?.color ?? 'var(--ink-300)' }} />
                    {formatAqi(forecast.aqi)}
                  </span>
                  {info && <LevelChip info={info} short />}
                </li>
              );
            })}
          </ul>
          <p className="caption">
            {DATA_STATUS_LABELS[set.status]}, modèle {set.modelName} {set.modelVersion}, calculé {formatRelativeTime(set.generatedAt)}.{' '}
            <Link to="/previsions">Toutes les prévisions</Link>
          </p>
        </div>
      )}
    </QueryState>
  );
}
