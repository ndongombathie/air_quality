import { Link } from 'react-router-dom';
import { formatMeasure, formatPercent, MISSING_VALUE, type LocationAirQuality } from '@senair/core';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { DataFreshness } from '../../shared/ui/DataFreshness';

export function LocateResult({ result }: { result: LocationAirQuality }) {
  return (
    <div className="locate-result" aria-live="polite">
      <p className="strong">À votre position{result.zoneName ? ` (${result.zoneName})` : ''}</p>
      <AqiBadge aqi={result.aqi} level={result.level} />
      <DataFreshness observedAt={result.observedAt} freshness={result.freshness} status={result.status} />
      <p className="small muted">
        Confiance de l'estimation : {formatPercent(result.confidence)} · station la plus proche à{' '}
        {result.distanceToNearestStationM == null ? MISSING_VALUE : `${formatMeasure(result.distanceToNearestStationM / 1000)} km`}
      </p>
      {result.zoneId && <Link to={`/zones/${encodeURIComponent(result.zoneId)}`}>Voir la zone</Link>}
    </div>
  );
}
