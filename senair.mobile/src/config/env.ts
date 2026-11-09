import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { ApiMode } from '@senair/core';

/**
 * Configuration publique lue à la compilation (variables EXPO_PUBLIC_*, intégrées au bundle).
 * Aucun secret ne doit transiter par ici.
 * Les accès `process.env.EXPO_PUBLIC_X` doivent rester littéraux pour être remplacés par Metro.
 */
function parseMode(value: string | undefined): ApiMode {
  return value === 'rest' ? 'rest' : 'mock';
}

/**
 * Sans EXPO_PUBLIC_API_BASE_URL : l'API tourne sur l'ordinateur qui sert Expo (même adresse, port 8000).
 * Évite l'adresse 10.0.2.2, propre à l'émulateur Android, injoignable depuis un téléphone ou le navigateur.
 */
function devApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8000/api/v1` : 'http://10.0.2.2:8000/api/v1';
}

export const ENV = {
  apiMode: parseMode(process.env.EXPO_PUBLIC_API_MODE),
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || devApiUrl(),
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? null,
  /** Développement uniquement (mode mock) : ajoute des photos et une vidéo publiques aux articles de démo. */
  demoMedia: process.env.EXPO_PUBLIC_DEMO_MEDIA === '1',
} as const;
