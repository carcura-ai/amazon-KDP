import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { customers, vehicles, activities, leads, tasks, appointments, orders, protocols, files, emailLog, auditLog } from '../../db/schema.js';
import type { FileStorage } from '../../integrations/storage.js';
import { nowIso } from '../../core/ids.js';

/**
 * Löschkonzept: Personenbezogene Daten eines Kunden werden entfernt, steuerlich aufbewahrungspflichtige
 * Belege (Angebote, Rechnungen, Aufträge als Buchungsgrundlage) bleiben mit Pseudonym erhalten
 * (§ 147 AO, § 14b UStG: 8 bzw. 10 Jahre). Fotos, Unterschriften, Protokolle, Historie, Notizen,
 * Aufgaben und Leads des Kunden werden gelöscht; Termine werden auf einen neutralen Titel gesetzt.
 */
export interface AnonymizeResult { customerId: string; filesDeleted: number; activitiesDeleted: number; leadsDeleted: number; tasksDeleted: number; protocolsCleared: number; invoicesKept: number }

export function anonymizeCustomer(db: Db, storage: FileStorage, companyId: string, customerId: string): AnonymizeResult {
  const c = db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get();
  if (!c) throw new Error('Kunde nicht gefunden');
  const vehicleIds = db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.customerId, customerId), eq(vehicles.companyId, companyId))).all().map((v) => v.id);
  const protocolRows = db.select({ id: protocols.id, pdf: protocols.pdfFileId, cs: protocols.customerSignatureFileId, es: protocols.employeeSignatureFileId }).from(protocols).where(and(eq(protocols.customerId, customerId), eq(protocols.companyId, companyId))).all();
  const protocolIds = protocolRows.map((p) => p.id);

  // Dateien: alles mit Kundenbezug außer Rechnungs-/Angebots-PDFs (Aufbewahrungspflicht)
  const fileRows = db.select({ id: files.id, category: files.category, kind: files.kind }).from(files).where(and(eq(files.companyId, companyId), sql`(${files.customerId} = ${customerId}${vehicleIds.length ? sql` or ${files.vehicleId} in ${vehicleIds}` : sql``}${protocolIds.length ? sql` or ${files.protocolId} in ${protocolIds}` : sql``})`)).all();
  let filesDeleted = 0;
  for (const f of fileRows) { if (f.kind === 'pdf' && (f.category === 'invoice' || f.category === 'offer')) continue; if (storage.remove(companyId, f.id)) filesDeleted++; }

  const invoicesKept = db.select({ n: sql<number>`count(*)` }).from(sql`invoices`).where(sql`customer_id = ${customerId}`).get()?.n ?? 0;
  const result = db.transaction((tx) => {
    const activitiesDeleted = tx.delete(activities).where(and(eq(activities.companyId, companyId), eq(activities.customerId, customerId))).run().changes;
    const leadsDeleted = tx.delete(leads).where(and(eq(leads.companyId, companyId), eq(leads.customerId, customerId))).run().changes;
    const tasksDeleted = tx.delete(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.customerId, customerId))).run().changes;
    tx.update(appointments).set({ title: 'Termin (Kunde gelöscht)', notes: null, location: null, updatedAt: nowIso() }).where(and(eq(appointments.companyId, companyId), eq(appointments.customerId, customerId))).run();
    tx.update(orders).set({ notes: null, internalNotes: null, updatedAt: nowIso() }).where(and(eq(orders.companyId, companyId), eq(orders.customerId, customerId))).run();
    let protocolsCleared = 0;
    if (protocolIds.length) protocolsCleared = tx.update(protocols).set({ notes: null, signedByName: null, customerSignatureFileId: null, employeeSignatureFileId: null, pdfFileId: null, updatedAt: nowIso() }).where(inArray(protocols.id, protocolIds)).run().changes;
    if (vehicleIds.length) tx.update(vehicles).set({ licensePlate: null, normalizedPlate: null, vin: null, notes: null, isActive: false, updatedAt: nowIso() }).where(inArray(vehicles.id, vehicleIds)).run();
    tx.update(customers).set({ salutation: null, firstName: 'Gelöschter', lastName: `Kunde ${c.customerNumber}`, companyName: null, street: null, houseNumber: null, zip: null, city: null, email: null, phone: null, phone2: null, notes: null, tagsJson: '[]', source: null, leadId: null, normalizedEmail: null, normalizedPhone: null, isActive: false, anonymizedAt: nowIso(), updatedAt: nowIso() }).where(eq(customers.id, customerId)).run();
    if (c.email) tx.update(emailLog).set({ toAddress: 'anonymisiert' }).where(and(eq(emailLog.companyId, companyId), eq(emailLog.toAddress, c.email))).run();
    // Audit-Log: Einträge bleiben (Nachweis), aber ohne Vorher/Nachher-Inhalte mit Personenbezug
    tx.update(auditLog).set({ beforeJson: null, afterJson: null }).where(and(eq(auditLog.companyId, companyId), eq(auditLog.entityType, 'customer'), eq(auditLog.entityId, customerId))).run();
    return { activitiesDeleted, leadsDeleted, tasksDeleted, protocolsCleared };
  });
  return { customerId, filesDeleted, invoicesKept, ...result };
}

/** Vollständige Löschung (nur ohne aufbewahrungspflichtige Belege): erst anonymisieren, dann Datensätze entfernen. */
export function deleteCustomerCompletely(db: Db, storage: FileStorage, companyId: string, customerId: string): AnonymizeResult {
  const r = anonymizeCustomer(db, storage, companyId, customerId);
  db.transaction((tx) => {
    tx.delete(protocols).where(and(eq(protocols.companyId, companyId), eq(protocols.customerId, customerId))).run();
    tx.delete(appointments).where(and(eq(appointments.companyId, companyId), eq(appointments.customerId, customerId))).run();
    tx.delete(vehicles).where(and(eq(vehicles.companyId, companyId), eq(vehicles.customerId, customerId))).run();
    tx.delete(customers).where(eq(customers.id, customerId)).run();
  });
  return r;
}

export function hasRetentionDocuments(db: Db, companyId: string, customerId: string): boolean {
  const n = db.get<{ n: number }>(sql`select (select count(*) from invoices where company_id = ${companyId} and customer_id = ${customerId} and status != 'draft') + (select count(*) from offers where company_id = ${companyId} and customer_id = ${customerId} and status != 'draft') + (select count(*) from orders where company_id = ${companyId} and customer_id = ${customerId} and status != 'planned') as n`);
  return (n?.n ?? 0) > 0;
}
