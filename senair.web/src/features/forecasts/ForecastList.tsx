import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { FORECAST_HORIZON_LABELS, formatPercent, getPollutant, MISSING_VALUE, TREND_LABELS, type Forecast } from '@senair/core';
import { LevelChip } from '../../shared/ui/AqiBadge';
import { formatAqi, resolveLevel } from '../../shared/ui/aqi';

const TREND_ICONS = { up: ArrowUpRight, down: ArrowDownRight, stable: ArrowRight } as const;

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function ForecastRow({ forecast, daily }: { forecast: Forecast; daily: boolean }) {
  const info = resolveLevel(forecast.aqi, forecast.level);
  const TrendIcon = TREND_ICONS[forecast.trend];
  const validAt = new Date(forecast.validAt);
  const dominant = forecast.dominantPollutant ? getPollutant(forecast.dominantPollutant) : null;
  const confidence = forecast.confidence;
  return (
    <li className="forecast-row">
      <div className="forecast-row__when">
        <strong>{FORECAST_HORIZON_LABELS[forecast.horizon].long}</strong>
        <time className="caption" dateTime={forecast.validAt}>
          {daily ? dayFormat.format(validAt) : `vers ${timeFormat.format(validAt)}`}
        </time>
      </div>
      <span className="forecast-row__aqi">
        <span className="level-dot" aria-hidden="true" style={{ backgroundColor: info?.color ?? 'var(--ink-300)' }} />
        {formatAqi(forecast.aqi)}
        <span className="sr-only"> IQA</span>
      </span>
      <span className="forecast-row__level">{info ? <LevelChip info={info} short /> : MISSING_VALUE}</span>
      <span className="forecast-row__trend">
        <TrendIcon size={16} aria-hidden="true" />
        {TREND_LABELS[forecast.trend]}
      </span>
      <div className="forecast-row__conf">
        <span>Confiance {formatPercent(confidence)}</span>
        <span className="confidence-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((confidence ?? 0) * 100)}%` }} />
        </span>
        <span>{forecast.interval ? `Entre ${Math.round(forecast.interval.low)} et ${Math.round(forecast.interval.high)}` : `Intervalle ${MISSING_VALUE}`}</span>
      </div>
      {(forecast.drivers.length > 0 || dominant) && (
        <details className="disclosure forecast-row__drivers">
          <summary>Pourquoi cette prévision</summary>
          <ul>
            {dominant && <li>Polluant dominant attendu : {dominant.formula}, {dominant.name.toLowerCase()}.</li>}
            {forecast.drivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export function ForecastList({ forecasts, daily }: { forecasts: readonly Forecast[]; daily: boolean }) {
  if (forecasts.length === 0) return <p className="muted">Aucune prévision pour ces horizons.</p>;
  return (
    <ul className="forecast-list">
      {forecasts.map((forecast) => (
        <ForecastRow key={forecast.horizon} forecast={forecast} daily={daily} />
      ))}
    </ul>
  );
}
