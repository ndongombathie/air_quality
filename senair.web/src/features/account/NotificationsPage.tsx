import { useState, type FormEvent } from 'react';
import { AQI_SCALE, notificationPreferencesSchema, POLLUTANT_CODES, POLLUTANTS, type NotificationPreferences } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CheckboxField, CheckboxGroup, SelectField, TextField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { serverFieldErrors, validate, type FieldErrors } from '../../shared/lib/forms';
import { useZones } from '../air-quality/hooks';
import { useNotificationPreferences } from './hooks';

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const api = useApi();
  const zones = useZones();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useFeedbackMutation({
    mutationFn: (prefs: NotificationPreferences) => api.account.updateNotificationPreferences(prefs),
    invalidate: [queryKeys.account.preferences, queryKeys.account.all],
    successMessage: 'Préférences enregistrées.',
    onSuccess: () => setErrors({}),
  });
  const set = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(notificationPreferencesSchema, values);
    setErrors(result.errors ?? {});
    if (result.data) mutation.mutate(result.data, { onError: (error) => setErrors(serverFieldErrors(error)) });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <Card title="Canaux">
        <CheckboxField
          label="Notifications push (navigateur ou application mobile)"
          checked={values.pushEnabled}
          onChange={(e) => set('pushEnabled', e.target.checked)}
        />
        <CheckboxField label="Alertes par e-mail" checked={values.emailEnabled} onChange={(e) => set('emailEnabled', e.target.checked)} />
      </Card>
      <Card title="Déclenchement">
        <SelectField
          label="Niveau minimum d'alerte"
          value={values.minLevel}
          options={AQI_SCALE.map((level) => ({ value: level.id, label: level.label }))}
          onChange={(e) => set('minLevel', e.target.value as NotificationPreferences['minLevel'])}
          error={errors.minLevel}
        />
        <CheckboxGroup
          legend="Zones (5 maximum)"
          hint="Sans sélection, les zones de votre profil sont utilisées."
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          value={values.zoneIds}
          onChange={(next) => set('zoneIds', next)}
          error={errors.zoneIds}
        />
        <CheckboxGroup
          legend="Polluants"
          options={POLLUTANT_CODES.map((code) => ({ value: code, label: POLLUTANTS[code].formula }))}
          value={values.pollutants}
          onChange={(next) => set('pollutants', next)}
          error={errors.pollutants}
        />
      </Card>
      <Card title="Heures calmes">
        <CheckboxField
          label="Ne pas me notifier pendant une plage horaire"
          checked={values.quietHours !== null}
          onChange={(e) => set('quietHours', e.target.checked ? { start: '22:00', end: '07:00' } : null)}
        />
        {values.quietHours && (
          <div className="grid grid--2">
            <TextField
              label="Début"
              type="time"
              value={values.quietHours.start}
              onChange={(e) => set('quietHours', { start: e.target.value, end: values.quietHours?.end ?? '07:00' })}
              error={errors['quietHours.start']}
            />
            <TextField
              label="Fin"
              type="time"
              value={values.quietHours.end}
              onChange={(e) => set('quietHours', { start: values.quietHours?.start ?? '22:00', end: e.target.value })}
              error={errors['quietHours.end']}
            />
          </div>
        )}
      </Card>
      <div>
        <Button type="submit" loading={mutation.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function NotificationsPage() {
  const query = useNotificationPreferences();
  return (
    <div className="stack">
      <PageHeader title="Préférences de notification" />
      <QueryState query={query}>{(prefs) => <PreferencesForm initial={prefs} />}</QueryState>
    </div>
  );
}
