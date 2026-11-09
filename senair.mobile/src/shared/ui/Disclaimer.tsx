import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

export function Disclaimer({ text }: { text: string }) {
  return (
    <View style={styles.box} accessibilityRole="text">
      <Info size={16} color={COLORS.primaryText} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, marginTop: SPACING.xl },
  text: { ...TYPE.small, color: COLORS.primaryText, flex: 1 },
});
