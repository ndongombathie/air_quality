import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ChipGroup, SectionHeader, StateView } from '@/shared/ui';
import type { HistoryScope } from '@/shared/api/queryKeys';
import { SPACING } from '@/theme';
import { HISTORY_RANGES, useHistory, type HistoryRange } from '../hooks/useHistory';
import { HistoryChart } from './HistoryChart';

const RANGE_OPTIONS = (Object.keys(HISTORY_RANGES) as HistoryRange[]).map((value) => ({ value, label: HISTORY_RANGES[value].label }));

interface HistorySectionProps {
  scope: HistoryScope;
  scopeName: string;
  /** Sélecteur de périmètre (ex. ville et zones) rendu au-dessus du graphique. */
  scopePicker?: ReactNode;
}

/** Historique 24 h ou 7 jours de la ville, d'une zone ou d'une station. */
export function HistorySection({ scope, scopeName, scopePicker }: HistorySectionProps) {
  const [range, setRange] = useState<HistoryRange>('24h');
  const history = useHistory(scope, range);

  return (
    <View>
      <SectionHeader title="Historique" subtitle={`IQA, ${scopeName}`} />
      <View style={styles.pickers}>
        {scopePicker}
        <ChipGroup options={RANGE_OPTIONS} isSelected={(v) => v === range} onToggle={setRange} />
      </View>
      {history.data ? (
        <Card style={styles.card}>
          <HistoryChart points={history.data.points} labelMode={range === '24h' ? 'hour' : 'day'} />
        </Card>
      ) : history.isError ? (
        <Card style={styles.card}>
          <StateView kind="error" error={history.error} onRetry={() => void history.refetch()} />
        </Card>
      ) : (
        <View style={styles.card}>
          <StateView kind="loading" graphic lines={1} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pickers: { gap: SPACING.sm },
  card: { marginTop: SPACING.md },
});
