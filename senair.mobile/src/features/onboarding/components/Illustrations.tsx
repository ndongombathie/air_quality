import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Bell, MapPin } from 'lucide-react-native';
import { AQI_SCALE } from '@senair/core';
import { AqiGauge } from '@/shared/ui';
import { COLORS } from '@/theme';

const SIZE = 240;

/** Fond commun : disque bleu ciel et quelques « nuages » d'air. */
function Sky() {
  return (
    <View style={StyleSheet.absoluteFill} aria-hidden>
      <Svg width={SIZE} height={SIZE}>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill={COLORS.primarySoft} />
      <Rect x={28} y={48} width={64} height={14} rx={7} fill={COLORS.surface} opacity={0.9} />
      <Rect x={150} y={176} width={56} height={12} rx={6} fill={COLORS.surface} opacity={0.9} />
      <Rect x={160} y={60} width={40} height={10} rx={5} fill={COLORS.surface} opacity={0.7} />
      </Svg>
    </View>
  );
}

/** Lent flottement vertical (désactivé si animations réduites). */
function useFloat() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduced) y.value = withRepeat(withSequence(withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })), -1);
  }, [reduced, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

export function AqiIllustration({ active }: { active: boolean }) {
  const float = useFloat();
  return (
    <View style={styles.box}>
      <Sky />
      <Animated.View style={[styles.gaugeCard, float]}>
        {active ? <AqiGauge aqi={42} level="good" size={150} /> : null}
        <View style={styles.scale}>
          {AQI_SCALE.map((l) => (
            <View key={l.id} style={[styles.scaleDot, { backgroundColor: l.color }]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export function LocationIllustration() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const float = useFloat();
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.value), transform: [{ scale: 0.6 + pulse.value * 0.9 }] }));
  return (
    <View style={styles.box}>
      <Sky />
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={[styles.pin, float]}>
        <MapPin size={56} color={COLORS.primaryStrong} fill={COLORS.surface} strokeWidth={2} />
      </Animated.View>
    </View>
  );
}

export function AlertIllustration() {
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      angle.value = withRepeat(
        withDelay(900, withSequence(withTiming(14, { duration: 120 }), withTiming(-12, { duration: 140 }), withTiming(8, { duration: 120 }), withTiming(0, { duration: 160 }))),
        -1,
      );
  }, [reduced, angle]);
  const wiggle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <View style={styles.box}>
      <Sky />
      <View style={styles.bellDisc}>
        <Animated.View style={wiggle}>
          <Bell size={56} color={COLORS.primaryStrong} strokeWidth={2} />
        </Animated.View>
        <View style={styles.badge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeCard: { backgroundColor: COLORS.surface, borderRadius: 24, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, alignItems: 'center', gap: 12, minHeight: 170 },
  scale: { flexDirection: 'row', gap: 6 },
  scaleDot: { width: 10, height: 10, borderRadius: 5 },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.primary },
  pin: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  bellDisc: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 30, right: 32, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.warning, borderWidth: 3, borderColor: COLORS.surface },
});
