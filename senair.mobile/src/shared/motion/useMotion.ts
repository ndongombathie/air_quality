import { useMemo } from 'react';
import { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

/** Délai maximal d'une cascade : au-delà, les éléments apparaissent ensemble (pas d'attente inutile). */
const MAX_STAGGER_MS = 360;
const STEP_MS = 60;

/**
 * Animations communes, désactivées si l'utilisateur a demandé à réduire les animations.
 * Retourne `undefined` dans ce cas : les composants s'affichent alors immédiatement.
 */
export function useMotion() {
  const reduced = useReducedMotion();
  return useMemo(
    () => ({
      reduced,
      /** Entrée en cascade : fondu + légère montée, délai progressif court. */
      enter: (index = 0) =>
        reduced ? undefined : FadeInDown.duration(380).delay(Math.min(index * STEP_MS, MAX_STAGGER_MS)).springify().damping(18),
      fadeIn: (delay = 0) => (reduced ? undefined : FadeIn.duration(260).delay(delay)),
      fadeOut: reduced ? undefined : FadeOut.duration(180),
      /** Réorganisation fluide d'une liste (filtres). */
      layout: reduced ? undefined : LinearTransition.springify().damping(20),
    }),
    [reduced],
  );
}
