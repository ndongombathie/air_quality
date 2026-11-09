import { ReferenceArea } from 'recharts';
import { AQI_SCALE, DesignTokens } from '@senair/core';

/** Borne haute de l'axe IQA : au moins 150, arrondie à la cinquantaine supérieure. */
export function aqiDomainMax(values: readonly (number | null | undefined)[]): number {
  const max = Math.max(150, ...values.filter((v): v is number => v != null && Number.isFinite(v)));
  return Math.ceil((max + 10) / 50) * 50;
}

/** Bandes horizontales très pâles par niveau IQA, en fond de graphe (à placer dans le graphe recharts). */
export function aqiBands(domainMax: number) {
  return AQI_SCALE.filter((level) => level.min < domainMax).map((level) => (
    <ReferenceArea
      key={level.id}
      y1={level.min}
      y2={Math.min(Number.isFinite(level.max) ? level.max + 1 : domainMax, domainMax)}
      fill={level.surface}
      fillOpacity={0.7}
      stroke="none"
      ifOverflow="hidden"
    />
  ));
}

const { PALETTE, COLORS } = DesignTokens;

/** Couleurs des graphes (hex de DesignTokens : les attributs SVG n'acceptent pas toujours var()). */
export const CHART = {
  line: PALETTE.sky600,
  fill: PALETTE.sky400,
  band: PALETTE.sky300,
  secondary: PALETTE.sky300,
  grid: COLORS.border,
  muted: COLORS.textMuted,
} as const;

export const AXIS_TICK = { fontSize: 12, fill: COLORS.textMuted } as const;
