import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { users, userTokens } from '../../db/schema.js';
import { parse, zEmail } from '../../core/validation.js';
import { hashPassword, validatePasswordPolicy } from '../../core/password.js';
import { newId, nowIso, randomToken } from '../../core/ids.js';
import { badRequest } from '../../core/errors.js';
import { sha256 } from '../../core/crypto.js';
import { writeAudit } from '../../core/audit.js';
import { revokeAllUserSessions } from '../../core/session.js';

/**
 * Passwort vergessen: Selbstbedienung per E-Mail.
 * - Antwort ist immer gleich (keine Aussage, ob ein Konto existiert).
 * - Token: 32 Byte Zufall, gespeichert nur als SHA-256, 30 Minuten gültig, einmalig verwendbar.
 * - Neue Anforderung entwertet ältere offene Tokens.
 * - Nach dem Setzen werden alle Sitzungen des Benutzers beendet. Die Zwei-Faktor-Anmeldung bleibt bestehen.
 */
const TTL_MINUTES = 30;
const MAX_PER_HOUR = 3;

export default async function passwordResetRoutes(app: FastifyInstance) {
  app.post('/api/auth/password-reset/request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req) => {
    const { email } = parse(z.object({ email: zEmail }), req.body);
    const generic = { ok: true, message: 'Wenn ein Konto mit dieser Adresse existiert, wurde eine E-Mail mit einem Link zum Zurücksetzen gesendet.' };
    const user = app.db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !user.isActive) return generic;
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const recent = app.db.select({ id: userTokens.id }).from(userTokens).where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, 'password_reset'), gt(userTokens.createdAt, since))).all().length;
    if (recent >= MAX_PER_HOUR) return generic;
    if (!app.mail.canSendAccountMail(user.companyId)) {
      req.log.warn({ userId: user.id }, 'Passwort-Reset angefordert, aber kein E-Mail-Versand eingerichtet');
      return generic;
    }
    const token = randomToken(32);
    const now = nowIso();
    app.db.update(userTokens).set({ usedAt: now }).where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, 'password_reset'), isNull(userTokens.usedAt))).run();
    app.db.insert(userTokens).values({ id: newId(), userId: user.id, purpose: 'password_reset', tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(), ip: req.ip }).run();
    const link = `${app.config.publicUrl.replace(/\/$/, '')}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
    await app.mail.sendAccountMail(user.companyId, {
      to: user.email,
      subject: 'Passwort zurücksetzen',
      text: `Guten Tag ${user.firstName},\n\nfür Ihr Konto wurde das Zurücksetzen des Passworts angefordert. Über diesen Link können Sie ein neues Passwort festlegen (gültig ${TTL_MINUTES} Minuten, nur einmal verwendbar):\n\n${link}\n\nWenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail. Ihr Passwort bleibt unverändert.`,
      refType: 'password_reset',
    });
    writeAudit(app.db, { companyId: user.companyId, userId: null, ip: req.ip }, { action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id });
    return generic;
  });

  app.post('/api/auth/password-reset/confirm', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    const { token, password } = parse(z.object({ token: z.string().min(20).max(200), password: z.string().max(200) }), req.body);
    const row = app.db.select().from(userTokens).where(and(eq(userTokens.tokenHash, sha256(token)), eq(userTokens.purpose, 'password_reset'))).get();
    if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) throw badRequest('Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    const user = app.db.select().from(users).where(eq(users.id, row.userId)).get();
    if (!user || !user.isActive) throw badRequest('Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    const policy = validatePasswordPolicy(password);
    if (policy) throw badRequest(policy, [{ path: 'password', message: policy }]);
    const now = nowIso();
    app.db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null, updatedAt: now }).where(eq(users.id, user.id)).run();
    app.db.update(userTokens).set({ usedAt: now }).where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, 'password_reset'), isNull(userTokens.usedAt))).run();
    revokeAllUserSessions(app.db, user.id);
    writeAudit(app.db, { companyId: user.companyId, userId: null, ip: req.ip }, { action: 'auth.password_reset_completed', entityType: 'user', entityId: user.id });
    return { ok: true };
  });
}
