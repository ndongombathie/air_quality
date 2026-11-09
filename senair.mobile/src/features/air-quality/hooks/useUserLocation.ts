import { useCallback, useState } from 'react';
import type { GeoPoint } from '@senair/core';
import { requestCurrentPosition } from '@/services/location';

export type UserLocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'granted'; point: GeoPoint }
  | { status: 'denied' | 'unavailable'; message: string };

/** Position de l'utilisateur, demandée uniquement sur action (consentement au premier usage). */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ status: 'idle' });

  const locate = useCallback(async () => {
    setState({ status: 'locating' });
    const result = await requestCurrentPosition();
    setState(result.status === 'granted' ? { status: 'granted', point: result.point } : result);
    return result;
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, point: state.status === 'granted' ? state.point : null, locate, reset };
}
