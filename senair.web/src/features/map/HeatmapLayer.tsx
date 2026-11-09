import { Rectangle, Tooltip } from 'react-leaflet';
import { formatMeasure, type Heatmap } from '@senair/core';
import { resolveLevel } from '../../shared/ui/aqi';

const METERS_PER_DEGREE_LAT = 111_000;

/** Couche interpolée : rectangles semi-transparents colorés selon le niveau fourni par l'API. */
export function HeatmapLayer({ heatmap }: { heatmap: Heatmap }) {
  const halfLat = heatmap.resolutionM / METERS_PER_DEGREE_LAT / 2;
  return (
    <>
      {heatmap.cells.map((cell) => {
        const info = resolveLevel(cell.aqi, cell.level);
        if (!info) return null;
        const { latitude: lat, longitude: lon } = cell.location;
        const halfLon = halfLat / Math.cos((lat * Math.PI) / 180);
        return (
          <Rectangle
            key={`${lat.toFixed(5)}:${lon.toFixed(5)}`}
            bounds={[
              [lat - halfLat, lon - halfLon],
              [lat + halfLat, lon + halfLon],
            ]}
            pathOptions={{ stroke: false, fillColor: info.color, fillOpacity: 0.32 }}
            interactive
          >
            <Tooltip sticky>
              {heatmap.layer === 'aqi' ? `IQA estimé ${formatMeasure(cell.aqi, 0)}` : `Valeur estimée ${formatMeasure(cell.value)}`} ·{' '}
              {info.shortLabel}
              {cell.uncertainty != null && ` · incertitude ${Math.round(cell.uncertainty * 100)} %`}
            </Tooltip>
          </Rectangle>
        );
      })}
    </>
  );
}
