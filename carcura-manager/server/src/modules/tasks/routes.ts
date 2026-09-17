import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, lt, gte, sql } from 'drizzle-orm';
import { tasks, users, customers, leads, orders, vehicles } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import type { Db } from '../../db/index.js';

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
const fields = {
  title: zTrimmed(200).min(1),
  description: zOptionalText(5000),
  priority: z.enum(TASK_PRIORITIES),
  dueAt: z.string().datetime().nullable(),
  assignedUserId: z.string().uuid().nullable(),
  customerId: z.string().uuid().nullable(),
  leadId: z.string().uuid().nullable(),
  vehicleId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
};
const createSchema = z.object({ ...fields, priority: fields.priority.default('normal'), dueAt: fields.dueAt.optional(), assignedUserId: fields.assignedUserId.optional(), customerId: fields.customerId.optional(), leadId: fields.leadId.optional(), vehicleId: fields.vehicleId.optional(), orderId: fields.orderId.optional() });
const updateSchema = z.object({ ...fields, status: z.enum(['open', 'done']) }).partial();

/** Aufgaben-Kennzahlen (offen, heute fällig, überfällig) für Dashboard und Navigation. */
export function taskStats(db: Db, companyId: string, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const open = and(eq(tasks.companyId, companyId), eq(tasks.status, 'open'));
  const n = (w: ReturnType<typeof and>) => db.select({ n: sql<number>`count(*)` }).from(tasks).where(w).get()?.n ?? 0;
  return {
    open: n(open),
    dueToday: n(and(open, gte(tasks.dueAt, start.toISOString()), lt(tasks.dueAt, end.toISOString()))),
    overdue: n(and(open, lt(tasks.dueAt, start.toISOString()))),
  };
}

export default async function taskRoutes(app: FastifyInstance) {
  const withRefs = (companyId: string) => ({
    id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt,
    assignedUserId: tasks.assignedUserId, customerId: tasks.customerId, leadId: tasks.leadId, vehicleId: tasks.vehicleId, orderId: tasks.orderId,
    createdByUserId: tasks.createdByUserId, completedAt: tasks.completedAt, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
    assignedName: sql<string | null>`(select first_name || ' ' || last_name from ${users} u where u.id = ${tasks.assignedUserId})`,
    customerName: sql<string | null>`(select coalesce(nullif(company_name,''), first_name || ' ' || last_name) from ${customers} c where c.id = ${tasks.customerId} and c.company_id = ${companyId})`,
    leadName: sql<string | null>`(select first_name || ' ' || last_name from ${leads} l where l.id = ${tasks.leadId} and l.company_id = ${companyId})`,
    orderNumber: sql<string | null>`(select order_number from ${orders} o where o.id = ${tasks.orderId} and o.company_id = ${companyId})`,
    vehiclePlate: sql<string | null>`(select license_plate from ${vehicles} v where v.id = ${tasks.vehicleId} and v.company_id = ${companyId})`,
  });
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select(withRefs(companyId)).from(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId))).get();
    if (!row) throw notFound('Aufgabe');
    return row;
  };

  app.get('/api/tasks', { preHandler: app.requireAuth('tasks:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({
      view: z.enum(['open', 'today', 'overdue', 'week', 'done', 'all']).default('open'),
      customerId: z.string().uuid().optional(), leadId: z.string().uuid().optional(), orderId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional(),
      assignedUserId: z.string().uuid().optional(), mine: z.coerce.boolean().optional(),
    }), req.query);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000); const in7 = new Date(start.getTime() + 7 * 86_400_000);
    const conds = [eq(tasks.companyId, ctx.companyId)];
    if (q.view === 'open') conds.push(eq(tasks.status, 'open'));
    if (q.view === 'today') conds.push(eq(tasks.status, 'open'), gte(tasks.dueAt, start.toISOString()), lt(tasks.dueAt, end.toISOString()));
    if (q.view === 'overdue') conds.push(eq(tasks.status, 'open'), lt(tasks.dueAt, start.toISOString()));
    if (q.view === 'week') conds.push(eq(tasks.status, 'open'), lt(tasks.dueAt, in7.toISOString()));
    if (q.view === 'done') conds.push(eq(tasks.status, 'done'));
    if (q.customerId) conds.push(eq(tasks.customerId, q.customerId));
    if (q.leadId) conds.push(eq(tasks.leadId, q.leadId));
    if (q.orderId) conds.push(eq(tasks.orderId, q.orderId));
    if (q.vehicleId) conds.push(eq(tasks.vehicleId, q.vehicleId));
    if (q.assignedUserId) conds.push(eq(tasks.assignedUserId, q.assignedUserId));
    if (q.mine) conds.push(eq(tasks.assignedUserId, ctx.userId));
    if (q.q) conds.push(sql`(${tasks.title} like ${`%${q.q}%`} or ${tasks.description} like ${`%${q.q}%`})`);
    const where = and(...conds);
    const order = q.view === 'done' ? [desc(tasks.completedAt)] : [sql`case when ${tasks.dueAt} is null then 1 else 0 end`, asc(tasks.dueAt), sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`, desc(tasks.createdAt)];
    const items = app.db.select(withRefs(ctx.companyId)).from(tasks).where(where).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(tasks).where(where).get()?.n ?? 0;
    return { items, total, page: q.page, pageSize: q.pageSize, stats: taskStats(app.db, ctx.companyId), priorities: TASK_PRIORITIES };
  });

  app.get('/api/tasks/stats', { preHandler: app.requireAuth('tasks:read') }, async (req) => taskStats(app.db, ctxOf(req).companyId));

  app.get('/api/tasks/:id', { preHandler: app.requireAuth('tasks:read') }, async (req) => getOne(ctxOf(req).companyId, (req.params as { id: string }).id));

  app.post('/api/tasks', { preHandler: app.requireAuth('tasks:write') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const input = parse(createSchema, req.body);
    const id = newId();
    app.db.insert(tasks).values({ id, companyId: ctx.companyId, ...input, createdByUserId: ctx.userId, assignedUserId: input.assignedUserId === undefined ? ctx.userId : input.assignedUserId }).run();
    writeAudit(app.db, ctx, { action: 'task.create', entityType: 'task', entityId: id, after: { title: input.title } });
    return reply.code(201).send(getOne(ctx.companyId, id));
  });

  app.patch('/api/tasks/:id', { preHandler: app.requireAuth('tasks:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = getOne(ctx.companyId, id);
    const input = parse(updateSchema, req.body);
    const patch: Partial<typeof tasks.$inferInsert> = { ...input, updatedAt: nowIso() };
    if (input.status && input.status !== before.status) patch.completedAt = input.status === 'done' ? nowIso() : null;
    app.db.update(tasks).set(patch).where(eq(tasks.id, id)).run();
    writeAudit(app.db, ctx, { action: 'task.update', entityType: 'task', entityId: id, before: { status: before.status }, after: input });
    return getOne(ctx.companyId, id);
  });

  app.delete('/api/tasks/:id', { preHandler: app.requireAuth('tasks:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    getOne(ctx.companyId, id);
    app.db.delete(tasks).where(eq(tasks.id, id)).run();
    writeAudit(app.db, ctx, { action: 'task.delete', entityType: 'task', entityId: id });
    return { ok: true };
  });
}
