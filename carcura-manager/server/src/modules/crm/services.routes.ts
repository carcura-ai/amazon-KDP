import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { services } from '../../db/schema.js';
import { parse, zTrimmed, zOptionalText, zMoneyCents } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';

const fields = {
  name: zTrimmed(120).min(1),
  description: zOptionalText(2000),
  category: zOptionalText(60),
  priceCents: zMoneyCents,
  vatBp: z.number().int().min(0).max(10000),
  durationMinutes: z.number().int().min(0).max(24 * 60),
  materialCostCents: zMoneyCents,
  isActive: z.boolean(),
  sortOrder: z.number().int(),
};
const createSchema = z.object({ ...fields, priceCents: fields.priceCents.default(0), vatBp: fields.vatBp.default(1900), durationMinutes: fields.durationMinutes.default(60), materialCostCents: fields.materialCostCents.default(0), isActive: fields.isActive.default(true), sortOrder: fields.sortOrder.default(0) });
const updateSchema = z.object(fields).partial();

export default async function serviceRoutes(app: FastifyInstance) {
  app.get('/api/services', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const { includeInactive } = parse(z.object({ includeInactive: z.coerce.boolean().default(false) }), req.query);
    const rows = app.db
      .select()
      .from(services)
      .where(and(eq(services.companyId, ctx.companyId), includeInactive ? undefined : eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder), asc(services.name))
      .all();
    return { items: rows };
  });

  app.post('/api/services', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(createSchema, req.body);
    const id = newId();
    app.db.insert(services).values({ id, companyId: ctx.companyId, ...input }).run();
    writeAudit(app.db, ctx, { action: 'service.create', entityType: 'service', entityId: id, after: input });
    return app.db.select().from(services).where(eq(services.id, id)).get();
  });

  app.patch('/api/services/:id', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(updateSchema, req.body);
    const before = app.db.select().from(services).where(and(eq(services.id, id), eq(services.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Leistung');
    app.db.update(services).set({ ...input, updatedAt: nowIso() }).where(eq(services.id, id)).run();
    const after = app.db.select().from(services).where(eq(services.id, id)).get();
    writeAudit(app.db, ctx, { action: 'service.update', entityType: 'service', entityId: id, before, after });
    return after;
  });

  app.delete('/api/services/:id', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(services).where(and(eq(services.id, id), eq(services.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Leistung');
    // Leistungen werden nie hart gelöscht (Referenzen aus Aufträgen/Rechnungen), sondern deaktiviert.
    app.db.update(services).set({ isActive: false, updatedAt: nowIso() }).where(eq(services.id, id)).run();
    writeAudit(app.db, ctx, { action: 'service.deactivate', entityType: 'service', entityId: id, before });
    return { ok: true };
  });
}
