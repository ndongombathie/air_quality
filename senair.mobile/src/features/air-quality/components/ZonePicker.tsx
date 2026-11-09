import type { Zone } from '@senair/core';
import { ChipGroup } from '@/shared/ui';

export const CITY_SCOPE = 'ville';

/** Choix du périmètre d'historique : la ville entière ou une zone. */
export function ZonePicker({ zones, selected, onSelect }: { zones: Zone[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <ChipGroup
      options={[{ value: CITY_SCOPE, label: 'Toute la ville' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]}
      isSelected={(id) => id === selected}
      onToggle={onSelect}
    />
  );
}
