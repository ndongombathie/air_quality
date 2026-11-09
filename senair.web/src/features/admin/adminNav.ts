import type { LucideIcon } from 'lucide-react';
import { BarChart3, Bell, Database, Download, FileText, Gauge, LayoutDashboard, Radio, ScrollText, ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { Permission } from '@senair/core';

export const ADMIN_SECTIONS = ['Pilotage', 'Contenus', 'Réseau', 'Gouvernance'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export interface AdminNavItem {
  /** Chemin relatif à /admin ('' = tableau de bord). */
  path: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  section: AdminSection;
}

/** Source unique : alimente la barre latérale (entrées non autorisées masquées), le fil d'Ariane et les gardes de routes. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { path: '', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'admin:access', section: 'Pilotage' },
  { path: 'alertes', label: 'Alertes et incidents', icon: Bell, permission: 'alerts:manage', section: 'Pilotage' },
  { path: 'analytique', label: 'Analytique', icon: BarChart3, permission: 'analytics:read', section: 'Pilotage' },
  { path: 'rapports', label: 'Rapports', icon: FileText, permission: 'reports:read', section: 'Pilotage' },
  { path: 'articles', label: 'Articles', icon: ScrollText, permission: 'articles:manage', section: 'Contenus' },
  { path: 'stations', label: 'Stations', icon: Radio, permission: 'stations:manage', section: 'Réseau' },
  { path: 'seuils', label: 'Seuils', icon: Gauge, permission: 'thresholds:manage', section: 'Réseau' },
  { path: 'sources', label: 'Sources de données', icon: Database, permission: 'sources:manage', section: 'Réseau' },
  { path: 'modeles', label: 'Modèles IA', icon: Sparkles, permission: 'models:manage', section: 'Réseau' },
  { path: 'utilisateurs', label: 'Utilisateurs', icon: Users, permission: 'users:manage', section: 'Gouvernance' },
  { path: 'audit', label: "Journal d'audit", icon: ShieldCheck, permission: 'audit:read', section: 'Gouvernance' },
  { path: 'export', label: 'Export des données', icon: Download, permission: 'data:export_raw', section: 'Gouvernance' },
];

/** Entrée correspondant à un chemin /admin/... (la plus spécifique). */
export function findAdminNavItem(pathname: string): AdminNavItem | null {
  const rest = pathname.replace(/^\/admin\/?/, '');
  const first = rest.split('/')[0] ?? '';
  return ADMIN_NAV.find((item) => item.path === first) ?? null;
}
