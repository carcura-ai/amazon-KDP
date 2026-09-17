import { and, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { invoices } from '../db/schema.js';
import { nowIso } from '../core/ids.js';

/** Markiert ausgestellte, unbezahlte Rechnungen nach Fälligkeit als überfällig. */
export async function runOverdueCheck(db: Db): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const res = db
    .update(invoices)
    .set({ status: 'overdue', updatedAt: nowIso() })
    .where(and(sql`${invoices.status} in ('open','sent')`, lt(invoices.dueDate, today)))
    .run();
  return `${res.changes} Rechnung(en) als überfällig markiert`;
}
