import type { PollutantCode, Unit } from './pollutants';

export type ReferenceStandard = 'WHO_2021' | 'NS_05_062';
export type AveragingPeriod = '1h' | '8h' | '24h' | '1y';

export const REFERENCE_LABELS: Readonly<Record<ReferenceStandard, string>> = {
  WHO_2021: 'OMS 2021',
  NS_05_062: 'Norme sénégalaise NS 05-062',
};

export interface ReferenceThreshold {
  pollutant: PollutantCode;
  reference: ReferenceStandard;
  period: AveragingPeriod;
  value: number;
  unit: Unit;
}

/**
 * Référentiels publiés (présentation §6 et annexe du cahier des charges).
 * Usage : contenu pédagogique et repli hors-ligne UNIQUEMENT.
 * Les seuils d'alerte effectifs viennent de `GET /thresholds` (paramétrables par l'admin).
 */
export const REFERENCE_THRESHOLDS: readonly ReferenceThreshold[] = [
  { pollutant: 'pm25', reference: 'WHO_2021', period: '24h', value: 15, unit: 'µg/m³' },
  { pollutant: 'pm25', reference: 'WHO_2021', period: '1y', value: 5, unit: 'µg/m³' },
  { pollutant: 'pm25', reference: 'NS_05_062', period: '24h', value: 25, unit: 'µg/m³' },
  { pollutant: 'pm10', reference: 'WHO_2021', period: '24h', value: 45, unit: 'µg/m³' },
  { pollutant: 'pm10', reference: 'WHO_2021', period: '1y', value: 15, unit: 'µg/m³' },
  { pollutant: 'pm10', reference: 'NS_05_062', period: '24h', value: 50, unit: 'µg/m³' },
  { pollutant: 'no2', reference: 'WHO_2021', period: '24h', value: 25, unit: 'µg/m³' },
  { pollutant: 'no2', reference: 'WHO_2021', period: '1y', value: 10, unit: 'µg/m³' },
  { pollutant: 'no2', reference: 'NS_05_062', period: '1h', value: 200, unit: 'µg/m³' },
  { pollutant: 'so2', reference: 'WHO_2021', period: '24h', value: 40, unit: 'µg/m³' },
  { pollutant: 'so2', reference: 'NS_05_062', period: '24h', value: 50, unit: 'µg/m³' },
  // OMS 2021 : 100 µg/m³ sur 8 h ; 60 µg/m³ est la valeur « saison de pointe » (moyenne sur 6 mois).
  { pollutant: 'o3', reference: 'WHO_2021', period: '8h', value: 100, unit: 'µg/m³' },
  { pollutant: 'o3', reference: 'NS_05_062', period: '8h', value: 100, unit: 'µg/m³' },
  { pollutant: 'co', reference: 'WHO_2021', period: '24h', value: 4, unit: 'mg/m³' },
  { pollutant: 'co', reference: 'NS_05_062', period: '8h', value: 10, unit: 'mg/m³' },
];

export function findReferenceThreshold(
  pollutant: PollutantCode,
  reference: ReferenceStandard = 'WHO_2021',
): ReferenceThreshold | null {
  return (
    REFERENCE_THRESHOLDS.find(
      (t) => t.pollutant === pollutant && t.reference === reference && t.period !== '1y',
    ) ?? null
  );
}

/** Ratio valeur / seuil (1 = au seuil). `null` si l'une des deux valeurs manque. */
export function exceedanceRatio(value: number | null, threshold: number | null): number | null {
  if (value == null || threshold == null || threshold <= 0) return null;
  return value / threshold;
}
