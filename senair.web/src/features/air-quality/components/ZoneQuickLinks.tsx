import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { Zone } from '@senair/core';
import { cx } from '../../../shared/lib/cx';

/** Accès direct à l'IQA d'un quartier : 1 clic depuis l'accueil. */
export function ZoneQuickLinks({ zones, highlighted }: { zones: readonly Zone[]; highlighted: readonly string[] }) {
  const sorted = [...zones].sort((a, b) => Number(highlighted.includes(b.id)) - Number(highlighted.includes(a.id)) || a.name.localeCompare(b.name, 'fr'));
  return (
    <nav aria-label="IQA par quartier">
      <ul className="chip-list">
        {sorted.map((zone) => (
          <li key={zone.id}>
            <Link to={`/zones/${encodeURIComponent(zone.id)}`} className={cx('chip', highlighted.includes(zone.id) && 'chip--selected')}>
              <MapPin size={14} aria-hidden="true" />
              {zone.name}
              {highlighted.includes(zone.id) && <span className="sr-only"> (votre zone)</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
