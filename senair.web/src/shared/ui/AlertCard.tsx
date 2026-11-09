import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { AQI_LEVELS, formatDateTime, formatMeasure, formatRelativeTime, getPollutant, REFERENCE_LABELS, type Alert } from '@senair/core';
import { ALERT_STATUS_LABELS } from '../lib/labels';
import { AqiBadge } from './AqiBadge';
import { Badge } from './Badge';

const STATUS_TONE = { active: 'danger', acknowledged: 'warning', resolved: 'success' } as const;

export function AlertCard({ alert, actions, extra }: { alert: Alert; actions?: ReactNode; extra?: ReactNode }) {
  const level = AQI_LEVELS[alert.severity];
  const pollutant = getPollutant(alert.pollutant);
  return (
    <article className="alert-card" style={{ '--level-color': level.color } as CSSProperties}>
      <header className="alert-card__header">
        <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
        <h3 className="alert-card__title">{alert.title}</h3>
        {alert.origin === 'manual' && <Badge tone="info">Publiée manuellement</Badge>}
        <Badge tone={STATUS_TONE[alert.status]}>{ALERT_STATUS_LABELS[alert.status]}</Badge>
      </header>
      <div className="alert-card__meta">
        <AqiBadge aqi={null} level={alert.severity} labelOnly size="sm" />
        {alert.origin === 'sensor' && (
          <span>
            {`${pollutant?.formula ?? alert.pollutant} à ${formatMeasure(alert.value)} ${alert.unit}, seuil ${formatMeasure(alert.threshold)} ${alert.unit} (${REFERENCE_LABELS[alert.reference]})`}
          </span>
        )}
      </div>
      {(alert.zoneName || alert.stationName) && (
        <p className="alert-card__place">
          <MapPin size={14} aria-hidden="true" />
          {[alert.zoneName, alert.stationName].filter(Boolean).join(' · ')}
        </p>
      )}
      <p>{alert.message}</p>
      {alert.recommendations.length > 0 && (
        <ul className="alert-card__reco">
          {alert.recommendations.map((reco) => (
            <li key={reco}>{reco}</li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Début : <time dateTime={alert.startedAt}>{formatDateTime(alert.startedAt)}</time> ({formatRelativeTime(alert.startedAt)})
        {alert.resolvedAt && <> · Résolue {formatRelativeTime(alert.resolvedAt)}</>}
      </p>
      {extra}
      {actions && <div className="alert-card__actions">{actions}</div>}
    </article>
  );
}
