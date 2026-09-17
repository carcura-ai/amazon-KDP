import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { offers, offerItems, customers, vehicles, leads, orders, orderItems, invoices, invoiceItems } from '../../db/schema.js';
import { parse, zOptionalText, zPagination, zEmail } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nextNumber } from '../../core/numbering.js';
import { lineItemSchema } from '../../core/lineItems.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from '../crm/activities.js';
import { offerBody, dateDe } from '../../integrations/pdf-templates.js';
import { offerMailText } from '../../integrations/templates.js';
import { today, addDays, companyOf, customerOf, vehicleOf, assertServices, itemRows, totalsFor, renderDocument } from './common.js';

export const OFFER_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
const fields = {
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable(),
  leadId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  title: zOptionalText(200),
  introText: zOptionalText(2000),
  notes: zOptionalText(3000),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  items: z.array(lineItemSchema).max(100),
};
const createSchema = z.object({ ...fields, vehicleId: fields.vehicleId.default(null), leadId: fields.leadId.default(null), orderId: fields.orderId.default(null), issueDate: fields.issueDate.default(today), validUntil: fields.validUntil.optional(), items: fields.items.default([]) });
const updateSchema = z.object(fields).partial();

export default async function offerRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(offers).where(and(eq(offers.id, id), eq(offers.companyId, companyId))).get();
    if (!row) throw notFound('Angebot');
    return row;
  };
  const items = (id: string) => app.db.select().from(offerItems).where(eq(offerItems.offerId, id)).orderBy(asc(offerItems.sortOrder)).all();
  const detail = (companyId: string, id: string) => {
    const o = getOne(companyId, id);
    const its = items(id);
    return { offer: o, items: its, customer: app.db.select().from(customers).where(eq(customers.id, o.customerId)).get() ?? null, vehicle: o.vehicleId ? app.db.select().from(vehicles).where(eq(vehicles.id, o.vehicleId)).get() ?? null : null, totals: totalsFor(app, companyId, its), invoice: app.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status }).from(invoices).where(eq(invoices.offerId, id)).get() ?? null, order: o.orderId ? app.db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status }).from(orders).where(eq(orders.id, o.orderId)).get() ?? null : null };
  };
  const writeItems = (companyId: string, id: string, list: z.infer<typeof lineItemSchema>[]) => {
    assertServices(app, companyId, list);
    app.db.delete(offerItems).where(eq(offerItems.offerId, id)).run();
    for (const row of itemRows(companyId, { offerId: id }, list)) app.db.insert(offerItems).values(row).run();
    const t = totalsFor(app, companyId, list);
    app.db.update(offers).set({ subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents, updatedAt: nowIso() }).where(eq(offers.id, id)).run();
  };
  const renderPdf = async (companyId: string, id: string) => {
    const d = detail(companyId, id);
    if (!d.customer) throw notFound('Kunde');
    return renderDocument(app, companyId, { title: 'Angebot', docNumber: d.offer.offerNumber, docDate: dateDe(d.offer.issueDate), body: offerBody(d.offer, d.items, companyOf(app, companyId), d.customer, d.vehicle, d.totals), footerExtra: `Angebot ${d.offer.offerNumber}` });
  };
  const setLeadStatus = (companyId: string, leadId: string | null, status: string) => {
    if (!leadId) return;
    const l = app.db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.companyId, companyId))).get();
    if (l && !['won', 'lost'].includes(l.status)) app.db.update(leads).set({ status, updatedAt: nowIso() }).where(eq(leads.id, leadId)).run();
  };

  app.get('/api/offers', { preHandler: app.requireAuth('offers:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ status: z.enum(OFFER_STATUS).optional(), customerId: z.string().uuid().optional(), leadId: z.string().uuid().optional() }), req.query);
    const conds = [eq(offers.companyId, ctx.companyId)];
    if (q.status) conds.push(eq(offers.status, q.status));
    if (q.customerId) conds.push(eq(offers.customerId, q.customerId));
    if (q.leadId) conds.push(eq(offers.leadId, q.leadId));
    if (q.q) { const t = `%${q.q}%`; conds.push(or(like(offers.offerNumber, t), like(offers.title, t), like(customers.firstName, t), like(customers.lastName, t), like(customers.companyName, t))!); }
    const where = and(...conds);
    const rows = app.db.select({ offer: offers, customer: { id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName } }).from(offers).innerJoin(customers, eq(customers.id, offers.customerId)).where(where).orderBy(desc(offers.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(offers).innerJoin(customers, eq(customers.id, offers.customerId)).where(where).get()?.n ?? 0;
    return { items: rows, total, page: q.page, pageSize: q.pageSize };
  });

  app.get('/api/offers/:id', { preHandler: app.requireAuth('offers:read') }, async (req) => detail(ctxOf(req).companyId, (req.params as { id: string }).id));

  app.post('/api/offers', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { items: list, ...input } = parse(createSchema, req.body);
    customerOf(app, ctx.companyId, input.customerId);
    vehicleOf(app, ctx.companyId, input.vehicleId);
    const company = companyOf(app, ctx.companyId);
    const id = newId();
    const offerNumber = nextNumber(app.db, ctx.companyId, 'offer', company.offerPrefix, true);
    app.db.insert(offers).values({ id, companyId: ctx.companyId, offerNumber, ...input, validUntil: input.validUntil === undefined ? addDays(input.issueDate, 14) : input.validUntil, createdByUserId: ctx.userId }).run();
    writeItems(ctx.companyId, id, list);
    setLeadStatus(ctx.companyId, input.leadId, 'offer_created');
    logActivity(app.db, ctx.companyId, { customerId: input.customerId, leadId: input.leadId, vehicleId: input.vehicleId, userId: ctx.userId, type: 'offer', subject: `Angebot ${offerNumber} erstellt`, content: input.title, refType: 'offer', refId: id });
    writeAudit(app.db, ctx, { action: 'offer.create', entityType: 'offer', entityId: id, after: { offerNumber, items: list.length } });
    return detail(ctx.companyId, id);
  });

  app.patch('/api/offers/:id', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { items: list, ...input } = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    if (['accepted', 'rejected'].includes(before.status)) throw conflict('Angenommene oder abgelehnte Angebote sind nicht mehr änderbar.');
    if (input.customerId) customerOf(app, ctx.companyId, input.customerId);
    if (input.vehicleId) vehicleOf(app, ctx.companyId, input.vehicleId);
    app.db.update(offers).set({ ...input, updatedAt: nowIso() }).where(eq(offers.id, id)).run();
    if (list) writeItems(ctx.companyId, id, list);
    writeAudit(app.db, ctx, { action: 'offer.update', entityType: 'offer', entityId: id });
    return detail(ctx.companyId, id);
  });

  app.post('/api/offers/:id/status', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: z.enum(OFFER_STATUS) }), req.body);
    const before = getOne(ctx.companyId, id);
    app.db.update(offers).set({ status, acceptedAt: status === 'accepted' ? nowIso() : before.acceptedAt, sentAt: status === 'sent' && !before.sentAt ? nowIso() : before.sentAt, updatedAt: nowIso() }).where(eq(offers.id, id)).run();
    if (status === 'accepted') setLeadStatus(ctx.companyId, before.leadId, 'order');
    if (status === 'sent') setLeadStatus(ctx.companyId, before.leadId, 'offer_sent');
    const label: Record<string, string> = { draft: 'Entwurf', sent: 'versendet', accepted: 'angenommen', rejected: 'abgelehnt', expired: 'abgelaufen' };
    logActivity(app.db, ctx.companyId, { customerId: before.customerId, leadId: before.leadId, userId: ctx.userId, type: 'status', subject: `Angebot ${before.offerNumber}: ${label[status]}`, refType: 'offer', refId: id });
    writeAudit(app.db, ctx, { action: 'offer.status', entityType: 'offer', entityId: id, before: { status: before.status }, after: { status } });
    return detail(ctx.companyId, id);
  });

  app.get('/api/offers/:id/pdf', { preHandler: app.requireAuth('offers:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const o = getOne(ctx.companyId, id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${o.offerNumber}.pdf"`);
    return reply.send(await renderPdf(ctx.companyId, id));
  });

  /** Versand per E-Mail mit PDF-Anhang; PDF wird zusätzlich in der Kundenakte abgelegt. */
  app.post('/api/offers/:id/send', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const o = getOne(ctx.companyId, id);
    const customer = customerOf(app, ctx.companyId, o.customerId);
    const company = companyOf(app, ctx.companyId);
    const tpl = offerMailText(company, customer, o.offerNumber, o.validUntil);
    const input = parse(z.object({ to: zEmail.optional(), subject: z.string().trim().max(200).optional(), message: z.string().trim().max(5000).optional() }), req.body ?? {});
    const to = input.to ?? customer.email;
    if (!to) throw badRequest('Der Kunde hat keine E-Mail-Adresse.');
    if (!app.mail.isConfigured(ctx.companyId)) throw badRequest('Kein E-Mail-Versand (SMTP) konfiguriert.');
    const pdf = await renderPdf(ctx.companyId, id);
    const res = await app.mail.send(ctx.companyId, { to, subject: input.subject ?? tpl.subject, text: input.message ?? tpl.text, attachments: [{ filename: `${o.offerNumber}.pdf`, content: pdf, contentType: 'application/pdf' }], refType: 'offer', refId: id });
    if (!res.ok) throw badRequest(`Versand fehlgeschlagen: ${res.error}`);
    if (o.pdfFileId) app.storage.remove(ctx.companyId, o.pdfFileId);
    const file = await app.storage.store({ companyId: ctx.companyId, buffer: pdf, originalName: `${o.offerNumber}.pdf`, mimeType: 'application/pdf', kind: 'pdf', category: 'offer', customerId: o.customerId, vehicleId: o.vehicleId, uploadedByUserId: ctx.userId });
    app.db.update(offers).set({ status: o.status === 'draft' ? 'sent' : o.status, sentAt: nowIso(), pdfFileId: file.id, updatedAt: nowIso() }).where(eq(offers.id, id)).run();
    setLeadStatus(ctx.companyId, o.leadId, 'offer_sent');
    logActivity(app.db, ctx.companyId, { customerId: o.customerId, leadId: o.leadId, userId: ctx.userId, type: 'email', direction: 'out', subject: `Angebot ${o.offerNumber} per E-Mail gesendet`, content: `An ${to}`, refType: 'offer', refId: id });
    writeAudit(app.db, ctx, { action: 'offer.send', entityType: 'offer', entityId: id, after: { to } });
    return detail(ctx.companyId, id);
  });

  /** Angenommenes Angebot in Auftrag oder Rechnung überführen (Positionen werden kopiert). */
  app.post('/api/offers/:id/convert', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { to } = parse(z.object({ to: z.enum(['order', 'invoice']) }), req.body);
    const o = getOne(ctx.companyId, id);
    const its = items(id);
    const t = totalsFor(app, ctx.companyId, its);
    if (to === 'order') {
      if (o.orderId) throw conflict('Zu diesem Angebot existiert bereits ein Auftrag.', { orderId: o.orderId });
      const orderId = newId();
      const orderNumber = nextNumber(app.db, ctx.companyId, 'order', 'AU', true);
      app.db.insert(orders).values({ id: orderId, companyId: ctx.companyId, orderNumber, customerId: o.customerId, vehicleId: o.vehicleId, leadId: o.leadId, title: o.title ?? `Angebot ${o.offerNumber}`, notes: o.notes, subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents }).run();
      for (const it of its) app.db.insert(orderItems).values({ id: newId(), companyId: ctx.companyId, orderId, serviceId: it.serviceId, name: it.name, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, vatBp: it.vatBp, totalCents: it.totalCents, sortOrder: it.sortOrder }).run();
      app.db.update(offers).set({ orderId, status: o.status === 'accepted' ? 'accepted' : 'accepted', acceptedAt: o.acceptedAt ?? nowIso(), updatedAt: nowIso() }).where(eq(offers.id, id)).run();
      setLeadStatus(ctx.companyId, o.leadId, 'order');
      logActivity(app.db, ctx.companyId, { customerId: o.customerId, leadId: o.leadId, vehicleId: o.vehicleId, userId: ctx.userId, type: 'system', subject: `Auftrag ${orderNumber} aus Angebot ${o.offerNumber} erstellt`, refType: 'order', refId: orderId });
      writeAudit(app.db, ctx, { action: 'offer.to_order', entityType: 'offer', entityId: id, after: { orderId } });
      return { orderId, orderNumber };
    }
    const existing = app.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.offerId, id), sql`${invoices.status} != 'cancelled'`)).get();
    if (existing) throw conflict('Zu diesem Angebot existiert bereits eine Rechnung.', { invoiceId: existing.id });
    const invoiceId = newId();
    app.db.insert(invoices).values({ id: invoiceId, companyId: ctx.companyId, customerId: o.customerId, vehicleId: o.vehicleId, orderId: o.orderId, offerId: id, title: o.title, notes: o.notes, subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents, createdByUserId: ctx.userId }).run();
    for (const it of its) app.db.insert(invoiceItems).values({ id: newId(), companyId: ctx.companyId, invoiceId, serviceId: it.serviceId, name: it.name, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, vatBp: it.vatBp, totalCents: it.totalCents, sortOrder: it.sortOrder }).run();
    writeAudit(app.db, ctx, { action: 'offer.to_invoice', entityType: 'offer', entityId: id, after: { invoiceId } });
    return { invoiceId };
  });

  app.delete('/api/offers/:id', { preHandler: app.requireAuth('offers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const o = getOne(ctx.companyId, id);
    if (o.status !== 'draft') throw badRequest('Nur Entwürfe können gelöscht werden; versendete Angebote bitte als abgelehnt/abgelaufen markieren.');
    app.db.delete(offerItems).where(eq(offerItems.offerId, id)).run();
    app.db.delete(offers).where(eq(offers.id, id)).run();
    writeAudit(app.db, ctx, { action: 'offer.delete', entityType: 'offer', entityId: id, before: { offerNumber: o.offerNumber } });
    return { ok: true };
  });
}
