import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { numberSequences } from '../db/schema.js';
import { newId } from './ids.js';

/**
 * Vergibt transaktional die nächste Nummer eines Nummernkreises.
 * Kunden: KD-000123 (ohne Jahr). Rechnungen/Angebote: RE-2026-0001 (pro Jahr).
 */
export function nextNumber(db: Db, companyId: string, kind: 'customer' | 'invoice' | 'offer' | 'order', prefix: string, perYear: boolean): string {
  const year = perYear ? new Date().getFullYear() : 0;
  const value = db.transaction((tx) => {
    tx.insert(numberSequences).values({ id: newId(), companyId, kind, year, value: 0 }).onConflictDoNothing().run();
    tx.update(numberSequences)
      .set({ value: sql`${numberSequences.value} + 1` })
      .where(and(eq(numberSequences.companyId, companyId), eq(numberSequences.kind, kind), eq(numberSequences.year, year)))
      .run();
    return tx
      .select({ value: numberSequences.value })
      .from(numberSequences)
      .where(and(eq(numberSequences.companyId, companyId), eq(numberSequences.kind, kind), eq(numberSequences.year, year)))
      .get()!.value;
  });
  return perYear ? `${prefix}-${year}-${String(value).padStart(4, '0')}` : `${prefix}-${String(value).padStart(6, '0')}`;
}
