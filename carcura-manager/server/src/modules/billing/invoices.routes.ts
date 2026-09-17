import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, gte, like, or, sql } from 'drizzle-orm';
import { invoices, invoiceItems, payments, customers, vehicles, orders, orderItems } from '../../db/schema.js';
import { parse, zOptionalText, zPagination, zEmail } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nextNumber } from '../../core/numbering.js';
import { lineItemSchema } from '../../core/lineItems.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from '../crm/activities.js';
import { invoiceBody, dateDe } from '../../integrations/pdf-templates.js';
import { invoiceMailText } from '../../integrations/templates.js';
import { today, addDays, companyOf, customerOf, vehicleOf, assertServices, itemRows, totalsFor, renderDocument } from './common.js';

export const INVOICE_STATUS = ['draft', 'open', 'sent', 'overdue', 'paid', 'cancelled'] as const;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fields = {
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  offerId: z.string().uuid().nullable(),
  title: zOptionalText(200),
  introText: zOptionalText(2000),
  notes: zOptionalText(3000),
  serviceDate: dateStr.nullable(),
  items: z.array(lineItemSchema).max(100),
};
const createSchema = z.object({ ...fields, vehicleId: fields.vehicleId.default(null), orderId: fields.orderId.default(null), offerId: fields.offerId.default(null), serviceDate: fields.serviceDate.default(null), items: fields.items.default([]) });
const updateSchema = z.object(fields).partial();

export default async function invoiceRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).get();
    if (!row) throw notFound('Rechnung');
    return row;
  };
  const items = (id: string) => app.db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)).all();
  const detail = (companyId: string, id: string) => {
    const inv = getOne(companyId, id);
    const its = items(id);
    return {
      invoice: inv,
      items: its,
      payments: app.db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt)).all(),
      customer: app.db.select().from(customers).where(eq(customers.id, inv.customerId)).get() ?? null,
      vehicle: inv.vehicleId ? app.db.select().from(vehicles).where(eq(vehicles.id, inv.vehicleId)).get() ?? null : null,
      order: inv.orderId ? app.db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status }).from(orders).where(eq(orders.id, inv.orderId)).get() ?? null : null,
      totals: totalsFor(app, companyId, its),
      cancels: inv.cancelsInvoiceId ? app.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(eq(invoices.id, inv.cancelsInvoiceId)).get() ?? null : null,
      cancelledBy: inv.cancelledByInvoiceId ? app.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(eq(invoices.id, inv.cancelledByInvoiceId)).get() ?? null : null,
    };
  };
  const writeItems = (companyId: string, id: string, list: z.infer<typeof lineItemSchema>[]) => {
    assertServices(app, companyId, list);
    app.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
    for (const row of itemRows(companyId, { invoiceId: id }, list)) app.db.insert(invoiceItems).values(row).run();
    const t = totalsFor(app, companyId, list);
    app.db.update(invoices).set({ subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents, updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
  };
  const assertDraft = (inv: typeof invoices.$inferSelect) => { if (inv.status !== 'draft') throw conflict('Ausgestellte Rechnungen sind unveränderlich. Bei Fehlern bitte stornieren und neu ausstellen.'); };
  const renderPdf = async (companyId: string, id: string) => {
    const d = detail(companyId, id);
    if (!d.customer) throw notFound('Kunde');
    const isStorno = Boolean(d.invoice.cancelsInvoiceId);
    return renderDocument(app, companyId, { title: isStorno ? 'Stornorechnung' : d.invoice.invoiceNumber ? 'Rechnung' : 'Rechnungsentwurf', docNumber: d.invoice.invoiceNumber ?? undefined, docDate: dateDe(d.invoice.issueDate ?? new Date().toISOString()), body: invoiceBody(d.invoice, d.items, companyOf(app, companyId), d.customer, d.vehicle, d.totals, d.cancels?.invoiceNumber), footerExtra: d.invoice.invoiceNumber ? `Rechnung ${d.invoice.invoiceNumber}` : 'Entwurf' });
  };
  const storePdf = async (ctxCompany: string, userId: string, inv: typeof invoices.$inferSelect, pdf: Buffer) => {
    if (inv.pdfFileId) app.storage.remove(ctxCompany, inv.pdfFileId);
    const file = await app.storage.store({ companyId: ctxCompany, buffer: pdf, originalName: `${inv.invoiceNumber ?? 'entwurf'}.pdf`, mimeType: 'application/pdf', kind: 'pdf', category: 'invoice', customerId: inv.customerId, vehicleId: inv.vehicleId, orderId: inv.orderId, uploadedByUserId: userId });
    app.db.update(invoices).set({ pdfFileId: file.id }).where(eq(invoices.id, inv.id)).run();
    return file;
  };

  app.get('/api/invoices', { preHandler: app.requireAuth('invoices:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ status: z.enum(INVOICE_STATUS).optional(), customerId: z.string().uuid().optional(), unpaid: z.coerce.boolean().optional() }), req.query);
    const conds = [eq(invoices.companyId, ctx.companyId)];
    if (q.status) conds.push(eq(invoices.status, q.status));
    if (q.customerId) conds.push(eq(invoices.customerId, q.customerId));
    if (q.unpaid) conds.push(sql`${invoices.status} in ('open','sent','overdue')`);
    if (q.q) { const t = `%${q.q}%`; conds.push(or(like(invoices.invoiceNumber, t), like(invoices.title, t), like(customers.firstName, t), like(customers.lastName, t), like(customers.companyName, t))!); }
    const where = and(...conds);
    const rows = app.db.select({ invoice: invoices, customer: { id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName } }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).where(where).orderBy(desc(invoices.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).where(where).get()?.n ?? 0;
    return { items: rows, total, page: q.page, pageSize: q.pageSize };
  });

  app.get('/api/invoices/stats', { preHandler: app.requireAuth('invoices:read') }, async (req) => {
    const ctx = ctxOf(req);
    const monthStart = today().slice(0, 8) + '01';
    const yearStart = today().slice(0, 4) + '-01-01';
    const sum = (cond: ReturnType<typeof sql>) => app.db.select({ n: sql<number>`count(*)`, s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)`, t: sql<number>`coalesce(sum(${invoices.totalCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), cond)).get()!;
    const open = sum(sql`${invoices.status} in ('open','sent','overdue')`);
    const overdue = sum(sql`${invoices.status} = 'overdue'`);
    const month = sum(sql`${invoices.status} in ('open','sent','overdue','paid') and ${invoices.issueDate} >= ${monthStart}`);
    const year = sum(sql`${invoices.status} in ('open','sent','overdue','paid') and ${invoices.issueDate} >= ${yearStart}`);
    const paidMonth = app.db.select({ s: sql<number>`coalesce(sum(${payments.amountCents}),0)` }).from(payments).where(and(eq(payments.companyId, ctx.companyId), gte(payments.paidAt, monthStart))).get()!;
    return { openCents: open.s, openCount: open.n, overdueCents: overdue.s, overdueCount: overdue.n, invoicedMonthCents: month.t, invoicedMonthCount: month.n, invoicedYearCents: year.t, paidMonthCents: paidMonth.s };
  });

  app.get('/api/invoices/:id', { preHandler: app.requireAuth('invoices:read') }, async (req) => detail(ctxOf(req).companyId, (req.params as { id: string }).id));

  app.post('/api/invoices', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { items: list, ...input } = parse(createSchema, req.body);
    customerOf(app, ctx.companyId, input.customerId);
    vehicleOf(app, ctx.companyId, input.vehicleId);
    const id = newId();
    app.db.insert(invoices).values({ id, companyId: ctx.companyId, ...input, createdByUserId: ctx.userId }).run();
    writeItems(ctx.companyId, id, list);
    writeAudit(app.db, ctx, { action: 'invoice.create', entityType: 'invoice', entityId: id, after: { items: list.length } });
    return detail(ctx.companyId, id);
  });

  /** Rechnungsentwurf aus Auftrag (Positionen werden kopiert). */
  app.post('/api/invoices/from-order', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { orderId } = parse(z.object({ orderId: z.string().uuid() }), req.body);
    const o = app.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.companyId, ctx.companyId))).get();
    if (!o) throw notFound('Auftrag');
    const existing = app.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(and(eq(invoices.orderId, orderId), sql`${invoices.status} != 'cancelled'`, sql`${invoices.cancelsInvoiceId} is null`)).get();
    if (existing) throw conflict('Zu diesem Auftrag existiert bereits eine Rechnung.', { invoiceId: existing.id });
    const its = app.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.sortOrder)).all();
    const id = newId();
    app.db.insert(invoices).values({ id, companyId: ctx.companyId, customerId: o.customerId, vehicleId: o.vehicleId, orderId, title: o.title, notes: o.notes, serviceDate: (o.finishedAt ?? o.startedAt ?? o.scheduledAt ?? nowIso()).slice(0, 10), createdByUserId: ctx.userId }).run();
    writeItems(ctx.companyId, id, its.map((it) => ({ serviceId: it.serviceId, name: it.name, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, vatBp: it.vatBp })));
    writeAudit(app.db, ctx, { action: 'invoice.from_order', entityType: 'invoice', entityId: id, after: { orderId } });
    return detail(ctx.companyId, id);
  });

  app.patch('/api/invoices/:id', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { items: list, ...input } = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    assertDraft(before);
    if (input.customerId) customerOf(app, ctx.companyId, input.customerId);
    if (input.vehicleId) vehicleOf(app, ctx.companyId, input.vehicleId);
    app.db.update(invoices).set({ ...input, updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    if (list) writeItems(ctx.companyId, id, list);
    return detail(ctx.companyId, id);
  });

  /** Ausstellen: lückenlose Nummer, Rechnungsdatum, Fälligkeit, PDF in Kundenakte. */
  app.post('/api/invoices/:id/issue', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { issueDate } = parse(z.object({ issueDate: dateStr.optional() }), req.body ?? {});
    const inv = getOne(ctx.companyId, id);
    assertDraft(inv);
    if (items(id).length === 0) throw badRequest('Eine Rechnung braucht mindestens eine Position.');
    const company = companyOf(app, ctx.companyId);
    const date = issueDate ?? today();
    const invoiceNumber = nextNumber(app.db, ctx.companyId, 'invoice', company.invoicePrefix, true);
    app.db.update(invoices).set({ invoiceNumber, status: 'open', issueDate: date, dueDate: addDays(date, company.paymentTermsDays), serviceDate: inv.serviceDate ?? date, issuedAt: nowIso(), updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    const pdf = await renderPdf(ctx.companyId, id);
    await storePdf(ctx.companyId, ctx.userId, getOne(ctx.companyId, id), pdf);
    logActivity(app.db, ctx.companyId, { customerId: inv.customerId, vehicleId: inv.vehicleId, userId: ctx.userId, type: 'invoice', subject: `Rechnung ${invoiceNumber} ausgestellt`, content: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(inv.totalCents / 100), refType: 'invoice', refId: id });
    writeAudit(app.db, ctx, { action: 'invoice.issue', entityType: 'invoice', entityId: id, after: { invoiceNumber, issueDate: date } });
    return detail(ctx.companyId, id);
  });

  app.get('/api/invoices/:id/pdf', { preHandler: app.requireAuth('invoices:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const inv = getOne(ctx.companyId, id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${inv.invoiceNumber ?? 'rechnungsentwurf'}.pdf"`);
    return reply.send(await renderPdf(ctx.companyId, id));
  });

  app.post('/api/invoices/:id/send', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const inv = getOne(ctx.companyId, id);
    if (inv.status === 'draft') throw badRequest('Bitte die Rechnung zuerst ausstellen.');
    if (inv.status === 'cancelled') throw badRequest('Stornierte Rechnungen werden nicht versendet.');
    const customer = customerOf(app, ctx.companyId, inv.customerId);
    const company = companyOf(app, ctx.companyId);
    const input = parse(z.object({ to: zEmail.optional(), subject: z.string().trim().max(200).optional(), message: z.string().trim().max(5000).optional() }), req.body ?? {});
    const to = input.to ?? customer.email;
    if (!to) throw badRequest('Der Kunde hat keine E-Mail-Adresse.');
    if (!app.mail.isConfigured(ctx.companyId)) throw badRequest('Kein E-Mail-Versand (SMTP) konfiguriert.');
    const tpl = invoiceMailText(company, customer, inv.invoiceNumber!, inv.totalCents, inv.dueDate);
    const pdf = await renderPdf(ctx.companyId, id);
    const res = await app.mail.send(ctx.companyId, { to, subject: input.subject ?? tpl.subject, text: input.message ?? tpl.text, attachments: [{ filename: `${inv.invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }], refType: 'invoice', refId: id });
    if (!res.ok) throw badRequest(`Versand fehlgeschlagen: ${res.error}`);
    app.db.update(invoices).set({ status: inv.status === 'open' ? 'sent' : inv.status, sentAt: nowIso(), updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    logActivity(app.db, ctx.companyId, { customerId: inv.customerId, userId: ctx.userId, type: 'email', direction: 'out', subject: `Rechnung ${inv.invoiceNumber} per E-Mail gesendet`, content: `An ${to}`, refType: 'invoice', refId: id });
    writeAudit(app.db, ctx, { action: 'invoice.send', entityType: 'invoice', entityId: id, after: { to } });
    return detail(ctx.companyId, id);
  });

  app.post('/api/invoices/:id/payments', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(z.object({ amountCents: z.number().int().min(1), paidAt: dateStr.default(today), method: z.enum(['cash', 'transfer', 'card', 'paypal', 'other']).default('transfer'), note: zOptionalText(300) }), req.body);
    const inv = getOne(ctx.companyId, id);
    if (inv.status === 'draft') throw badRequest('Zahlungen sind erst nach dem Ausstellen möglich.');
    if (inv.status === 'cancelled') throw badRequest('Stornierte Rechnungen nehmen keine Zahlungen an.');
    const remaining = inv.totalCents - inv.paidCents;
    if (input.amountCents > remaining) throw badRequest(`Der Betrag übersteigt den offenen Rest von ${(remaining / 100).toFixed(2).replace('.', ',')} €.`);
    app.db.insert(payments).values({ id: newId(), companyId: ctx.companyId, invoiceId: id, ...input, createdByUserId: ctx.userId }).run();
    const paid = inv.paidCents + input.amountCents;
    const fullyPaid = paid >= inv.totalCents;
    app.db.update(invoices).set({ paidCents: paid, status: fullyPaid ? 'paid' : inv.status, paidAt: fullyPaid ? nowIso() : null, updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    logActivity(app.db, ctx.companyId, { customerId: inv.customerId, userId: ctx.userId, type: 'invoice', direction: 'in', subject: `Zahlung zu ${inv.invoiceNumber}: ${(input.amountCents / 100).toFixed(2).replace('.', ',')} €${fullyPaid ? ' (vollständig bezahlt)' : ''}`, refType: 'invoice', refId: id });
    writeAudit(app.db, ctx, { action: 'invoice.payment', entityType: 'invoice', entityId: id, after: input });
    return detail(ctx.companyId, id);
  });

  app.delete('/api/invoices/:id/payments/:pid', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id, pid } = req.params as { id: string; pid: string };
    const inv = getOne(ctx.companyId, id);
    const p = app.db.select().from(payments).where(and(eq(payments.id, pid), eq(payments.invoiceId, id))).get();
    if (!p) throw notFound('Zahlung');
    app.db.delete(payments).where(eq(payments.id, pid)).run();
    const paid = inv.paidCents - p.amountCents;
    app.db.update(invoices).set({ paidCents: paid, status: inv.status === 'paid' ? (inv.dueDate && inv.dueDate < today() ? 'overdue' : 'open') : inv.status, paidAt: null, updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    writeAudit(app.db, ctx, { action: 'invoice.payment_removed', entityType: 'invoice', entityId: id, before: p });
    return detail(ctx.companyId, id);
  });

  /** Storno: Entwurf wird gelöscht, ausgestellte Rechnung erhält eine Stornorechnung (negative Positionen). */
  app.post('/api/invoices/:id/cancel', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const inv = getOne(ctx.companyId, id);
    if (inv.status === 'cancelled') throw conflict('Bereits storniert.');
    if (inv.cancelsInvoiceId) throw badRequest('Eine Stornorechnung kann nicht storniert werden.');
    if (inv.status === 'draft') {
      app.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
      app.db.delete(invoices).where(eq(invoices.id, id)).run();
      return { ok: true, deleted: true };
    }
    const company = companyOf(app, ctx.companyId);
    const its = items(id);
    const stornoId = newId();
    const invoiceNumber = nextNumber(app.db, ctx.companyId, 'invoice', company.invoicePrefix, true);
    const date = today();
    app.db.insert(invoices).values({ id: stornoId, companyId: ctx.companyId, invoiceNumber, customerId: inv.customerId, vehicleId: inv.vehicleId, orderId: inv.orderId, offerId: inv.offerId, status: 'paid', title: `Storno zu Rechnung ${inv.invoiceNumber}`, issueDate: date, serviceDate: inv.serviceDate, dueDate: date, issuedAt: nowIso(), cancelsInvoiceId: id, subtotalCents: -inv.subtotalCents, vatCents: -inv.vatCents, totalCents: -inv.totalCents, paidCents: -inv.totalCents, paidAt: nowIso(), createdByUserId: ctx.userId }).run();
    its.forEach((it, i) => app.db.insert(invoiceItems).values({ id: newId(), companyId: ctx.companyId, invoiceId: stornoId, serviceId: it.serviceId, name: it.name, description: it.description, quantity: it.quantity, unitPriceCents: -it.unitPriceCents, vatBp: it.vatBp, totalCents: -it.totalCents, sortOrder: i }).run());
    app.db.update(invoices).set({ status: 'cancelled', cancelledByInvoiceId: stornoId, updatedAt: nowIso() }).where(eq(invoices.id, id)).run();
    const pdf = await renderPdf(ctx.companyId, stornoId);
    await storePdf(ctx.companyId, ctx.userId, getOne(ctx.companyId, stornoId), pdf);
    logActivity(app.db, ctx.companyId, { customerId: inv.customerId, userId: ctx.userId, type: 'invoice', subject: `Rechnung ${inv.invoiceNumber} storniert durch ${invoiceNumber}`, refType: 'invoice', refId: stornoId });
    writeAudit(app.db, ctx, { action: 'invoice.cancel', entityType: 'invoice', entityId: id, after: { stornoId, invoiceNumber } });
    return detail(ctx.companyId, stornoId);
  });

  app.delete('/api/invoices/:id', { preHandler: app.requireAuth('invoices:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const inv = getOne(ctx.companyId, id);
    if (inv.status !== 'draft') throw badRequest('Ausgestellte Rechnungen können nur storniert werden.');
    app.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
    app.db.delete(invoices).where(eq(invoices.id, id)).run();
    writeAudit(app.db, ctx, { action: 'invoice.delete_draft', entityType: 'invoice', entityId: id });
    return { ok: true };
  });

}
