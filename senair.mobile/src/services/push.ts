/**
 * Notifications push. La permission n'est JAMAIS demandée au démarrage :
 * uniquement quand l'utilisateur active les notifications dans ses préférences.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DeviceRegistration } from '@senair/core';
import { ENV } from '@/config/env';

export type PushRegistrationResult =
  | { ok: true; device: DeviceRegistration }
  | { ok: false; reason: 'not_device' | 'denied' | 'no_project' | 'unsupported' | 'error'; message: string };

const ANDROID_CHANNEL_ID = 'alertes-qualite-air';

/** Comportement des notifications reçues app ouverte (appelé une fois au démarrage, sans permission). */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function resolveProjectId(): string | null {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === 'string' && fromEas) return fromEas;
  return ENV.easProjectId;
}

export async function registerForPush(): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, reason: 'unsupported', message: 'Les notifications push ne sont disponibles que sur iOS et Android.' };
  }
  if (!Device.isDevice) {
    return {
      ok: false,
      reason: 'not_device',
      message: 'Les notifications push nécessitent un appareil physique (indisponibles sur simulateur ou émulateur).',
    };
  }
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Alertes qualité de l’air',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Notifications refusées. Vous pouvez les autoriser dans les réglages du téléphone.',
      };
    }
    const projectId = resolveProjectId();
    if (!projectId) {
      return {
        ok: false,
        reason: 'no_project',
        message:
          "Notifications push non configurées pour cette version de l'application (identifiant de projet EAS manquant). Vos préférences sont tout de même enregistrées.",
      };
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, device: { token: data, platform: Platform.OS } };
  } catch {
    return { ok: false, reason: 'error', message: "Impossible d'activer les notifications sur cet appareil pour le moment." };
  }
}
