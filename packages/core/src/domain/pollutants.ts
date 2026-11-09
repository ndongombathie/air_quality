export const POLLUTANT_CODES = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'] as const;
export type PollutantCode = (typeof POLLUTANT_CODES)[number];

/** Grandeurs secondaires remontées par les capteurs AirGradient, hors calcul IQA. */
export const AUXILIARY_CODES = ['co2', 'tvoc', 'nh3', 'no'] as const;
export type AuxiliaryCode = (typeof AUXILIARY_CODES)[number];

export type MeasureCode = PollutantCode | AuxiliaryCode;
export type Unit = 'µg/m³' | 'mg/m³' | 'ppm' | 'ppb' | 'index';

export interface PollutantInfo {
  code: MeasureCode;
  formula: string;
  name: string;
  unit: Unit;
  description: string;
  sources: string;
  /** Polluant pris en compte dans l'IQA (sous-indice). */
  inAqi: boolean;
}

export const POLLUTANTS: Readonly<Record<MeasureCode, PollutantInfo>> = {
  pm25: {
    code: 'pm25',
    formula: 'PM2.5',
    name: 'Particules fines',
    unit: 'µg/m³',
    description: 'Particules ≤ 2,5 µm : pénètrent profondément les poumons et le sang.',
    sources: 'Trafic, combustion du charbon de bois, cimenteries, harmattan.',
    inAqi: true,
  },
  pm10: {
    code: 'pm10',
    formula: 'PM10',
    name: 'Particules grossières',
    unit: 'µg/m³',
    description: 'Particules ≤ 10 µm : poussières, chantiers, sable.',
    sources: 'Poussières sahariennes, routes non bitumées, chantiers.',
    inAqi: true,
  },
  no2: {
    code: 'no2',
    formula: 'NO₂',
    name: "Dioxyde d'azote",
    unit: 'µg/m³',
    description: 'Gaz irritant issu de la combustion.',
    sources: 'Trafic routier, centrales thermiques.',
    inAqi: true,
  },
  so2: {
    code: 'so2',
    formula: 'SO₂',
    name: 'Dioxyde de soufre',
    unit: 'µg/m³',
    description: 'Gaz irritant pour les voies respiratoires.',
    sources: 'Industries, combustibles soufrés.',
    inAqi: true,
  },
  co: {
    code: 'co',
    formula: 'CO',
    name: 'Monoxyde de carbone',
    unit: 'mg/m³',
    description: 'Gaz inodore issu de la combustion incomplète.',
    sources: 'Véhicules anciens, cuisson au charbon.',
    inAqi: true,
  },
  o3: {
    code: 'o3',
    formula: 'O₃',
    name: 'Ozone troposphérique',
    unit: 'µg/m³',
    description: 'Formé par réaction photochimique sous fort ensoleillement.',
    sources: 'Réaction entre NOx et COV au soleil.',
    inAqi: true,
  },
  co2: {
    code: 'co2',
    formula: 'CO₂',
    name: 'Dioxyde de carbone',
    unit: 'ppm',
    description: 'Indicateur de confinement des espaces intérieurs.',
    sources: 'Respiration, combustion.',
    inAqi: false,
  },
  tvoc: {
    code: 'tvoc',
    formula: 'TVOC',
    name: 'Composés organiques volatils',
    unit: 'index',
    description: 'Indice agrégé des COV mesurés par le capteur.',
    sources: 'Solvants, carburants, produits ménagers.',
    inAqi: false,
  },
  nh3: {
    code: 'nh3',
    formula: 'NH₃',
    name: 'Ammoniac',
    unit: 'µg/m³',
    description: 'Gaz irritant.',
    sources: 'Agriculture, déchets.',
    inAqi: false,
  },
  no: {
    code: 'no',
    formula: 'NO',
    name: "Monoxyde d'azote",
    unit: 'µg/m³',
    description: 'Précurseur du NO₂.',
    sources: 'Combustion.',
    inAqi: false,
  },
};

export function getPollutant(code: string): PollutantInfo | null {
  return (POLLUTANTS as Record<string, PollutantInfo>)[code] ?? null;
}
