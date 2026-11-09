import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { formatRelativeTime, ROLE_LABELS, ROLES, toUserMessage, userInviteSchema, type Role, type User, type UserInvite, type UserUpdate } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Button } from '../../shared/ui/Button';
import { DataTable } from '../../shared/ui/DataTable';
import { SelectField, TextField } from '../../shared/ui/Field';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { serverFieldErrors, validate, type FieldErrors } from '../../shared/lib/forms';
import { USER_STATUS_LABELS, optionsOf } from '../../shared/lib/labels';
import { useAuth } from '../auth/AuthProvider';
import { useUsers } from './hooks';

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApi();
  const [values, setValues] = useState<UserInvite>({ email: '', fullName: '', role: 'authority' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const invite = useFeedbackMutation({
    mutationFn: (input: UserInvite) => api.admin.inviteUser(input),
    invalidate: [queryKeys.admin.usersAll, queryKeys.admin.dashboard],
    successMessage: (user) => `Invitation envoyée à ${user.email}.`,
    onSuccess: () => {
      setValues({ email: '', fullName: '', role: 'authority' });
      onClose();
    },
    silentError: true,
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(userInviteSchema, values);
    setErrors(result.errors ?? {});
    setFormError(null);
    if (!result.data) return;
    invite.mutate(result.data, {
      onError: (error) => {
        const fields = serverFieldErrors(error);
        setErrors(fields);
        if (!Object.keys(fields).length) setFormError(toUserMessage(error));
      },
    });
  };

  return (
    <Modal open={open} title="Inviter un utilisateur" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="stack stack--sm">
        <TextField label="Nom complet" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} error={errors.fullName} required />
        <TextField label="Adresse e-mail" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} required />
        <SelectField label="Rôle" value={values.role} options={ROLE_OPTIONS} onChange={(e) => setValues({ ...values, role: e.target.value as Role })} error={errors.role} />
        <p className="small muted">Les rôles Autorité et Administrateur exigent l'activation de la double authentification à la première connexion.</p>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="row row--end">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={invite.isPending}>
            Envoyer l'invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const api = useApi();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [inviting, setInviting] = useState(false);
  const term = useDebouncedValue(search.trim());
  const query = useUsers({ ...(term ? { search: term } : {}), ...(role ? { role } : {}) });
  const update = useFeedbackMutation({
    mutationFn: ({ id, change }: { id: string; change: UserUpdate }) => api.admin.updateUser(id, change),
    invalidate: [queryKeys.admin.usersAll, queryKeys.admin.auditAll],
    successMessage: (user) => `${user.fullName} : ${ROLE_LABELS[user.role]}, ${USER_STATUS_LABELS[user.status].toLowerCase()}.`,
  });

  return (
    <div className="stack">
      <PageHeader
        title="Utilisateurs et rôles"
        actions={
          <Button icon={<UserPlus size={16} aria-hidden="true" />} onClick={() => setInviting(true)}>
            Inviter
          </Button>
        }
      />
      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField label="Rechercher (nom, e-mail)" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Rôle" value={role} placeholder="Tous" options={ROLE_OPTIONS} onChange={(e) => setRole(e.target.value as Role | '')} />
      </form>
      <QueryState query={query} isEmpty={(page) => page.items.length === 0} emptyMessage="Aucun utilisateur trouvé.">
        {(page) => (
          <DataTable<User>
            caption="Utilisateurs"
            rows={page.items}
            rowKey={(u) => u.id}
            columns={[
              {
                key: 'name',
                header: 'Utilisateur',
                render: (u) => (
                  <>
                    <span className="strong">{u.fullName}</span>
                    <br />
                    <span className="small muted">{u.email}</span>
                  </>
                ),
              },
              {
                key: 'role',
                header: 'Rôle',
                render: (u) => (
                  <SelectField
                    label={<span className="sr-only">Rôle de {u.fullName}</span>}
                    value={u.role}
                    options={ROLE_OPTIONS}
                    disabled={u.id === me?.id || update.isPending}
                    onChange={(e) => update.mutate({ id: u.id, change: { role: e.target.value as Role } })}
                  />
                ),
              },
              {
                key: 'status',
                header: 'Statut',
                render: (u) => (
                  <SelectField
                    label={<span className="sr-only">Statut de {u.fullName}</span>}
                    value={u.status}
                    options={optionsOf(USER_STATUS_LABELS)}
                    disabled={u.id === me?.id || update.isPending}
                    onChange={(e) => update.mutate({ id: u.id, change: { status: e.target.value as User['status'] } })}
                  />
                ),
              },
              { key: 'mfa', header: 'MFA', render: (u) => (u.mfaEnabled ? 'Activée' : 'Non') },
              { key: 'last', header: 'Dernière connexion', render: (u) => formatRelativeTime(u.lastLoginAt) },
            ]}
          />
        )}
      </QueryState>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
