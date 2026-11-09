import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toUserMessage } from '@senair/core';
import { useToast } from '../ui/Toast';

interface FeedbackMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Préfixes de clés à invalider après succès (invalidation ciblée). */
  invalidate: readonly QueryKey[];
  successMessage: string | ((data: TData, variables: TVariables) => string);
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Laisse l'appelant afficher les erreurs (ex. erreurs par champ dans un formulaire). */
  silentError?: boolean;
}

/** Mutation avec invalidation ciblée et retour utilisateur (toast succès / erreur). */
export function useFeedbackMutation<TVariables, TData = unknown>(options: FeedbackMutationOptions<TVariables, TData>) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      const message = typeof options.successMessage === 'function' ? options.successMessage(data, variables) : options.successMessage;
      notify(message, 'success');
      options.onSuccess?.(data, variables);
    },
    onError: (error) => {
      if (!options.silentError) notify(toUserMessage(error), 'error');
    },
  });
}
