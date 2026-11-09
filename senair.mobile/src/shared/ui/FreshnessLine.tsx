import { StyleSheet, Text, View } from 'react-native';
import { FRESHNESS_LABELS, formatDateTime, formatRelativeTime, type Freshness } from '@senair/core';
import { COLORS, SPACING, TYPE } from '@/theme';

const DOT: Record<Freshness, string> = {
  fresh: COLORS.success,
  stale: COLORS.warning,
  outdated: COLORS.danger,
  unknown: COLORS.textDisabled,
};

/** « À jour, il y a 5 minutes » : fraîcheur fournie par l'API, jamais supposée. */
export function FreshnessLine({ freshness, observedAt }: { freshness: Freshness; observedAt: string | null }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${FRESHNESS_LABELS[freshness]}, mesure du ${formatDateTime(observedAt)}`}
    >
      <View style={[styles.dot, { backgroundColor: DOT[freshness] }]} />
      <Text style={styles.text}>
        {FRESHNESS_LABELS[freshness]}, {formatRelativeTime(observedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + SPACING.xxs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...TYPE.caption, color: COLORS.textMuted },
});
