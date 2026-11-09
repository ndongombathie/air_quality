import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { fieldErrorsOf, registerSchema, type HealthProfileId } from '@senair/core';
import { BrandLogo, Button, CheckboxRow, Screen, ScreenTitle, SectionHeader, TextField } from '@/shared/ui';
import { SPACING } from '@/theme';
import { FormError } from '../components/FormError';
import { HealthProfileSelect } from '../components/HealthProfileSelect';
import { ZoneMultiSelect } from '../components/ZoneMultiSelect';
import { serverErrors } from '../formErrors';
import { useRegister } from '../hooks/useAuthActions';

export function RegisterScreen() {
  const register = useRegister();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [acceptHealthData, setAcceptHealthData] = useState(false);
  const [healthProfile, setHealthProfile] = useState<HealthProfileId | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      passwordConfirm,
      zoneIds,
      healthProfile: acceptHealthData ? healthProfile : null,
      acceptTerms,
      acceptHealthData,
    });
    if (!parsed.success) return setFields(fieldErrorsOf(parsed.error));
    setFields({});
    const v = parsed.data;
    try {
      await register.mutateAsync({
        email: v.email,
        password: v.password,
        fullName: v.fullName,
        zoneIds: v.zoneIds,
        // Minimisation : le profil santé n'est transmis qu'avec un consentement explicite.
        healthProfile: v.acceptHealthData ? v.healthProfile : null,
        consent: { terms: true, healthData: v.acceptHealthData },
      });
      router.replace('/account');
    } catch (error) {
      const { fields: f, form } = serverErrors(error);
      setFields(f);
      setFormError(form);
    }
  };

  return (
    <Screen topInset={false}>
      <BrandLogo variant="stacked" size={72} />
      <ScreenTitle title="Créer un compte" subtitle="Facultatif : pour des alertes et conseils adaptés à vos zones" />
      <FormError message={formError} />
      <TextField label="Nom complet" value={fullName} onChangeText={setFullName} autoComplete="name" error={fields.fullName} />
      <TextField
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={fields.email}
      />
      <TextField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        hint="10 caractères minimum, au moins une lettre et un chiffre"
        error={fields.password}
      />
      <TextField
        label="Confirmer le mot de passe"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        secureTextEntry
        autoComplete="new-password"
        error={fields.passwordConfirm}
      />

      <ZoneMultiSelect label="Mes zones" value={zoneIds} onChange={setZoneIds} error={fields.zoneIds} />

      <SectionHeader title="Consentements" />
      <CheckboxRow
        label="J'accepte les conditions d'utilisation et la politique de confidentialité"
        description="Obligatoire pour créer un compte."
        checked={acceptTerms}
        onChange={setAcceptTerms}
        error={fields.acceptTerms}
      />
      <CheckboxRow
        label="J'accepte que mon profil santé soit enregistré"
        description="Facultatif. Sert uniquement à personnaliser les recommandations ; révocable à tout moment depuis votre compte."
        checked={acceptHealthData}
        onChange={(checked) => {
          setAcceptHealthData(checked);
          if (!checked) setHealthProfile(null);
        }}
      />
      {acceptHealthData ? (
        <>
          <HealthProfileSelect label="Mon profil santé" value={healthProfile} onChange={setHealthProfile} />
        </>
      ) : null}

      <Button label="Créer mon compte" onPress={() => void submit()} loading={register.isPending} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: SPACING.xl },
});
