import { useCallback, useState } from 'react';
import type { GeoPoint } from '@senair/core';

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'success'; point: GeoPoint; accuracyM: number }
  | { status: 'error'; message: string };

const MESSAGES: Record<number, string> = {
  1: 'Autorisation de localisation refusée.',
  2: 'Position indisponible.',
  3: 'La localisation a pris trop de temps.',
};

/** Géolocalisation à la demande (jamais automatique : action explicite de l'utilisateur). */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: "La géolocalisation n'est pas prise en charge par ce navigateur." });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: 'success',
          // Arrondi ~100 m : suffisant pour l'IQA, limite la précision transmise (minimisation).
          point: {
            latitude: Math.round(position.coords.latitude * 1000) / 1000,
            longitude: Math.round(position.coords.longitude * 1000) / 1000,
          },
          accuracyM: position.coords.accuracy,
        }),
      (error) => setState({ status: 'error', message: MESSAGES[error.code] ?? 'Localisation impossible.' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { state, locate };
}
