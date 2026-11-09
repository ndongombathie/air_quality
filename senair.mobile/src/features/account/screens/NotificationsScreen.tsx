import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AQI_LEVEL_IDS,
  AQI_LEVELS,
  POLLUTANT_CODES,
  POLLUTANTS,
  fieldErrorsOf,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from '@senair/core';
import { Button, CheckboxRow, ChipGroup, Screen, ScreenTitle, SectionHeader, StateView, TextField } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';
import { FormError, FormNotice } from '../components/FormError';
import { RequireAccount } from '../components/RequireAccount';
import { ZoneMultiSelect } from '../components/ZoneMultiSelect';
import { serverErrors } from '../formErrors';
import { useNotificationPreferences, useSaveNotificationPreferences } from '../hooks/useNotificationPreferences';

const LEVEL_OPTIONS = AQI_LEVEL_IDS.map((id) => ({
  value: id,
  label: AQI_LEVELS[id].shortLabel,
  dotColor: AQI_LEVELS[id].color,
}));
const POLLUTANT_OPTIONS = POLLUTANT_CODES.map((code) => ({
  value: code,
  label: POLLUTANTS[code].formula,
}));

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const save = useSaveNotificationPreferences();
  const [prefs, setPrefs] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPrefs(initial), [initial]);
  const patch = (update: Partial<NotificationPreferences>) => setPrefs((p) => ({ ...p, ...update }));

  const submit = async () => {
    setNotice(null);
    setError(null);
    const parsed = notificationPreferencesSchema.safeParse(prefs);
    if (!parsed.success) return setFields(fieldErrorsOf(parsed.error));
    setFields({});
    try {
      const result = await save.mutateAsync(parsed.data);
      setNotice(result.pushNotice ?? 'Préférences enregistrées.');
    } catch (e) {
      setError(serverErrors(e).form);
    }
  };

  return (
    <View>
      <FormError message={error} />
      <FormNotice message={notice} />
      <SectionHeader title="Canaux" />
      <CheckboxRow
        role="switch"
        label="Notifications push"
        description="L'autorisation du téléphone vous sera demandée à l'enregistrement."
        checked={prefs.pushEnabled}
        onChange={(pushEnabled) => patch({ pushEnabled })}
      />
      <CheckboxRow role="switch" label="E-mail" checked={prefs.emailEnabled} onChange={(emailEnabled) => patch({ emailEnabled })} />

      <SectionHeader title="Niveau minimum" subtitle="Être prévenu à partir de ce niveau d'IQA" />
      <ChipGroup options={LEVEL_OPTIONS} isSelected={(v) => v === prefs.minLevel} onToggle={(minLevel) => patch({ minLevel })} />

      <SectionHeader title="Polluants" />
      <ChipGroup
        scroll={false}
        options={POLLUTANT_OPTIONS}
        isSelected={(v) => prefs.pollutants.includes(v)}
        onToggle={(v) =>
          patch({
            pollutants: prefs.pollutants.includes(v) ? prefs.pollutants.filter((p) => p !== v) : [...prefs.pollutants, v],
          })
        }
      />
      {fields.pollutants ? <Text style={styles.error}>{fields.pollutants}</Text> : null}

      <SectionHeader title="Zones" subtitle="Aucune zone : celles de votre profil" />
      <ZoneMultiSelect label="Quartiers" value={prefs.zoneIds} onChange={(zoneIds) => patch({ zoneIds })} error={fields.zoneIds} />

      <SectionHeader title="Heures calmes" />
      <CheckboxRow
        role="switch"
        label="Ne pas déranger la nuit"
        checked={prefs.quietHours !== null}
        onChange={(on) => patch({ quietHours: on ? { start: '22:00', end: '06:30' } : null })}
      />
      {prefs.quietHours ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Début (HH:MM)"
              value={prefs.quietHours.start}
              onChangeText={(start) =>
                patch({
                  quietHours: { start, end: prefs.quietHours?.end ?? '' },
                })
              }
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={fields['quietHours.start']}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Fin (HH:MM)"
              value={prefs.quietHours.end}
              onChangeText={(end) =>
                patch({
                  quietHours: { start: prefs.quietHours?.start ?? '', end },
                })
              }
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={fields['quietHours.end']}
            />
          </View>
        </View>
      ) : null}

      <Button label="Enregistrer" onPress={() => void submit()} loading={save.isPending} style={styles.submit} />
    </View>
  );
}

function PreferencesLoader() {
  const prefs = useNotificationPreferences();
  if (prefs.data) return <PreferencesForm initial={prefs.data} />;
  if (prefs.isError) return <StateView kind="error" error={prefs.error} onRetry={() => void prefs.refetch()} />;
  return <StateView kind="loading" />;
}

export function NotificationsScreen() {
  return (
    <Screen topInset={false}>
      <ScreenTitle title="Notifications" subtitle="Choisissez quand et pour quoi être alerté" />
      <RequireAccount reason="Les alertes personnalisées nécessitent un compte citoyen.">
        <PreferencesLoader />
      </RequireAccount>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.lg },
  flex: { flex: 1 },
  error: { ...TYPE.small, color: COLORS.danger, marginTop: SPACING.xs },
  submit: { marginTop: SPACING.xl },
});
