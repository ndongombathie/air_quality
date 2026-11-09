import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getPollutant, type ZoneRanking } from '@senair/core';
import { AqiBadge } from '../../../shared/ui/AqiBadge';

export function ZoneRankingList({ zones }: { zones: readonly ZoneRanking[] }) {
  if (zones.length === 0) return <p className="muted">Aucune zone à classer.</p>;
  return (
    <ol className="ranking">
      {zones.map((zone, index) => (
        <li key={zone.zoneId}>
          <Link to={`/zones/${encodeURIComponent(zone.zoneId)}`} className="ranking__row">
            <span className="ranking__rank" aria-hidden="true">
              {index + 1}
            </span>
            <span className="ranking__name">
              {zone.zoneName}
              {zone.dominantPollutant && <span className="caption"> · {getPollutant(zone.dominantPollutant)?.formula}</span>}
            </span>
            <AqiBadge aqi={zone.aqi} level={zone.level} size="sm" short />
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
