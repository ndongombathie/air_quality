import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasPermission, type Me } from '@senair/core';

/** Redirige vers la page demandée avant connexion, sinon vers l'espace adapté au rôle. */
export function useRedirectAfterLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return useCallback(
    (user: Me | null) => {
      const fallback = hasPermission(user, 'admin:access') ? '/admin' : '/mon-espace';
      // Seuls les chemins internes sont acceptés (pas de redirection ouverte).
      const target = from && from.startsWith('/') && !from.startsWith('//') ? from : fallback;
      navigate(target, { replace: true });
    },
    [from, navigate],
  );
}
