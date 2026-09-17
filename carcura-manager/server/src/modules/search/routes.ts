import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, like, or } from 'drizzle-orm';
import { leads, customers, vehicles } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { ctxOf } from '../../plugins/auth.js';

export interface SearchHit {
  kind: 'customer' | 'lead' | 'vehicle';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export default async function searchRoutes(app: FastifyInstance) {
  app.get('/api/search', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const { q } = parse(z.object({ q: z.string().trim().min(1).max(100) }), req.query);
    const term = `%${q}%`;
    const hits: SearchHit[] = [];

    if (ctx.permissions.has('customers:read')) {
      const rows = app.db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, ctx.companyId), or(like(customers.firstName, term), like(customers.lastName, term), like(customers.companyName, term), like(customers.email, term), like(customers.phone, term), like(customers.customerNumber, term))))
        .limit(8)
        .all();
      for (const c of rows) hits.push({ kind: 'customer', id: c.id, title: `${c.companyName ? c.companyName + ' · ' : ''}${c.firstName} ${c.lastName}`.trim(), subtitle: `${c.customerNumber}${c.city ? ' · ' + c.city : ''}${c.phone ? ' · ' + c.phone : ''}`, href: `/kunden/${c.id}` });
    }
    if (ctx.permissions.has('leads:read')) {
      const rows = app.db
        .select()
        .from(leads)
        .where(and(eq(leads.companyId, ctx.companyId), or(like(leads.firstName, term), like(leads.lastName, term), like(leads.companyName, term), like(leads.email, term), like(leads.phone, term), like(leads.vehicleText, term))))
        .limit(8)
        .all();
      for (const l of rows) hits.push({ kind: 'lead', id: l.id, title: `${l.firstName} ${l.lastName}`.trim() || l.email || l.phone || 'Lead', subtitle: `Lead · ${l.status}${l.requestedService ? ' · ' + l.requestedService : ''}`, href: `/leads/${l.id}` });
    }
    if (ctx.permissions.has('vehicles:read')) {
      const rows = app.db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.companyId, ctx.companyId), eq(vehicles.isActive, true), or(like(vehicles.licensePlate, term), like(vehicles.make, term), like(vehicles.model, term), like(vehicles.vin, term))))
        .limit(8)
        .all();
      for (const v of rows) hits.push({ kind: 'vehicle', id: v.id, title: [v.make, v.model].filter(Boolean).join(' ') || 'Fahrzeug', subtitle: `${v.licensePlate ?? 'ohne Kennzeichen'}${v.year ? ' · ' + v.year : ''}`, href: `/fahrzeuge/${v.id}` });
    }
    return { hits };
  });
}
