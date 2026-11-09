import { useCallback, useRef, useState } from 'react';

type Refetcher = (() => Promise<unknown>) | null | false | undefined;

/**
 * Pull-to-refresh : déclenche les `refetch` fournis (les requêtes désactivées sont passées
 * à `null`/`false`) et expose l'état du geste.
 */
export function useRefresh(...refetchers: Refetcher[]) {
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(refetchers);
  latest.current = refetchers;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const active = latest.current.filter((r): r is () => Promise<unknown> => typeof r === 'function');
      await Promise.allSettled(active.map((refetch) => refetch()));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
