import { useMemo } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import type { HistoryQuery } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys, type HistoryScope } from '@/shared/api/queryKeys';

export type HistoryRange = '24h' | '7d';

const HOUR = 3_600_000;

export const HISTORY_RANGES: Record<HistoryRange, { label: string; hours: number; granularity: HistoryQuery['granularity'] }> = {
  '24h': { label: '24 h', hours: 24, granularity: 'hour' },
  '7d': { label: '7 jours', hours: 24 * 7, granularity: 'day' },
};

/** Fenêtre alignée sur l'heure : clé de cache stable entre deux rendus. */
function windowFor(range: HistoryRange): HistoryQuery {
  const to = Math.ceil(Date.now() / HOUR) * HOUR;
  const { hours, granularity } = HISTORY_RANGES[range];
  return { from: new Date(to - hours * HOUR).toISOString(), to: new Date(to).toISOString(), granularity };
}

export function useHistory(scope: HistoryScope | null, range: HistoryRange) {
  const api = useApi();
  const hourBucket = Math.ceil(Date.now() / HOUR);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const query = useMemo(() => windowFor(range), [range, hourBucket]);
  return useQuery({
    queryKey: scope ? queryKeys.airQuality.history(scope, query) : ['airQuality', 'history', 'none'],
    queryFn: scope
      ? () => {
          if (scope.kind === 'city') return api.airQuality.cityHistory(query);
          return scope.kind === 'station' ? api.stations.history(scope.id, query) : api.airQuality.zoneHistory(scope.id, query);
        }
      : skipToken,
  });
}
