import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences } from '@senair/core';
import { useApi, useSession } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';
import { registerForPush } from '@/services/push';
import { secureSession } from '@/services/secureSession';

export function useNotificationPreferences() {
  const api = useApi();
  const { status } = useSession();
  return useQuery({
    queryKey: queryKeys.account.notificationPreferences(),
    queryFn: () => api.account.notificationPreferences(),
    enabled: status === 'authenticated',
  });
}

export interface SavePreferencesResult {
  preferences: NotificationPreferences;
  /** Message à afficher si l'activation push n'a pas abouti (permission, simulateur, EAS…). */
  pushNotice: string | null;
}

/**
 * Enregistre les préférences. La permission push n'est demandée QUE si l'utilisateur active le push ;
 * la désactivation retire le jeton du compte.
 */
export function useSaveNotificationPreferences() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (next: NotificationPreferences): Promise<SavePreferencesResult> => {
      let pushNotice: string | null = null;
      const storedToken = await secureSession.getPushToken();

      if (next.pushEnabled && !storedToken) {
        const registration = await registerForPush();
        if (registration.ok) {
          await api.account.registerDevice(registration.device);
          await secureSession.setPushToken(registration.device.token);
        } else {
          pushNotice = registration.message;
        }
      } else if (!next.pushEnabled && storedToken) {
        try {
          await api.account.unregisterDevice(storedToken);
        } finally {
          await secureSession.setPushToken(null);
        }
      }

      const preferences = await api.account.updateNotificationPreferences(next);
      return { preferences, pushNotice };
    },
    onSuccess: ({ preferences }) => queryClient.setQueryData(queryKeys.account.notificationPreferences(), preferences),
  });
}
