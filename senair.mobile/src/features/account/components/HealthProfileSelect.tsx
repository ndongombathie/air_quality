import { HEALTH_PROFILE_IDS, HEALTH_PROFILES, type HealthProfileId } from '@senair/core';
import { SelectField } from '@/shared/ui';

const NONE = 'none';
const OPTIONS = [
  { value: NONE, label: 'Ne pas renseigner' },
  ...HEALTH_PROFILE_IDS.map((id) => ({
    value: id,
    label: HEALTH_PROFILES[id].label,
  })),
];

interface HealthProfileSelectProps {
  value: HealthProfileId | null;
  onChange: (id: HealthProfileId | null) => void;
  label?: string;
  hint?: string;
}

/** Profil santé en liste déroulante ; « Ne pas renseigner » efface le profil. */
export function HealthProfileSelect({ value, onChange, label = 'Profil santé', hint }: HealthProfileSelectProps) {
  return (
    <SelectField label={label} options={OPTIONS} value={value ?? NONE} onChange={(id) => onChange(id === NONE ? null : (id as HealthProfileId))} hint={hint} />
  );
}
