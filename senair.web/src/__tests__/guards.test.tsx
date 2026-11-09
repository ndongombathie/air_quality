import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hasPermission, type Me, type Role } from '@senair/core';
import { AuthContext, type AuthContextValue, type AuthStatus } from '../features/auth/AuthProvider';
import { RequireAuth, RequirePermission } from '../features/auth/guards';
import { ADMIN_NAV } from '../features/admin/adminNav';

function authValue(status: AuthStatus, role: Role | null): AuthContextValue {
  const user = role ? ({ id: 'u', role, fullName: 'Test', email: 't@senair.sn' } as Me) : null;
  const reject = () => Promise.reject(new Error('non utilisé'));
  return {
    status,
    user,
    login: reject,
    verifyMfa: reject,
    register: reject,
    logout: () => Promise.resolve(),
    updateUser: () => undefined,
    can: (permission) => hasPermission(user, permission),
  };
}

function render(value: AuthContextValue, element: ReactNode) {
  return renderToString(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/admin/seuils']}>{element}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

const SECRET = <p>contenu-protégé</p>;

describe('RequirePermission', () => {
  it("affiche le contenu quand l'utilisateur a la permission", () => {
    expect(render(authValue('authenticated', 'admin'), <RequirePermission permission="thresholds:manage">{SECRET}</RequirePermission>)).toContain('contenu-protégé');
  });

  it("refuse l'accès à une autorité pour une permission réservée à l'admin", () => {
    const html = render(authValue('authenticated', 'authority'), <RequirePermission permission="thresholds:manage">{SECRET}</RequirePermission>);
    expect(html).not.toContain('contenu-protégé');
    expect(html).toContain('Accès refusé');
  });

  it("n'affiche rien de protégé pendant la vérification de session ni pour un visiteur", () => {
    expect(render(authValue('loading', null), <RequirePermission permission="admin:access">{SECRET}</RequirePermission>)).toContain('Vérification');
    expect(render(authValue('anonymous', null), <RequirePermission permission="admin:access">{SECRET}</RequirePermission>)).not.toContain('contenu-protégé');
  });
});

describe('RequireAuth', () => {
  it('protège mon espace des visiteurs anonymes', () => {
    expect(render(authValue('anonymous', null), <RequireAuth>{SECRET}</RequireAuth>)).not.toContain('contenu-protégé');
    expect(render(authValue('authenticated', 'citizen'), <RequireAuth>{SECRET}</RequireAuth>)).toContain('contenu-protégé');
  });
});

describe('menu administrateur', () => {
  const visible = (role: Role) => ADMIN_NAV.filter((item) => hasPermission({ role }, item.permission)).map((item) => item.path);

  it("masque à l'autorité les entrées réservées à l'admin", () => {
    const paths = visible('authority');
    expect(paths).toEqual(expect.arrayContaining(['', 'alertes', 'articles', 'rapports', 'analytique']));
    for (const adminOnly of ['stations', 'seuils', 'sources', 'modeles', 'utilisateurs', 'audit', 'export']) expect(paths).not.toContain(adminOnly);
  });

  it("donne tout le menu à l'admin et rien au citoyen", () => {
    expect(visible('admin')).toHaveLength(ADMIN_NAV.length);
    expect(visible('citizen')).toHaveLength(0);
  });
});
