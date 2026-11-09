/**
 * Contrôle d'accès côté client : sert UNIQUEMENT à adapter l'interface.
 * L'autorisation fait foi côté backend, à partir du jeton — jamais d'une valeur envoyée par le client.
 */
export const ROLES = ['citizen', 'authority', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  citizen: 'Citoyen',
  authority: 'Autorité sanitaire',
  admin: 'Administrateur',
};

export const PERMISSIONS = [
  'profile:manage',
  'notifications:manage',
  'admin:access',
  'alerts:manage',
  'articles:manage',
  'reports:read',
  'reports:generate',
  'analytics:read',
  'stations:manage',
  'thresholds:manage',
  'sources:manage',
  'models:manage',
  'users:manage',
  'audit:read',
  'data:export_raw',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CITIZEN: readonly Permission[] = ['profile:manage', 'notifications:manage'];

const AUTHORITY: readonly Permission[] = [
  ...CITIZEN,
  'admin:access',
  'alerts:manage',
  'articles:manage',
  'reports:read',
  'reports:generate',
  'analytics:read',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  citizen: CITIZEN,
  authority: AUTHORITY,
  admin: PERMISSIONS,
};

export interface PermissionSubject {
  role: Role;
  /** Liste renvoyée par `GET /me` ; prioritaire sur le mapping local si présente. */
  permissions?: readonly Permission[];
}

export function hasPermission(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;
  const granted = subject.permissions ?? ROLE_PERMISSIONS[subject.role] ?? [];
  return granted.includes(permission);
}
