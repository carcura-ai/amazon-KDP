import { and, eq, isNull, lt } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { sessions, users, rolePermissions } from '../db/schema.js';
import { newId, nowIso, randomToken } from './ids.js';
import type { Ctx } from './context.js';
import { DEFAULT_ROLE_PERMISSIONS, isPermission, type Permission, type Role, ROLES } from './permissions.js';
import type { AppConfig } from '../config.js';

export interface SessionInfo {
  sessionId: string;
  ctx: Ctx;
  user: typeof users.$inferSelect;
}

export function createSession(db: Db, cfg: AppConfig, user: typeof users.$inferSelect, meta: { ip?: string; userAgent?: string }): string {
  const id = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + cfg.sessionMaxDays * 86_400_000);
  db.insert(sessions)
    .values({
      id,
      userId: user.id,
      companyId: user.companyId,
      expiresAt: expires.toISOString(),
      lastSeenAt: now.toISOString(),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    })
    .run();
  return id;
}

export function loadPermissions(db: Db, companyId: string, role: string): Set<Permission> {
  const rows = db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.companyId, companyId), eq(rolePermissions.role, role)))
    .all();
  if (rows.length === 0) {
    const r = (ROLES as readonly string[]).includes(role) ? (role as Role) : 'readonly';
    return new Set(DEFAULT_ROLE_PERMISSIONS[r]);
  }
  return new Set(rows.map((r) => r.permission).filter(isPermission));
}

export function seedRolePermissions(db: Db, companyId: string): void {
  for (const role of ROLES) {
    for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
      db.insert(rolePermissions).values({ id: newId(), companyId, role, permission }).onConflictDoNothing().run();
    }
  }
}

/** Lädt und validiert eine Session (Leerlauf- und Absolut-Timeout), verlängert den Leerlaufzähler. */
export function resolveSession(db: Db, cfg: AppConfig, sessionId: string, ip?: string): SessionInfo | null {
  const row = db.select().from(sessions).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt))).get();
  if (!row) return null;
  const now = Date.now();
  if (new Date(row.expiresAt).getTime() < now) return null;
  if (new Date(row.lastSeenAt).getTime() + cfg.sessionIdleMinutes * 60_000 < now) {
    db.update(sessions).set({ revokedAt: nowIso() }).where(eq(sessions.id, sessionId)).run();
    return null;
  }
  const user = db.select().from(users).where(eq(users.id, row.userId)).get();
  if (!user || !user.isActive) return null;
  // Leerlaufzähler höchstens einmal pro Minute schreiben
  if (new Date(row.lastSeenAt).getTime() + 60_000 < now) {
    db.update(sessions).set({ lastSeenAt: new Date(now).toISOString() }).where(eq(sessions.id, sessionId)).run();
  }
  const role = ((ROLES as readonly string[]).includes(user.role) ? user.role : 'readonly') as Role;
  return {
    sessionId,
    user,
    ctx: {
      companyId: user.companyId,
      userId: user.id,
      role,
      permissions: loadPermissions(db, user.companyId, role),
      isPlatformAdmin: user.isPlatformAdmin,
      ip,
    },
  };
}

export function revokeSession(db: Db, sessionId: string): void {
  db.update(sessions).set({ revokedAt: nowIso() }).where(eq(sessions.id, sessionId)).run();
}

export function revokeAllUserSessions(db: Db, userId: string): void {
  db.update(sessions).set({ revokedAt: nowIso() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt))).run();
}

export function purgeExpiredSessions(db: Db): number {
  const res = db.delete(sessions).where(lt(sessions.expiresAt, nowIso())).run();
  return res.changes;
}
