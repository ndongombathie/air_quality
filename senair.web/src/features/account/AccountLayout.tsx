import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ROLE_LABELS } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { LoadingState } from '../../shared/ui/QueryState';
import { cx } from '../../shared/lib/cx';
import { useAuth } from '../auth/AuthProvider';

const LINKS = [
  { to: '/mon-espace', label: 'Ma zone', end: true },
  { to: '/mon-espace/alertes', label: 'Mes alertes', end: false },
  { to: '/mon-espace/notifications', label: 'Notifications', end: false },
  { to: '/mon-espace/profil', label: 'Profil et santé', end: false },
];

export function AccountLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="stack">
      <header className="account-header">
        <div>
          <p className="muted small">Mon espace</p>
          <p className="h3">{user?.fullName}</p>
          <p className="muted small">{user ? ROLE_LABELS[user.role] : ''}</p>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void logout()}>
          Déconnexion
        </Button>
      </header>
      <nav className="subnav" aria-label="Mon espace">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cx('subnav__link', isActive && 'is-active')}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
