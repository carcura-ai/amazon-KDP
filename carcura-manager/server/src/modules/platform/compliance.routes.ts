import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { subprocessors, legalDocuments, legalAcceptances, incidents, companies, users } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { sha256 } from '../../core/crypto.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { incidentSchema } from '../privacy/center.routes.js';
import { purgeTenant } from './tenant-lifecycle.js';
import { subscriptionOf } from '../../core/subscriptions.js';

export const LEGAL_TYPES = ['agb', 'avv', 'privacy', 'tom', 'subprocessors', 'prices', 'imprint', 'withdrawal', 'sla'] as const;
const LEGAL_LABEL: Record<(typeof LEGAL_TYPES)[number], string> = { agb: 'Allgemeine Geschäftsbedingungen', avv: 'Auftragsverarbeitungsvertrag (Art. 28 DSGVO)', privacy: 'Datenschutzerklärung', tom: 'Technische und organisatorische Maßnahmen', subprocessors: 'Liste der Unterauftragsverarbeiter', prices: 'Preis- und Leistungsbeschreibung', imprint: 'Impressum', withdrawal: 'Widerrufsbelehrung', sla: 'Verfügbarkeit und Support' };

/**
 * Compliance-Verwaltung des Betreibers: Subprozessoren, versionierte Rechtsdokumente, Vorfälle,
 * Mandantenlöschung. Rechtstexte werden hier eingestellt – nie im Code; vor Veröffentlichung juristisch prüfen.
 */
export default async function complianceRoutes(app: FastifyInstance) {
  const pre = { preHandler: app.requirePlatformAdmin() };

  /* ---------------------------------------------------------- Subprozessoren */
  app.get('/api/platform/subprocessors', pre, async () => ({ items: app.db.select().from(subprocessors).all() }));
  app.put('/api/platform/subprocessors/:id', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(subprocessors).where(eq(subprocessors.id, id)).get();
    if (!before) throw notFound('Subprozessor');
    const input = parse(z.object({ name: zTrimmed(160).min(2), purpose: zTrimmed(500).min(3), dataCategories: zTrimmed(1000).min(3), location: zOptionalText(160), thirdCountry: z.boolean(), transferMechanism: zOptionalText(300), dpaStatus: z.enum(['to_review', 'signed', 'not_required', 'missing']), dpaReference: zOptionalText(300), notes: zOptionalText(2000), isActive: z.boolean() }).partial(), req.body);
    app.db.update(subprocessors).set({ ...input, version: before.version + 1, updatedAt: nowIso() }).where(eq(subprocessors.id, id)).run();
    writeAudit(app.db, ctx, { action: 'platform.subprocessor_update', entityType: 'subprocessor', entityId: id, before, after: input });
    return app.db.select().from(subprocessors).where(eq(subprocessors.id, id)).get();
  });
  app.post('/api/platform/subprocessors', pre, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ key: z.string().regex(/^[a-z0-9_]{2,40}$/), name: zTrimmed(160).min(2), purpose: zTrimmed(500).min(3), dataCategories: zTrimmed(1000).min(3), location: zOptionalText(160), thirdCountry: z.boolean().default(false), transferMechanism: zOptionalText(300), dpaStatus: z.enum(['to_review', 'signed', 'not_required', 'missing']).default('to_review'), activation: z.enum(['always', 'optional']).default('optional'), integrationType: zOptionalText(40), notes: zOptionalText(2000) }), req.body);
    if (app.db.select({ id: subprocessors.id }).from(subprocessors).where(eq(subprocessors.key, input.key)).get()) throw conflict('Schlüssel existiert bereits.');
    const id = newId();
    app.db.insert(subprocessors).values({ id, ...input }).run();
    writeAudit(app.db, ctx, { action: 'platform.subprocessor_create', entityType: 'subprocessor', entityId: id, after: input });
    return app.db.select().from(subprocessors).where(eq(subprocessors.id, id)).get();
  });

  /* ---------------------------------------------------------- Rechtsdokumente */
  app.get('/api/platform/legal-documents', pre, async () => ({ items: app.db.select({ id: legalDocuments.id, type: legalDocuments.type, version: legalDocuments.version, title: legalDocuments.title, url: legalDocuments.url, contentSha256: legalDocuments.contentSha256, requiresAcceptance: legalDocuments.requiresAcceptance, isCurrent: legalDocuments.isCurrent, publishedAt: legalDocuments.publishedAt }).from(legalDocuments).orderBy(desc(legalDocuments.publishedAt)).all(), types: LEGAL_LABEL }));
  /** Neue Version veröffentlichen; ältere Versionen bleiben unverändert erhalten (Nachweis). */
  app.post('/api/platform/legal-documents', pre, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ type: z.enum(LEGAL_TYPES), version: z.string().trim().min(1).max(40), title: zTrimmed(200).optional(), contentMarkdown: z.string().max(500_000).nullable().default(null), url: z.string().url().max(500).nullable().default(null), requiresAcceptance: z.boolean().default(false) }), req.body);
    if (!input.contentMarkdown && !input.url) throw badRequest('Inhalt oder Adresse des Dokuments angeben.');
    if (app.db.select({ id: legalDocuments.id }).from(legalDocuments).where(and(eq(legalDocuments.type, input.type), eq(legalDocuments.version, input.version))).get()) throw conflict('Diese Version existiert bereits. Versionen werden nie überschrieben.');
    const id = newId();
    app.db.transaction((tx) => {
      tx.update(legalDocuments).set({ isCurrent: false }).where(eq(legalDocuments.type, input.type)).run();
      tx.insert(legalDocuments).values({ id, type: input.type, version: input.version, title: input.title ?? LEGAL_LABEL[input.type], contentMarkdown: input.contentMarkdown, url: input.url, contentSha256: sha256(input.contentMarkdown ?? input.url ?? ''), requiresAcceptance: input.requiresAcceptance, isCurrent: true, publishedAt: nowIso(), createdByUserId: ctx.userId }).run();
    });
    writeAudit(app.db, ctx, { action: 'platform.legal_publish', entityType: 'legal_document', entityId: id, after: { type: input.type, version: input.version } });
    return { id };
  });
  app.get('/api/platform/legal-acceptances', pre, async (req) => {
    const { companyId } = parse(z.object({ companyId: z.string().uuid().optional() }), req.query);
    const q = app.db.select({ a: legalAcceptances, company: companies.name }).from(legalAcceptances).innerJoin(companies, eq(companies.id, legalAcceptances.companyId));
    return { items: (companyId ? q.where(eq(legalAcceptances.companyId, companyId)) : q).orderBy(desc(legalAcceptances.acceptedAt)).limit(500).all().map((r) => ({ ...r.a, companyName: r.company })) };
  });

  /* ---------------------------------------------------------- Vorfälle (betreiberweit) */
  app.get('/api/platform/incidents', pre, async () => ({ items: app.db.select().from(incidents).orderBy(desc(incidents.detectedAt)).limit(200).all() }));
  app.post('/api/platform/incidents', pre, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(incidentSchema.extend({ affectedTenants: z.array(z.string().uuid()).default([]) }), req.body);
    const { affectedTenants, ...rest } = input;
    const id = newId();
    app.db.insert(incidents).values({ id, companyId: null, ...rest, detectedAt: rest.detectedAt ?? nowIso(), affectedTenantsJson: JSON.stringify(affectedTenants), createdByUserId: ctx.userId }).run();
    writeAudit(app.db, ctx, { action: 'platform.incident_create', entityType: 'incident', entityId: id, after: { type: rest.type, severity: rest.severity, tenants: affectedTenants.length } });
    return app.db.select().from(incidents).where(eq(incidents.id, id)).get();
  });
  app.patch('/api/platform/incidents/:id', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(incidents).where(and(eq(incidents.id, id), isNull(incidents.companyId))).get();
    if (!before) throw notFound('Vorfall');
    const input = parse(incidentSchema.partial().extend({ affectedTenants: z.array(z.string().uuid()).optional(), notifyTenants: z.boolean().default(false) }), req.body);
    const { affectedTenants, notifyTenants, ...rest } = input;
    const tenants = affectedTenants ?? (JSON.parse(before.affectedTenantsJson) as string[]);
    app.db.update(incidents).set({ ...rest, ...(affectedTenants ? { affectedTenantsJson: JSON.stringify(affectedTenants) } : {}), ...(notifyTenants ? { tenantsNotifiedAt: nowIso() } : {}), updatedAt: nowIso() }).where(eq(incidents.id, id)).run();
    if (notifyTenants) {
      // Information der betroffenen Mandanten (Verantwortliche) – Art. 33 Abs. 2 DSGVO: Auftragsverarbeiter meldet unverzüglich
      for (const cid of tenants) for (const u of app.db.select().from(users).where(and(eq(users.companyId, cid), eq(users.role, 'admin'), eq(users.isActive, true))).all()) {
        if (app.mail.canSendAccountMail(cid)) await app.mail.sendAccountMail(cid, { to: u.email, subject: `Sicherheitshinweis: ${before.title}`, text: `Guten Tag ${u.firstName},\n\nwir informieren Sie über einen Vorfall, der Ihre Daten betreffen kann.\n\nArt: ${before.type}\nFestgestellt: ${before.detectedAt}\nBeschreibung: ${rest.description ?? before.description ?? '–'}\nMaßnahmen: ${rest.measures ?? before.measures ?? '–'}\n\nAls Verantwortlicher prüfen Sie bitte, ob eine Meldung an die Aufsichtsbehörde (Art. 33 DSGVO, in der Regel binnen 72 Stunden) oder eine Information der Betroffenen (Art. 34 DSGVO) erforderlich ist. Details finden Sie unter Einstellungen → Datenschutz → Vorfälle.`, refType: 'incident' });
      }
    }
    writeAudit(app.db, ctx, { action: 'platform.incident_update', entityType: 'incident', entityId: id, after: { status: rest.status, notifyTenants } });
    return app.db.select().from(incidents).where(eq(incidents.id, id)).get();
  });

  /* ---------------------------------------------------------- Mandantenlöschung */
  app.post('/api/platform/companies/:id/delete', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { confirmName, reason } = parse(z.object({ confirmName: z.string(), reason: zTrimmed(500).min(5) }), req.body);
    const c = app.db.select().from(companies).where(eq(companies.id, id)).get();
    if (!c || c.deletedAt) throw notFound('Mandant');
    if (id === ctx.companyId) throw badRequest('Der eigene Mandant kann nicht gelöscht werden.');
    if (confirmName !== c.name) throw badRequest('Zur Bestätigung den Namen des Mandanten exakt eingeben.');
    const sub = subscriptionOf(app.db, id);
    if (app.config.deploymentMode === 'saas' && sub && !['expired', 'cancelled'].includes(sub.status)) throw conflict('Das Abonnement ist noch aktiv. Löschung erst nach Vertragsende.');
    if (c.isActive && app.config.deploymentMode !== 'saas') throw conflict('Bitte den Mandanten zuerst deaktivieren.');
    const counts = purgeTenant(app, id, reason, ctx.userId);
    writeAudit(app.db, ctx, { action: 'platform.tenant_delete', entityType: 'company', entityId: id, after: { reason, counts } });
    return { ok: true, counts, note: 'Sicherungen enthalten die Daten bis zu ihrer Rotation. Nach einer Wiederherstellung wird die Löschung automatisch erneut angewendet.' };
  });
}
