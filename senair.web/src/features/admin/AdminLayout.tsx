import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ROLE_LABELS } from '@senair/core';
import { AppShell, SidebarLink, SidebarUser, type ShellSection } from '../../shared/layout/AppShell';
import { useAuth } from '../auth/AuthProvider';
import { ADMIN_NAV, ADMIN_SECTIONS, findAdminNavItem } from './adminNav';

function Breadcrumb() {
  const { pathname } = useLocation();
  const item = findAdminNavItem(pathname);
  const editor = /^\/admin\/articles\/.+/.test(pathname) ? (pathname.endsWith('/nouveau') ? 'Nouvel article' : "Modifier l'article") : null;
  const crumbs: { label: string; to?: string }[] = [{ label: 'Administration', to: '/admin' }];
  if (!item || item.path === '') crumbs.push({ label: 'Tableau de bord' });
  else if (editor) crumbs.push({ label: item.label, to: `/admin/${item.path}` }, { label: editor });
  else crumbs.push({ label: item.label });
  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.label}>
            {crumb.to && index < crumbs.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminLayout() {
  const { user, can, logout } = useAuth();
  const sections: ShellSection[] = ADMIN_SECTIONS.map((section) => ({
    title: section,
    items: ADMIN_NAV.filter((item) => item.section === section && can(item.permission)).map((item) => ({
      to: item.path ? `/admin/${item.path}` : '/admin',
      label: item.label,
      icon: item.icon,
      end: item.path === '',
    })),
  }));

  return (
    <AppShell
      id="admin-sidebar"
      label="Menu d'administration"
      brandSubtitle="Administration"
      sections={sections}
      collapseKey="senair.admin.sidebar-collapsed"
      topbar={<Breadcrumb />}
      footer={(collapsed) => (
        <>
          <SidebarLink item={{ to: '/', label: 'Voir le site public', icon: ExternalLink }} collapsed={collapsed} />
          {user && <SidebarUser name={user.fullName} role={ROLE_LABELS[user.role]} onLogout={() => void logout()} />}
        </>
      )}
    />
  );
}
