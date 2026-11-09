import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogIn, User } from 'lucide-react';
import { ROLE_LABELS } from '@senair/core';
import { useAuth } from '../../features/auth/AuthProvider';
import { cx } from '../lib/cx';
import { AppShell, SidebarLink, SidebarUser, type ShellSection } from './AppShell';
import { Footer } from './Footer';
import { PUBLIC_NAV, PUBLIC_SECTIONS, findPublicNavItem } from './navigation';

function PageTitle() {
  const { pathname } = useLocation();
  const item = findPublicNavItem(pathname);
  const title = item?.label ?? (pathname.startsWith('/mon-espace') ? 'Mon espace' : pathname.startsWith('/zones') ? 'Quartier' : pathname.startsWith('/stations') ? 'Station' : 'SEN-AIR');
  return <p className="shell-topbar__title">{title}</p>;
}

function AccountFooter({ collapsed }: { collapsed: boolean }) {
  const { status, user, can, logout } = useAuth();
  if (status !== 'authenticated' || !user) {
    return collapsed ? (
      <SidebarLink item={{ to: '/connexion', label: 'Connexion', icon: LogIn }} collapsed />
    ) : (
      <NavLink to="/connexion" className="btn btn--primary btn--block">
        <LogIn size={16} aria-hidden="true" />
        Connexion
      </NavLink>
    );
  }
  return (
    <>
      <SidebarLink item={{ to: '/mon-espace', label: 'Mon espace', icon: User }} collapsed={collapsed} />
      {can('admin:access') && <SidebarLink item={{ to: '/admin', label: 'Administration', icon: LayoutDashboard }} collapsed={collapsed} />}
      <SidebarUser name={user.fullName} role={ROLE_LABELS[user.role]} onLogout={() => void logout()} />
    </>
  );
}

function MobileTabbar() {
  return (
    <nav className="tabbar" aria-label="Navigation mobile">
      {PUBLIC_NAV.filter((item) => item.mobile).map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cx('tabbar__link', isActive && 'is-active')}>
          <item.icon size={20} aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const SECTIONS: ShellSection[] = PUBLIC_SECTIONS.map((section) => ({
  title: section,
  items: PUBLIC_NAV.filter((item) => item.section === section).map((item) => ({ ...item, end: item.to === '/' })),
}));

export function PublicLayout() {
  return (
    <AppShell
      id="public-sidebar"
      label="Navigation principale"
      brandSubtitle="Qualité de l'air"
      sections={SECTIONS}
      collapseKey="senair.public.sidebar-collapsed"
      contentClassName="shell-content--public"
      topbar={<PageTitle />}
      footer={(collapsed) => <AccountFooter collapsed={collapsed} />}
      after={
        <>
          <Footer />
          <MobileTabbar />
        </>
      }
    />
  );
}
