import { Radio } from 'lucide-react';
import { formatMeasure, getPollutant, MEASURE_SOURCE_LABELS, type Measure, type MeasureCode } from '@senair/core';
import { cx } from '../lib/cx';
import { resolveLevel } from './aqi';

/** Ordre d'affichage : polluants de l'indice, puis grandeurs complémentaires (dont NO et NH₃). */
const ORDER: readonly MeasureCode[] = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'no', 'nh3', 'co2', 'tvoc'];
const rank = (code: MeasureCode) => {
  const index = ORDER.indexOf(code);
  return index === -1 ? ORDER.length : index;
};

/** Carte d'une mesure : formule, valeur (N/D si absente), unité, sous-indice et provenance. */
export function MeasureCard({ measure, dominant = false }: { measure: Measure; dominant?: boolean }) {
  const info = getPollutant(measure.code);
  const subLevel = measure.subIndex != null ? resolveLevel(measure.subIndex) : null;
  return (
    <article className={cx('measure-card', dominant && 'measure-card--dominant')}>
      <header className="measure-card__header">
        <span className="measure-card__formula">{info?.formula ?? measure.code}</span>
        {dominant && <span className="badge badge--info">Dominant</span>}
      </header>
      <p className="measure-card__value">
        {formatMeasure(measure.value)} {measure.value != null && <span className="measure-card__unit">{measure.unit}</span>}
      </p>
      <p className="measure-card__name">{info?.name ?? measure.code}</p>
      {measure.subIndex != null && subLevel && (
        <>
          <div className="measure-card__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(measure.subIndex, 300) / 3}%`, backgroundColor: subLevel.color }} />
          </div>
          <p className="measure-card__sub">
            Sous-indice {Math.round(measure.subIndex)}, {subLevel.shortLabel.toLowerCase()}
          </p>
        </>
      )}
      <p className="measure-card__source">
        <Radio size={12} aria-hidden="true" />
        {MEASURE_SOURCE_LABELS[measure.source]}
      </p>
    </article>
  );
}

export function MeasureGrid({ measures, dominant }: { measures: readonly Measure[]; dominant?: MeasureCode | null }) {
  if (measures.length === 0) return <p className="muted">Aucune mesure disponible.</p>;
  const sorted = [...measures].sort((a, b) => rank(a.code) - rank(b.code));
  const indexed = sorted.filter((m) => getPollutant(m.code)?.inAqi);
  const others = sorted.filter((m) => !getPollutant(m.code)?.inAqi);
  return (
    <div className="stack stack--sm">
      {indexed.length > 0 && (
        <section className="measure-section" aria-label="Polluants de l'indice">
          <p className="caption">Polluants pris en compte dans l'IQA</p>
          <div className="measure-grid">
            {indexed.map((measure) => (
              <MeasureCard key={measure.code} measure={measure} dominant={measure.code === dominant} />
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section className="measure-section" aria-label="Autres mesures">
          <p className="caption">Autres mesures</p>
          <div className="measure-grid">
            {others.map((measure) => (
              <MeasureCard key={measure.code} measure={measure} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
