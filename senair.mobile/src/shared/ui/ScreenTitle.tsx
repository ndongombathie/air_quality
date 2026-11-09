import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { COLORS, SPACING, TYPE } from '@/theme';

/** En-tête de page : titre 28 px, sous-titre secondaire, actions à droite. */
export function ScreenTitle({ title, subtitle, right, eyebrow }: { title: string; subtitle?: string; right?: ReactNode; eyebrow?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: SPACING.lg, gap: SPACING.md },
  texts: { flex: 1 },
  eyebrow: { ...TYPE.overline, color: COLORS.primaryText, marginBottom: SPACING.xs },
  title: { ...TYPE.h1, color: COLORS.text },
  subtitle: { ...TYPE.small, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
