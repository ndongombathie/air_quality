import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permission } from '@senair/core';
import { LoadingState } from '../../shared/ui/QueryState';
import { useAuth } from './AuthProvider';

/**
 * Gardes de navigation : simple confort d'interface. L'autorisation fait foi côté serveur
 * (chaque appel /me et /admin est revérifié à partir du jeton).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Vérification de la session…" />;
  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { status, can } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Vérification des droits…" />;
  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (!can(permission)) return <ForbiddenState />;
  return <>{children}</>;
}

export function ForbiddenState() {
  return (
    <div className="state state--error" role="alert">
      <h1 className="h3">Accès refusé</h1>
      <p>Vous n'avez pas les droits nécessaires pour afficher cette page.</p>
    </div>
  );
}
