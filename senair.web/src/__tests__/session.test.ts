import { describe, expect, it, vi } from 'vitest';
import { MOCK_OTP, MOCK_PASSWORD } from '@senair/core';
import { createSessionStore } from '../features/auth/session';
import { createAppApi } from '../app/api';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('session (navigateur)', () => {
  it("ne persiste rien hors mode mock : le jeton d'accès reste en mémoire", async () => {
    const storage = memoryStorage();
    const session = createSessionStore({ persistMockRefreshToken: false, storage });
    const api = createAppApi({ apiMode: 'mock', apiBaseUrl: 'http://localhost' }, session);
    const response = await api.auth.login({ email: 'citoyen@senair.sn', password: MOCK_PASSWORD });
    if ('mfaRequired' in response) throw new Error('MFA inattendue');
    session.set(response);
    expect(session.getAccessToken()).toBe(response.accessToken);
    expect(storage.data.size).toBe(0);
    expect(session.getStoredRefreshToken()).toBeNull();
  });

  it('mode mock : conserve uniquement le refresh token et le purge à la déconnexion', async () => {
    const storage = memoryStorage();
    const session = createSessionStore({ persistMockRefreshToken: true, storage });
    const api = createAppApi({ apiMode: 'mock', apiBaseUrl: 'http://localhost' }, session);
    const challenge = await api.auth.login({ email: 'admin@senair.sn', password: MOCK_PASSWORD });
    expect('mfaRequired' in challenge).toBe(true);
    if (!('mfaRequired' in challenge)) return;
    const next = await api.auth.verifyMfa({ challengeId: challenge.challengeId, otp: MOCK_OTP });
    session.set(next);

    const stored = session.getStoredRefreshToken();
    expect(stored).toBe(next.refreshToken);
    expect([...storage.data.values()]).not.toContain(next.accessToken);

    // Rechargement simulé : nouvelle mémoire, restauration via le refresh token.
    const reloaded = createSessionStore({ persistMockRefreshToken: true, storage });
    const restoredApi = createAppApi({ apiMode: 'mock', apiBaseUrl: 'http://localhost' }, reloaded);
    reloaded.set(await restoredApi.auth.refresh(reloaded.getStoredRefreshToken() ?? undefined));
    expect(reloaded.getUser()?.role).toBe('admin');
    await expect(restoredApi.admin.dashboard()).resolves.toHaveProperty('stations');

    const listener = vi.fn();
    reloaded.subscribe(listener);
    reloaded.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reloaded.getAccessToken()).toBeNull();
    expect(storage.data.size).toBe(0);
    await expect(restoredApi.admin.dashboard()).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
