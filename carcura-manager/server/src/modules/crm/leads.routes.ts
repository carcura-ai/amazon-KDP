import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { leads, customers, companies, users } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination, zOptionalEmail } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { normalizeEmail, normalizePhone } from '../../core/normalize.js';
import { nextNumber } from '../../core/numbering.js';
import { ctxOf } from '../../plugins/auth.js';
import { findDuplicates } from './duplicates.js';
import { logActivity, listActivities } from './activities.js';

export const LEAD_STATUS = ['new', 'contact_attempt', 'contacted', 'offer_created', 'offer_sent', 'appointment', 'order', 'won', 'lost'] as const;
export const LEAD_SOURCES = ['google_ads', 'meta_ads', 'website', 'manual', 'phone', 'referral', 'google_business', 'other'] as const;

const leadFields = {
  firstName: zTrimmed(80),
  lastName: zTrimmed(80),
  companyName: zOptionalText(160),
  customerType: z.enum(['private', 'business']),
  email: zOptionalEmail,
  phone: zOptionalText(60),
  street: zOptionalText(200),
  zip: zOptionalText(20),
  city: zOptionalText(120),
  source: z.enum(LEAD_SOURCES),
  sourceDetail: zOptionalText(200),
  gclid: zOptionalText(200),
  fbclid: zOptionalText(200),
  campaign: zOptionalText(200),
  status: z.enum(LEAD_STATUS),
  requestedService: zOptionalText(500),
  vehicleText: zOptionalText(200),
  message: zOptionalText(5000),
  notes: zOptionalText(5000),
  estimatedValueCents: z.number().int().min(0).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  lostReason: zOptionalText(500),
};
// Anlegen: sinnvolle Standardwerte. Ändern: nur übermittelte Felder (keine Defaults, sonst würden Werte überschrieben).
const leadCreateSchema = z.object({ ...leadFields, firstName: leadFields.firstName.default(''), lastName: leadFields.lastName.default(''), customerType: leadFields.customerType.default('private'), source: leadFields.source.default('manual'), status: leadFields.status.default('new') });
const leadUpdateSchema = z.object(leadFields).partial();

export default async function leadRoutes(app: FastifyInstance) {
  const getLead = (companyId: string, id: string) => {
    const row = app.db.select().from(leads).where(and(eq(leads.id, id), eq(leads.companyId, companyId))).get();
    if (!row) throw notFound('Lead');
    return row;
  };

  app.get('/api/leads', { preHandler: app.requireAuth('leads:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ status: z.enum(LEAD_STATUS).optional(), source: z.enum(LEAD_SOURCES).optional(), open: z.coerce.boolean().optional() }), req.query);
    const conds = [eq(leads.companyId, ctx.companyId)];
    if (q.status) conds.push(eq(leads.status, q.status));
    if (q.source) conds.push(eq(leads.source, q.source));
    if (q.open) conds.push(sql`${leads.status} not in ('won','lost')`);
    if (q.q) {
      const term = `%${q.q}%`;
      conds.push(or(like(leads.firstName, term), like(leads.lastName, term), like(leads.email, term), like(leads.phone, term), like(leads.companyName, term), like(leads.vehicleText, term))!);
    }
    const where = and(...conds);
    const items = app.db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(leads).where(where).get()?.n ?? 0;
    return { items, total, page: q.page, pageSize: q.pageSize };
  });

  app.get('/api/leads/stats', { preHandler: app.requireAuth('leads:read') }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select({ status: leads.status, n: sql<number>`count(*)` }).from(leads).where(eq(leads.companyId, ctx.companyId)).groupBy(leads.status).all();
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = r.n;
    return { byStatus };
  });

  app.get('/api/leads/:id', { preHandler: app.requireAuth('leads:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const lead = getLead(ctx.companyId, id);
    const duplicates = findDuplicates(app.db, ctx.companyId, { email: lead.email, phone: lead.phone, firstName: lead.firstName, lastName: lead.lastName, excludeId: lead.id });
    return { lead, activities: listActivities(app.db, ctx.companyId, { leadId: id }), duplicates };
  });

  app.post('/api/leads', { preHandler: app.requireAuth('leads:write') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(leadCreateSchema, req.body);
    if (!input.firstName && !input.lastName && !input.companyName && !input.email && !input.phone) throw badRequest('Bitte mindestens Name, E-Mail oder Telefon angeben.');
    const id = newId();
    app.db.insert(leads).values({ id, companyId: ctx.companyId, ...input, normalizedEmail: normalizeEmail(input.email), normalizedPhone: normalizePhone(input.phone) }).run();
    logActivity(app.db, ctx.companyId, { leadId: id, userId: ctx.userId, type: 'system', subject: 'Lead angelegt', content: `Quelle: ${input.source}` });
    writeAudit(app.db, ctx, { action: 'lead.create', entityType: 'lead', entityId: id, after: input });
    const duplicates = findDuplicates(app.db, ctx.companyId, { email: input.email, phone: input.phone, firstName: input.firstName, lastName: input.lastName, excludeId: id });
    return { lead: getLead(ctx.companyId, id), duplicates };
  });

  app.patch('/api/leads/:id', { preHandler: app.requireAuth('leads:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(leadUpdateSchema, req.body);
    const before = getLead(ctx.companyId, id);
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (input.email !== undefined) patch.normalizedEmail = normalizeEmail(input.email);
    if (input.phone !== undefined) patch.normalizedPhone = normalizePhone(input.phone);
    if (input.status && input.status !== before.status) {
      patch.lastContactAt = nowIso();
      logActivity(app.db, ctx.companyId, { leadId: id, customerId: before.customerId, userId: ctx.userId, type: 'status', subject: `Status: ${before.status} → ${input.status}`, content: input.status === 'lost' ? input.lostReason ?? before.lostReason : null });
    }
    app.db.update(leads).set(patch).where(eq(leads.id, id)).run();
    const after = getLead(ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'lead.update', entityType: 'lead', entityId: id, before, after });
    return after;
  });

  app.delete('/api/leads/:id', { preHandler: app.requireAuth('leads:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = getLead(ctx.companyId, id);
    if (before.customerId) throw conflict('Ein bereits in einen Kunden umgewandelter Lead kann nicht gelöscht werden.');
    app.db.delete(leads).where(eq(leads.id, id)).run();
    writeAudit(app.db, ctx, { action: 'lead.delete', entityType: 'lead', entityId: id, before });
    return { ok: true };
  });

  /** Lead → Kunde. Optional an bestehenden Kunden anhängen (Duplikat-Fall). */
  app.post('/api/leads/:id/convert', { preHandler: app.requireAuth('leads:write', 'customers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { existingCustomerId, status } = parse(z.object({ existingCustomerId: z.string().uuid().optional(), status: z.enum(LEAD_STATUS).default('won') }), req.body ?? {});
    const lead = getLead(ctx.companyId, id);
    if (lead.customerId) throw conflict('Dieser Lead wurde bereits umgewandelt.', { customerId: lead.customerId });

    let customerId: string;
    if (existingCustomerId) {
      const existing = app.db.select().from(customers).where(and(eq(customers.id, existingCustomerId), eq(customers.companyId, ctx.companyId))).get();
      if (!existing) throw notFound('Kunde');
      customerId = existing.id;
    } else {
      const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
      customerId = newId();
      app.db
        .insert(customers)
        .values({
          id: customerId,
          companyId: ctx.companyId,
          customerNumber: nextNumber(app.db, ctx.companyId, 'customer', company.customerPrefix, false),
          type: lead.customerType,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          street: lead.street,
          zip: lead.zip,
          city: lead.city,
          email: lead.email,
          phone: lead.phone,
          notes: [lead.vehicleText ? `Fahrzeug laut Anfrage: ${lead.vehicleText}` : null, lead.requestedService ? `Gewünschte Leistung: ${lead.requestedService}` : null].filter(Boolean).join('\n') || null,
          source: lead.source,
          leadId: lead.id,
          normalizedEmail: lead.normalizedEmail,
          normalizedPhone: lead.normalizedPhone,
        })
        .run();
    }
    app.db.update(leads).set({ customerId, status, updatedAt: nowIso() }).where(eq(leads.id, id)).run();
    // Historie des Leads in die Kundenakte übernehmen
    app.db.run(sql`update activities set customer_id = ${customerId} where company_id = ${ctx.companyId} and lead_id = ${id} and customer_id is null`);
    logActivity(app.db, ctx.companyId, { customerId, leadId: id, userId: ctx.userId, type: 'system', subject: existingCustomerId ? 'Lead bestehendem Kunden zugeordnet' : 'Kunde aus Lead erstellt' });
    writeAudit(app.db, ctx, { action: 'lead.convert', entityType: 'lead', entityId: id, after: { customerId } });
    const customer = app.db.select().from(customers).where(eq(customers.id, customerId)).get();
    return { customer, lead: getLead(ctx.companyId, id) };
  });

  app.get('/api/crm/duplicates', { preHandler: app.requireAuth('customers:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ email: z.string().optional(), phone: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional(), plate: z.string().optional(), excludeId: z.string().optional() }), req.query);
    return { hits: findDuplicates(app.db, ctx.companyId, q) };
  });

  app.get('/api/crm/assignees', { preHandler: app.requireAuth('leads:read') }, async (req) => {
    const ctx = ctxOf(req);
    return { items: app.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(and(eq(users.companyId, ctx.companyId), eq(users.isActive, true))).all() };
  });
}
