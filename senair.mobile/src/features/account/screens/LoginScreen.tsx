import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { fieldErrorsOf, isApiError, loginSchema, otpSchema, MOCK_PASSWORD } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { BrandLogo, Button, Screen, ScreenTitle, TextField } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';
import { FormError, FormNotice } from '../components/FormError';
import { serverErrors } from '../formErrors';
import { useLogin, useVerifyMfa } from '../hooks/useAuthActions';

export function LoginScreen() {
  const api = useApi();
  const login = useLogin();
  const verify = useVerifyMfa();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/account'));

  const submit = async () => {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setFields(fieldErrorsOf(parsed.error));
    setFields({});
    try {
      const outcome = await login.mutateAsync(parsed.data);
      if (outcome.kind === 'mfa') setChallengeId(outcome.challengeId);
      else done();
    } catch (error) {
      const { fields: f, form } = serverErrors(error);
      setFields(f);
      setFormError(isApiError(error) && error.kind === 'unauthorized' ? 'E-mail ou mot de passe incorrect.' : form);
    }
  };

  const submitOtp = async () => {
    if (!challengeId) return;
    const parsed = otpSchema.safeParse({ otp });
    if (!parsed.success) return setFields(fieldErrorsOf(parsed.error));
    try {
      await verify.mutateAsync({ challengeId, otp: parsed.data.otp });
      done();
    } catch (error) {
      setFormError(serverErrors(error).form);
    }
  };

  return (
    <Screen topInset={false}>
      <BrandLogo variant="stacked" size={72} />
      <ScreenTitle title="Connexion" subtitle="Compte citoyen facultatif : alertes personnalisées et profil santé" />
      {api.isMock ? <FormNotice message={`Démonstration : citoyen@senair.sn / ${MOCK_PASSWORD}`} /> : null}
      <FormError message={formError} />
      {challengeId ? (
        <>
          <TextField
            label="Code de vérification (6 chiffres)"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            error={fields.otp}
          />
          <Button label="Valider" onPress={() => void submitOtp()} loading={verify.isPending} />
        </>
      ) : (
        <>
          <TextField
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={fields.email}
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            error={fields.password}
            onSubmitEditing={() => void submit()}
          />
          <Button label="Se connecter" onPress={() => void submit()} loading={login.isPending} />
          <Text style={styles.or}>Pas encore de compte ?</Text>
          <Button label="Créer un compte" variant="secondary" onPress={() => router.replace('/account/register')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  or: {
    ...TYPE.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
});
