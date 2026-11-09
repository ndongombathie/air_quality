import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { HEALTH_PROFILE_IDS, HEALTH_PROFILES, toUserMessage, type HealthProfileId, type Me, type ProfileUpdate } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CheckboxGroup, SelectField, TextField } from '../../shared/ui/Field';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { serverFieldErrors, type FieldErrors } from '../../shared/lib/forms';
import { useAuth } from '../auth/AuthProvider';
import { useZones } from '../air-quality/hooks';
import { MedicalDisclaimer } from '../health/HealthPage';

/** Règles alignées sur registerSchema (non réutilisable tel quel car raffiné) ; voir recommandations core. */
function validateProfile(values: Required<ProfileUpdate>): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.fullName.trim();
  if (name.length < 2) errors.fullName = 'Nom trop court';
  if (name.length > 120) errors.fullName = '120 caractères maximum';
  if (values.zoneIds.length > 5) errors.zoneIds = '5 zones maximum';
  return errors;
}

function ProfileForm({ user }: { user: Me }) {
  const api = useApi();
  const { updateUser } = useAuth();
  const zones = useZones();
  const [values, setValues] = useState<Required<ProfileUpdate>>({
    fullName: user.fullName,
    zoneIds: user.zoneIds,
    healthProfile: user.healthProfile,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useFeedbackMutation({
    mutationFn: (update: ProfileUpdate) => api.account.updateProfile(update),
    invalidate: [queryKeys.account.all],
    successMessage: 'Profil mis à jour.',
    onSuccess: (me) => updateUser(me),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateProfile(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    mutation.mutate({ ...values, fullName: values.fullName.trim() }, { onError: (error) => setErrors(serverFieldErrors(error)) });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <Card title="Identité">
        <TextField label="Nom complet" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} error={errors.fullName} required />
        <TextField label="Adresse e-mail" value={user.email} readOnly disabled hint="Contactez un administrateur pour modifier votre e-mail." />
      </Card>
      <Card title="Zones suivies">
        <CheckboxGroup
          legend="Zones (5 maximum)"
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          value={values.zoneIds}
          onChange={(zoneIds) => setValues({ ...values, zoneIds })}
          error={errors.zoneIds}
        />
      </Card>
      <Card title="Profil santé">
        <p className="small muted">
          Donnée sensible, utilisée uniquement pour personnaliser vos recommandations. Choisissez « Ne pas renseigner » pour la retirer.
        </p>
        <SelectField
          label="Profil"
          value={values.healthProfile ?? ''}
          placeholder="Ne pas renseigner"
          options={HEALTH_PROFILE_IDS.map((id) => ({ value: id, label: HEALTH_PROFILES[id].label }))}
          onChange={(e) => setValues({ ...values, healthProfile: (e.target.value || null) as HealthProfileId | null })}
          error={errors.healthProfile}
        />
        <MedicalDisclaimer />
      </Card>
      <div>
        <Button type="submit" loading={mutation.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const api = useApi();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await api.account.deleteAccount();
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setPending(false);
    }
  };

  return (
    <Card title="Supprimer mon compte">
      <p>La suppression efface votre profil, vos zones, votre profil santé et vos préférences. Cette action est définitive.</p>
      <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
      <Modal
        open={open}
        title="Confirmer la suppression"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" disabled={confirm !== 'SUPPRIMER'} loading={pending} onClick={() => void onDelete()}>
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <TextField label="Tapez SUPPRIMER pour confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        {error && <p className="form-error" role="alert">{error}</p>}
      </Modal>
    </Card>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="stack">
      <PageHeader title="Profil et santé" />
      <ProfileForm user={user} />
      <DeleteAccount />
    </div>
  );
}
