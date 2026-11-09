import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isApiError, loginSchema, MOCK_OTP, MOCK_PASSWORD, otpSchema, toUserMessage } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/Field';
import { useApi } from '../../shared/api/ApiProvider';
import { validate, type FieldErrors } from '../../shared/lib/forms';
import { useAuth } from './AuthProvider';
import { AuthCard, FormError } from './AuthCard';
import { useRedirectAfterLogin } from './useRedirectAfterLogin';

function DemoAccounts() {
  return (
    <details className="demo-accounts">
      <summary>Comptes de démonstration</summary>
      <ul className="small">
        <li>citoyen@senair.sn</li>
        <li>autorite@senair.sn (code MFA {MOCK_OTP})</li>
        <li>admin@senair.sn (code MFA {MOCK_OTP})</li>
      </ul>
      <p className="small">
        Mot de passe : <code>{MOCK_PASSWORD}</code>
      </p>
    </details>
  );
}

function OtpStep({ challengeId, onBack }: { challengeId: string; onBack: (message?: string) => void }) {
  const { verifyMfa } = useAuth();
  const redirect = useRedirectAfterLogin();
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(otpSchema, { otp });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setPending(true);
    setFormError(null);
    try {
      redirect(await verifyMfa(challengeId, result.data.otp));
    } catch (error) {
      // Challenge expiré ou épuisé : retour à l'étape mot de passe ; sinon message précis (code faux, etc.).
      if (isApiError(error) && error.code === 'invalid_challenge') onBack(toUserMessage(error));
      else setFormError(toUserMessage(error));
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="stack stack--sm">
      <p>Saisissez le code à 6 chiffres de votre application d'authentification.</p>
      <TextField
        label="Code de vérification"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
        error={errors.otp}
        required
        autoFocus
      />
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Vérifier
      </Button>
      <Button variant="ghost" onClick={() => onBack()}>
        Retour
      </Button>
    </form>
  );
}

export function LoginPage() {
  const api = useApi();
  const { login } = useAuth();
  const redirect = useRedirectAfterLogin();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(loginSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setPending(true);
    setFormError(null);
    try {
      const outcome = await login(result.data);
      if ('challengeId' in outcome) setChallengeId(outcome.challengeId);
      else redirect(outcome);
    } catch (error) {
      // Message générique côté API (ne révèle pas si le compte existe) ; double authentification non configurée, etc.
      setFormError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard
      title={challengeId ? 'Vérification en deux étapes' : 'Connexion'}
      footer={
        !challengeId && (
          <p>
            Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
          </p>
        )
      }
    >
      {challengeId ? (
        <OtpStep
          challengeId={challengeId}
          onBack={(message) => {
            setChallengeId(null);
            setFormError(message ?? null);
          }}
        />
      ) : (
        <form onSubmit={onSubmit} noValidate className="stack stack--sm">
          <TextField
            label="Adresse e-mail"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
            error={errors.email}
            required
          />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
            error={errors.password}
            required
          />
          <FormError message={formError} />
          <Button type="submit" loading={pending}>
            Se connecter
          </Button>
          <Link to="/mot-de-passe-oublie" className="small">
            Mot de passe oublié ?
          </Link>
        </form>
      )}
      {api.isMock && <DemoAccounts />}
    </AuthCard>
  );
}
