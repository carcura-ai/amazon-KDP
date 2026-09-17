import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { orders, orderItems, customers, vehicles, appointments, companies, users, services } from '../../db/schema.js';
import { parse, zOptionalText, zPagination } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nextNumber } from '../../core/numbering.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from '../crm/activities.js';

export const ORDER_STATUS = ['planned', 'accepted', 'in_progress', 'quality_check', 'finished', 'picked_up', 'completed', 'cancelled'] as const;
export const ORDER_STATUS_LABEL: Record<string, string> = { planned: 'Geplant', accepted: 'Angenommen', in_progress: 'In Bearbeitung', quality_check: 'Qualitätskontrolle', finished: 'Fertig', picked_up: 'Abgeholt', completed: 'Abgeschlossen', cancelled: 'Storniert' };

import { lineItemSchema as itemSchema, computeTotals } from '../../core/lineItems.js';
export { computeTotals };
const fields = {
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable(),
  appointmentId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  leadId: z.string().uuid().nullable(),
  status: z.enum(ORDER_STATUS),
  title: zOptionalText(200),
  notes: zOptionalText(5000),
  internalNotes: zOptionalText(5000),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  mileageIn: z.number().int().min(0).nullable(),
  items: z.array(itemSchema).max(100),
};
const createSchema = z.object({ ...fields, vehicleId: fields.vehicleId.default(null), appointmentId: fields.appointmentId.default(null), userId: fields.userId.default(null), leadId: fields.leadId.default(null), status: fields.status.default('planned'), scheduledAt: fields.scheduledAt.default(null), mileageIn: fields.mileageIn.default(null), items: fields.items.default([]) });
const updateSchema = z.object(fields).partial();

export default async function orderRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.companyId, companyId))).get();
    if (!row) throw notFound('Auftrag');
    return row;
  };
  const items = (orderId: string) => app.db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.sortOrder)).all();
  const detail = (companyId: string, id: string) => {
    const o = getOne(companyId, id);
    const customer = app.db.select().from(customers).where(eq(customers.id, o.customerId)).get() ?? null;
    const vehicle = o.vehicleId ? app.db.select().from(vehicles).where(eq(vehicles.id, o.vehicleId)).get() ?? null : null;
    const appointment = o.appointmentId ? app.db.select().from(appointments).where(eq(appointments.id, o.appointmentId)).get() ?? null : null;
    const user = o.userId ? app.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, o.userId)).get() ?? null : null;
    const company = app.db.select({ smallBusiness: companies.smallBusiness }).from(companies).where(eq(companies.id, companyId)).get()!;
    const its = items(id);
    return { order: o, items: its, customer, vehicle, appointment, user, totals: computeTotals(its, company.smallBusiness), statusLabels: ORDER_STATUS_LABEL };
  };
  const validateRefs = (companyId: string, input: { customerId?: string; vehicleId?: string | null; userId?: string | null; appointmentId?: string | null }) => {
    if (input.customerId && !app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, companyId))).get()) throw notFound('Kunde');
    if (input.vehicleId && !app.db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.companyId, companyId))).get()) throw notFound('Fahrzeug');
    if (input.userId && !app.db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.companyId, companyId))).get()) throw notFound('Mitarbeiter');
    if (input.appointmentId && !app.db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, input.appointmentId), eq(appointments.companyId, companyId))).get()) throw notFound('Termin');
  };
  const writeItems = (companyId: string, orderId: string, list: z.infer<typeof itemSchema>[]) => {
    app.db.delete(orderItems).where(eq(orderItems.orderId, orderId)).run();
    list.forEach((it, i) => {
      if (it.serviceId && !app.db.select({ id: services.id }).from(services).where(and(eq(services.id, it.serviceId), eq(services.companyId, companyId))).get()) throw notFound('Leistung');
      app.db.insert(orderItems).values({ id: it.id ?? newId(), companyId, orderId, serviceId: it.serviceId ?? null, name: it.name, description: it.description ?? null, quantity: it.quantity, unitPriceCents: it.unitPriceCents, vatBp: it.vatBp, totalCents: it.quantity * it.unitPriceCents, sortOrder: i }).run();
    });
    const company = app.db.select({ smallBusiness: companies.smallBusiness }).from(companies).where(eq(companies.id, companyId)).get()!;
    const t = computeTotals(list, company.smallBusiness);
    app.db.update(orders).set({ subtotalCents: t.subtotalCents, vatCents: t.vatCents, totalCents: t.totalCents, updatedAt: nowIso() }).where(eq(orders.id, orderId)).run();
  };

  app.get('/api/orders', { preHandler: app.requireAuth('orders:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ status: z.enum(ORDER_STATUS).optional(), customerId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional(), open: z.coerce.boolean().optional() }), req.query);
    const conds = [eq(orders.companyId, ctx.companyId)];
    if (q.status) conds.push(eq(orders.status, q.status));
    if (q.customerId) conds.push(eq(orders.customerId, q.customerId));
    if (q.vehicleId) conds.push(eq(orders.vehicleId, q.vehicleId));
    if (q.open) conds.push(sql`${orders.status} not in ('completed','cancelled')`);
    if (q.q) {
      const term = `%${q.q}%`;
      conds.push(or(like(orders.orderNumber, term), like(orders.title, term), like(customers.firstName, term), like(customers.lastName, term), like(customers.companyName, term), like(vehicles.licensePlate, term))!);
    }
    const where = and(...conds);
    const rows = app.db
      .select({ order: orders, customer: { id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }, vehicle: { id: vehicles.id, licensePlate: vehicles.licensePlate, make: vehicles.make, model: vehicles.model } })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(vehicles, eq(vehicles.id, orders.vehicleId))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).leftJoin(vehicles, eq(vehicles.id, orders.vehicleId)).where(where).get()?.n ?? 0;
    return { items: rows, total, page: q.page, pageSize: q.pageSize, statusLabels: ORDER_STATUS_LABEL };
  });

  app.get('/api/orders/stats', { preHandler: app.requireAuth('orders:read') }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select({ status: orders.status, n: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${orders.totalCents}),0)` }).from(orders).where(eq(orders.companyId, ctx.companyId)).groupBy(orders.status).all();
    return { byStatus: Object.fromEntries(rows.map((r) => [r.status, { count: r.n, totalCents: r.sum }])) };
  });

  app.get('/api/orders/:id', { preHandler: app.requireAuth('orders:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    return detail(ctx.companyId, id);
  });

  app.post('/api/orders', { preHandler: app.requireAuth('orders:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { items: list, ...input } = parse(createSchema, req.body);
    validateRefs(ctx.companyId, input);
    const id = newId();
    const orderNumber = nextNumber(app.db, ctx.companyId, 'order', 'AU', true);
    app.db.insert(orders).values({ id, companyId: ctx.companyId, orderNumber, ...input, startedAt: input.status === 'in_progress' ? nowIso() : null }).run();
    writeItems(ctx.companyId, id, list);
    if (input.appointmentId) app.db.update(appointments).set({ orderId: id, updatedAt: nowIso() }).where(eq(appointments.id, input.appointmentId)).run();
    logActivity(app.db, ctx.companyId, { customerId: input.customerId, vehicleId: input.vehicleId, userId: ctx.userId, type: 'system', subject: `Auftrag ${orderNumber} angelegt`, content: input.title ?? (list.map((i) => i.name).join(', ') || null), refType: 'order', refId: id });
    writeAudit(app.db, ctx, { action: 'order.create', entityType: 'order', entityId: id, after: { orderNumber, ...input, items: list.length } });
    return detail(ctx.companyId, id);
  });

  app.patch('/api/orders/:id', { preHandler: app.requireAuth('orders:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { items: list, ...input } = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    if (before.status === 'completed' && input.status && input.status !== 'completed') throw conflict('Ein abgeschlossener Auftrag kann nicht wieder geöffnet werden.');
    validateRefs(ctx.companyId, input);
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (input.status && input.status !== before.status) {
      if (input.status === 'in_progress' && !before.startedAt) patch.startedAt = nowIso();
      if (['finished', 'picked_up', 'completed'].includes(input.status) && !before.finishedAt) patch.finishedAt = nowIso();
      if (input.status === 'completed') patch.completedAt = nowIso();
    }
    app.db.update(orders).set(patch).where(eq(orders.id, id)).run();
    if (list) writeItems(ctx.companyId, id, list);
    if (input.appointmentId !== undefined) {
      app.db.update(appointments).set({ orderId: null }).where(and(eq(appointments.orderId, id), eq(appointments.companyId, ctx.companyId))).run();
      if (input.appointmentId) app.db.update(appointments).set({ orderId: id }).where(eq(appointments.id, input.appointmentId)).run();
    }
    const after = getOne(ctx.companyId, id);
    if (input.status && input.status !== before.status) {
      logActivity(app.db, ctx.companyId, { customerId: after.customerId, vehicleId: after.vehicleId, userId: ctx.userId, type: 'status', subject: `Auftrag ${after.orderNumber}: ${ORDER_STATUS_LABEL[before.status]} → ${ORDER_STATUS_LABEL[input.status]}`, refType: 'order', refId: id });
    }
    writeAudit(app.db, ctx, { action: 'order.update', entityType: 'order', entityId: id, before, after });
    return detail(ctx.companyId, id);
  });

  app.delete('/api/orders/:id', { preHandler: app.requireAuth('orders:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = getOne(ctx.companyId, id);
    if (!['planned', 'cancelled'].includes(before.status)) throw badRequest('Nur geplante oder stornierte Aufträge können gelöscht werden. Andernfalls bitte stornieren.');
    app.db.transaction((tx) => {
      tx.delete(orderItems).where(eq(orderItems.orderId, id)).run();
      tx.update(appointments).set({ orderId: null }).where(eq(appointments.orderId, id)).run();
      tx.delete(orders).where(eq(orders.id, id)).run();
    });
    writeAudit(app.db, ctx, { action: 'order.delete', entityType: 'order', entityId: id, before });
    return { ok: true };
  });
}
