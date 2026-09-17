import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users, companies } from '../../db/schema.js';
import { parse, zEmail } from '../../core/validation.js';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '../../core/password.js';
import { AppError, badRequest, unauthorized } from '../../core/errors.js';
import { createSession, revokeSession, revokeAllUserSessions } from '../../core/session.js';
import { nowIso } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import { SESSION_COOKIE, ctxOf } from '../../plugins/auth.js';

const loginSchema = z.object({ email: zEmail, password: z.string().min(1) });
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    isPlatformAdmin: u.isPlatformAdmin,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

export function publicCompany(c: typeof companies.$inferSelect) {
  const { websiteLeadToken: _t, ...rest } = c;
  return rest;
}

import { issueChallenge } from './twofa.routes.js';
import { privacySettings } from '../privacy/settings.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = app.db.select().from(users).where(eq(users.email, email)).get();
    const generic = unauthorized('E-Mail oder Passwort ist falsch.');
    if (!user || !user.isActive) {
      // gleiche Antwortzeit wie bei falschem Passwort
      await verifyPassword(password, 'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      throw generic;
    }
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw new AppError(423, 'locked', `Konto vorübergehend gesperrt. Bitte in ${LOCK_MINUTES} Minuten erneut versuchen.`);
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      app.db
        .update(users)
        .set({
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
        })
        .where(eq(users.id, user.id))
        .run();
      writeAudit(app.db, { companyId: user.companyId, userId: user.id, ip: req.ip }, { action: 'auth.login_failed', entityType: 'user', entityId: user.id });
      throw generic;
    }
    if (user.totpEnabledAt && user.totpSecretEnc) {
      // Zweiter Faktor erforderlich: noch keine Sitzung, nur eine kurzlebige Challenge
      app.db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id)).run();
      return { ok: false, requires2fa: true, challenge: issueChallenge(app, user.id) };
    }
    app.db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: nowIso() }).where(eq(users.id, user.id)).run();
    const sessionId = createSession(app.db, app.config, user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE, sessionId, app.cookieOptions);
    writeAudit(app.db, { companyId: user.companyId, userId: user.id, ip: req.ip }, { action: 'auth.login', entityType: 'user', entityId: user.id });
    return { ok: true, user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionId) revokeSession(app.db, req.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const user = app.db.select().from(users).where(eq(users.id, ctx.userId)).get()!;
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const privacy = privacySettings(company);
    const twoFactorEnabled = Boolean(user.totpEnabledAt);
    return { user: publicUser(user), company: publicCompany(company), permissions: [...ctx.permissions], twoFactorEnabled, mustSetup2fa: privacy.require2faForAdmins && user.role === 'admin' && !twoFactorEnabled };
  });

  app.post('/api/auth/change-password', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const { currentPassword, newPassword } = parse(z.object({ currentPassword: z.string(), newPassword: z.string() }), req.body);
    const user = app.db.select().from(users).where(eq(users.id, ctx.userId)).get()!;
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Das aktuelle Passwort ist falsch.');
    const policy = validatePasswordPolicy(newPassword);
    if (policy) throw badRequest(policy);
    app.db.update(users).set({ passwordHash: await hashPassword(newPassword), updatedAt: nowIso() }).where(eq(users.id, ctx.userId)).run();
    revokeAllUserSessions(app.db, ctx.userId);
    writeAudit(app.db, ctx, { action: 'auth.password_changed', entityType: 'user', entityId: ctx.userId });
    return { ok: true, reloginRequired: true };
  });
}
