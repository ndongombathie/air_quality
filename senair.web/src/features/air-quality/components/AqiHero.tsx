import type { ReactNode } from 'react';
import { getPollutant, type AqiLevel, type DataStatus, type Freshness, type PollutantCode } from '@senair/core';
import { LevelChip } from '../../../shared/ui/AqiBadge';
import { DataFreshness } from '../../../shared/ui/DataFreshness';
import { formatAqi, resolveLevel } from '../../../shared/ui/aqi';

export interface AqiHeroProps {
  eyebrow: string;
  title: string;
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
  observedAt: string | null;
  freshness: Freshness;
  status: DataStatus;
  details?: ReactNode;
  side?: ReactNode;
  /** h1 sur une page dédiée, h2 quand la page a déjà un titre. */
  headingLevel?: 1 | 2;
}

/** Héros IQA : gros chiffre en encre, point de couleur, niveau en toutes lettres, fraîcheur et provenance. */
export function AqiHero({ eyebrow, title, aqi, level, dominantPollutant, observedAt, freshness, status, details, side, headingLevel = 2 }: AqiHeroProps) {
  const info = resolveLevel(aqi, level);
  const dominant = dominantPollutant ? getPollutant(dominantPollutant) : null;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="home-hero" aria-labelledby="aqi-hero-title">
      <div className="home-hero__main">
        <p className="eyebrow">{eyebrow}</p>
        <Heading id="aqi-hero-title" className="h3">
          {title}
        </Heading>
        <div className="home-hero__aqi">
          <p className="home-hero__number" aria-label={`Indice de qualité de l'air ${formatAqi(aqi)}`}>
            <span className="level-ring" aria-hidden="true" style={{ borderColor: info?.color ?? 'var(--ink-300)', width: 22, height: 22, borderWidth: 5, marginRight: 14, verticalAlign: 'middle' }} />
            {formatAqi(aqi)}
            <small>IQA</small>
          </p>
          <div className="row">{info ? <LevelChip info={info} /> : <span className="level-chip" style={{ borderColor: 'var(--border-strong)' }}>Indisponible</span>}</div>
        </div>
        {info && <p className="lead">{info.healthImpact}</p>}
        <p className="small">
          Polluant dominant : <strong>{dominant ? `${dominant.formula}, ${dominant.name.toLowerCase()}` : 'N/D'}</strong>
        </p>
        <DataFreshness observedAt={observedAt} freshness={freshness} status={status} />
        {details}
      </div>
      {side && <div className="home-hero__side">{side}</div>}
    </section>
  );
}
