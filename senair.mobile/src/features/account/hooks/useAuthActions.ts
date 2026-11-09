import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, ProfileUpdate, RegisterRequest } from '@senair/core';
import { useApi, useSessionManager } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';
import { secureSession } from '@/services/secureSession';

export type LoginOutcome = { kind: 'signedIn' } | { kind: 'mfa'; challengeId: string };

export function useLogin() {
  const api = useApi();
  const session = useSessionManager();
  return useMutation({
    mutationFn: async (request: LoginRequest): Promise<LoginOutcome> => {
      const response = await api.auth.login(request);
      if ('mfaRequired' in response) return { kind: 'mfa', challengeId: response.challengeId };
      await session.signIn(response);
      return { kind: 'signedIn' };
    },
  });
}

export function useVerifyMfa() {
  const api = useApi();
  const session = useSessionManager();
  return useMutation({
    mutationFn: async (request: { challengeId: string; otp: string }) => session.signIn(await api.auth.verifyMfa(request)),
  });
}

export function useRegister() {
  const api = useApi();
  const session = useSessionManager();
  return useMutation({
    mutationFn: async (request: RegisterRequest) => session.signIn(await api.auth.register(request)),
  });
}

export function useUpdateProfile() {
  const api = useApi();
  const session = useSessionManager();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => api.account.updateProfile(update),
    onSuccess: (me) => session.setUser(me),
  });
}

/** Retire le jeton push du compte (best effort) avant de quitter la session. */
async function unregisterPush(unregister: (token: string) => Promise<void>): Promise<void> {
  const token = await secureSession.getPushToken();
  if (!token) return;
  try {
    await unregister(token);
  } catch {
    // Le backend expirera le jeton ; on n'empêche pas la déconnexion.
  }
}

export function useSignOut() {
  const api = useApi();
  const session = useSessionManager();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await unregisterPush((token) => api.account.unregisterDevice(token));
      await session.signOut();
    },
    onSettled: () =>
      queryClient.removeQueries({
        queryKey: queryKeys.account.me().slice(0, 1),
      }),
  });
}

export function useDeleteAccount() {
  const api = useApi();
  const session = useSessionManager();
  return useMutation({
    mutationFn: async () => {
      await unregisterPush((token) => api.account.unregisterDevice(token));
      await api.account.deleteAccount();
      await session.purge();
    },
  });
}
