import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { customers, vehicles, leads, orders, offers, invoices, protocols, appointments, users, services, inventoryItems } from '../db/schema.js';
import { notFound } from './errors.js';

/**
 * Mandantenbindung von Fremdreferenzen. Jede ID, die ein Client mitschickt, wird gegen den
 * Mandanten der Sitzung geprüft. IDs sind nie alleinige Autorisierung.
 * Die Tabellen heißen historisch `companies`; `company_id` ist die Tenant-ID.
 */
const TABLES = {
  customerId: { table: customers, label: 'Kunde' },
  vehicleId: { table: vehicles, label: 'Fahrzeug' },
  leadId: { table: leads, label: 'Lead' },
  orderId: { table: orders, label: 'Auftrag' },
  offerId: { table: offers, label: 'Angebot' },
  invoiceId: { table: invoices, label: 'Rechnung' },
  protocolId: { table: protocols, label: 'Protokoll' },
  appointmentId: { table: appointments, label: 'Termin' },
  userId: { table: users, label: 'Mitarbeiter' },
  assignedUserId: { table: users, label: 'Mitarbeiter' },
  serviceId: { table: services, label: 'Leistung' },
  itemId: { table: inventoryItems, label: 'Lagerartikel' },
} as const;
export type RefKey = keyof typeof TABLES;

/** Prüft, ob eine ID zum Mandanten gehört. */
export function isOwned(db: Db, companyId: string, key: RefKey, id: string): boolean {
  const { table } = TABLES[key];
  return Boolean(db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.companyId, companyId))).get());
}

/** Wirft 404, wenn eine gesetzte Referenz nicht zum Mandanten gehört. `null`/`undefined` wird ignoriert. */
export function assertRefs(db: Db, companyId: string, refs: Partial<Record<RefKey, string | null | undefined>>): void {
  for (const [key, id] of Object.entries(refs) as Array<[RefKey, string | null | undefined]>) {
    if (!id || !(key in TABLES)) continue;
    if (!isOwned(db, companyId, key, id)) throw notFound(TABLES[key].label);
  }
}
