import { Bell, HeartPulse, Home, Info, Map, Newspaper, TrendingUp, type LucideIcon } from 'lucide-react';

export const PUBLIC_SECTIONS = ["Qualité de l'air", "S'informer"] as const;
export type PublicSection = (typeof PUBLIC_SECTIONS)[number];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  section: PublicSection;
  /** Visible dans la barre d'onglets mobile (5 entrées max). */
  mobile: boolean;
}

/** Source unique : barre latérale, barre d'onglets mobile et titre de la barre supérieure. */
export const PUBLIC_NAV: readonly NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home, section: "Qualité de l'air", mobile: true },
  { to: '/carte', label: 'Carte', icon: Map, section: "Qualité de l'air", mobile: true },
  { to: '/previsions', label: 'Prévisions', icon: TrendingUp, section: "Qualité de l'air", mobile: false },
  { to: '/alertes', label: 'Alertes', icon: Bell, section: "Qualité de l'air", mobile: true },
  { to: '/sante', label: 'Santé', icon: HeartPulse, section: "S'informer", mobile: true },
  { to: '/articles', label: 'Actualités', icon: Newspaper, section: "S'informer", mobile: false },
  { to: '/infos', label: 'Comprendre', icon: Info, section: "S'informer", mobile: true },
];

/** Entrée de navigation correspondant à un chemin public (la plus spécifique). */
export function findPublicNavItem(pathname: string): NavItem | null {
  if (pathname === '/') return PUBLIC_NAV[0] ?? null;
  return PUBLIC_NAV.filter((item) => item.to !== '/' && pathname.startsWith(item.to)).sort((a, b) => b.to.length - a.to.length)[0] ?? null;
}
