import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HEALTH_PROFILE_IDS, HEALTH_PROFILES, registerSchema, toUserMessage, type HealthProfileId } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { CheckboxField, CheckboxGroup, SelectField, TextField } from '../../shared/ui/Field';
import { serverFieldErrors, validate, type FieldErrors } from '../../shared/lib/forms';
import { useZones } from '../air-quality/hooks';
import { useAuth } from './AuthProvider';
import { AuthCard, FormError } from './AuthCard';
import { useRedirectAfterLogin } from './useRedirectAfterLogin';

interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  zoneIds: string[];
  healthProfile: HealthProfileId | null;
  acceptTerms: boolean;
  acceptHealthData: boolean;
}

const INITIAL: RegisterValues = {
  fullName: '',
  email: '',
  password: '',
  passwordConfirm: '',
  zoneIds: [],
  healthProfile: null,
  acceptTerms: false,
  acceptHealthData: false,
};

export function RegisterPage() {
  const { register } = useAuth();
  const redirect = useRedirectAfterLogin();
  const zones = useZones();
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(registerSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    const data = result.data;
    setPending(true);
    setFormError(null);
    try {
      await register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        zoneIds: data.zoneIds,
        // Minimisation : le profil santé n'est transmis qu'avec un consentement explicite.
        healthProfile: data.acceptHealthData ? data.healthProfile : null,
        consent: { terms: true, healthData: data.acceptHealthData },
      });
      redirect(null);
    } catch (error) {
      const fields = serverFieldErrors(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? null : toUserMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard
      title="Créer un compte"
      description="Recevez des alertes pour vos zones et des conseils adaptés à votre santé."
      footer={
        <p>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="stack stack--sm">
        <TextField label="Nom complet" autoComplete="name" value={values.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} required />
        <TextField label="Adresse e-mail" type="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
          hint="10 caractères minimum, avec au moins une lettre et un chiffre."
          required
        />
        <TextField
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={values.passwordConfirm}
          onChange={(e) => set('passwordConfirm', e.target.value)}
          error={errors.passwordConfirm}
          required
        />
        <CheckboxGroup
          legend="Zones suivies (5 maximum)"
          hint="Facultatif : utilisé pour vos alertes et votre tableau de bord."
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          value={values.zoneIds}
          onChange={(next) => set('zoneIds', next)}
          error={errors.zoneIds}
        />
        <CheckboxField
          label="J'accepte que mon profil santé soit utilisé pour personnaliser mes recommandations."
          hint="Facultatif. Donnée sensible : vous pouvez la retirer à tout moment depuis votre espace."
          checked={values.acceptHealthData}
          onChange={(e) => setValues((v) => ({ ...v, acceptHealthData: e.target.checked, healthProfile: e.target.checked ? v.healthProfile : null }))}
        />
        {values.acceptHealthData && (
          <SelectField
            label="Profil santé"
            value={values.healthProfile ?? ''}
            placeholder="Choisir un profil"
            options={HEALTH_PROFILE_IDS.map((id) => ({ value: id, label: HEALTH_PROFILES[id].label }))}
            onChange={(e) => set('healthProfile', (e.target.value || null) as HealthProfileId | null)}
            error={errors.healthProfile}
          />
        )}
        <CheckboxField
          label="J'accepte les conditions d'utilisation et la politique de confidentialité de SEN-AIR."
          checked={values.acceptTerms}
          onChange={(e) => set('acceptTerms', e.target.checked)}
          error={errors.acceptTerms}
          required
        />
        <FormError message={formError} />
        <Button type="submit" loading={pending}>
          Créer mon compte
        </Button>
      </form>
    </AuthCard>
  );
}
