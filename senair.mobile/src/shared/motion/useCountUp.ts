import { useEffect, useState } from 'react';
import { Easing, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Progression animée 0 → cible (valeur partagée pour le dessin) et entier affiché qui « compte ».
 * Valeur absente : pas d'animation, `display` vaut `null`.
 */
export function useCountUp(target: number | null, duration = 900): { progress: SharedValue<number>; display: number | null } {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState<number | null>(reduced ? target : target == null ? null : 0);

  useEffect(() => {
    if (target == null) {
      progress.value = 0;
      setDisplay(null);
      return;
    }
    if (reduced) {
      progress.value = target;
      setDisplay(Math.round(target));
      return;
    }
    progress.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, duration, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous && target != null && !reduced) scheduleOnRN(setDisplay, current);
    },
    [target, reduced],
  );

  return { progress, display };
}
