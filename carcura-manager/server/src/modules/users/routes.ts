import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import { parse, zEmail, zTrimmed } from '../../core/validation.js';
import { hashPassword, validatePasswordPolicy } from '../../core/password.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors.js';
import type { Ctx } from '../../core/context.js';
import { newId, nowIso } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import { revokeAllUserSessions } from '../../core/session.js';
import { ROLES } from '../../core/permissions.js';
import { ctxOf } from '../../plugins/auth.js';
import { publicUser } from '../auth/routes.js';

/**
 * Schutz der Administratorkonten: Wer nur das Recht „Benutzer verwalten“ hat (z. B. ein Betriebsleiter mit
 * erweiterten Rechten), darf Administratoren und den Softwarebetreiber weder ändern, zurücksetzen noch anlegen.
 */
export function assertMayManageUser(ctx: Ctx, target: { id: string; role: string; isPlatformAdmin: boolean }, newRole?: string): void {
  if (target.isPlatformAdmin && !ctx.isPlatformAdmin && target.id !== ctx.userId) throw forbidden('Das Konto des Softwarebetreibers kann nur von ihm selbst geändert werden.');
  if ((target.role === 'admin' || newRole === 'admin') && ctx.role !== 'admin') throw forbidden('Administratorkonten können nur von Administratoren verwaltet werden.');
}

const createSchema = z.object({
  email: zEmail,
  password: z.string(),
  firstName: zTrimmed(80).min(1),
  lastName: zTrimmed(80).min(1),
  role: z.enum(ROLES).default('employee'),
});
const updateSchema = z.object({
  firstName: zTrimmed(80).min(1).optional(),
  lastName: zTrimmed(80).min(1).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

/** Benutzerlimit des Tarifs (SaaS). Im Self-Hosted-Betrieb unbegrenzt. */
function assertUserLimit(app: FastifyInstance, companyId: string) {
  const { maxUsers } = app.entitlementsFor(companyId).limits;
  if (maxUsers === null) return;
  const active = app.db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.companyId, companyId), eq(users.isActive, true))).get()?.n ?? 0;
  if (active >= maxUsers) throw new AppError(402, 'user_limit', `Ihr Tarif umfasst ${maxUsers} aktive Benutzer. Weitere Benutzer können unter Einstellungen → Vertrag & Abo hinzugebucht werden.`);
}

export default async function userRoutes(app: FastifyInstance) {
  app.get('/api/users', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select().from(users).where(eq(users.companyId, ctx.companyId)).orderBy(users.lastName, users.firstName).all();
    // Mitarbeiter ohne users:manage sehen nur Name/Rolle (für Zuweisungen)
    if (!ctx.permissions.has('users:manage')) {
      return { items: rows.filter((u) => u.isActive).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role })) };
    }
    return { items: rows.map(publicUser) };
  });

  app.post('/api/users', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(createSchema, req.body);
    const policy = validatePasswordPolicy(input.password);
    if (policy) throw badRequest(policy, [{ path: 'password', message: policy }]);
    if (input.role === 'admin' && ctx.role !== 'admin') throw forbidden('Administratorkonten können nur von Administratoren angelegt werden.');
    assertUserLimit(app, ctx.companyId);
    const exists = app.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
    if (exists) throw conflict('Diese E-Mail-Adresse wird bereits verwendet.');
    const id = newId();
    app.db
      .insert(users)
      .values({ id, companyId: ctx.companyId, email: input.email, passwordHash: await hashPassword(input.password), firstName: input.firstName, lastName: input.lastName, role: input.role })
      .run();
    writeAudit(app.db, ctx, { action: 'user.create', entityType: 'user', entityId: id, after: { email: input.email, role: input.role } });
    return publicUser(app.db.select().from(users).where(eq(users.id, id)).get()!);
  });

  app.patch('/api/users/:id', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(updateSchema, req.body);
    const before = app.db.select().from(users).where(and(eq(users.id, id), eq(users.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Benutzer');
    assertMayManageUser(ctx, before, input.role);
    if (id === ctx.userId && (input.role !== undefined && input.role !== 'admin' || input.isActive === false)) {
      throw badRequest('Der eigene Admin-Zugang kann nicht herabgestuft oder deaktiviert werden.');
    }
    if (before.role === 'admin' && (input.role && input.role !== 'admin' || input.isActive === false)) {
      const admins = app.db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.companyId, ctx.companyId), eq(users.role, 'admin'), eq(users.isActive, true))).get()?.n ?? 0;
      if (admins <= 1) throw badRequest('Mindestens ein aktiver Administrator muss bestehen bleiben.');
    }
    if (input.isActive === true && !before.isActive) assertUserLimit(app, ctx.companyId);
    app.db.update(users).set({ ...input, updatedAt: nowIso() }).where(eq(users.id, id)).run();
    if (input.isActive === false) revokeAllUserSessions(app.db, id);
    const after = app.db.select().from(users).where(eq(users.id, id)).get()!;
    writeAudit(app.db, ctx, { action: 'user.update', entityType: 'user', entityId: id, before: publicUser(before), after: publicUser(after) });
    return publicUser(after);
  });

  app.post('/api/users/:id/reset-password', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { password } = parse(z.object({ password: z.string() }), req.body);
    const policy = validatePasswordPolicy(password);
    if (policy) throw badRequest(policy);
    const target = app.db.select().from(users).where(and(eq(users.id, id), eq(users.companyId, ctx.companyId))).get();
    if (!target) throw notFound('Benutzer');
    assertMayManageUser(ctx, target);
    app.db.update(users).set({ passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null, updatedAt: nowIso() }).where(eq(users.id, id)).run();
    revokeAllUserSessions(app.db, id);
    writeAudit(app.db, ctx, { action: 'user.password_reset', entityType: 'user', entityId: id });
    return { ok: true };
  });
}
