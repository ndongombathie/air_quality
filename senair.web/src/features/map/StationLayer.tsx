import { Link } from 'react-router-dom';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { DesignTokens, getPollutant, MISSING_VALUE, type Station } from '@senair/core';

const MAP_COLORS = { white: DesignTokens.PALETTE.white, unknown: DesignTokens.PALETTE.ink300 } as const;
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { DataFreshness } from '../../shared/ui/DataFreshness';
import { formatAqi, resolveLevel } from '../../shared/ui/aqi';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS } from '../../shared/lib/labels';

/** Marqueurs vectoriels (CircleMarker) : pas d'icône image, donc pas de bug d'icône Leaflet. */
export function StationLayer({ stations }: { stations: readonly Station[] }) {
  return (
    <>
      {stations.map((station) => {
        const latest = station.latest ?? null;
        const info = resolveLevel(latest?.aqi, latest?.level);
        const dominant = latest?.dominantPollutant ? getPollutant(latest.dominantPollutant) : null;
        return (
          <CircleMarker
            key={station.id}
            center={[station.location.latitude, station.location.longitude]}
            radius={16}
            pathOptions={{
              color: info?.color ?? MAP_COLORS.unknown,
              weight: 4,
              fillColor: MAP_COLORS.white,
              fillOpacity: 1,
              opacity: station.status === 'online' ? 1 : 0.55,
              dashArray: station.status === 'online' ? undefined : '4 3',
            }}
          >
            <Tooltip permanent direction="center" className="map-label" opacity={1}>
              <span>{formatAqi(latest?.aqi)}</span>
            </Tooltip>
            <Popup>
              <div className="map-popup">
                <p className="strong">{station.name}</p>
                <p className="small muted">
                  {station.zoneName}, {STATION_TYPE_LABELS[station.type].toLowerCase()}, {STATION_STATUS_LABELS[station.status].toLowerCase()}
                </p>
                <AqiBadge aqi={latest?.aqi ?? null} level={latest?.level} size="sm" />
                <p className="small">Polluant dominant : {dominant?.formula ?? MISSING_VALUE}</p>
                {latest && <DataFreshness observedAt={latest.observedAt} freshness={latest.freshness} status={latest.status} />}
                <Link to={`/stations/${encodeURIComponent(station.id)}`}>Détail de la station</Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
