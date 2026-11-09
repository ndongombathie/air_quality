import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { Check } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

interface CheckboxRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  /** `switch` pour un réglage (interrupteur), `checkbox` pour un consentement (case). */
  role?: 'checkbox' | 'switch';
}

export function CheckboxRow({ label, description, checked, onChange, error, role = 'checkbox' }: CheckboxRowProps) {
  return (
    <View style={styles.wrapper}>
      <PressableScale
        onPress={() => onChange(!checked)}
        accessibilityRole={role}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked }}
        style={styles.row}
      >
        {role === 'switch' ? (
          <View style={[styles.track, checked && styles.trackOn]}>
            <View style={[styles.thumb, checked && styles.thumbOn]} />
          </View>
        ) : (
          <View style={[styles.box, checked && styles.boxChecked, error ? styles.boxError : null]}>
            {checked ? <Check size={15} color={COLORS.onPrimary} strokeWidth={3} /> : null}
          </View>
        )}
        <View style={styles.texts}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </PressableScale>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', minHeight: TOUCH_TARGET, paddingVertical: SPACING.xs, gap: SPACING.md },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: RADIUS.sm / 2 + 2,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: COLORS.primaryStrong, borderColor: COLORS.primaryStrong },
  boxError: { borderColor: COLORS.danger },
  track: { width: 40, height: 24, borderRadius: 12, backgroundColor: COLORS.borderStrong, padding: 2, marginTop: 1 },
  trackOn: { backgroundColor: COLORS.primaryStrong },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.surface },
  thumbOn: { transform: [{ translateX: 16 }] },
  texts: { flex: 1 },
  label: { ...TYPE.bodyMedium, color: COLORS.text },
  description: { ...TYPE.small, color: COLORS.textMuted, marginTop: SPACING.xxs },
  error: { ...TYPE.small, color: COLORS.danger, marginLeft: 38 },
});
