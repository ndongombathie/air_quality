/**
 * Identité visuelle SEN-AIR : bleu ciel et blanc, pour évoquer l'air.
 * Couleurs du logo (senair.mobile/assets/logo) : bleu #5AC8FA, vert #6DBE45, texte #212121.
 * La gamme « sky » est construite sur la teinte du bleu du logo ; les nuances 600 et plus
 * servent au texte et aux boutons (contraste AA), le bleu du logo reste une couleur d'accent.
 * Source unique des couleurs et mesures ; senair.web/src/styles/tokens.css les reprend en variables CSS
 * (un test vérifie qu'elles restent identiques). Les couleurs IQA restent celles de domain/aqi.ts.
 */
export const PALETTE = {
  sky50: '#F3FBFF',
  sky100: '#E1F5FE',
  sky200: '#C4EBFD',
  sky300: '#92DBFC',
  /** Bleu du logo. */
  sky400: '#5AC8FA',
  sky500: '#35B0E9',
  sky600: '#137BAA',
  sky700: '#116D97',
  sky800: '#0D5373',
  /** Vert du logo. */
  green500: '#6DBE45',
  green700: '#407128',
  /** Texte du logo. */
  logoInk: '#212121',
  ink900: '#0E2233',
  ink700: '#33495C',
  ink500: '#5E7487',
  ink300: '#A7B8C7',
  white: '#FFFFFF',
} as const;

export const COLORS = {
  background: PALETTE.sky50,
  surface: PALETTE.white,
  surfaceSubtle: PALETTE.sky100,
  border: '#DDEDF6',
  borderStrong: '#C3DDEC',
  text: PALETTE.ink900,
  textSecondary: PALETTE.ink700,
  textMuted: PALETTE.ink500,
  textDisabled: PALETTE.ink300,
  /** Boutons principaux : texte blanc lisible (4,7:1). */
  primary: PALETTE.sky600,
  primaryHover: PALETTE.sky700,
  /** Bleu lisible sur fond blanc (contraste AA) : liens, texte accentué, icônes actives. */
  primaryText: PALETTE.sky700,
  primarySoft: PALETTE.sky100,
  onPrimary: PALETTE.white,
  focus: PALETTE.sky400,
  /** Couleurs de marque, reprises du logo (accents, indicateurs actifs, illustrations). */
  brand: PALETTE.sky400,
  brandGreen: PALETTE.green500,
  /** Vert du logo lisible en texte (5,8:1). */
  brandGreenText: PALETTE.green700,
  success: '#1F9D6B',
  warning: '#C77700',
  danger: '#D2433A',
  /** Dégradé « ciel » des en-têtes : du bleu très clair vers le blanc. */
  skyGradient: [PALETTE.sky100, PALETTE.white],
} as const;

export const SPACING = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const FONT = {
  family: 'Manrope',
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  sizes: { caption: 13, small: 15, body: 17, title: 21, heading: 30, display: 48 },
} as const;

export const SHADOW = {
  /** Ombres teintées de bleu, très légères. */
  card: '0 1px 2px rgba(14, 34, 51, 0.04), 0 6px 20px rgba(19, 123, 170, 0.06)',
  raised: '0 12px 32px rgba(19, 123, 170, 0.12)',
} as const;
