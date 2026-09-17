import { and, eq, lte } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { recurringExpenses, expenses } from '../db/schema.js';
import { newId, nowIso } from '../core/ids.js';

export function nextDateAfter(date: string, interval: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDate();
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (interval === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3, 1);
  else if (interval === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1, 1);
  if (interval === 'monthly' || interval === 'quarterly') {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}

/** Erzeugt fällige Buchungen aus wiederkehrenden Ausgaben (idempotent je Periode). */
export async function runRecurringExpenses(db: Db): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  let booked = 0;
  const due = db.select().from(recurringExpenses).where(and(eq(recurringExpenses.isActive, true), lte(recurringExpenses.nextDate, today))).all();
  for (const r of due) {
    let next = r.nextDate;
    let guard = 0;
    while (next <= today && guard++ < 120) {
      if (r.endDate && next > r.endDate) { db.update(recurringExpenses).set({ isActive: false, updatedAt: nowIso() }).where(eq(recurringExpenses.id, r.id)).run(); break; }
      const vat = Math.round((r.netCents * r.vatBp) / 10000);
      const res = db
        .insert(expenses)
        .values({ id: newId(), companyId: r.companyId, date: next, category: r.category, description: r.name, vendor: r.vendor, netCents: r.netCents, vatBp: r.vatBp, vatCents: vat, grossCents: r.netCents + vat, paymentMethod: r.paymentMethod, isPaid: r.autoPaid, paidAt: r.autoPaid ? next : null, dueDate: next, recurringExpenseId: r.id, notes: 'Automatisch aus wiederkehrender Ausgabe erzeugt' })
        .onConflictDoNothing()
        .run();
      if (res.changes > 0) booked++;
      next = nextDateAfter(next, r.interval);
    }
    db.update(recurringExpenses).set({ nextDate: next, updatedAt: nowIso() }).where(eq(recurringExpenses.id, r.id)).run();
  }
  return `${booked} Buchung(en) erzeugt`;
}
