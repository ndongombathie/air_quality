import { useState, type FormEvent } from 'react';
import {
  AQI_SCALE,
  POLLUTANT_CODES,
  POLLUTANTS,
  REFERENCE_LABELS,
  thresholdSchema,
  type AveragingPeriod,
  type AqiLevel,
  type PollutantCode,
  type ReferenceStandard,
  type Threshold,
  type ThresholdInput,
  type Unit,
} from '@senair/core';
import { Button } from '../../../shared/ui/Button';
import { CheckboxField, SelectField, TextField } from '../../../shared/ui/Field';
import { PERIOD_LABELS, optionsOf } from '../../../shared/lib/labels';
import { validate, type FieldErrors } from '../../../shared/lib/forms';
import { useZones } from '../../air-quality/hooks';

const UNITS: Unit[] = ['µg/m³', 'mg/m³', 'ppm', 'ppb', 'index'];

interface ThresholdFormProps {
  threshold: Threshold | null;
  pending: boolean;
  serverErrors: FieldErrors;
  onSubmit: (input: ThresholdInput) => void;
  onCancel: () => void;
}

export function ThresholdForm({ threshold, pending, serverErrors, onSubmit, onCancel }: ThresholdFormProps) {
  const zones = useZones();
  const [values, setValues] = useState({
    pollutant: threshold?.pollutant ?? ('pm25' as PollutantCode),
    reference: threshold?.reference ?? ('WHO_2021' as ReferenceStandard),
    period: threshold?.period ?? ('24h' as AveragingPeriod),
    value: threshold ? String(threshold.value) : '',
    unit: threshold?.unit ?? POLLUTANTS.pm25.unit,
    zoneId: threshold?.zoneId ?? '',
    alertLevel: threshold?.alertLevel ?? ('unhealthy_sensitive' as AqiLevel),
    enabled: threshold?.enabled ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const shown = { ...serverErrors, ...errors };
  type Values = typeof values;
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const raw = values.value.replace(',', '.').trim();
    const result = validate(thresholdSchema, { ...values, value: raw === '' ? Number.NaN : Number(raw), zoneId: values.zoneId || null });
    setErrors(result.errors ?? {});
    if (result.data) onSubmit(result.data);
  };

  return (
    <form onSubmit={submit} noValidate className="stack stack--sm">
      <div className="grid grid--2">
        <SelectField
          label="Polluant"
          value={values.pollutant}
          options={POLLUTANT_CODES.map((code) => ({ value: code, label: `${POLLUTANTS[code].formula}, ${POLLUTANTS[code].name.toLowerCase()}` }))}
          onChange={(e) => {
            const pollutant = e.target.value as PollutantCode;
            setValues((v) => ({ ...v, pollutant, unit: POLLUTANTS[pollutant].unit }));
          }}
          error={shown.pollutant}
        />
        <SelectField
          label="Zone"
          value={values.zoneId}
          placeholder="Toute la ville (seuil global)"
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          onChange={(e) => set('zoneId', e.target.value)}
          error={shown.zoneId}
        />
      </div>
      <div className="grid grid--2">
        <SelectField label="Référentiel" value={values.reference} options={optionsOf(REFERENCE_LABELS)} onChange={(e) => set('reference', e.target.value as ReferenceStandard)} error={shown.reference} />
        <SelectField label="Période de moyenne" value={values.period} options={optionsOf(PERIOD_LABELS)} onChange={(e) => set('period', e.target.value as AveragingPeriod)} error={shown.period} />
      </div>
      <div className="grid grid--2">
        <TextField label="Valeur limite" inputMode="decimal" value={values.value} onChange={(e) => set('value', e.target.value)} error={shown.value} required />
        <SelectField label="Unité" value={values.unit} options={UNITS.map((u) => ({ value: u, label: u }))} onChange={(e) => set('unit', e.target.value as Unit)} error={shown.unit} />
      </div>
      <SelectField
        label="Niveau d'alerte déclenché"
        value={values.alertLevel}
        options={AQI_SCALE.map((level) => ({ value: level.id, label: level.label }))}
        onChange={(e) => set('alertLevel', e.target.value as AqiLevel)}
        error={shown.alertLevel}
      />
      <CheckboxField label="Seuil actif" checked={values.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <div className="row row--end">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          {threshold ? 'Enregistrer' : 'Créer le seuil'}
        </Button>
      </div>
    </form>
  );
}
