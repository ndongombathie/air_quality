import { useState, type FormEvent } from 'react';
import { AQI_SCALE, POLLUTANT_CODES, POLLUTANTS, type AlertCreate, type PollutantCode } from '@senair/core';
import { Button } from '../../../shared/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../../shared/ui/Field';
import type { FieldErrors } from '../../../shared/lib/forms';
import { useZones } from '../../air-quality/hooks';
import { useAdminStations } from '../hooks';

type Severity = AlertCreate['severity'];

const TITLE = { min: 5, max: 200 };
const MESSAGE = { min: 10, max: 2000 };
const RECO_MAX = 5;
const SEVERITY_OPTIONS = AQI_SCALE.filter((level) => level.id !== 'good').map((level) => ({ value: level.id, label: level.label }));

interface AlertFormProps {
  pending: boolean;
  serverErrors: FieldErrors;
  onSubmit: (input: AlertCreate) => void;
  onCancel: () => void;
}

/** Publication manuelle d'une alerte : les abonnés de la zone sont notifiés par push. */
export function AlertForm({ pending, serverErrors, onSubmit, onCancel }: AlertFormProps) {
  const zones = useZones();
  const stations = useAdminStations();
  const [values, setValues] = useState({
    zoneId: '',
    stationId: '',
    severity: 'unhealthy_sensitive' as Severity,
    pollutant: 'pm25' as PollutantCode,
    value: '',
    title: '',
    message: '',
    recommendations: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const shown = { ...serverErrors, ...errors };
  type Values = typeof values;
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const zoneStations = (stations.data ?? []).filter((s) => s.zoneId === values.zoneId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const title = values.title.trim();
    const message = values.message.trim();
    const raw = values.value.replace(',', '.').trim();
    const value = raw === '' ? null : Number(raw);
    const recommendations = values.recommendations.split('\n').map((line) => line.trim()).filter(Boolean);
    const next: FieldErrors = {};
    if (!values.zoneId) next.zoneId = 'Choisissez une zone.';
    if (value !== null && (!Number.isFinite(value) || value < 0)) next.value = 'Valeur numérique positive attendue.';
    if (title.length < TITLE.min || title.length > TITLE.max) next.title = `Entre ${TITLE.min} et ${TITLE.max} caractères.`;
    if (message.length < MESSAGE.min || message.length > MESSAGE.max) next.message = `Entre ${MESSAGE.min} et ${MESSAGE.max} caractères.`;
    if (recommendations.length > RECO_MAX) next.recommendations = `${RECO_MAX} conseils maximum.`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      zoneId: values.zoneId,
      stationId: values.stationId || null,
      severity: values.severity,
      pollutant: values.pollutant,
      value,
      title,
      message,
      ...(recommendations.length > 0 ? { recommendations } : {}),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="stack stack--sm">
      <div className="grid grid--2">
        <SelectField
          label="Zone"
          value={values.zoneId}
          placeholder="Choisir une zone"
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          onChange={(e) => setValues((v) => ({ ...v, zoneId: e.target.value, stationId: '' }))}
          error={shown.zoneId}
          required
        />
        <SelectField
          label="Station"
          value={values.stationId}
          placeholder={values.zoneId ? 'Aucune (toute la zone)' : 'Choisissez d’abord une zone'}
          options={zoneStations.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => set('stationId', e.target.value)}
          disabled={!values.zoneId}
          error={shown.stationId}
        />
      </div>
      <div className="grid grid--2">
        <SelectField label="Niveau" value={values.severity} options={SEVERITY_OPTIONS} onChange={(e) => set('severity', e.target.value as Severity)} error={shown.severity} />
        <SelectField
          label="Polluant"
          value={values.pollutant}
          options={POLLUTANT_CODES.map((code) => ({ value: code, label: `${POLLUTANTS[code].formula}, ${POLLUTANTS[code].name.toLowerCase()}` }))}
          onChange={(e) => set('pollutant', e.target.value as PollutantCode)}
          error={shown.pollutant}
        />
      </div>
      <TextField
        label={`Valeur observée (${POLLUTANTS[values.pollutant].unit})`}
        hint="Facultatif : par défaut, le seuil du polluant."
        inputMode="decimal"
        value={values.value}
        onChange={(e) => set('value', e.target.value)}
        error={shown.value}
      />
      <TextField label="Titre" value={values.title} onChange={(e) => set('title', e.target.value)} error={shown.title} maxLength={TITLE.max} required />
      <TextAreaField label="Message" value={values.message} onChange={(e) => set('message', e.target.value)} error={shown.message} rows={4} maxLength={MESSAGE.max} required />
      <TextAreaField
        label="Conseils"
        hint={`Facultatif : un conseil par ligne, ${RECO_MAX} au maximum.`}
        value={values.recommendations}
        onChange={(e) => set('recommendations', e.target.value)}
        error={shown.recommendations}
        rows={3}
      />
      <div className="row row--end">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Publier l'alerte
        </Button>
      </div>
    </form>
  );
}
