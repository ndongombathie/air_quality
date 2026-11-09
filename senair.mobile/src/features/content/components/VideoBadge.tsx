import { StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

export function VideoBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Contient une vidéo">
      <Play size={11} color={COLORS.primaryText} fill={COLORS.primaryText} />
      <Text style={styles.text}>Vidéo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
    alignSelf: 'flex-start',
  },
  text: { ...TYPE.captionMedium, color: COLORS.primaryText },
});
