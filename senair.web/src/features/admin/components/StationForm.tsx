import { useState, type FormEvent } from 'react';
import type { Station, StationInput, StationStatus, StationType } from '@senair/core';
import { Button } from '../../../shared/ui/Button';
import { SelectField, TextField } from '../../../shared/ui/Field';
import { STATION_STATUS_LABELS, STATION_TYPE_LABELS, optionsOf } from '../../../shared/lib/labels';
import type { FieldErrors } from '../../../shared/lib/forms';
import { useZones } from '../../air-quality/hooks';

interface StationFormValues {
  name: string;
  shortName: string;
  zoneId: string;
  latitude: string;
  longitude: string;
  type: StationType;
  status: StationStatus;
  externalId: string;
  provider: string;
}

function toValues(station: Station | null): StationFormValues {
  return {
    name: station?.name ?? '',
    shortName: station?.shortName ?? '',
    zoneId: station?.zoneId ?? '',
    latitude: station ? String(station.location.latitude) : '',
    longitude: station ? String(station.location.longitude) : '',
    type: station?.type ?? 'residential',
    status: station?.status ?? 'online',
    externalId: station?.externalId ?? '',
    provider: station?.provider ?? 'AirGradient',
  };
}

/** Pas de stationSchema dans @senair/core : validation locale équivalente (voir recommandations). */
export function validateStation(values: StationFormValues): { data: StationInput | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const shortName = values.shortName.trim();
  const latitude = Number(values.latitude.replace(',', '.'));
  const longitude = Number(values.longitude.replace(',', '.'));
  if (name.length < 3 || name.length > 120) errors.name = 'Entre 3 et 120 caractères';
  if (shortName.length < 2 || shortName.length > 40) errors.shortName = 'Entre 2 et 40 caractères';
  if (!values.zoneId) errors.zoneId = 'Zone requise';
  if (values.latitude.trim() === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'Latitude invalide';
  if (values.longitude.trim() === '' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = 'Longitude invalide';
  if (values.provider.trim().length < 2) errors.provider = 'Fournisseur requis';
  if (values.externalId.length > 64) errors.externalId = '64 caractères maximum';
  if (Object.keys(errors).length) return { data: null, errors };
  return {
    data: {
      name,
      shortName,
      zoneId: values.zoneId,
      location: { latitude, longitude },
      type: values.type,
      status: values.status,
      externalId: values.externalId.trim() || null,
      provider: values.provider.trim(),
    },
    errors,
  };
}

interface StationFormProps {
  station: Station | null;
  pending: boolean;
  serverErrors: FieldErrors;
  onSubmit: (input: StationInput) => void;
  onCancel: () => void;
}

export function StationForm({ station, pending, serverErrors, onSubmit, onCancel }: StationFormProps) {
  const zones = useZones();
  const [values, setValues] = useState(() => toValues(station));
  const [errors, setErrors] = useState<FieldErrors>({});
  const shown = { ...serverErrors, ...errors };
  const set = <K extends keyof StationFormValues>(key: K, value: StationFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateStation(values);
    setErrors(result.errors);
    if (result.data) onSubmit(result.data);
  };

  return (
    <form onSubmit={submit} noValidate className="stack stack--sm">
      <TextField label="Nom" value={values.name} onChange={(e) => set('name', e.target.value)} error={shown.name} required />
      <TextField label="Nom court" value={values.shortName} onChange={(e) => set('shortName', e.target.value)} error={shown.shortName} required />
      <SelectField
        label="Zone"
        value={values.zoneId}
        placeholder="Choisir une zone"
        options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
        onChange={(e) => set('zoneId', e.target.value)}
        error={shown.zoneId}
        required
      />
      <div className="grid grid--2">
        <TextField label="Latitude" inputMode="decimal" value={values.latitude} onChange={(e) => set('latitude', e.target.value)} error={shown.latitude} required />
        <TextField label="Longitude" inputMode="decimal" value={values.longitude} onChange={(e) => set('longitude', e.target.value)} error={shown.longitude} required />
      </div>
      <div className="grid grid--2">
        <SelectField label="Type" value={values.type} options={optionsOf(STATION_TYPE_LABELS)} onChange={(e) => set('type', e.target.value as StationType)} />
        <SelectField label="État" value={values.status} options={optionsOf(STATION_STATUS_LABELS)} onChange={(e) => set('status', e.target.value as StationStatus)} />
      </div>
      <div className="grid grid--2">
        <TextField label="Fournisseur" value={values.provider} onChange={(e) => set('provider', e.target.value)} error={shown.provider} required />
        <TextField label="Identifiant fournisseur" hint="Ex. location_id AirGradient" value={values.externalId} onChange={(e) => set('externalId', e.target.value)} error={shown.externalId} />
      </div>
      <div className="row row--end">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          {station ? 'Enregistrer' : 'Créer la station'}
        </Button>
      </div>
    </form>
  );
}
