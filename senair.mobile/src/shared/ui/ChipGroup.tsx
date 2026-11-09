import { ScrollView, StyleSheet, View } from 'react-native';
import { SPACING } from '@/theme';
import { Chip } from './Chip';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  dotColor?: string;
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[];
  isSelected: (value: T) => boolean;
  onToggle: (value: T) => void;
  /** Défilement horizontal (filtres) ou retour à la ligne (formulaires). */
  scroll?: boolean;
}

export function ChipGroup<T extends string>({ options, isSelected, onToggle, scroll = true }: ChipGroupProps<T>) {
  const chips = options.map((option) => (
    <Chip
      key={option.value}
      label={option.label}
      dotColor={option.dotColor}
      selected={isSelected(option.value)}
      onPress={() => onToggle(option.value)}
    />
  ));
  if (!scroll) return <View style={styles.wrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACING.sm, paddingVertical: SPACING.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
