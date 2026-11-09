import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, actionText, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionText && onAction ? (
        <PressableScale style={styles.action} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionText}>
          <Text style={styles.actionText}>{actionText}</Text>
          <ChevronRight size={16} color={COLORS.primaryText} strokeWidth={2.2} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', marginTop: SPACING.xxl, marginBottom: SPACING.md },
  left: { flex: 1 },
  title: { ...TYPE.h2, color: COLORS.text },
  subtitle: { ...TYPE.small, color: COLORS.textMuted, marginTop: SPACING.xxs },
  action: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET, paddingLeft: SPACING.sm },
  actionText: { ...TYPE.smallSemibold, color: COLORS.primaryText, marginRight: SPACING.xxs },
});
