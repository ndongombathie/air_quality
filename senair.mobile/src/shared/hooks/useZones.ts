import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

/** Référentiel des zones (partagé par l'accueil, le compte et les préférences). */
export function useZones() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reference.zones(),
    queryFn: () => api.reference.zones(),
    staleTime: 60 * 60_000,
  });
}
