import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { emailLog, jobs, users } from '../../db/schema.js';
import { parse, zEmail, zOptionalText, zTrimmed } from '../../core/validation.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import type { SmtpConfig } from '../../integrations/mail.js';

const smtpSchema = z.object({
  host: zTrimmed(200).min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  user: zTrimmed(200).default(''),
  pass: z.string().max(500).optional(), // leer = vorhandenes Passwort behalten
  fromName: zTrimmed(120).min(1),
  fromEmail: zEmail,
  replyTo: zOptionalText(200),
});

export default async function integrationRoutes(app: FastifyInstance) {
  app.get('/api/integrations', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.integrations.listPublic(ctx.companyId) };
  });

  app.get('/api/integrations/smtp', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const found = app.integrations.get<SmtpConfig>(ctx.companyId, 'smtp');
    if (!found) return { configured: false };
    const { pass: _p, ...rest } = found.config;
    return { configured: true, config: { ...rest, hasPassword: Boolean(found.config.pass) }, status: found.row.status, lastError: found.row.lastError, lastSyncAt: found.row.lastSyncAt };
  });

  app.put('/api/integrations/smtp', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(smtpSchema, req.body);
    const existing = app.integrations.get<SmtpConfig>(ctx.companyId, 'smtp');
    const pass = input.pass ? input.pass : existing?.config.pass ?? '';
    const cfg: SmtpConfig = { host: input.host, port: input.port, secure: input.secure, user: input.user, pass, fromName: input.fromName, fromEmail: input.fromEmail, replyTo: input.replyTo };
    app.integrations.save(ctx.companyId, 'smtp', cfg as unknown as Record<string, unknown>, { host: cfg.host, port: cfg.port, fromEmail: cfg.fromEmail }, 'E-Mail-Versand (SMTP)');
    writeAudit(app.db, ctx, { action: 'integration.smtp_saved', entityType: 'integration', entityId: 'smtp', after: { host: cfg.host, fromEmail: cfg.fromEmail } });
    return { ok: true };
  });

  app.delete('/api/integrations/smtp', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    app.integrations.remove(ctx.companyId, 'smtp');
    writeAudit(app.db, ctx, { action: 'integration.smtp_removed', entityType: 'integration', entityId: 'smtp' });
    return { ok: true };
  });

  /** Sendet eine Testmail an den angemeldeten Benutzer. */
  app.post('/api/integrations/smtp/test', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const me = app.db.select().from(users).where(eq(users.id, ctx.userId)).get();
    if (!me) throw notFound('Benutzer');
    if (!app.mail.isConfigured(ctx.companyId)) throw badRequest('Bitte zuerst die SMTP-Zugangsdaten speichern.');
    const res = await app.mail.send(ctx.companyId, { to: me.email, subject: 'Testnachricht – E-Mail-Versand funktioniert', text: `Guten Tag ${me.firstName},\n\ndiese Nachricht bestätigt, dass der E-Mail-Versand korrekt eingerichtet ist.\n\nGesendet am ${new Date().toLocaleString('de-DE')}.`, refType: 'test' });
    if (!res.ok) throw badRequest(`Versand fehlgeschlagen: ${res.error}`);
    return { ok: true, to: me.email };
  });

  app.get('/api/integrations/email-log', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select().from(emailLog).where(eq(emailLog.companyId, ctx.companyId)).orderBy(desc(emailLog.createdAt)).limit(100).all() };
  });

  app.get('/api/system/jobs', { preHandler: app.requireAuth('settings:manage') }, async () => {
    return { items: app.db.select().from(jobs).orderBy(desc(jobs.runAt)).limit(50).all() };
  });
}
