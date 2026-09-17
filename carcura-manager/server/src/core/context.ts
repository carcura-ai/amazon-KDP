import type { Permission, Role } from './permissions.js';

/** Mandanten- und Benutzerkontext einer authentifizierten Anfrage. */
export interface Ctx {
  companyId: string;
  userId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  isPlatformAdmin: boolean;
  ip?: string;
}
