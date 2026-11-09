import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={[styles.box, styles.error]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <AlertCircle size={16} color={COLORS.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function FormNotice({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={[styles.box, styles.notice]} accessibilityLiveRegion="polite">
      <CheckCircle2 size={16} color={COLORS.primaryText} />
      <Text style={[styles.text, styles.noticeText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  error: { backgroundColor: COLORS.surface, borderColor: COLORS.danger },
  notice: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.selectedBorder,
  },
  text: { ...TYPE.small, color: COLORS.text, flex: 1 },
  noticeText: { color: COLORS.primaryText },
});
