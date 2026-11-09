import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import type { Ctx } from './context.js';
import type { Permission } from './permissions.js';
import { newId } from './ids.js';

/**
 * API-Schlüssel für Programme (z. B. Carcura-Assistent, Claude): Lesen und Anlegen/Ändern von
 * Kunden, Fahrzeugen, Aufträgen, Leads und Terminen. Kein Löschen, keine Rechnungen, keine Verwaltung.
 */
export const API_KEY_SCOPES: Permission[] = [
  'customers:read', 'customers:write',
  'vehicles:read', 'vehicles:write',
  'orders:read', 'orders:write',
  'leads:read', 'leads:write',
  'appointments:read', 'appointments:write',
  'offers:read',
];

const PREFIX = 'cm_';

export const hashApiKey = (key: string): string => crypto.createHash('sha256').update(key).digest('hex');

export function isApiKeyToken(token: string | undefined): token is string {
  return typeof token === 'string' && token.startsWith(PREFIX) && token.length > 20 && token.length < 200;
}

/** Legt einen Schlüssel an und gibt ihn einmalig im Klartext zurück. Gespeichert wird nur der Hash. */
export function createApiKey(db: Db, opts: { companyId: string; name: string; createdByUserId: string }): { id: string; key: string; prefix: string } {
  const visible = crypto.randomBytes(4).toString('hex');
  const key = `${PREFIX}${visible}_${crypto.randomBytes(32).toString('base64url')}`;
  const id = newId();
  db.insert(apiKeys).values({
    id,
    companyId: opts.companyId,
    name: opts.name,
    prefix: `${PREFIX}${visible}`,
    keyHash: hashApiKey(key),
    scopesJson: JSON.stringify(API_KEY_SCOPES),
    createdByUserId: opts.createdByUserId,
  }).run();
  return { id, key, prefix: `${PREFIX}${visible}` };
}

/** Prüft einen Bearer-Schlüssel und liefert den Kontext (Rechte = Schnittmenge aus Schlüssel und Ersteller). */
export function resolveApiKey(db: Db, token: string, ip?: string): (Ctx & { apiKeyId: string }) | null {
  const row = db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, hashApiKey(token)), isNull(apiKeys.revokedAt))).get();
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
  if (!row.createdByUserId) return null;
  const user = db.select().from(users).where(eq(users.id, row.createdByUserId)).get();
  if (!user || !user.isActive || user.companyId !== row.companyId) return null;
  let scopes: Permission[] = [];
  try { scopes = (JSON.parse(row.scopesJson) as Permission[]).filter((p) => API_KEY_SCOPES.includes(p)); } catch { scopes = []; }
  db.update(apiKeys).set({ lastUsedAt: new Date().toISOString(), lastUsedIp: ip ?? null }).where(eq(apiKeys.id, row.id)).run();
  return {
    companyId: row.companyId,
    userId: user.id,
    role: 'readonly',
    permissions: new Set(scopes),
    isPlatformAdmin: false,
    ip,
    apiKeyId: row.id,
  };
}
