import { isApiError, toUserMessage } from '@senair/core';

/** Erreurs serveur : champs (422 `details.fields`) + message global sans détail technique. */
export function serverErrors(error: unknown): {
  fields: Record<string, string>;
  form: string;
} {
  return {
    fields: isApiError(error) ? error.fieldErrors : {},
    form: toUserMessage(error),
  };
}
