import type { Permission, Role } from './permissions.js';

/** Mandanten- und Benutzerkontext einer authentifizierten Anfrage. */
export interface Ctx {
  companyId: string;
  userId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  isPlatformAdmin: boolean;
  ip?: string;
  /** Gesetzt, wenn ein System-Admin über einen Supportzugriff im Mandanten arbeitet. */
  supportSessionId?: string | null;
  supportMode?: 'read' | 'write' | null;
  /** Request-ID für Audit und Logs. */
  requestId?: string;
}
