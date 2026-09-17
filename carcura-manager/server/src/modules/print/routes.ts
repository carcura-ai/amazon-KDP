import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq } from 'drizzle-orm';
import { customers, vehicles, orders, orderItems, companies, activities } from '../../db/schema.js';
import { notFound } from '../../core/errors.js';
import { ctxOf } from '../../plugins/auth.js';
import { documentShell, documentFooter, customerProfileBody, orderBody, dateDe } from '../../integrations/pdf-templates.js';
import { computeTotals } from '../orders/routes.js';

/** Druck-/PDF-Ausgaben für Kundenakte und Auftrag (weitere folgen je Modul). */
export default async function printRoutes(app: FastifyInstance) {
  const shellFor = (companyId: string) => {
    const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
    const logo = company.logoFileId ? app.storage.get(companyId, company.logoFileId) : null;
    return { company, logoDataUrl: logo ? app.storage.dataUrl(logo, 'original') : null };
  };

  app.get('/api/customers/:id/pdf', { preHandler: app.requireAuth('customers:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const c = app.db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, ctx.companyId))).get();
    if (!c) throw notFound('Kunde');
    const { company, logoDataUrl } = shellFor(ctx.companyId);
    const html = documentShell({
      company, logoDataUrl, title: 'Kundenakte', docNumber: c.customerNumber, docDate: dateDe(new Date().toISOString()),
      body: customerProfileBody(c, app.db.select().from(vehicles).where(and(eq(vehicles.customerId, id), eq(vehicles.isActive, true))).all(), app.db.select().from(activities).where(and(eq(activities.companyId, ctx.companyId), eq(activities.customerId, id))).orderBy(desc(activities.occurredAt)).limit(60).all(), app.db.select().from(orders).where(and(eq(orders.customerId, id), eq(orders.companyId, ctx.companyId))).orderBy(desc(orders.createdAt)).all()),
    });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="kundenakte-${c.customerNumber}.pdf"`);
    return reply.send(await app.pdf.render(html, { footerHtml: documentFooter(company, `Kundenakte ${c.customerNumber}`) }));
  });

  app.get('/api/orders/:id/pdf', { preHandler: app.requireAuth('orders:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const o = app.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, ctx.companyId))).get();
    if (!o) throw notFound('Auftrag');
    const c = app.db.select().from(customers).where(eq(customers.id, o.customerId)).get();
    if (!c) throw notFound('Kunde');
    const v = o.vehicleId ? app.db.select().from(vehicles).where(eq(vehicles.id, o.vehicleId)).get() ?? null : null;
    const items = app.db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.sortOrder)).all();
    const { company, logoDataUrl } = shellFor(ctx.companyId);
    const html = documentShell({ company, logoDataUrl, title: 'Auftrag', docNumber: o.orderNumber, docDate: dateDe(o.createdAt), body: orderBody(o, items, c, v, computeTotals(items, company.smallBusiness), company.smallBusiness), footerExtra: `Auftrag ${o.orderNumber}` });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${o.orderNumber}.pdf"`);
    return reply.send(await app.pdf.render(html, { footerHtml: documentFooter(company, `Auftrag ${o.orderNumber}`) }));
  });
}
