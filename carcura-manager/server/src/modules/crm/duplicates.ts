import { and, eq, or, ne, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { customers, leads, vehicles } from '../../db/schema.js';
import { normalizeEmail, normalizePhone, normalizePlate } from '../../core/normalize.js';

export interface DuplicateHit {
  kind: 'customer' | 'lead' | 'vehicle';
  id: string;
  label: string;
  matchedOn: Array<'email' | 'phone' | 'name' | 'plate'>;
}

export function findDuplicates(
  db: Db,
  companyId: string,
  probe: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null; plate?: string | null; excludeId?: string },
): DuplicateHit[] {
  const hits = new Map<string, DuplicateHit>();
  const email = normalizeEmail(probe.email);
  const phone = normalizePhone(probe.phone);
  const plate = normalizePlate(probe.plate);
  const first = probe.firstName?.trim().toLowerCase();
  const last = probe.lastName?.trim().toLowerCase();

  const add = (kind: DuplicateHit['kind'], id: string, label: string, on: DuplicateHit['matchedOn'][number]) => {
    const key = `${kind}:${id}`;
    const h = hits.get(key) ?? { kind, id, label, matchedOn: [] };
    if (!h.matchedOn.includes(on)) h.matchedOn.push(on);
    hits.set(key, h);
  };

  const custConds = [];
  if (email) custConds.push(eq(customers.normalizedEmail, email));
  if (phone) custConds.push(eq(customers.normalizedPhone, phone));
  if (first && last) custConds.push(and(sql`lower(${customers.firstName}) = ${first}`, sql`lower(${customers.lastName}) = ${last}`));
  if (custConds.length) {
    const rows = db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), or(...custConds), probe.excludeId ? ne(customers.id, probe.excludeId) : undefined))
      .limit(20)
      .all();
    for (const c of rows) {
      const label = `${c.customerNumber} · ${c.companyName ? c.companyName + ' · ' : ''}${c.firstName} ${c.lastName}`.trim();
      if (email && c.normalizedEmail === email) add('customer', c.id, label, 'email');
      if (phone && c.normalizedPhone === phone) add('customer', c.id, label, 'phone');
      if (first && last && c.firstName.toLowerCase() === first && c.lastName.toLowerCase() === last) add('customer', c.id, label, 'name');
    }
  }

  const leadConds = [];
  if (email) leadConds.push(eq(leads.normalizedEmail, email));
  if (phone) leadConds.push(eq(leads.normalizedPhone, phone));
  if (leadConds.length) {
    const rows = db
      .select()
      .from(leads)
      .where(and(eq(leads.companyId, companyId), or(...leadConds), probe.excludeId ? ne(leads.id, probe.excludeId) : undefined))
      .limit(20)
      .all();
    for (const l of rows) {
      const label = `Lead · ${l.firstName} ${l.lastName} (${l.status})`.trim();
      if (email && l.normalizedEmail === email) add('lead', l.id, label, 'email');
      if (phone && l.normalizedPhone === phone) add('lead', l.id, label, 'phone');
    }
  }

  if (plate) {
    const rows = db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.companyId, companyId), eq(vehicles.normalizedPlate, plate), probe.excludeId ? ne(vehicles.id, probe.excludeId) : undefined))
      .limit(10)
      .all();
    for (const v of rows) add('vehicle', v.id, `${v.licensePlate} · ${v.make ?? ''} ${v.model ?? ''}`.trim(), 'plate');
  }
  return [...hits.values()];
}
