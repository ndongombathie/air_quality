import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { AQI_SCALE } from '@senair/core';
import { PressableScale } from '@/shared/ui';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';

/** Petite illustration : les 6 niveaux de l'IQA en arcs concentriques. */
function ScaleIllustration() {
  const size = 72;
  const c = size / 2;
  return (
    <View aria-hidden>
      <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c} fill={COLORS.surface} />
      {AQI_SCALE.map((level, i) => {
        const r = 30 - i * 4.4;
        const start = Math.PI * (1 + i * 0.06);
        const end = Math.PI * (2 - i * 0.06);
        const d = `M ${c + r * Math.cos(start)} ${c + r * Math.sin(start)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(end)} ${c + r * Math.sin(end)}`;
        return <Path key={level.id} d={d} stroke={level.color} strokeWidth={3} strokeLinecap="round" fill="none" />;
      })}
      </Svg>
    </View>
  );
}

/** Carte d'entrée vers « Comprendre » (échelle IQA, normes, polluants). */
export function ComprendreCard() {
  return (
    <PressableScale
      onPress={() => router.push('/comprendre')}
      accessibilityRole="link"
      accessibilityLabel="Comprendre la qualité de l'air : échelle IQA, normes et polluants"
      haptics="light"
      style={styles.card}
    >
      <ScaleIllustration />
      <View style={styles.texts}>
        <Text style={styles.kicker}>Comprendre</Text>
        <Text style={styles.title}>L'IQA, les normes et les polluants</Text>
        <Text style={styles.sub}>OMS 2021, norme NS 05-062, PM2.5, NO₂…</Text>
      </View>
      <ChevronRight size={20} color={COLORS.primaryText} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.selectedBorder,
    ...SHADOWS.card,
  },
  texts: { flex: 1, gap: SPACING.xxs },
  kicker: { ...TYPE.overline, color: COLORS.primaryText },
  title: { ...TYPE.h3, color: COLORS.text },
  sub: { ...TYPE.caption, color: COLORS.textSecondary },
});
