import { skipToken, useQuery } from '@tanstack/react-query';
import type { AqiLevel, HealthProfileId } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

/** Recommandations validées côté backend pour un profil et un niveau d'IQA. */
export function useHealthGuidance(profile: HealthProfileId, level: AqiLevel | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reference.healthGuidance(profile, level),
    queryFn: level ? () => api.reference.healthGuidance({ profile, level }) : skipToken,
    staleTime: 60 * 60_000,
  });
}
