import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { and, desc, eq, gte, sql, isNotNull, isNull } from 'drizzle-orm';
import { companies, customers, leads, privacyRequests, deletionLog, dataExports, subprocessors, incidents, aiUsageLog, integrations, jobs } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { privacySettings } from './settings.js';
import { logDeletion, searchSubjects } from './lifecycle.js';
import { buildCustomerExport, buildTenantExport } from './export.js';

const REQUEST_TYPES = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'] as const;

/**
 * Datenschutz-Center des Mandanten (Einstellungen → Datenschutz):
 * Einschränkung (Art. 18), Betroffenenanfragen mit Fristen, Löschsuche mit Abhängigkeiten,
 * Löschprotokoll, Export einer Person (Art. 20) und des gesamten Mandanten, Subprozessoren,
 * Vorfälle, Übersicht.
 */
export default async function privacyCenterRoutes(app: FastifyInstance) {
  const customerOf = (companyId: string, id: string) => {
    const c = app.db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, companyId))).get();
    if (!c) throw notFound('Kunde');
    return c;
  };

  /* ---------------------------------------------------------- Einschränkung (Art. 18) */
  app.post('/api/customers/:id/restrict', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { reason } = parse(z.object({ reason: zTrimmed(500).min(3) }), req.body);
    const c = customerOf(ctx.companyId, id);
    if (c.anonymizedAt) throw badRequest('Der Kunde ist bereits anonymisiert.');
    app.db.update(customers).set({ restrictedAt: nowIso(), restrictionReason: reason, updatedAt: nowIso() }).where(eq(customers.id, id)).run();
    logDeletion(app.db, { companyId: ctx.companyId, subjectType: 'customer', subjectRef: c.customerNumber, action: 'restricted', reason, userId: ctx.userId });
    writeAudit(app.db, ctx, { action: 'customer.restrict', entityType: 'customer', entityId: id, after: { reason } });
    return { ok: true };
  });
  app.delete('/api/customers/:id/restrict', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const c = customerOf(ctx.companyId, id);
    if (!c.restrictedAt) throw badRequest('Die Verarbeitung ist nicht eingeschränkt.');
    app.db.update(customers).set({ restrictedAt: null, restrictionReason: null, updatedAt: nowIso() }).where(eq(customers.id, id)).run();
    logDeletion(app.db, { companyId: ctx.companyId, subjectType: 'customer', subjectRef: c.customerNumber, action: 'unrestricted', reason: 'Einschränkung aufgehoben', userId: ctx.userId });
    writeAudit(app.db, ctx, { action: 'customer.unrestrict', entityType: 'customer', entityId: id });
    return { ok: true };
  });

  /* ---------------------------------------------------------- Löschsuche */
  app.get('/api/privacy/subjects', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(100) }), req.query);
    writeAudit(app.db, ctx, { action: 'privacy.subject_search', entityType: 'privacy', entityId: null });
    return searchSubjects(app.db, ctx.companyId, q);
  });

  app.delete('/api/privacy/leads/:id', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const l = app.db.select().from(leads).where(and(eq(leads.id, id), eq(leads.companyId, ctx.companyId))).get();
    if (!l) throw notFound('Lead');
    if (l.customerId) throw badRequest('Dieser Lead ist einem Kunden zugeordnet. Bitte den Kunden löschen.');
    app.db.delete(leads).where(eq(leads.id, id)).run();
    logDeletion(app.db, { companyId: ctx.companyId, subjectType: 'lead', subjectRef: null, action: 'deleted', reason: 'Löschung auf Anfrage (Art. 17 DSGVO)', userId: ctx.userId });
    writeAudit(app.db, ctx, { action: 'lead.delete_privacy', entityType: 'lead', entityId: id });
    return { ok: true };
  });

  app.get('/api/privacy/deletion-log', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select().from(deletionLog).where(eq(deletionLog.companyId, ctx.companyId)).orderBy(desc(deletionLog.createdAt)).limit(300).all() };
  });

  /* ---------------------------------------------------------- Betroffenenanfragen */
  app.get('/api/privacy/requests', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select().from(privacyRequests).where(eq(privacyRequests.companyId, ctx.companyId)).orderBy(desc(privacyRequests.receivedAt)).all(), types: REQUEST_TYPES };
  });
  app.post('/api/privacy/requests', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ type: z.enum(REQUEST_TYPES), subjectName: zTrimmed(160).min(2), subjectContact: zOptionalText(200), customerId: z.string().uuid().nullable().default(null), receivedAt: z.string().datetime({ offset: true }).optional(), notes: zOptionalText(3000) }), req.body);
    if (input.customerId) customerOf(ctx.companyId, input.customerId);
    const received = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const due = new Date(received); due.setMonth(due.getMonth() + 1); // Art. 12 Abs. 3 DSGVO: grundsätzlich ein Monat
    const id = newId();
    app.db.insert(privacyRequests).values({ id, companyId: ctx.companyId, type: input.type, subjectName: input.subjectName, subjectContact: input.subjectContact, customerId: input.customerId, receivedAt: received.toISOString(), dueAt: due.toISOString(), notes: input.notes, handledByUserId: ctx.userId }).run();
    writeAudit(app.db, ctx, { action: 'privacy.request_create', entityType: 'privacy_request', entityId: id, after: { type: input.type } });
    return app.db.select().from(privacyRequests).where(eq(privacyRequests.id, id)).get();
  });
  app.patch('/api/privacy/requests/:id', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(privacyRequests).where(and(eq(privacyRequests.id, id), eq(privacyRequests.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Anfrage');
    const input = parse(z.object({ status: z.enum(['open', 'in_progress', 'completed', 'rejected']), notes: zOptionalText(3000), result: zOptionalText(3000), dueAt: z.string().datetime({ offset: true }) }).partial(), req.body);
    const done = input.status === 'completed' || input.status === 'rejected';
    app.db.update(privacyRequests).set({ ...input, completedAt: done ? nowIso() : before.completedAt, handledByUserId: ctx.userId, updatedAt: nowIso() }).where(eq(privacyRequests.id, id)).run();
    writeAudit(app.db, ctx, { action: 'privacy.request_update', entityType: 'privacy_request', entityId: id, after: { status: input.status } });
    return app.db.select().from(privacyRequests).where(eq(privacyRequests.id, id)).get();
  });

  /* ---------------------------------------------------------- Exporte */
  app.get('/api/customers/:id/export.zip', { preHandler: app.requireAuth('customers:read', 'export:manage') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    customerOf(ctx.companyId, id);
    const zip = await buildCustomerExport(app, ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'customer.export_zip', entityType: 'customer', entityId: id });
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${zip.name}"`);
    const stream = fs.createReadStream(zip.path);
    stream.on('close', () => fs.rmSync(zip.path, { force: true }));
    return reply.send(stream);
  });

  app.get('/api/tenant-export', { preHandler: app.requireAuth('export:manage') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select({ id: dataExports.id, scope: dataExports.scope, status: dataExports.status, sizeBytes: dataExports.sizeBytes, sha256: dataExports.sha256, contentsJson: dataExports.contentsJson, error: dataExports.error, createdAt: dataExports.createdAt, completedAt: dataExports.completedAt, expiresAt: dataExports.expiresAt, downloadedAt: dataExports.downloadedAt, formatVersion: dataExports.formatVersion }).from(dataExports).where(and(eq(dataExports.companyId, ctx.companyId), eq(dataExports.scope, 'tenant'))).orderBy(desc(dataExports.createdAt)).limit(20).all() };
  });
  app.post('/api/tenant-export', { preHandler: app.requireAuth('export:manage'), config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (req) => {
    const ctx = ctxOf(req);
    const running = app.db.select({ id: dataExports.id }).from(dataExports).where(and(eq(dataExports.companyId, ctx.companyId), eq(dataExports.status, 'running'))).get();
    if (running) throw conflict('Ein Export wird bereits erstellt.');
    const e = await buildTenantExport(app, ctx.companyId, ctx.userId);
    writeAudit(app.db, ctx, { action: 'tenant.export', entityType: 'data_export', entityId: e.id, after: { sizeBytes: e.sizeBytes, sha256: e.sha256 } });
    return { id: e.id, status: e.status, sizeBytes: e.sizeBytes, sha256: e.sha256, expiresAt: e.expiresAt };
  });
  app.get('/api/tenant-export/:id/download', { preHandler: app.requireAuth('export:manage') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const e = app.db.select().from(dataExports).where(and(eq(dataExports.id, id), eq(dataExports.companyId, ctx.companyId))).get();
    if (!e || e.status !== 'ready' || !e.storagePath || !fs.existsSync(e.storagePath)) throw notFound('Export');
    app.db.update(dataExports).set({ downloadedAt: nowIso() }).where(eq(dataExports.id, id)).run();
    writeAudit(app.db, ctx, { action: 'tenant.export_download', entityType: 'data_export', entityId: id });
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="datenexport-${e.createdAt.slice(0, 10)}.zip"`);
    return reply.send(fs.createReadStream(e.storagePath));
  });

  /* ---------------------------------------------------------- Subprozessoren und Vorfälle */
  app.get('/api/privacy/subprocessors', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const active = new Set(app.db.select({ t: integrations.type }).from(integrations).where(and(eq(integrations.companyId, ctx.companyId), eq(integrations.isActive, true))).all().map((r) => r.t));
    return { items: app.db.select().from(subprocessors).where(eq(subprocessors.isActive, true)).all().map((s) => ({ ...s, usedByTenant: s.activation === 'always' || (s.integrationType ? active.has(s.integrationType) : false) })) };
  });

  app.get('/api/privacy/incidents', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const own = app.db.select().from(incidents).where(eq(incidents.companyId, ctx.companyId)).all();
    const platform = app.db.select().from(incidents).where(isNull(incidents.companyId)).all().filter((i) => (JSON.parse(i.affectedTenantsJson) as string[]).includes(ctx.companyId))
      .map((i) => ({ ...i, affectedTenantsJson: '[]' }));
    return { items: [...own, ...platform].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)) };
  });
  app.post('/api/privacy/incidents', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(incidentSchema, req.body);
    const id = newId();
    app.db.insert(incidents).values({ id, companyId: ctx.companyId, ...input, detectedAt: input.detectedAt ?? nowIso(), createdByUserId: ctx.userId }).run();
    writeAudit(app.db, ctx, { action: 'incident.create', entityType: 'incident', entityId: id, after: { type: input.type, severity: input.severity } });
    return app.db.select().from(incidents).where(eq(incidents.id, id)).get();
  });
  app.patch('/api/privacy/incidents/:id', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    if (!app.db.select({ id: incidents.id }).from(incidents).where(and(eq(incidents.id, id), eq(incidents.companyId, ctx.companyId))).get()) throw notFound('Vorfall');
    const input = parse(incidentSchema.partial(), req.body);
    app.db.update(incidents).set({ ...input, updatedAt: nowIso() }).where(eq(incidents.id, id)).run();
    writeAudit(app.db, ctx, { action: 'incident.update', entityType: 'incident', entityId: id, after: { status: input.status } });
    return app.db.select().from(incidents).where(eq(incidents.id, id)).get();
  });

  /* ---------------------------------------------------------- Übersicht */
  app.get('/api/privacy/dashboard', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const cid = ctx.companyId;
    const company = app.db.select().from(companies).where(eq(companies.id, cid)).get()!;
    const n = (q: ReturnType<typeof sql>) => app.db.get<{ n: number }>(q)?.n ?? 0;
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const retentionJob = app.db.select().from(jobs).where(eq(jobs.type, 'privacy.retention')).orderBy(desc(jobs.runAt)).limit(1).get();
    const backupJob = app.db.select().from(jobs).where(eq(jobs.type, 'backup.daily')).orderBy(desc(jobs.runAt)).limit(1).get();
    return {
      customers: {
        active: n(sql`select count(*) as n from customers where company_id = ${cid} and anonymized_at is null and restricted_at is null`),
        restricted: n(sql`select count(*) as n from customers where company_id = ${cid} and restricted_at is not null`),
        anonymizedInRetention: n(sql`select count(*) as n from customers where company_id = ${cid} and anonymized_at is not null`),
        nextRetentionEnd: app.db.select({ d: customers.retentionUntil }).from(customers).where(and(eq(customers.companyId, cid), isNotNull(customers.retentionUntil))).orderBy(customers.retentionUntil).limit(1).get()?.d ?? null,
      },
      leads: n(sql`select count(*) as n from leads where company_id = ${cid}`),
      dataCategories: ['Kontaktdaten (Name, Anschrift, E-Mail, Telefon)', 'Fahrzeugdaten (Hersteller, Modell, Kennzeichen)', 'Auftrags-, Angebots- und Rechnungsdaten', 'Fotos und Protokolle (können Personen oder Kennzeichen zeigen)', 'Kommunikationsverlauf', 'Unterschriften', 'Beschäftigtendaten der Benutzer (Anmeldungen, Protokoll)'],
      retention: privacySettings(company),
      requests: {
        open: n(sql`select count(*) as n from privacy_requests where company_id = ${cid} and status in ('open','in_progress')`),
        overdue: n(sql`select count(*) as n from privacy_requests where company_id = ${cid} and status in ('open','in_progress') and due_at < ${nowIso()}`),
      },
      deletionsLast30: n(sql`select count(*) as n from deletion_log where company_id = ${cid} and created_at >= ${since30}`),
      exports: app.db.select({ id: dataExports.id, status: dataExports.status, createdAt: dataExports.createdAt, expiresAt: dataExports.expiresAt }).from(dataExports).where(eq(dataExports.companyId, cid)).orderBy(desc(dataExports.createdAt)).limit(5).all(),
      integrations: app.db.select({ type: integrations.type, name: integrations.name, status: integrations.status }).from(integrations).where(and(eq(integrations.companyId, cid), eq(integrations.isActive, true))).all(),
      ai: {
        requestsLast30: n(sql`select count(*) as n from ai_usage_log where company_id = ${cid} and created_at >= ${since30}`),
        withPersonalDataLast30: n(sql`select count(*) as n from ai_usage_log where company_id = ${cid} and personal_data = 1 and created_at >= ${since30}`),
        personalDataAllowed: privacySettings(company).assistantPersonalData,
      },
      openIncidents: app.db.select({ n: sql<number>`count(*)` }).from(incidents).where(and(eq(incidents.companyId, cid), sql`${incidents.status} in ('open','contained')`)).get()!.n,
      lastRetentionRun: retentionJob ? { at: retentionJob.finishedAt ?? retentionJob.runAt, status: retentionJob.status } : null,
      lastBackup: backupJob ? { at: backupJob.finishedAt ?? backupJob.runAt, status: backupJob.status } : null,
      aiUsage: app.db.select({ createdAt: aiUsageLog.createdAt, model: aiUsageLog.model, personalData: aiUsageLog.personalData, toolsJson: aiUsageLog.toolsJson }).from(aiUsageLog).where(and(eq(aiUsageLog.companyId, cid), gte(aiUsageLog.createdAt, since30))).orderBy(desc(aiUsageLog.createdAt)).limit(20).all(),
    };
  });
}

const incidentSchema = z.object({
  title: zTrimmed(200).min(3),
  type: z.enum(['data_breach', 'account_compromise', 'credential_loss', 'outage', 'malware', 'backup_failure', 'cross_tenant_bug', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'contained', 'resolved', 'closed']).default('open'),
  occurredAt: z.string().datetime({ offset: true }).nullable().optional(),
  detectedAt: z.string().datetime({ offset: true }).optional(),
  personalDataAffected: z.boolean().default(false),
  description: zOptionalText(5000),
  measures: zOptionalText(5000),
  authorityNotifiedAt: z.string().datetime({ offset: true }).nullable().optional(),
  subjectsNotifiedAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export { incidentSchema };
