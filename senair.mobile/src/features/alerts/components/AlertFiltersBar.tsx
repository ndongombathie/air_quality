import { StyleSheet, View } from 'react-native';
import { AQI_LEVEL_IDS, AQI_LEVELS, type AqiLevel } from '@senair/core';
import { SelectField } from '@/shared/ui';
import { SPACING } from '@/theme';
import type { AlertFilters } from '../hooks/useAlerts';

const ALL = 'all';
const LEVEL_OPTIONS = [
  { value: ALL, label: 'Tous les niveaux' },
  ...AQI_LEVEL_IDS.filter((id) => id !== 'good').map((id) => ({ value: id, label: AQI_LEVELS[id].label })),
];

/** Filtre de l'historique : niveau d'alerte, en liste déroulante. */
export function AlertFiltersBar({ filters, onChange }: { filters: AlertFilters; onChange: (next: AlertFilters) => void }) {
  return (
    <View style={styles.container}>
      <SelectField
        label="Niveau"
        options={LEVEL_OPTIONS}
        value={filters.severities[0] ?? ALL}
        onChange={(value) => onChange({ ...filters, severities: value === ALL ? [] : [value as AqiLevel] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.lg },
});
