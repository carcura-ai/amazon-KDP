import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { legalDocuments, legalAcceptances, companies, users, userTokens } from '../../db/schema.js';
import { parse, zEmail, zOptionalText, zTrimmed } from '../../core/validation.js';
import { hashPassword, validatePasswordPolicy } from '../../core/password.js';
import { newId, nowIso, randomToken } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { sha256 } from '../../core/crypto.js';
import { writeAudit } from '../../core/audit.js';
import { createSession, seedRolePermissions } from '../../core/session.js';
import { slugify } from '../../core/normalize.js';
import { ctxOf, SESSION_COOKIE } from '../../plugins/auth.js';
import { seedDefaultServices } from '../company/defaultServices.js';
import { startSubscription } from '../../core/subscriptions.js';

/**
 * Rechtsdokumente (öffentlich lesbar), Zustimmung mit Nachweis und Selbstregistrierung (nur SaaS).
 * Nachweis je Zustimmung: Dokumenttyp, Version, Hash des Inhalts, Zeitpunkt, Mandant, Benutzer, IP, User-Agent.
 */
export default async function legalSignupRoutes(app: FastifyInstance) {
  const current = () => app.db.select({ id: legalDocuments.id, type: legalDocuments.type, version: legalDocuments.version, title: legalDocuments.title, url: legalDocuments.url, requiresAcceptance: legalDocuments.requiresAcceptance, publishedAt: legalDocuments.publishedAt, contentSha256: legalDocuments.contentSha256 }).from(legalDocuments).where(eq(legalDocuments.isCurrent, true)).all();

  app.get('/api/legal/current', async () => ({ items: current() }));
  app.get('/api/legal/documents/:id', async (req) => {
    const { id } = req.params as { id: string };
    const d = app.db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).get();
    if (!d) throw notFound('Dokument');
    return d;
  });

  const accept = (companyId: string, userId: string, docIds: string[], ip: string, ua: string | undefined) => {
    for (const id of new Set(docIds)) {
      const d = app.db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).get();
      if (!d) throw badRequest('Unbekanntes Dokument.');
      app.db.insert(legalAcceptances).values({ id: newId(), companyId, userId, documentId: d.id, documentType: d.type, documentVersion: d.version, contentSha256: d.contentSha256, acceptedAt: nowIso(), ip, userAgent: ua?.slice(0, 300) ?? null }).run();
    }
  };
  const missingRequired = (docIds: string[]) => current().filter((d) => d.requiresAcceptance && !docIds.includes(d.id));

  /** Zustimmung zu (neuen Versionen von) Dokumenten durch einen Mandanten-Admin. */
  app.post('/api/legal/accept', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { documentIds } = parse(z.object({ documentIds: z.array(z.string().uuid()).min(1).max(20) }), req.body);
    accept(ctx.companyId, ctx.userId, documentIds, req.ip, req.headers['user-agent']);
    writeAudit(app.db, ctx, { action: 'legal.accept', entityType: 'legal_document', entityId: null, after: { documentIds } });
    return { ok: true };
  });
  /** Welche aktuellen Pflichtdokumente hat der Mandant noch nicht bestätigt? */
  app.get('/api/legal/pending', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const accepted = new Set(app.db.select({ d: legalAcceptances.documentId }).from(legalAcceptances).where(eq(legalAcceptances.companyId, ctx.companyId)).all().map((r) => r.d));
    return { items: current().filter((d) => d.requiresAcceptance && !accepted.has(d.id)) };
  });
  app.get('/api/legal/acceptances', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select().from(legalAcceptances).where(eq(legalAcceptances.companyId, ctx.companyId)).all() };
  });

  /* ---------------------------------------------------------- Registrierung (SaaS) */
  app.post('/api/signup', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    if (app.config.deploymentMode !== 'saas') throw notFound('Registrierung');
    const input = parse(z.object({
      company: z.object({ name: zTrimmed(120).min(2), legalName: zOptionalText(200), street: zOptionalText(200), zip: zOptionalText(20), city: zOptionalText(120), phone: zOptionalText(60), customerType: z.enum(['business', 'consumer']).default('business') }),
      admin: z.object({ email: zEmail, password: z.string().max(200), firstName: zTrimmed(80).min(1), lastName: zTrimmed(80).min(1) }),
      planCode: z.string().min(2).max(40).default('BUSINESS'),
      acceptedDocumentIds: z.array(z.string().uuid()).max(20).default([]),
      website: z.string().max(200).default(''), // Honeypot
    }), req.body);
    if (input.website) return { ok: true };
    const pw = validatePasswordPolicy(input.admin.password);
    if (pw) throw badRequest(pw, [{ path: 'admin.password', message: pw }]);
    if (input.company.customerType === 'consumer') throw badRequest('Die Registrierung ist derzeit nur für Unternehmen (B2B) möglich.');
    const missing = missingRequired(input.acceptedDocumentIds);
    if (missing.length) throw badRequest(`Bitte bestätigen Sie: ${missing.map((m) => m.title).join(', ')}.`);
    if (app.db.select({ id: users.id }).from(users).where(eq(users.email, input.admin.email)).get()) throw conflict('Für diese E-Mail-Adresse besteht bereits ein Konto. Bitte anmelden oder Passwort zurücksetzen.');
    let slug = slugify(input.company.name);
    if (app.db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).get()) slug = `${slug}-${randomToken(3).toLowerCase()}`;
    const companyId = newId();
    const userId = newId();
    const passwordHash = await hashPassword(input.admin.password);
    app.db.transaction((tx) => {
      tx.insert(companies).values({ id: companyId, name: input.company.name, legalName: input.company.legalName, slug, street: input.company.street, zip: input.company.zip, city: input.company.city, phone: input.company.phone, email: input.admin.email, websiteLeadToken: randomToken(24) }).run();
      tx.insert(users).values({ id: userId, companyId, email: input.admin.email, passwordHash, firstName: input.admin.firstName, lastName: input.admin.lastName, role: 'admin' }).run();
      seedRolePermissions(tx, companyId);
      seedDefaultServices(tx, companyId);
    });
    startSubscription(app.db, companyId, input.planCode, { trial: true }, { userId, source: 'app' });
    accept(companyId, userId, input.acceptedDocumentIds, req.ip, req.headers['user-agent']);
    await sendVerification(app, userId);
    writeAudit(app.db, { companyId, userId, ip: req.ip }, { action: 'signup.complete', entityType: 'company', entityId: companyId, after: { plan: input.planCode } });
    const user = app.db.select().from(users).where(eq(users.id, userId)).get()!;
    reply.setCookie(SESSION_COOKIE, createSession(app.db, app.config, user, { ip: req.ip, userAgent: req.headers['user-agent'] }), app.cookieOptions);
    return { ok: true, companyId, userId, emailVerificationSent: app.mail.canSendAccountMail(companyId) };
  });

  app.post('/api/auth/verify-email', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(200) }), req.body);
    const row = app.db.select().from(userTokens).where(and(eq(userTokens.tokenHash, sha256(token)), eq(userTokens.purpose, 'email_verify'), isNull(userTokens.usedAt))).get();
    if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw badRequest('Der Bestätigungslink ist ungültig oder abgelaufen.');
    app.db.update(users).set({ emailVerifiedAt: nowIso() }).where(eq(users.id, row.userId)).run();
    app.db.update(userTokens).set({ usedAt: nowIso() }).where(eq(userTokens.id, row.id)).run();
    return { ok: true };
  });
  app.post('/api/auth/verify-email/resend', { preHandler: app.requireAuth(), config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (req) => {
    const ctx = ctxOf(req);
    await sendVerification(app, ctx.userId);
    return { ok: true };
  });
}

async function sendVerification(app: FastifyInstance, userId: string) {
  const user = app.db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.emailVerifiedAt) return;
  const token = randomToken(32);
  app.db.insert(userTokens).values({ id: newId(), userId, purpose: 'email_verify', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }).run();
  if (!app.mail.canSendAccountMail(user.companyId)) return;
  const link = `${app.config.publicUrl.replace(/\/$/, '')}/email-bestaetigen?token=${encodeURIComponent(token)}`;
  await app.mail.sendAccountMail(user.companyId, { to: user.email, subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse', text: `Guten Tag ${user.firstName},\n\nbitte bestätigen Sie Ihre E-Mail-Adresse (Link 3 Tage gültig):\n\n${link}\n\nWenn Sie sich nicht registriert haben, ignorieren Sie diese Nachricht.`, refType: 'email_verify' });
}
