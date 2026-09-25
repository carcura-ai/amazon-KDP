import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { companies, supportSessions, users, sessions } from '../../db/schema.js';
import { parse, zTrimmed } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { createSession, revokeSession } from '../../core/session.js';
import { ctxOf, SESSION_COOKIE } from '../../plugins/auth.js';
import type { Db } from '../../db/index.js';

/**
 * Kontrollierter Supportzugriff (Break-Glass-Modell).
 *
 * Der System-Admin sieht Mandantendaten nie automatisch. Zugriff entsteht nur über eine
 * Supportsitzung, die
 *  - begründet ist,
 *  - vom Mandanten-Admin freigegeben wurde (oder als Notfallzugriff „Break-Glass“ sofort gilt,
 *    dann mit sofortigem Eintrag im Audit-Log des Mandanten und E-Mail an dessen Admins),
 *  - zeitlich begrenzt ist (höchstens 8 Stunden),
 *  - standardmäßig nur lesend ist,
 *  - vom Mandanten jederzeit widerrufen werden kann.
 * Jede Anfrage während der Sitzung wird im Audit-Log des Mandanten protokolliert.
 */
export const HOME_COOKIE = 'cm_sid_home';
const MAX_MINUTES = 480;

export function expireSupportSessions(db: Db): number {
  const now = nowIso();
  return db.update(supportSessions).set({ status: 'expired', endedAt: now, endedReason: 'Zeit abgelaufen', updatedAt: now })
    .where(and(eq(supportSessions.status, 'approved'), lt(supportSessions.expiresAt, now))).run().changes;
}

const publicSession = (s: typeof supportSessions.$inferSelect, db: Db) => {
  const name = (id: string | null) => (id ? db.select({ f: users.firstName, l: users.lastName }).from(users).where(eq(users.id, id)).get() : null);
  const r = name(s.requestedByUserId);
  const a = name(s.approvedByUserId);
  return { ...s, requestedBy: r ? `${r.f} ${r.l}` : null, approvedBy: a ? `${a.f} ${a.l}` : null };
};

export default async function supportRoutes(app: FastifyInstance) {
  const tenantAdmins = (companyId: string) => app.db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.role, 'admin'), eq(users.isActive, true))).all();
  const notifyTenant = async (companyId: string, subject: string, text: string) => {
    if (!app.mail.isConfigured(companyId)) return;
    for (const u of tenantAdmins(companyId)) await app.mail.send(companyId, { to: u.email, subject, text, refType: 'support' });
  };
  const getForTenant = (companyId: string, id: string) => {
    const row = app.db.select().from(supportSessions).where(and(eq(supportSessions.id, id), eq(supportSessions.companyId, companyId))).get();
    if (!row) throw notFound('Supportzugriff');
    return row;
  };

  /* ---------------------------------------------------------- Mandant: Übersicht, Freigabe, Widerruf */
  app.get('/api/support-sessions', { preHandler: app.requireAuth('support:grant') }, async (req) => {
    const ctx = ctxOf(req);
    expireSupportSessions(app.db);
    return { items: app.db.select().from(supportSessions).where(eq(supportSessions.companyId, ctx.companyId)).orderBy(desc(supportSessions.createdAt)).limit(100).all().map((s) => publicSession(s, app.db)) };
  });

  /** Mandant gibt Support von sich aus frei (z. B. bei einem Telefonat mit dem Support). */
  app.post('/api/support-sessions/grant', { preHandler: app.requireAuth('support:grant') }, async (req) => {
    const ctx = ctxOf(req);
    if (ctx.supportSessionId) throw forbidden('Im Supportzugriff nicht möglich.');
    const input = parse(z.object({ reason: zTrimmed(500).min(5), mode: z.enum(['read', 'write']).default('read'), durationMinutes: z.number().int().min(15).max(MAX_MINUTES).default(60) }), req.body);
    const id = newId();
    const now = new Date();
    app.db.insert(supportSessions).values({ id, companyId: ctx.companyId, requestedByUserId: null, reason: input.reason, mode: input.mode, status: 'approved', durationMinutes: input.durationMinutes, approvedByUserId: ctx.userId, approvedAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.durationMinutes * 60_000).toISOString() }).run();
    writeAudit(app.db, ctx, { action: 'support.granted', entityType: 'support_session', entityId: id, after: input });
    return publicSession(getForTenant(ctx.companyId, id), app.db);
  });

  app.post('/api/support-sessions/:id/approve', { preHandler: app.requireAuth('support:grant') }, async (req) => {
    const ctx = ctxOf(req);
    if (ctx.supportSessionId) throw forbidden('Im Supportzugriff nicht möglich.');
    const { id } = req.params as { id: string };
    const input = parse(z.object({ durationMinutes: z.number().int().min(15).max(MAX_MINUTES).optional(), mode: z.enum(['read', 'write']).optional() }), req.body ?? {});
    const row = getForTenant(ctx.companyId, id);
    if (row.status !== 'requested') throw conflict('Nur offene Anfragen können freigegeben werden.');
    const minutes = input.durationMinutes ?? row.durationMinutes;
    const now = new Date();
    app.db.update(supportSessions).set({ status: 'approved', mode: input.mode ?? row.mode, durationMinutes: minutes, approvedByUserId: ctx.userId, approvedAt: now.toISOString(), expiresAt: new Date(now.getTime() + minutes * 60_000).toISOString(), updatedAt: nowIso() }).where(eq(supportSessions.id, id)).run();
    writeAudit(app.db, ctx, { action: 'support.approved', entityType: 'support_session', entityId: id, after: { minutes, mode: input.mode ?? row.mode } });
    return publicSession(getForTenant(ctx.companyId, id), app.db);
  });

  app.post('/api/support-sessions/:id/reject', { preHandler: app.requireAuth('support:grant') }, async (req) => {
    const ctx = ctxOf(req);
    if (ctx.supportSessionId) throw forbidden('Im Supportzugriff nicht möglich.');
    const { id } = req.params as { id: string };
    const row = getForTenant(ctx.companyId, id);
    if (row.status !== 'requested') throw conflict('Nur offene Anfragen können abgelehnt werden.');
    app.db.update(supportSessions).set({ status: 'rejected', endedAt: nowIso(), endedReason: 'abgelehnt', updatedAt: nowIso() }).where(eq(supportSessions.id, id)).run();
    writeAudit(app.db, ctx, { action: 'support.rejected', entityType: 'support_session', entityId: id });
    return { ok: true };
  });

  app.post('/api/support-sessions/:id/revoke', { preHandler: app.requireAuth('support:grant') }, async (req) => {
    const ctx = ctxOf(req);
    if (ctx.supportSessionId) throw forbidden('Im Supportzugriff nicht möglich.');
    const { id } = req.params as { id: string };
    const row = getForTenant(ctx.companyId, id);
    if (!['approved', 'requested'].includes(row.status)) throw conflict('Der Zugriff ist bereits beendet.');
    app.db.update(supportSessions).set({ status: 'revoked', endedAt: nowIso(), endedReason: 'vom Mandanten widerrufen', updatedAt: nowIso() }).where(eq(supportSessions.id, id)).run();
    app.db.update(sessions).set({ revokedAt: nowIso() }).where(eq(sessions.supportSessionId, id)).run();
    writeAudit(app.db, ctx, { action: 'support.revoked', entityType: 'support_session', entityId: id });
    return { ok: true };
  });

  /* ---------------------------------------------------------- System-Admin */
  app.get('/api/platform/support-sessions', { preHandler: app.requirePlatformAdmin() }, async (req) => {
    const ctx = ctxOf(req);
    expireSupportSessions(app.db);
    const rows = app.db.select({ s: supportSessions, companyName: companies.name }).from(supportSessions).innerJoin(companies, eq(companies.id, supportSessions.companyId)).where(inArray(supportSessions.status, ['requested', 'approved'])).orderBy(desc(supportSessions.createdAt)).all();
    return { items: rows.map((r) => ({ ...publicSession(r.s, app.db), companyName: r.companyName, mine: r.s.requestedByUserId === ctx.userId || r.s.requestedByUserId === null })) };
  });

  app.post('/api/platform/support-sessions', { preHandler: app.requirePlatformAdmin() }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ companyId: z.string().uuid(), reason: zTrimmed(500).min(10), mode: z.enum(['read', 'write']).default('read'), durationMinutes: z.number().int().min(15).max(MAX_MINUTES).default(60), breakGlass: z.boolean().default(false) }), req.body);
    const company = app.db.select().from(companies).where(eq(companies.id, input.companyId)).get();
    if (!company) throw notFound('Mandant');
    if (company.id === ctx.companyId) throw badRequest('Für den eigenen Mandanten ist kein Supportzugriff nötig.');
    const id = newId();
    const now = new Date();
    const approved = input.breakGlass;
    app.db.insert(supportSessions).values({
      id, companyId: company.id, requestedByUserId: ctx.userId, reason: input.reason, mode: input.mode, durationMinutes: input.durationMinutes, breakGlass: input.breakGlass,
      status: approved ? 'approved' : 'requested', approvedAt: approved ? now.toISOString() : null, expiresAt: approved ? new Date(now.getTime() + input.durationMinutes * 60_000).toISOString() : null,
    }).run();
    // Eintrag im Audit-Log des Ziel-Mandanten (für dessen Admins sichtbar) und im eigenen
    writeAudit(app.db, { companyId: company.id, userId: null, ip: ctx.ip }, { action: input.breakGlass ? 'support.break_glass' : 'support.requested', entityType: 'support_session', entityId: id, after: { reason: input.reason, mode: input.mode, minutes: input.durationMinutes, requestedByUserId: ctx.userId } });
    writeAudit(app.db, ctx, { action: input.breakGlass ? 'platform.support_break_glass' : 'platform.support_requested', entityType: 'support_session', entityId: id, after: { companyId: company.id, reason: input.reason } });
    const who = app.db.select({ f: users.firstName, l: users.lastName }).from(users).where(eq(users.id, ctx.userId)).get();
    await notifyTenant(company.id,
      input.breakGlass ? 'Notfall-Supportzugriff auf Ihre Daten' : 'Anfrage: Supportzugriff auf Ihre Daten',
      `${who ? `${who.f} ${who.l}` : 'Der Softwarebetreiber'} ${input.breakGlass ? 'hat einen Notfall-Supportzugriff geöffnet' : 'bittet um Supportzugriff'}.\n\nBegründung: ${input.reason}\nModus: ${input.mode === 'read' ? 'nur lesen' : 'lesen und ändern'}\nDauer: ${input.durationMinutes} Minuten\n\n${input.breakGlass ? 'Sie können den Zugriff unter Einstellungen → Supportzugriff sofort widerrufen.' : 'Sie können die Anfrage unter Einstellungen → Supportzugriff freigeben oder ablehnen.'}`);
    return publicSession(app.db.select().from(supportSessions).where(eq(supportSessions.id, id)).get()!, app.db);
  });

  /** System-Admin betritt den Mandanten über eine freigegebene Supportsitzung. */
  app.post('/api/platform/support-sessions/:id/enter', { preHandler: app.requirePlatformAdmin() }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    expireSupportSessions(app.db);
    const s = app.db.select().from(supportSessions).where(eq(supportSessions.id, id)).get();
    if (!s) throw notFound('Supportzugriff');
    if (s.requestedByUserId && s.requestedByUserId !== ctx.userId) throw forbidden('Dieser Supportzugriff wurde für einen anderen Administrator angefragt.');
    if (s.status !== 'approved' || !s.expiresAt || new Date(s.expiresAt).getTime() <= Date.now()) throw conflict('Der Supportzugriff ist nicht freigegeben oder abgelaufen.');
    const user = app.db.select().from(users).where(eq(users.id, ctx.userId)).get()!;
    const sid = createSession(app.db, app.config, user, { ip: req.ip, userAgent: req.headers['user-agent'], support: { id: s.id, companyId: s.companyId, expiresAt: s.expiresAt } });
    if (!s.firstUsedAt) app.db.update(supportSessions).set({ firstUsedAt: nowIso(), updatedAt: nowIso() }).where(eq(supportSessions.id, id)).run();
    writeAudit(app.db, { companyId: s.companyId, userId: ctx.userId, ip: ctx.ip, supportSessionId: s.id }, { action: 'support.entered', entityType: 'support_session', entityId: s.id });
    if (req.sessionId) reply.setCookie(HOME_COOKIE, req.sessionId, app.cookieOptions);
    reply.setCookie(SESSION_COOKIE, sid, { ...app.cookieOptions, maxAge: Math.max(60, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000)) });
    return { ok: true, companyId: s.companyId, expiresAt: s.expiresAt, mode: s.mode };
  });

  /** Supportzugriff verlassen: Supportsitzung beenden und zur eigenen Sitzung zurückkehren. */
  app.post('/api/support/leave', { preHandler: app.requireAuth() }, async (req: FastifyRequest, reply) => {
    const ctx = ctxOf(req);
    if (!ctx.supportSessionId) throw badRequest('Kein Supportzugriff aktiv.');
    if (req.sessionId) revokeSession(app.db, req.sessionId);
    app.db.update(supportSessions).set({ status: 'ended', endedAt: nowIso(), endedReason: 'vom Support beendet', updatedAt: nowIso() }).where(and(eq(supportSessions.id, ctx.supportSessionId), eq(supportSessions.status, 'approved'))).run();
    writeAudit(app.db, ctx, { action: 'support.left', entityType: 'support_session', entityId: ctx.supportSessionId });
    const home = req.cookies[HOME_COOKIE];
    const unsigned = home ? req.unsignCookie(home) : null;
    if (unsigned?.valid && unsigned.value) reply.setCookie(SESSION_COOKIE, unsigned.value, app.cookieOptions);
    else reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(HOME_COOKIE, { path: '/' });
    return { ok: true };
  });
}
