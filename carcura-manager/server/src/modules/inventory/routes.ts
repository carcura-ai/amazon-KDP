import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { inventoryItems, inventoryMovements } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination, zMoneyCents } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';

export const UNITS = ['Stück', 'Liter', 'ml', 'kg', 'g', 'Packung', 'Rolle', 'Meter'] as const;
const fields = {
  name: zTrimmed(160).min(1),
  sku: zOptionalText(60),
  manufacturer: zOptionalText(120),
  category: zOptionalText(80),
  unit: z.enum(UNITS),
  minQuantity: z.number().min(0).max(1_000_000),
  purchasePriceCents: zMoneyCents,
  supplier: zOptionalText(160),
  location: zOptionalText(120),
  notes: zOptionalText(2000),
  isActive: z.boolean(),
};
const createSchema = z.object({ ...fields, unit: fields.unit.default('Stück'), minQuantity: fields.minQuantity.default(0), purchasePriceCents: fields.purchasePriceCents.default(0), isActive: fields.isActive.default(true), quantity: z.number().min(0).max(1_000_000).default(0) });
const updateSchema = z.object(fields).partial();
const movementSchema = z.object({ type: z.enum(['in', 'out', 'adjust']), quantity: z.number().min(0).max(1_000_000), unitCostCents: zMoneyCents.nullable().optional(), reason: zOptionalText(300), refType: zOptionalText(40), refId: zOptionalText(60) });

export default async function inventoryRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.companyId, companyId))).get();
    if (!row) throw notFound('Artikel');
    return row;
  };
  const withFlags = (r: typeof inventoryItems.$inferSelect) => ({ ...r, isLow: r.minQuantity > 0 && r.quantity <= r.minQuantity, stockValueCents: Math.round(r.quantity * r.purchasePriceCents) });

  app.get('/api/inventory', { preHandler: app.requireAuth('inventory:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ low: z.coerce.boolean().optional(), category: z.string().optional(), includeInactive: z.coerce.boolean().default(false) }), req.query);
    const conds = [eq(inventoryItems.companyId, ctx.companyId)];
    if (!q.includeInactive) conds.push(eq(inventoryItems.isActive, true));
    if (q.category) conds.push(eq(inventoryItems.category, q.category));
    if (q.low) conds.push(sql`${inventoryItems.minQuantity} > 0 and ${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`);
    if (q.q) { const t = `%${q.q}%`; conds.push(or(like(inventoryItems.name, t), like(inventoryItems.sku, t), like(inventoryItems.manufacturer, t), like(inventoryItems.supplier, t), like(inventoryItems.category, t))!); }
    const where = and(...conds);
    const items = app.db.select().from(inventoryItems).where(where).orderBy(asc(inventoryItems.category), asc(inventoryItems.name)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all().map(withFlags);
    const total = app.db.select({ n: sql<number>`count(*)` }).from(inventoryItems).where(where).get()?.n ?? 0;
    const lowCount = app.db.select({ n: sql<number>`count(*)` }).from(inventoryItems).where(and(eq(inventoryItems.companyId, ctx.companyId), eq(inventoryItems.isActive, true), sql`${inventoryItems.minQuantity} > 0 and ${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`)).get()?.n ?? 0;
    const stockValue = app.db.select({ s: sql<number>`coalesce(sum(${inventoryItems.quantity} * ${inventoryItems.purchasePriceCents}),0)` }).from(inventoryItems).where(and(eq(inventoryItems.companyId, ctx.companyId), eq(inventoryItems.isActive, true))).get()?.s ?? 0;
    const categories = app.db.selectDistinct({ c: inventoryItems.category }).from(inventoryItems).where(eq(inventoryItems.companyId, ctx.companyId)).all().map((r) => r.c).filter(Boolean) as string[];
    return { items, total, page: q.page, pageSize: q.pageSize, lowCount, stockValueCents: Math.round(stockValue), categories, units: UNITS };
  });

  app.get('/api/inventory/:id', { preHandler: app.requireAuth('inventory:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const item = withFlags(getOne(ctx.companyId, id));
    const movements = app.db.select().from(inventoryMovements).where(eq(inventoryMovements.itemId, id)).orderBy(desc(inventoryMovements.createdAt)).limit(200).all();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const consumption30 = app.db.select({ s: sql<number>`coalesce(sum(-${inventoryMovements.delta}),0)` }).from(inventoryMovements).where(and(eq(inventoryMovements.itemId, id), eq(inventoryMovements.type, 'out'), sql`${inventoryMovements.createdAt} >= ${since}`)).get()?.s ?? 0;
    return { item, movements, consumption30, daysOfStock: consumption30 > 0 ? Math.round((item.quantity / consumption30) * 30) : null };
  });

  app.post('/api/inventory', { preHandler: app.requireAuth('inventory:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { quantity, ...input } = parse(createSchema, req.body);
    const id = newId();
    app.db.insert(inventoryItems).values({ id, companyId: ctx.companyId, ...input, quantity }).run();
    if (quantity > 0) app.db.insert(inventoryMovements).values({ id: newId(), companyId: ctx.companyId, itemId: id, type: 'in', delta: quantity, quantityAfter: quantity, unitCostCents: input.purchasePriceCents, reason: 'Anfangsbestand', userId: ctx.userId }).run();
    writeAudit(app.db, ctx, { action: 'inventory.create', entityType: 'inventory_item', entityId: id, after: input });
    return withFlags(getOne(ctx.companyId, id));
  });

  app.patch('/api/inventory/:id', { preHandler: app.requireAuth('inventory:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    app.db.update(inventoryItems).set({ ...input, updatedAt: nowIso() }).where(eq(inventoryItems.id, id)).run();
    writeAudit(app.db, ctx, { action: 'inventory.update', entityType: 'inventory_item', entityId: id, before, after: input });
    return withFlags(getOne(ctx.companyId, id));
  });

  /** Bestandsbewegung: Zugang, Entnahme oder Korrektur (setzt absolute Menge). */
  app.post('/api/inventory/:id/movements', { preHandler: app.requireAuth('inventory:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(movementSchema, req.body);
    const item = getOne(ctx.companyId, id);
    let delta = 0;
    if (input.type === 'in') delta = input.quantity;
    else if (input.type === 'out') { delta = -input.quantity; if (item.quantity + delta < 0) throw badRequest(`Nur ${item.quantity} ${item.unit} auf Lager.`); }
    else delta = input.quantity - item.quantity;
    const after = Math.round((item.quantity + delta) * 1000) / 1000;
    app.db.transaction((tx) => {
      tx.update(inventoryItems).set({ quantity: after, updatedAt: nowIso(), ...(input.type === 'in' && input.unitCostCents ? { purchasePriceCents: input.unitCostCents } : {}) }).where(eq(inventoryItems.id, id)).run();
      tx.insert(inventoryMovements).values({ id: newId(), companyId: ctx.companyId, itemId: id, type: input.type, delta, quantityAfter: after, unitCostCents: input.unitCostCents ?? null, reason: input.reason ?? null, refType: input.refType ?? null, refId: input.refId ?? null, userId: ctx.userId }).run();
    });
    writeAudit(app.db, ctx, { action: 'inventory.movement', entityType: 'inventory_item', entityId: id, after: { ...input, delta, after } });
    return { item: withFlags(getOne(ctx.companyId, id)) };
  });

  app.delete('/api/inventory/:id', { preHandler: app.requireAuth('inventory:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    getOne(ctx.companyId, id);
    app.db.update(inventoryItems).set({ isActive: false, updatedAt: nowIso() }).where(eq(inventoryItems.id, id)).run();
    writeAudit(app.db, ctx, { action: 'inventory.deactivate', entityType: 'inventory_item', entityId: id });
    return { ok: true };
  });
}
