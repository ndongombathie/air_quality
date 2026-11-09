import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react';
import { GlobalDataBanners } from '../ui/DataStatusBanner';
import { LoadingState } from '../ui/QueryState';
import { cx } from '../lib/cx';
import { Logo } from './Logo';
import { SkipLink } from './SkipLink';
import { ScrollToTop } from './ScrollToTop';

export interface ShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance exacte (accueil, tableau de bord). */
  end?: boolean;
}

export interface ShellSection {
  title: string;
  items: readonly ShellNavItem[];
}

interface AppShellProps {
  /** Identifiant de la barre latérale (aria-controls du bouton menu). */
  id: string;
  label: string;
  brandSubtitle: string;
  sections: readonly ShellSection[];
  /** Préférence « menu replié », mémorisée par espace (public / admin). */
  collapseKey: string;
  footer: (collapsed: boolean) => ReactNode;
  topbar: ReactNode;
  /** Contenu rendu après la page (pied de page, barre d'onglets mobile). */
  after?: ReactNode;
  contentClassName?: string;
}

/** Simple préférence d'affichage : localStorage peut être indisponible (navigation privée). */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* préférence non mémorisée */
  }
}

/** Mise en page commune : barre latérale (repliable sur desktop, tiroir sous 1024 px) + barre supérieure + contenu. */
export function AppShell({ id, label, brandSubtitle, sections, collapseKey, footer, topbar, after, contentClassName }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readFlag(collapseKey));
  const { pathname } = useLocation();

  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      writeFlag(collapseKey, !value);
      return !value;
    });
  };

  return (
    <div className={cx('shell', collapsed && 'shell--collapsed')}>
      <ScrollToTop />
      <SkipLink />
      {drawerOpen && <div className="shell-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside id={id} className={cx('sidebar', drawerOpen && 'is-open')} aria-label={label}>
        <div className="sidebar__brand">
          <Logo subtitle={brandSubtitle} />
          <button
            type="button"
            className="icon-btn sidebar__collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn sidebar__close" onClick={() => setDrawerOpen(false)} aria-label="Fermer le menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label={label}>
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title} className="sidebar__group" role="group" aria-label={section.title}>
                <p className="sidebar__section" aria-hidden="true">
                  {section.title}
                </p>
                {section.items.map((item) => (
                  <SidebarLink key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            ))}
        </nav>
        <div className="sidebar__footer">{footer(collapsed)}</div>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <button
            type="button"
            className="icon-btn shell-topbar__menu"
            aria-label="Ouvrir le menu"
            aria-expanded={drawerOpen}
            aria-controls={id}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          {topbar}
        </header>
        <GlobalDataBanners />
        <main id="contenu" className={cx('shell-content', contentClassName)} tabIndex={-1}>
          <Suspense fallback={<LoadingState block />}>
            <Outlet />
          </Suspense>
        </main>
        {after}
      </div>
    </div>
  );
}

export function SidebarLink({ item, collapsed }: { item: ShellNavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cx('sidebar__link', isActive && 'is-active')}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <item.icon size={18} aria-hidden="true" />
      <span className="sidebar__label">{item.label}</span>
    </NavLink>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function SidebarUser({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  return (
    <div className="sidebar__user">
      <span className="avatar" aria-hidden="true">
        {initials(name)}
      </span>
      <div className="sidebar__user-info">
        <p className="small strong">{name}</p>
        <p className="caption">{role}</p>
      </div>
      <button type="button" className="icon-btn" aria-label="Se déconnecter" title="Se déconnecter" onClick={onLogout}>
        <LogOut size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
