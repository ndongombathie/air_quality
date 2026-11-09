import { AUXILIARY_CODES, MISSING_VALUE, AQI_SCALE, POLLUTANT_CODES, POLLUTANTS, REFERENCE_LABELS, REFERENCE_THRESHOLDS, formatMeasure, type PollutantCode } from '@senair/core';
import { Card } from '../../shared/ui/Card';
import { LevelChip } from '../../shared/ui/AqiBadge';
import { PageHeader } from '../../shared/ui/PageHeader';
import { PERIOD_LABELS } from '../../shared/lib/labels';

function thresholdCell(pollutant: PollutantCode, reference: 'WHO_2021' | 'NS_05_062') {
  const rows = REFERENCE_THRESHOLDS.filter((t) => t.pollutant === pollutant && t.reference === reference);
  if (rows.length === 0) return MISSING_VALUE;
  return rows.map((t) => `${formatMeasure(t.value)} ${t.unit} (${PERIOD_LABELS[t.period]})`).join(' · ');
}

export function InfoPage() {
  return (
    <div className="stack">
      <PageHeader title="Comprendre la qualité de l'air" description="Échelle de l'IQA, polluants surveillés et normes de référence." />

      <Card title="Échelle de l'indice (IQA)">
        <ul className="scale">
          {AQI_SCALE.map((level) => (
            <li key={level.id} className="scale__item">
              <span className="row">
                <LevelChip info={level} withDot />
                <span className="scale__range">{Number.isFinite(level.max) ? `${level.min} à ${level.max}` : `${level.min} et plus`}</span>
              </span>
              <span className="small">{level.healthImpact}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Le sous-indice d'un polluant vaut concentration ÷ valeur limite × 100 ; l'IQA retenu est le plus élevé des sous-indices. Il est calculé
          par la plateforme, jamais par votre navigateur.
        </p>
      </Card>

      <Card title="Normes : OMS 2021 et norme sénégalaise NS 05-062">
        <div className="table-wrap" role="region" aria-label="Tableau des normes" tabIndex={0}>
          <table className="table">
            <caption className="sr-only">Valeurs limites par polluant et par référentiel</caption>
            <thead>
              <tr>
                <th scope="col">Polluant</th>
                <th scope="col">{REFERENCE_LABELS.WHO_2021}</th>
                <th scope="col">{REFERENCE_LABELS.NS_05_062}</th>
              </tr>
            </thead>
            <tbody>
              {POLLUTANT_CODES.map((code) => (
                <tr key={code}>
                  <th scope="row">{POLLUTANTS[code].formula}</th>
                  <td>{thresholdCell(code, 'WHO_2021')}</td>
                  <td>{thresholdCell(code, 'NS_05_062')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Les seuils d'alerte effectivement appliqués sont paramétrés par les administrateurs de la plateforme.</p>
      </Card>

      <Card title="Grandeurs surveillées">
        <div className="grid grid--3">
          {[...POLLUTANT_CODES, ...AUXILIARY_CODES].map((code) => {
            const p = POLLUTANTS[code];
            return (
              <article key={code} className="pollutant">
                <h3 className="pollutant__title">
                  {p.formula} <span className="muted small">{p.name}</span>
                </h3>
                <p>{p.description}</p>
                <p className="small">
                  <strong>Sources :</strong> {p.sources}
                </p>
                <p className="small muted">Unité : {p.unit}</p>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
