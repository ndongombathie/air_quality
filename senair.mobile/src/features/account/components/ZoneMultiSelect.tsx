import { SelectField, StateView } from '@/shared/ui';
import { useZones } from '@/shared/hooks/useZones';

const MAX_ZONES = 5;

interface ZoneMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  label?: string;
}

/** Quartiers suivis, en liste déroulante (5 au plus). */
export function ZoneMultiSelect({ value, onChange, error, label = 'Mes zones suivies' }: ZoneMultiSelectProps) {
  const zones = useZones();
  if (!zones.data) return zones.isError ? <StateView kind="error" error={zones.error} onRetry={() => void zones.refetch()} /> : <StateView kind="loading" />;
  return (
    <SelectField
      multiple
      label={label}
      placeholder="Aucune zone"
      options={zones.data.map((z) => ({ value: z.id, label: z.name }))}
      value={value}
      onChange={onChange}
      max={MAX_ZONES}
      error={error}
      hint={`Jusqu'à ${MAX_ZONES} quartiers`}
    />
  );
}
