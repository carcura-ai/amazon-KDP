export const ROLES = ['admin', 'manager', 'employee', 'accounting', 'readonly'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'dashboard:read',
  'leads:read', 'leads:write',
  'customers:read', 'customers:write', 'customers:delete',
  'vehicles:read', 'vehicles:write',
  'appointments:read', 'appointments:write',
  'orders:read', 'orders:write',
  'offers:read', 'offers:write',
  'invoices:read', 'invoices:write',
  'documents:read', 'documents:write',
  'protocols:read', 'protocols:write',
  'inventory:read', 'inventory:write',
  'finance:read', 'finance:write',
  'marketing:read',
  'reports:read',
  'tasks:read', 'tasks:write',
  'notes:read', 'notes:write',
  'assistant:use',
  'users:manage',
  'settings:manage',
  'integrations:manage',
  'audit:read',
  'backups:manage',
  // Ab Version 0.3 (SaaS-Umbau)
  'invoices:cancel',
  'invoices:export',
  'privacy:manage',
  'export:manage',
  'api:manage',
  'time:read', 'time:write', 'time:manage',
  'subscription:manage',
  'support:grant',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const all = [...PERMISSIONS] as Permission[];
const reads = all.filter((p) => p.endsWith(':read'));
/** Rechte, die nur der Mandanten-Admin standardmäßig hat (Verwaltung, Geheimnisse, Vertrag, Datenschutz). */
export const ADMIN_ONLY: Permission[] = ['users:manage', 'backups:manage', 'integrations:manage', 'api:manage', 'subscription:manage', 'support:grant', 'privacy:manage', 'export:manage'];

/** Standard-Berechtigungen je Rolle. Der Mandanten-Admin kann sie anpassen (role_permissions). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: all,
  manager: all.filter((p) => !ADMIN_ONLY.includes(p)),
  employee: [
    'dashboard:read',
    'leads:read', 'leads:write',
    'customers:read', 'customers:write',
    'vehicles:read', 'vehicles:write',
    'appointments:read', 'appointments:write',
    'orders:read', 'orders:write',
    'offers:read', 'offers:write',
    'documents:read', 'documents:write',
    'protocols:read', 'protocols:write',
    'inventory:read', 'inventory:write',
    'tasks:read', 'tasks:write',
    'notes:read', 'notes:write',
    'time:read', 'time:write',
  ],
  accounting: [
    'dashboard:read',
    'customers:read',
    'orders:read',
    'offers:read',
    'invoices:read', 'invoices:write',
    'documents:read',
    'finance:read', 'finance:write',
    'reports:read',
    'audit:read',
    'invoices:cancel', 'invoices:export',
    'time:read',
  ],
  readonly: reads.filter((p) => p !== 'audit:read' && p !== 'time:read'),
};

/**
 * Rechte, die mit einer Version neu eingeführt wurden. Bestehende Mandanten haben gespeicherte
 * Rollenrechte; beim Start werden neue Standardrechte einmalig ergänzt (nie entfernt), damit
 * Updates keine Funktionen sperren. Siehe core/session.ts → syncNewPermissions.
 */
export const PERMISSION_VERSIONS: Array<{ version: number; permissions: Permission[] }> = [
  { version: 2, permissions: ['invoices:cancel', 'invoices:export', 'privacy:manage', 'export:manage', 'api:manage', 'time:read', 'time:write', 'time:manage', 'subscription:manage', 'support:grant'] },
];

/** Rechte eines System-Admins im Supportzugriff (nie Benutzer, Integrationen, Geheimnisse, Vertrag, Datenschutz, Export). */
export function supportPermissions(mode: 'read' | 'write'): Permission[] {
  if (mode === 'read') return reads.filter((p) => p !== 'audit:read');
  return all.filter((p) => !ADMIN_ONLY.includes(p) && p !== 'assistant:use');
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
