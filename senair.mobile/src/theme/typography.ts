import type { TextStyle } from 'react-native';
import { DesignTokens } from '@senair/core';

/** Noms des fichiers Manrope enregistrés par `useFonts` dans app/_layout.tsx. */
export const FONTS = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
} as const;

const SIZE = DesignTokens.FONT.sizes;

/** Chiffres à chasse fixe : IQA, valeurs, tableaux. */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export const TYPE = {
  display: { fontFamily: FONTS.extrabold, fontSize: SIZE.display, lineHeight: 52, letterSpacing: -1, ...TABULAR },
  h1: { fontFamily: FONTS.bold, fontSize: SIZE.heading, lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontFamily: FONTS.bold, fontSize: SIZE.title, lineHeight: 26 },
  h3: { fontFamily: FONTS.semibold, fontSize: SIZE.body, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: SIZE.body, lineHeight: 24 },
  bodyMedium: { fontFamily: FONTS.medium, fontSize: SIZE.body, lineHeight: 24 },
  bodySemibold: { fontFamily: FONTS.semibold, fontSize: SIZE.body, lineHeight: 24 },
  small: { fontFamily: FONTS.regular, fontSize: SIZE.small, lineHeight: 20 },
  smallMedium: { fontFamily: FONTS.medium, fontSize: SIZE.small, lineHeight: 20 },
  smallSemibold: { fontFamily: FONTS.semibold, fontSize: SIZE.small, lineHeight: 20 },
  caption: { fontFamily: FONTS.regular, fontSize: SIZE.caption, lineHeight: 16 },
  captionMedium: { fontFamily: FONTS.medium, fontSize: SIZE.caption, lineHeight: 16 },
  /** Petites capitales discrètes pour les en-têtes de liste. */
  overline: { fontFamily: FONTS.semibold, fontSize: SIZE.caption, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { fontFamily: FONTS.bold, fontSize: SIZE.title, lineHeight: 26, ...TABULAR },
  valueSmall: { fontFamily: FONTS.bold, fontSize: SIZE.body, lineHeight: 22, ...TABULAR },
} as const satisfies Record<string, TextStyle>;
