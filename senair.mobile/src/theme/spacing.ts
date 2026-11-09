import { DesignTokens } from '@senair/core';

/** Grille de 4 px (DesignTokens.SPACING) : xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48. */
export const SPACING = DesignTokens.SPACING;

/** Rayons : 8 champs, 12 boutons, 16 cartes, 24 panneaux. */
export const RADIUS = DesignTokens.RADIUS;

/** Marge intérieure des cartes (20 px, entre lg et xl). */
export const CARD_PADDING = SPACING.lg + SPACING.xs;

/** Zone tactile minimale (Apple HIG / WCAG 2.5.5). */
export const TOUCH_TARGET = 44;

/** Largeur au-delà de laquelle on passe en mise en page tablette. */
export const TABLET_BREAKPOINT = 768;

/** Largeur maximale du contenu centré sur tablette. */
export const CONTENT_MAX_WIDTH = 960;
