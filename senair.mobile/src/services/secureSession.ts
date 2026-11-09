/**
 * Persistance chiffrée (Keychain iOS / Keystore Android) des seuls éléments durables de session :
 * le refresh token et le jeton push enregistré. Le jeton d'accès reste en mémoire.
 * Aucune valeur n'est journalisée.
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  refreshToken: 'senair.refreshToken',
  pushToken: 'senair.pushToken',
} as const;

type Key = keyof typeof KEYS;

async function read(key: Key): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS[key]);
  } catch {
    return null;
  }
}

async function write(key: Key, value: string | null): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(KEYS[key], value);
    else await SecureStore.deleteItemAsync(KEYS[key]);
  } catch {
    // Stockage sécurisé indisponible (ex. web) : la session ne survivra simplement pas au redémarrage.
  }
}

export const secureSession = {
  getRefreshToken: () => read('refreshToken'),
  setRefreshToken: (token: string | null) => write('refreshToken', token),
  getPushToken: () => read('pushToken'),
  setPushToken: (token: string | null) => write('pushToken', token),
  async clear(): Promise<void> {
    await Promise.all([write('refreshToken', null), write('pushToken', null)]);
  },
};
