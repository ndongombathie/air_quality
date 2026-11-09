import { AQI_SCALE, POLLUTANTS, POLLUTANT_CODES, type AlertQuery, type AlertStatus, type AqiLevel, type PollutantCode } from '@senair/core';
import { SelectField } from '../../shared/ui/Field';
import { ALERT_STATUS_LABELS, optionsOf } from '../../shared/lib/labels';
import { useZones } from '../air-quality/hooks';

export interface AlertFilterValue {
  status: AlertStatus | '';
  severity: AqiLevel | '';
  pollutant: PollutantCode | '';
  zoneId: string;
}

export const EMPTY_ALERT_FILTERS: AlertFilterValue = { status: '', severity: '', pollutant: '', zoneId: '' };

export function toAlertQuery(filters: AlertFilterValue): AlertQuery {
  return {
    ...(filters.status ? { status: [filters.status] } : {}),
    ...(filters.severity ? { severity: [filters.severity] } : {}),
    ...(filters.pollutant ? { pollutant: [filters.pollutant] } : {}),
    ...(filters.zoneId ? { zoneId: filters.zoneId } : {}),
  };
}

export function AlertFilters({ value, onChange, showZone = true }: { value: AlertFilterValue; onChange: (next: AlertFilterValue) => void; showZone?: boolean }) {
  const zones = useZones();
  const set = <K extends keyof AlertFilterValue>(key: K, next: AlertFilterValue[K]) => onChange({ ...value, [key]: next });
  return (
    <form className="toolbar" role="search" aria-label="Filtrer les alertes" onSubmit={(event) => event.preventDefault()}>
      <SelectField label="Statut" value={value.status} placeholder="Tous" options={optionsOf(ALERT_STATUS_LABELS)} onChange={(e) => set('status', e.target.value as AlertStatus | '')} />
      <SelectField
        label="Niveau"
        value={value.severity}
        placeholder="Tous"
        options={AQI_SCALE.map((level) => ({ value: level.id, label: level.label }))}
        onChange={(e) => set('severity', e.target.value as AqiLevel | '')}
      />
      <SelectField
        label="Polluant"
        value={value.pollutant}
        placeholder="Tous"
        options={POLLUTANT_CODES.map((code) => ({ value: code, label: POLLUTANTS[code].formula }))}
        onChange={(e) => set('pollutant', e.target.value as PollutantCode | '')}
      />
      {showZone && (
        <SelectField
          label="Zone"
          value={value.zoneId}
          placeholder="Toutes"
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          onChange={(e) => set('zoneId', e.target.value)}
        />
      )}
    </form>
  );
}
