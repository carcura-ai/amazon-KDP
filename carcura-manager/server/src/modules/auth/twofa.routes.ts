import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { users, companies } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { badRequest, unauthorized, notFound } from '../../core/errors.js';
import { verifyPassword } from '../../core/password.js';
import { generateTotpSecret, verifyTotp, otpauthUrl, generateBackupCodes, hashBackupCode } from '../../core/totp.js';
import { createSession } from '../../core/session.js';
import { SESSION_COOKIE, ctxOf } from '../../plugins/auth.js';
import { writeAudit } from '../../core/audit.js';
import { nowIso } from '../../core/ids.js';
import { publicUser } from './routes.js';

const CHALLENGE_MINUTES = 5;

/**
 * Zwei-Faktor-Authentifizierung (TOTP). Ablauf: Passwort korrekt → Server gibt eine
 * kurzlebige, verschlüsselte „Challenge“ zurück → Client sendet Challenge + Code →
 * erst dann entsteht die Sitzung. Geheimnisse liegen verschlüsselt (AES-256-GCM) in der Datenbank.
 */
export function issueChallenge(app: FastifyInstance, userId: string): string {
  return app.secrets.encrypt(JSON.stringify({ uid: userId, exp: Date.now() + CHALLENGE_MINUTES * 60_000, n: Math.random() }));
}

export default async function twoFactorRoutes(app: FastifyInstance) {
  const getUser = (id: string) => app.db.select().from(users).where(eq(users.id, id)).get();

  /** Schritt 2 der Anmeldung: Code oder Wiederherstellungscode prüfen. */
  app.post('/api/auth/2fa/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { challenge, code } = parse(z.object({ challenge: z.string().min(10).max(2000), code: z.string().trim().min(6).max(20) }), req.body);
    let payload: { uid: string; exp: number };
    try { payload = JSON.parse(app.secrets.decrypt(challenge)) as { uid: string; exp: number }; } catch { throw unauthorized('Anmeldung abgelaufen. Bitte erneut anmelden.'); }
    if (payload.exp < Date.now()) throw unauthorized('Anmeldung abgelaufen. Bitte erneut anmelden.');
    const user = getUser(payload.uid);
    if (!user || !user.isActive || !user.totpSecretEnc || !user.totpEnabledAt) throw unauthorized('Anmeldung nicht möglich.');
    const secret = app.secrets.decrypt(user.totpSecretEnc);
    let ok = verifyTotp(secret, code);
    let usedBackup = false;
    if (!ok) {
      const hashes = JSON.parse(user.backupCodesJson || '[]') as string[];
      const h = hashBackupCode(code);
      const idx = hashes.indexOf(h);
      if (idx >= 0) { hashes.splice(idx, 1); app.db.update(users).set({ backupCodesJson: JSON.stringify(hashes) }).where(eq(users.id, user.id)).run(); ok = true; usedBackup = true; }
    }
    if (!ok) {
      writeAudit(app.db, { companyId: user.companyId, userId: user.id, ip: req.ip }, { action: 'auth.2fa_failed', entityType: 'user', entityId: user.id });
      throw unauthorized('Der Code ist ungültig oder abgelaufen.');
    }
    app.db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: nowIso() }).where(eq(users.id, user.id)).run();
    const sessionId = createSession(app.db, app.config, user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE, sessionId, app.cookieOptions);
    writeAudit(app.db, { companyId: user.companyId, userId: user.id, ip: req.ip }, { action: usedBackup ? 'auth.login_backup_code' : 'auth.login_2fa', entityType: 'user', entityId: user.id });
    return { ok: true, user: publicUser(user), backupCodesLeft: usedBackup ? (JSON.parse(getUser(user.id)!.backupCodesJson || '[]') as string[]).length : undefined };
  });

  /** Einrichtung starten: neues Geheimnis erzeugen (noch nicht aktiv), QR-Code zurückgeben. */
  app.post('/api/auth/2fa/setup', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const user = getUser(ctx.userId)!;
    if (user.totpEnabledAt) throw badRequest('Zwei-Faktor-Authentifizierung ist bereits aktiv. Zum Neueinrichten zuerst deaktivieren.');
    const company = app.db.select({ name: companies.name, productName: companies.productName }).from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const secret = generateTotpSecret();
    app.db.update(users).set({ totpSecretEnc: app.secrets.encrypt(secret) }).where(eq(users.id, user.id)).run();
    const url = otpauthUrl(`${company.name} ${company.productName}`.trim(), user.email, secret);
    const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 220 });
    return { secret, otpauthUrl: url, qrSvg };
  });

  /** Einrichtung abschließen: ersten Code prüfen, dann aktivieren und Wiederherstellungscodes ausgeben. */
  app.post('/api/auth/2fa/enable', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const { code } = parse(z.object({ code: z.string().trim().min(6).max(8) }), req.body);
    const user = getUser(ctx.userId)!;
    if (!user.totpSecretEnc) throw badRequest('Bitte zuerst die Einrichtung starten.');
    if (user.totpEnabledAt) throw badRequest('Bereits aktiv.');
    if (!verifyTotp(app.secrets.decrypt(user.totpSecretEnc), code)) throw badRequest('Der Code ist ungültig. Uhrzeit des Handys prüfen und erneut versuchen.');
    const codes = generateBackupCodes();
    app.db.update(users).set({ totpEnabledAt: nowIso(), backupCodesJson: JSON.stringify(codes.hashes) }).where(eq(users.id, user.id)).run();
    writeAudit(app.db, ctx, { action: 'auth.2fa_enabled', entityType: 'user', entityId: user.id });
    return { ok: true, backupCodes: codes.plain };
  });

  /** Deaktivieren: Passwort und aktueller Code (oder Wiederherstellungscode) erforderlich. */
  app.post('/api/auth/2fa/disable', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const { password, code } = parse(z.object({ password: z.string(), code: z.string().trim().min(6).max(20) }), req.body);
    const user = getUser(ctx.userId)!;
    if (!user.totpEnabledAt || !user.totpSecretEnc) throw badRequest('Zwei-Faktor-Authentifizierung ist nicht aktiv.');
    if (!(await verifyPassword(password, user.passwordHash))) throw unauthorized('Passwort ist falsch.');
    const hashes = JSON.parse(user.backupCodesJson || '[]') as string[];
    if (!verifyTotp(app.secrets.decrypt(user.totpSecretEnc), code) && !hashes.includes(hashBackupCode(code))) throw unauthorized('Der Code ist ungültig.');
    app.db.update(users).set({ totpSecretEnc: null, totpEnabledAt: null, backupCodesJson: null }).where(eq(users.id, user.id)).run();
    writeAudit(app.db, ctx, { action: 'auth.2fa_disabled', entityType: 'user', entityId: user.id });
    return { ok: true };
  });

  /** Administrator setzt 2FA eines Benutzers zurück (z. B. Handy verloren). */
  app.post('/api/users/:id/2fa/reset', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const user = getUser(id);
    if (!user || user.companyId !== ctx.companyId) throw notFound('Benutzer');
    app.db.update(users).set({ totpSecretEnc: null, totpEnabledAt: null, backupCodesJson: null }).where(eq(users.id, id)).run();
    writeAudit(app.db, ctx, { action: 'auth.2fa_reset_by_admin', entityType: 'user', entityId: id });
    return { ok: true };
  });
}
