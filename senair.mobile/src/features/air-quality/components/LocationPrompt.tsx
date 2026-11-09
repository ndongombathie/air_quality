import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SegmentedTabs, tabIconColor } from '@/shared/ui';
import { Building2, LocateFixed, MapPinOff } from 'lucide-react-native';
import { COLORS, SPACING, TYPE } from '@/theme';
import type { UserLocationState } from '../hooks/useUserLocation';

interface LocationPromptProps {
  state: UserLocationState;
  onLocate: () => void;
  onUseCity: () => void;
}

/** Bascule ville / ma position (permission demandée au clic) et message clair en cas de refus. */
export function LocationPrompt({ state, onLocate, onUseCity }: LocationPromptProps) {
  const located = state.status === 'granted';
  return (
    <View style={styles.container}>
      <SegmentedTabs
        value={located ? 'position' : 'city'}
        onChange={(value) => (value === 'city' ? onUseCity() : onLocate())}
        tabs={[
          {
            value: 'city',
            label: 'Ville de Thiès',
            icon: (active) => <Building2 size={16} color={tabIconColor(active)} />,
          },
          {
            value: 'position',
            label: 'Ma position',
            hint: "Demande l'accès à votre position pour afficher l'IQA près de vous",
            icon: (active) =>
              state.status === 'locating' ? (
                <ActivityIndicator size="small" color={COLORS.primaryText} />
              ) : (
                <LocateFixed size={16} color={tabIconColor(active)} />
              ),
          },
        ]}
      />
      {state.status === 'denied' || state.status === 'unavailable' ? (
        <View style={styles.message} accessibilityRole="alert">
          <MapPinOff size={16} color={COLORS.warning} />
          <Text style={styles.messageText}>{state.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  message: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  messageText: { ...TYPE.small, color: COLORS.textSecondary, flex: 1 },
});
