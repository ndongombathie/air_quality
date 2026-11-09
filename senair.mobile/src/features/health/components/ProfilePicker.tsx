import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/shared/ui';
import { HEALTH_PROFILE_IDS, HEALTH_PROFILES, type HealthProfileId } from '@senair/core';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

export function ProfilePicker({ selected, onSelect }: { selected: HealthProfileId; onSelect: (id: HealthProfileId) => void }) {
  const { isTablet } = useResponsive();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {HEALTH_PROFILE_IDS.map((id) => {
        const profile = HEALTH_PROFILES[id];
        const active = id === selected;
        return (
          <PressableScale
            key={id}
            onPress={() => onSelect(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${profile.label}, ${profile.description}${profile.sensitive ? ', profil sensible' : ''}`}
            style={[styles.item, { width: isTablet ? '24%' : '48%' }, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{profile.label}</Text>
            <Text style={[styles.description, active && styles.labelActive]}>{profile.description}</Text>
            {profile.sensitive ? <Text style={[styles.sensitive, active && styles.labelActive]}>Profil sensible</Text> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.sm },
  item: {
    minHeight: TOUCH_TARGET + 20,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.xxs,
  },
  active: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.selectedBorder },
  label: { ...TYPE.smallSemibold, color: COLORS.text },
  description: { ...TYPE.caption, color: COLORS.textMuted },
  sensitive: { ...TYPE.captionMedium, color: COLORS.primaryText, marginTop: SPACING.xxs },
  labelActive: { color: COLORS.primaryText },
});
