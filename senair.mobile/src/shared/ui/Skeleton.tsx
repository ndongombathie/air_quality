import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING } from '@/theme';

/** Reflet qui balaie le squelette (désactivé si les animations sont réduites). */
function Shimmer({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (!reduced) x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [reduced, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width }] }));
  if (reduced || width === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.shine, { width: width * 0.45 }, style]} />;
}

/** Bloc gris-bleu avec reflet animé. */
export function SkeletonBlock({ width = '100%', height = 14, radius = RADIUS.sm }: { width?: DimensionValue; height?: number; radius?: number }) {
  const [measured, setMeasured] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout} style={{ width, height, borderRadius: radius, backgroundColor: COLORS.skeleton, overflow: 'hidden' }}>
      <Shimmer width={measured} />
    </View>
  );
}

/** Squelette d'une carte : titre, lignes, éventuel bloc graphique. */
export function SkeletonCard({ lines = 3, graphic = false }: { lines?: number; graphic?: boolean }) {
  return (
    <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel="Chargement">
      <SkeletonBlock width="45%" height={16} />
      {graphic ? <SkeletonBlock height={120} radius={RADIUS.md} /> : null}
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.md,
    padding: SPACING.lg + SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: COLORS.surface, opacity: 0.55 },
});
