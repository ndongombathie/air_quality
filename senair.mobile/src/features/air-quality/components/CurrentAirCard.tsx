import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Lightbulb } from 'lucide-react-native';
import { AQI_LEVELS, DATA_STATUS_LABELS, getAqiLevel, type AqiLevel, type DataStatus, type Freshness, type PollutantCode } from '@senair/core';
import { AqiGauge, FreshnessLine } from '@/shared/ui';
import { pollutantLabel } from '@/shared/format/display';
import { CARD_PADDING, COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';

interface CurrentAirCardProps {
  title: string;
  subtitle: string;
  aqi: number | null;
  level: AqiLevel | null;
  dominantPollutant: PollutantCode | null;
  observedAt: string | null;
  freshness: Freshness;
  status: DataStatus;
  footer?: ReactNode;
}

/** Fond très légèrement teinté par le niveau (surface du niveau vers le blanc). */
function LevelTint({ color }: { color: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="heroTint" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="0.65" stopColor={COLORS.surface} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroTint)" />
      </Svg>
    </View>
  );
}

/** Carte héros : jauge animée, chiffre foncé, puce de niveau, conseil du moment, faits clés. */
export function CurrentAirCard(props: CurrentAirCardProps) {
  const info = props.level ? AQI_LEVELS[props.level] : getAqiLevel(props.aqi);
  return (
    <View style={styles.card}>
      <LevelTint color={info?.surface ?? COLORS.surfaceSubtle} />
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {props.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {props.subtitle}
        </Text>
      </View>
      <View style={styles.gauge}>
        <AqiGauge aqi={props.aqi} level={props.level} />
      </View>
      {info ? (
        <View style={styles.advice}>
          <View style={styles.adviceIcon}>
            <Lightbulb size={16} color={COLORS.primaryText} />
          </View>
          <View style={styles.adviceTexts}>
            <Text style={styles.adviceLabel}>Conseil du moment</Text>
            <Text style={styles.adviceText}>{info.healthImpact}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.facts}>
        <Fact label="Polluant dominant" value={pollutantLabel(props.dominantPollutant)} />
        <View style={styles.divider} />
        <Fact label="Provenance" value={DATA_STATUS_LABELS[props.status]} />
      </View>
      <View style={styles.footer}>
        <FreshnessLine freshness={props.freshness} observedAt={props.observedAt} />
        {props.footer}
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: CARD_PADDING,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  head: { gap: SPACING.xxs },
  title: { ...TYPE.h3, color: COLORS.text },
  subtitle: { ...TYPE.small, color: COLORS.textSecondary },
  gauge: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  advice: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.lg,
  },
  adviceIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  adviceTexts: { flex: 1, gap: SPACING.xxs },
  adviceLabel: { ...TYPE.captionMedium, color: COLORS.primaryText },
  adviceText: { ...TYPE.smallMedium, color: COLORS.text },
  facts: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.lg },
  fact: { flex: 1, gap: SPACING.xxs },
  divider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg },
  factLabel: { ...TYPE.caption, color: COLORS.textMuted },
  factValue: { ...TYPE.bodySemibold, color: COLORS.text },
  footer: { marginTop: SPACING.lg, gap: SPACING.xs },
});
