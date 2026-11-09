/**
 * Validation des saisies côté client (ergonomie). Le backend revalide systématiquement.
 */
import { z } from 'zod';
import { AQI_LEVEL_IDS } from '../domain/aqi';
import { HEALTH_PROFILE_IDS } from '../domain/health';
import { POLLUTANT_CODES } from '../domain/pollutants';
import { ROLES } from '../auth/permissions';

const email = z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(254);

/** 10 caractères minimum, au moins une lettre et un chiffre. */
export const passwordSchema = z
  .string()
  .min(10, '10 caractères minimum')
  .max(128)
  .regex(/[A-Za-z]/, 'Au moins une lettre')
  .regex(/\d/, 'Au moins un chiffre');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

export const otpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres') });

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Nom trop court').max(120),
    email,
    password: passwordSchema,
    passwordConfirm: z.string(),
    zoneIds: z.array(z.string()).max(5, '5 zones maximum'),
    healthProfile: z.enum(HEALTH_PROFILE_IDS).nullable(),
    acceptTerms: z.literal(true, { error: 'Vous devez accepter les conditions' }),
    acceptHealthData: z.boolean(),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'Les mots de passe diffèrent' });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'Les mots de passe diffèrent' });

export const articleSchema = z.object({
  title: z.string().trim().min(5, '5 caractères minimum').max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement')
    .max(80)
    .optional()
    .or(z.literal('')),
  excerpt: z.string().trim().min(10, '10 caractères minimum').max(300),
  content: z.string().trim().min(20, '20 caractères minimum').max(50_000),
  category: z.enum(['alert', 'info', 'report', 'regulation', 'event', 'education']),
  status: z.enum(['draft', 'published', 'archived']),
  featured: z.boolean(),
  coverImageUrl: z.string().trim().url('URL invalide').startsWith('https://', 'HTTPS requis').nullable(),
  mediaIds: z.array(z.string()).max(10, '10 médias maximum'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
});

export const thresholdSchema = z.object({
  pollutant: z.enum(POLLUTANT_CODES),
  reference: z.enum(['WHO_2021', 'NS_05_062']),
  period: z.enum(['1h', '8h', '24h', '1y']),
  value: z.number({ error: 'Nombre requis' }).positive('Doit être positif').max(100_000),
  unit: z.enum(['µg/m³', 'mg/m³', 'ppm', 'ppb', 'index']),
  zoneId: z.string().nullable(),
  alertLevel: z.enum(AQI_LEVEL_IDS),
  enabled: z.boolean(),
});

export const userInviteSchema = z.object({
  email,
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
});

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  zoneIds: z.array(z.string()).max(5),
  minLevel: z.enum(AQI_LEVEL_IDS),
  pollutants: z.array(z.enum(POLLUTANT_CODES)).min(1, 'Choisissez au moins un polluant'),
  quietHours: z
    .object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
    .nullable(),
});

/** Convertit une erreur zod en `{ champ: message }` pour les formulaires. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    out[key] ??= issue.message;
  }
  return out;
}
