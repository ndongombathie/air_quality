import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { AQI_LEVELS } from '@senair/core';
import { LevelChip } from '../../../shared/ui/AqiBadge';
import { useActiveAlerts } from '../hooks';

/** Dernière alerte active (silencieuse en cas d'erreur : l'IQA reste prioritaire). */
export function ActiveAlertBanner({ zoneId }: { zoneId?: string }) {
  const { data } = useActiveAlerts(zoneId);
  const alert = data?.items[0];
  if (!alert) return null;
  const level = AQI_LEVELS[alert.severity];
  const others = (data.total ?? data.items.length) - 1;
  return (
    <div className="alert-banner" role="alert" style={{ borderLeftColor: level.color }}>
      <BellRing size={20} aria-hidden="true" style={{ color: 'var(--primary-text)' }} />
      <div>
        <p className="alert-banner__title">{alert.title}</p>
        <p className="small muted">
          {alert.zoneName ?? 'Thiès'}. {alert.message}
          {others > 0 && ` ${others} autre${others > 1 ? 's' : ''} alerte${others > 1 ? 's' : ''} en cours.`}
        </p>
      </div>
      <LevelChip info={level} withDot />
      <Link to="/alertes" className="btn btn--secondary btn--sm">
        Voir les alertes
      </Link>
    </div>
  );
}
