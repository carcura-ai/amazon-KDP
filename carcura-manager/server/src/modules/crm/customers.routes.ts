import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { customers, companies, vehicles, leads } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination, zOptionalEmail } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { normalizeEmail, normalizePhone } from '../../core/normalize.js';
import { nextNumber } from '../../core/numbering.js';
import { ctxOf } from '../../plugins/auth.js';
import { findDuplicates } from './duplicates.js';
import { logActivity, listActivities, ACTIVITY_TYPES } from './activities.js';
import { anonymizeCustomer, deleteCustomerCompletely, hasRetentionDocuments } from '../privacy/anonymize.js';
import { customerDossier } from '../privacy/routes.js';

const customerFields = {
  type: z.enum(['private', 'business']),
  salutation: zOptionalText(20),
  firstName: zTrimmed(80),
  lastName: zTrimmed(80),
  companyName: zOptionalText(160),
  street: zOptionalText(200),
  houseNumber: zOptionalText(20),
  zip: zOptionalText(20),
  city: zOptionalText(120),
  country: zTrimmed(2),
  email: zOptionalEmail,
  phone: zOptionalText(60),
  phone2: zOptionalText(60),
  notes: zOptionalText(10000),
  tags: z.array(zTrimmed(40)).max(20).optional(),
  source: zOptionalText(60),
  isActive: z.boolean().optional(),
};
const customerCreateSchema = z.object({ ...customerFields, type: customerFields.type.default('private'), firstName: customerFields.firstName.default(''), lastName: customerFields.lastName.default(''), country: customerFields.country.default('DE') });
const customerUpdateSchema = z.object(customerFields).partial();

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  direction: z.enum(['in', 'out']).nullable().optional(),
  subject: zOptionalText(200),
  content: zOptionalText(10000),
  occurredAt: z.string().datetime().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
});

export default async function customerRoutes(app: FastifyInstance) {
  const getCustomer = (companyId: string, id: string) => {
    const row = app.db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, companyId))).get();
    if (!row) throw notFound('Kunde');
    return row;
  };

  app.get('/api/customers', { preHandler: app.requireAuth('customers:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ type: z.enum(['private', 'business']).optional(), includeInactive: z.coerce.boolean().default(false) }), req.query);
    const conds = [eq(customers.companyId, ctx.companyId)];
    if (!q.includeInactive) conds.push(eq(customers.isActive, true));
    if (q.type) conds.push(eq(customers.type, q.type));
    if (q.q) {
      const term = `%${q.q}%`;
      conds.push(or(like(customers.firstName, term), like(customers.lastName, term), like(customers.companyName, term), like(customers.email, term), like(customers.phone, term), like(customers.customerNumber, term), like(customers.city, term))!);
    }
    const where = and(...conds);
    const items = app.db.select().from(customers).where(where).orderBy(asc(customers.lastName), asc(customers.firstName)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(customers).where(where).get()?.n ?? 0;
    return { items, total, page: q.page, pageSize: q.pageSize };
  });

  app.get('/api/customers/:id', { preHandler: app.requireAuth('customers:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const customer = getCustomer(ctx.companyId, id);
    const vehicleRows = app.db.select().from(vehicles).where(and(eq(vehicles.customerId, id), eq(vehicles.companyId, ctx.companyId))).orderBy(desc(vehicles.createdAt)).all();
    const leadRows = app.db.select().from(leads).where(and(eq(leads.customerId, id), eq(leads.companyId, ctx.companyId))).orderBy(desc(leads.createdAt)).all();
    const duplicates = findDuplicates(app.db, ctx.companyId, { email: customer.email, phone: customer.phone, firstName: customer.firstName, lastName: customer.lastName, excludeId: id }).filter((h) => h.kind === 'customer');
    return { customer, vehicles: vehicleRows, leads: leadRows, activities: listActivities(app.db, ctx.companyId, { customerId: id }), duplicates };
  });

  app.post('/api/customers', { preHandler: app.requireAuth('customers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { tags, ...input } = parse(customerCreateSchema, req.body);
    if (!input.firstName && !input.lastName && !input.companyName) throw badRequest('Bitte Name oder Firma angeben.');
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const id = newId();
    app.db
      .insert(customers)
      .values({
        id,
        companyId: ctx.companyId,
        customerNumber: nextNumber(app.db, ctx.companyId, 'customer', company.customerPrefix, false),
        ...input,
        isActive: input.isActive ?? true,
        tagsJson: JSON.stringify(tags ?? []),
        normalizedEmail: normalizeEmail(input.email),
        normalizedPhone: normalizePhone(input.phone),
      })
      .run();
    logActivity(app.db, ctx.companyId, { customerId: id, userId: ctx.userId, type: 'system', subject: 'Kunde angelegt' });
    writeAudit(app.db, ctx, { action: 'customer.create', entityType: 'customer', entityId: id, after: input });
    const duplicates = findDuplicates(app.db, ctx.companyId, { email: input.email, phone: input.phone, firstName: input.firstName, lastName: input.lastName, excludeId: id });
    return { customer: getCustomer(ctx.companyId, id), duplicates };
  });

  app.patch('/api/customers/:id', { preHandler: app.requireAuth('customers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { tags, ...input } = parse(customerUpdateSchema, req.body);
    const before = getCustomer(ctx.companyId, id);
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (tags) patch.tagsJson = JSON.stringify(tags);
    if (input.email !== undefined) patch.normalizedEmail = normalizeEmail(input.email);
    if (input.phone !== undefined) patch.normalizedPhone = normalizePhone(input.phone);
    app.db.update(customers).set(patch).where(eq(customers.id, id)).run();
    const after = getCustomer(ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'customer.update', entityType: 'customer', entityId: id, before, after });
    return after;
  });

  /** DSGVO: Kunde deaktivieren (Standard) oder endgültig löschen inkl. Fahrzeuge/Historie. */
  app.delete('/api/customers/:id', { preHandler: app.requireAuth('customers:delete') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { hard } = parse(z.object({ hard: z.coerce.boolean().default(false) }), req.query);
    const before = getCustomer(ctx.companyId, id);
    if (hard) {
      // Löschkonzept: mit aufbewahrungspflichtigen Belegen wird anonymisiert, sonst vollständig gelöscht
      const retention = hasRetentionDocuments(app.db, ctx.companyId, id);
      const result = retention ? anonymizeCustomer(app.db, app.storage, ctx.companyId, id) : deleteCustomerCompletely(app.db, app.storage, ctx.companyId, id);
      writeAudit(app.db, ctx, { action: retention ? 'customer.anonymize' : 'customer.delete_hard', entityType: 'customer', entityId: id, before: { customerNumber: before.customerNumber }, after: { ...result, mode: retention ? 'anonymized' : 'deleted' } });
      return { ok: true, deleted: !retention, anonymized: retention, ...result };
    }
    app.db.update(customers).set({ isActive: false, updatedAt: nowIso() }).where(eq(customers.id, id)).run();
    writeAudit(app.db, ctx, { action: 'customer.deactivate', entityType: 'customer', entityId: id });
    return { ok: true, deleted: false };
  });

  app.post('/api/customers/:id/activities', { preHandler: app.requireAuth('customers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    getCustomer(ctx.companyId, id);
    const input = parse(activitySchema, req.body);
    const activityId = logActivity(app.db, ctx.companyId, { ...input, customerId: id, userId: ctx.userId });
    return { id: activityId };
  });

  app.post('/api/leads/:id/activities', { preHandler: app.requireAuth('leads:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const lead = app.db.select().from(leads).where(and(eq(leads.id, id), eq(leads.companyId, ctx.companyId))).get();
    if (!lead) throw notFound('Lead');
    const input = parse(activitySchema, req.body);
    app.db.update(leads).set({ lastContactAt: nowIso() }).where(eq(leads.id, id)).run();
    const activityId = logActivity(app.db, ctx.companyId, { ...input, leadId: id, customerId: lead.customerId, userId: ctx.userId });
    return { id: activityId };
  });

  app.get('/api/customers/:id/export', { preHandler: app.requireAuth('customers:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const data = customerDossier(app, ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'customer.export', entityType: 'customer', entityId: id });
    reply.header('Content-Disposition', `attachment; filename="kunde-${data.customer.customerNumber}.json"`);
    return data;
  });
}
