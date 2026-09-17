import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { vehicles, customers } from '../../db/schema.js';
import { parse, zOptionalText, zPagination } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { normalizePlate } from '../../core/normalize.js';
import { ctxOf } from '../../plugins/auth.js';
import { findDuplicates } from './duplicates.js';
import { logActivity, listActivities } from './activities.js';

export const VEHICLE_TYPES = ['Kleinwagen', 'Kompaktklasse', 'Limousine', 'Kombi', 'SUV', 'Van', 'Transporter', 'Cabrio', 'Sportwagen', 'Wohnmobil', 'Motorrad', 'Sonstiges'] as const;

const vehicleSchema = z.object({
  customerId: z.string().uuid(),
  licensePlate: zOptionalText(20),
  make: zOptionalText(60),
  model: zOptionalText(80),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  mileage: z.number().int().min(0).max(5_000_000).nullable().optional(),
  color: zOptionalText(40),
  vehicleType: z.enum(VEHICLE_TYPES).nullable().optional(),
  vin: zOptionalText(20),
  notes: zOptionalText(5000),
  isActive: z.boolean().optional(),
});

export default async function vehicleRoutes(app: FastifyInstance) {
  const getVehicle = (companyId: string, id: string) => {
    const row = app.db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId))).get();
    if (!row) throw notFound('Fahrzeug');
    return row;
  };

  app.get('/api/vehicles', { preHandler: app.requireAuth('vehicles:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ customerId: z.string().uuid().optional() }), req.query);
    const conds = [eq(vehicles.companyId, ctx.companyId), eq(vehicles.isActive, true)];
    if (q.customerId) conds.push(eq(vehicles.customerId, q.customerId));
    if (q.q) {
      const term = `%${q.q}%`;
      conds.push(or(like(vehicles.licensePlate, term), like(vehicles.make, term), like(vehicles.model, term), like(vehicles.vin, term))!);
    }
    const where = and(...conds);
    const items = app.db
      .select({ vehicle: vehicles, customer: { id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName } })
      .from(vehicles)
      .innerJoin(customers, eq(customers.id, vehicles.customerId))
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(vehicles).where(where).get()?.n ?? 0;
    return { items, total, page: q.page, pageSize: q.pageSize };
  });

  app.get('/api/vehicles/:id', { preHandler: app.requireAuth('vehicles:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const vehicle = getVehicle(ctx.companyId, id);
    const customer = app.db.select().from(customers).where(eq(customers.id, vehicle.customerId)).get();
    const activities = listActivities(app.db, ctx.companyId, { customerId: vehicle.customerId }).filter((a) => a.vehicleId === id);
    return { vehicle, customer, activities, types: VEHICLE_TYPES };
  });

  app.post('/api/vehicles', { preHandler: app.requireAuth('vehicles:write') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(vehicleSchema, req.body);
    const owner = app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, ctx.companyId))).get();
    if (!owner) throw notFound('Kunde');
    const id = newId();
    app.db.insert(vehicles).values({ id, companyId: ctx.companyId, ...input, isActive: input.isActive ?? true, normalizedPlate: normalizePlate(input.licensePlate) }).run();
    logActivity(app.db, ctx.companyId, { customerId: input.customerId, vehicleId: id, userId: ctx.userId, type: 'system', subject: `Fahrzeug angelegt: ${[input.make, input.model, input.licensePlate].filter(Boolean).join(' ')}` });
    writeAudit(app.db, ctx, { action: 'vehicle.create', entityType: 'vehicle', entityId: id, after: input });
    const duplicates = findDuplicates(app.db, ctx.companyId, { plate: input.licensePlate, excludeId: id });
    return { vehicle: getVehicle(ctx.companyId, id), duplicates };
  });

  app.patch('/api/vehicles/:id', { preHandler: app.requireAuth('vehicles:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(vehicleSchema.partial(), req.body);
    const before = getVehicle(ctx.companyId, id);
    if (input.customerId) {
      const owner = app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, ctx.companyId))).get();
      if (!owner) throw notFound('Kunde');
    }
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (input.licensePlate !== undefined) patch.normalizedPlate = normalizePlate(input.licensePlate);
    app.db.update(vehicles).set(patch).where(eq(vehicles.id, id)).run();
    const after = getVehicle(ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'vehicle.update', entityType: 'vehicle', entityId: id, before, after });
    return after;
  });

  app.delete('/api/vehicles/:id', { preHandler: app.requireAuth('vehicles:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = getVehicle(ctx.companyId, id);
    app.db.update(vehicles).set({ isActive: false, updatedAt: nowIso() }).where(eq(vehicles.id, id)).run();
    writeAudit(app.db, ctx, { action: 'vehicle.deactivate', entityType: 'vehicle', entityId: id, before });
    return { ok: true };
  });
}
