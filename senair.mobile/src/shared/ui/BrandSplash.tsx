import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { DesignTokens, LOGO_MARK } from '@senair/core';
import { FONTS } from '@/theme';

/** Séquence en millisecondes : les particules d'air se rassemblent, le logo se forme, une onde part, le nom apparaît. */
const TIMELINE = { markStart: 250, wave: 750, letters: 850, exit: 1950, end: 2400 };
/** Avec « réduire les animations » : tout est déjà en place, seul le fondu de sortie reste. */
const REDUCED_START = 1500;
const MARK_WIDTH = 148;
const LETTER_STEP = 70;
const LETTER_DURATION = 340;
const PARTICLE_COUNT = 16;
const WAVE_DELAYS = [0, 170, 340];

const BLUE = LOGO_MARK.paths[0].fill;
const GREEN = LOGO_MARK.paths[1].fill;

function progress(t: number, from: number, duration: number) {
  'worklet';
  return Math.min(Math.max((t - from) / duration, 0), 1);
}

function easeOut(x: number) {
  'worklet';
  return 1 - (1 - x) ** 3;
}

/** Léger dépassement en fin de course. */
function backOut(x: number) {
  'worklet';
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

function Particle({ t, index }: { t: SharedValue<number>; index: number }) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const radius = index % 2 ? 190 : 150;
  const size = [7, 11, 5][index % 3];
  const start = (index % 4) * 55;
  const style = useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, start, 650));
    const distance = radius * (1 - p) + 18;
    return {
      opacity: p < 0.2 ? p * 4 : 0.8 * (1 - (p - 0.2) / 0.8),
      transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }, { scale: 1 - 0.5 * p }],
    };
  });
  return <Animated.View style={[styles.particle, { width: size, height: size, borderRadius: size, backgroundColor: index % 3 === 1 ? GREEN : BLUE }, style]} />;
}

function Wave({ t, delay }: { t: SharedValue<number>; delay: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress(t.value, TIMELINE.wave + delay, 950);
    return { opacity: t.value < TIMELINE.wave + delay ? 0 : 0.9 * (1 - p), transform: [{ scale: 0.5 + 2.6 * easeOut(p) }] };
  });
  return <Animated.View style={[styles.wave, style]} />;
}

function MarkPart({ t, index, from, start, reduced }: { t: SharedValue<number>; index: number; from: number; start: number; reduced: boolean }) {
  const path = LOGO_MARK.paths[index]!;
  const height = (MARK_WIDTH * 104) / 118;
  const style = useAnimatedStyle(() => {
    if (reduced) return {};
    const p = backOut(progress(t.value, start, 620));
    return {
      opacity: progress(t.value, start, 220),
      transform: [{ translateX: from * (1 - p) }, { translateY: 34 * (1 - p) }, { rotate: `${(from / 3) * (1 - p)}deg` }, { scale: 0.7 + 0.3 * p }],
    };
  });
  return (
    <Animated.View style={[styles.markPart, style]}>
      <Svg width={MARK_WIDTH} height={height} viewBox={LOGO_MARK.viewBox}>
        <Path fill={path.fill} fillRule="evenodd" d={path.d} />
      </Svg>
    </Animated.View>
  );
}

function Letter({ t, char, index, light, reduced }: { t: SharedValue<number>; char: string; index: number; light: boolean; reduced: boolean }) {
  const start = TIMELINE.letters + index * LETTER_STEP;
  const style = useAnimatedStyle(() => {
    if (reduced) return {};
    const p = backOut(progress(t.value, start, LETTER_DURATION));
    return { opacity: progress(t.value, start, 180), transform: [{ translateY: 18 * (1 - p) }] };
  });
  return <Animated.Text style={[light ? styles.air : styles.sen, style]}>{char}</Animated.Text>;
}

/**
 * Écran d'ouverture : recouvre l'application le temps de l'animation, puis la révèle en fondu.
 * L'application se charge dessous et reste utilisable dès la fin du fondu.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const initial = reduced ? REDUCED_START : 0;
  const t = useSharedValue(initial);

  useEffect(() => {
    t.value = withTiming(TIMELINE.end, { duration: TIMELINE.end - initial, easing: Easing.linear });
    const timer = setTimeout(onDone, TIMELINE.end - initial);
    return () => clearTimeout(timer);
  }, [initial, onDone, t]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - progress(t.value, TIMELINE.exit, TIMELINE.end - TIMELINE.exit) }));
  const stageStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const pulse = Math.sin(progress(t.value, TIMELINE.wave, 420) * Math.PI) * 0.06;
    return {
      // Le logo s'efface avant le fond : il ne se superpose pas à l'application qui apparaît.
      opacity: 1 - progress(t.value, TIMELINE.exit, 220),
      transform: [{ scale: 1 + pulse + 0.14 * easeOut(progress(t.value, TIMELINE.exit, TIMELINE.end - TIMELINE.exit)) }],
    };
  });

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} aria-hidden>
      {reduced ? null : (
        <>
          {WAVE_DELAYS.map((delay) => (
            <Wave key={delay} t={t} delay={delay} />
          ))}
          {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
            <Particle key={index} t={t} index={index} />
          ))}
        </>
      )}
      <Animated.View style={[styles.stage, stageStyle]}>
        <View style={styles.mark}>
          <MarkPart t={t} index={0} from={-30} start={TIMELINE.markStart} reduced={reduced} />
          <MarkPart t={t} index={1} from={30} start={TIMELINE.markStart + 150} reduced={reduced} />
        </View>
        <View style={styles.word}>
          {['S', 'E', 'N'].map((char, index) => (
            <Letter key={char} t={t} char={char} index={index} light={false} reduced={reduced} />
          ))}
          <View style={styles.space} />
          {['A', 'I', 'R'].map((char, index) => (
            <Letter key={char} t={t} char={char} index={index + 3} light reduced={reduced} />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const WAVE_SIZE = 220;
const INK = DesignTokens.PALETTE.logoInk;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  particle: { position: 'absolute' },
  wave: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, borderRadius: WAVE_SIZE / 2, backgroundColor: DesignTokens.PALETTE.sky100 },
  stage: { alignItems: 'center', gap: 18 },
  mark: { width: MARK_WIDTH, height: (MARK_WIDTH * 104) / 118 },
  markPart: { position: 'absolute', top: 0, left: 0 },
  word: { flexDirection: 'row', alignItems: 'baseline', height: 48 },
  space: { width: 10 },
  sen: { fontFamily: FONTS.extrabold, fontSize: 38, lineHeight: 46, color: INK, letterSpacing: 0.5 },
  air: { fontFamily: FONTS.regular, fontSize: 38, lineHeight: 46, color: INK, letterSpacing: 1 },
});
