import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, toUserMessage } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/Field';
import { useApi } from '../../shared/api/ApiProvider';
import { validate, type FieldErrors } from '../../shared/lib/forms';
import { AuthCard, FormError } from './AuthCard';

/** Lien reçu par e-mail : réinitialisation du mot de passe, ou activation d'un compte invité. */
export function ResetPasswordPage() {
  const api = useApi();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [values, setValues] = useState({ password: '', passwordConfirm: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(resetPasswordSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setPending(true);
    setFormError(null);
    try {
      await api.auth.resetPassword({ token, password: result.data.password });
      setDone(true);
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  };

  const footer = <Link to="/connexion">Retour à la connexion</Link>;

  if (!token) {
    return (
      <AuthCard title="Lien invalide" footer={footer}>
        <p>Ce lien est incomplet. Demandez un nouveau lien depuis « Mot de passe oublié ».</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" description="Choisissez un mot de passe d'au moins 10 caractères, avec une lettre et un chiffre." footer={footer}>
      {done ? (
        <p role="status">
          Votre mot de passe est enregistré. <Link to="/connexion">Se connecter</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="stack stack--sm">
          <TextField
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
            error={errors.password}
            required
          />
          <TextField
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            value={values.passwordConfirm}
            onChange={(e) => setValues((v) => ({ ...v, passwordConfirm: e.target.value }))}
            error={errors.passwordConfirm}
            required
          />
          <FormError message={formError} />
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
