import { useMemo } from 'react';
import { ENV } from '@/config/env';
import { useApi } from '@/shared/api/AppProviders';
import { originOf, type MediaTrust } from './mediaRules';

/** Sources de médias acceptées pour la session en cours (voir `isSafeMediaUrl`). */
export function useMediaTrust(): MediaTrust {
  const { isMock } = useApi();
  return useMemo(
    () => ({
      allowLocal: isMock,
      apiOrigin: isMock ? null : originOf(ENV.apiBaseUrl),
    }),
    [isMock],
  );
}
