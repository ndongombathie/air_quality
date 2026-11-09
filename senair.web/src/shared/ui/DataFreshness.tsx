import { Clock } from 'lucide-react';
import { formatDateTime, formatRelativeTime, FRESHNESS_LABELS, type DataStatus, type Freshness } from '@senair/core';
import { DATA_STATUS_LABELS } from '../lib/labels';
import { cx } from '../lib/cx';

const FRESHNESS_TONE: Record<Freshness, string> = {
  fresh: 'success',
  stale: 'warning',
  outdated: 'danger',
  unknown: 'neutral',
};

/** Provenance + fraîcheur, à afficher à côté de toute valeur. */
export function DataFreshness({
  observedAt,
  freshness,
  status,
  className,
}: {
  observedAt: string | null;
  freshness?: Freshness;
  status: DataStatus;
  className?: string;
}) {
  return (
    <p className={cx('freshness', className)}>
      <Clock size={14} aria-hidden="true" />
      <span>
        {DATA_STATUS_LABELS[status]} ·{' '}
        <time dateTime={observedAt ?? undefined} title={formatDateTime(observedAt)}>
          {formatRelativeTime(observedAt)}
        </time>
      </span>
      {freshness && <span className={cx('badge', `badge--${FRESHNESS_TONE[freshness]}`)}>{FRESHNESS_LABELS[freshness]}</span>}
    </p>
  );
}
