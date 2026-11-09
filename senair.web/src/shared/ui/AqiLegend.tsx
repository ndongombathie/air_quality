import { AQI_SCALE } from '@senair/core';

export function AqiLegend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="aqi-legend" aria-label="Échelle de l'IQA">
      {AQI_SCALE.map((level) => (
        <li key={level.id}>
          <span className="level-dot" aria-hidden="true" style={{ backgroundColor: level.color }} />
          <span>
            {compact ? level.shortLabel : level.label}{' '}
            <span className="muted num">
              ({Number.isFinite(level.max) ? `${level.min} à ${level.max}` : `${level.min} et plus`})
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
