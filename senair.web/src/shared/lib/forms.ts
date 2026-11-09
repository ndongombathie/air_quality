import { fieldErrorsOf, isApiError } from '@senair/core';

export type FieldErrors = Record<string, string>;

type ZodLikeError = Parameters<typeof fieldErrorsOf>[0];

/** Forme minimale d'un schéma zod exporté par @senair/core (évite une dépendance directe à zod). */
export interface ParseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodLikeError };
}

/** Valide avec zod ; retourne les données ou les erreurs par champ. */
export function validate<T>(schema: ParseSchema<T>, value: unknown): { data: T; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(value);
  return result.success ? { data: result.data, errors: null } : { data: null, errors: fieldErrorsOf(result.error) };
}

/** Erreurs par champ renvoyées par le serveur (`ApiError.fieldErrors`). */
export function serverFieldErrors(error: unknown): FieldErrors {
  return isApiError(error) ? error.fieldErrors : {};
}
