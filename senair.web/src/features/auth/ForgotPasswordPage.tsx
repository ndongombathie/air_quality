import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { loginSchema, toUserMessage } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/Field';
import { useApi } from '../../shared/api/ApiProvider';
import { validate, type FieldErrors } from '../../shared/lib/forms';
import { AuthCard, FormError } from './AuthCard';

const emailSchema = loginSchema.pick({ email: true });

export function ForgotPasswordPage() {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(emailSchema, { email });
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setPending(true);
    setFormError(null);
    try {
      await api.auth.forgotPassword(result.data.email);
      setSent(true);
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard title="Mot de passe oublié" footer={<Link to="/connexion">Retour à la connexion</Link>}>
      {sent ? (
        <p role="status">Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="stack stack--sm">
          <TextField label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
          <FormError message={formError} />
          <Button type="submit" loading={pending}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
