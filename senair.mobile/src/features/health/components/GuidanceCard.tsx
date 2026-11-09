import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { HEALTH_PROFILES, type HealthGuidance } from '@senair/core';
import { Card, LevelChip } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';

export function GuidanceCard({ guidance }: { guidance: HealthGuidance }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <LevelChip level={guidance.level} />
        <Text style={styles.profile}>{HEALTH_PROFILES[guidance.profile].label}</Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {guidance.title}
      </Text>
      <View style={styles.actions}>
        {guidance.actions.map((action) => (
          <View key={action} style={styles.action}>
            <View style={styles.check}>
              <Check size={13} color={COLORS.primaryText} strokeWidth={3} />
            </View>
            <Text style={styles.actionText}>{action}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md, marginBottom: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  profile: { ...TYPE.caption, color: COLORS.textMuted },
  title: { ...TYPE.h3, color: COLORS.text },
  actions: { gap: SPACING.md },
  action: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actionText: { ...TYPE.body, color: COLORS.text, flex: 1 },
});
