import { useQuery } from '@tanstack/react-query';
import type { HealthProfileId } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useHealthGuidance(profile: HealthProfileId) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reference.healthGuidance(profile),
    queryFn: () => api.reference.healthGuidance({ profile }),
    staleTime: 60 * 60_000,
  });
}
