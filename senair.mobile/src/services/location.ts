/**
 * Géolocalisation « au premier usage » : la permission n'est demandée que sur action explicite.
 */
import * as Location from 'expo-location';
import type { GeoPoint } from '@senair/core';

export type LocationResult =
  | { status: 'granted'; point: GeoPoint }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string };

const DENIED_MESSAGE =
  "Accès à la position refusé. Vous pouvez l'autoriser dans les réglages du téléphone ; en attendant, l'IQA de la ville est affiché.";

export async function requestCurrentPosition(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied', message: DENIED_MESSAGE };

    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return { status: 'unavailable', message: 'La localisation est désactivée sur cet appareil.' };
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      status: 'granted',
      point: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { status: 'unavailable', message: 'Position introuvable pour le moment. Réessayez dans un instant.' };
  }
}
