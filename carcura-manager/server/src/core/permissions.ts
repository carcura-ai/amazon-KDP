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
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const all = [...PERMISSIONS] as Permission[];
const reads = all.filter((p) => p.endsWith(':read'));

/** Standard-Berechtigungen je Rolle. Der Mandanten-Admin kann sie anpassen (role_permissions). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: all,
  manager: all.filter((p) => !['users:manage', 'backups:manage', 'integrations:manage'].includes(p)),
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
  ],
  readonly: reads.filter((p) => p !== 'audit:read'),
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
