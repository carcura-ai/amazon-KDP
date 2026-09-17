import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { companies, customers, vehicles, activities, leads, tasks, appointments, orders, orderItems, offers, offerItems, invoices, invoiceItems, payments, protocols, protocolDamages, files, emailLog } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { notFound, badRequest } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nowIso } from '../../core/ids.js';
import { ctxOf } from '../../plugins/auth.js';
import { publicCompany } from '../auth/routes.js';
import { privacySchema, privacySettings } from './settings.js';
import { anonymizeCustomer, deleteCustomerCompletely, hasRetentionDocuments } from './anonymize.js';
import { runRetention } from './retention.js';

/** Auskunft nach Art. 15 DSGVO: alle zu einer Person gespeicherten Daten in einer Datei. */
export function customerDossier(app: FastifyInstance, companyId: string, customerId: string) {
  const customer = app.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get();
  if (!customer) throw notFound('Kunde');
  const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
  const vehicleRows = app.db.select().from(vehicles).where(and(eq(vehicles.customerId, customerId), eq(vehicles.companyId, companyId))).all();
  const orderRows = app.db.select().from(orders).where(and(eq(orders.customerId, customerId), eq(orders.companyId, companyId))).all();
  const offerRows = app.db.select().from(offers).where(and(eq(offers.customerId, customerId), eq(offers.companyId, companyId))).all();
  const invoiceRows = app.db.select().from(invoices).where(and(eq(invoices.customerId, customerId), eq(invoices.companyId, companyId))).all();
  const protocolRows = app.db.select().from(protocols).where(and(eq(protocols.customerId, customerId), eq(protocols.companyId, companyId))).all();
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);
  const { websiteLeadToken: _t, ...companyPublic } = company;
  return {
    exportedAt: nowIso(), purpose: 'Auskunft nach Art. 15 DSGVO / Datenübertragbarkeit nach Art. 20 DSGVO',
    responsible: { name: companyPublic.legalName ?? companyPublic.name, address: [companyPublic.street, [companyPublic.zip, companyPublic.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), email: companyPublic.email, phone: companyPublic.phone },
    customer, vehicles: vehicleRows,
    leads: app.db.select().from(leads).where(and(eq(leads.customerId, customerId), eq(leads.companyId, companyId))).all(),
    activities: app.db.select().from(activities).where(and(eq(activities.customerId, customerId), eq(activities.companyId, companyId))).all(),
    appointments: app.db.select().from(appointments).where(and(eq(appointments.customerId, customerId), eq(appointments.companyId, companyId))).all(),
    tasks: app.db.select().from(tasks).where(and(eq(tasks.customerId, customerId), eq(tasks.companyId, companyId))).all(),
    orders: orderRows.map((o) => ({ ...o, items: app.db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).all() })),
    offers: offerRows.map((o) => ({ ...o, items: app.db.select().from(offerItems).where(eq(offerItems.offerId, o.id)).all() })),
    invoices: invoiceRows.map((i) => ({ ...i, items: app.db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, i.id)).all(), payments: app.db.select().from(payments).where(eq(payments.invoiceId, i.id)).all() })),
    protocols: protocolRows.map((p) => ({ ...p, damages: app.db.select().from(protocolDamages).where(eq(protocolDamages.protocolId, p.id)).all() })),
    files: app.db.select({ id: files.id, kind: files.kind, category: files.category, originalName: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, caption: files.caption, createdAt: files.createdAt, vehicleId: files.vehicleId, protocolId: files.protocolId, orderId: files.orderId }).from(files).where(and(eq(files.companyId, companyId), sql`(${files.customerId} = ${customerId}${vehicleRows.length ? sql` or ${files.vehicleId} in ${ids(vehicleRows)}` : sql``}${protocolRows.length ? sql` or ${files.protocolId} in ${ids(protocolRows)}` : sql``})`)).all(),
    emails: customer.email ? app.db.select({ toAddress: emailLog.toAddress, subject: emailLog.subject, status: emailLog.status, createdAt: emailLog.createdAt }).from(emailLog).where(and(eq(emailLog.companyId, companyId), eq(emailLog.toAddress, customer.email))).all() : [],
    processors: ['E-Mail-Versand über den konfigurierten SMTP-Anbieter', 'optional: Windsor.ai / Meta (Lead-Import), Anthropic (KI-Assistent, nur wenn freigegeben)'],
  };
}

export default async function privacyRoutes(app: FastifyInstance) {
  app.get('/api/privacy/settings', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    return { settings: privacySettings(company), https: app.config.publicUrl.startsWith('https://'), publicUrl: app.config.publicUrl };
  });

  app.put('/api/privacy/settings', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(privacySchema, req.body);
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const settings = JSON.parse(company.settingsJson || '{}') as Record<string, unknown>;
    const before = privacySettings(company);
    settings.privacy = input;
    app.db.update(companies).set({ settingsJson: JSON.stringify(settings), updatedAt: nowIso() }).where(eq(companies.id, ctx.companyId)).run();
    writeAudit(app.db, ctx, { action: 'privacy.settings_update', entityType: 'company', entityId: ctx.companyId, before, after: input });
    return { settings: input };
  });

  /** Aufbewahrungslauf manuell starten (sonst täglich automatisch). */
  app.post('/api/privacy/retention/run', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const summary = runRetention(app.db, app.storage);
    writeAudit(app.db, ctx, { action: 'privacy.retention_run', entityType: 'company', entityId: ctx.companyId, after: { summary } });
    return { summary };
  });

  /** Löschung nach Art. 17 DSGVO: anonymisieren (Belege bleiben) oder – ohne Belege – vollständig löschen. */
  app.post('/api/customers/:id/anonymize', { preHandler: app.requireAuth('customers:delete') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const c = app.db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, ctx.companyId))).get();
    if (!c) throw notFound('Kunde');
    if (c.anonymizedAt) throw badRequest('Dieser Kunde wurde bereits anonymisiert.');
    const retention = hasRetentionDocuments(app.db, ctx.companyId, id);
    const result = retention ? anonymizeCustomer(app.db, app.storage, ctx.companyId, id) : deleteCustomerCompletely(app.db, app.storage, ctx.companyId, id);
    writeAudit(app.db, ctx, { action: retention ? 'customer.anonymize' : 'customer.delete_hard', entityType: 'customer', entityId: id, before: { customerNumber: c.customerNumber }, after: { ...result, mode: retention ? 'anonymized' : 'deleted' } });
    return { ok: true, mode: retention ? 'anonymized' : 'deleted', ...result };
  });

  /** Auskunft als JSON-Datei. */
  app.get('/api/customers/:id/dossier', { preHandler: app.requireAuth('customers:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const data = customerDossier(app, ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'customer.dossier_export', entityType: 'customer', entityId: id });
    reply.header('Content-Disposition', `attachment; filename="auskunft-${data.customer.customerNumber}.json"`);
    return data;
  });
  void inArray; void publicCompany;
}
