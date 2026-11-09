/**
 * Couleurs de l'interface : dérivées de `DesignTokens` (@senair/core), source unique.
 * Aucune valeur n'est recopiée ici. Les couleurs de niveaux IQA viennent de `AQI_LEVELS`.
 */
import { DesignTokens } from '@senair/core';

const { COLORS: TOKENS, PALETTE } = DesignTokens;

export const COLORS = {
  ...TOKENS,
  /** Fond des boutons principaux : sky600 (#137BAA), contraste 4,7:1 avec un texte blanc. */
  primaryStrong: TOKENS.primary,
  /** Piste des jauges et squelettes de chargement. */
  track: PALETTE.sky100,
  skeleton: PALETTE.sky100,
  /** Bordure d'un élément sélectionné. */
  selectedBorder: PALETTE.sky300,
  /** Teinte des ombres natives (Android/iOS). */
  shadow: PALETTE.sky700,
} as const;

export const PALETTE_COLORS = PALETTE;
