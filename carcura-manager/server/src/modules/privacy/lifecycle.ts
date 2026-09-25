import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { customers, vehicles, leads, appointments, orders, orderItems, offers, offerItems, invoices, invoiceItems, payments, protocols, protocolDamages, files, tasks, activities, deletionLog, companies } from '../../db/schema.js';
import type { FileStorage } from '../../integrations/storage.js';
import { newId, nowIso } from '../../core/ids.js';
import { privacySettings } from './settings.js';

/**
 * Datenlebenszyklus eines Kunden:
 *   active → (restricted, Art. 18) → anonymized + Aufbewahrungssperre (Belege nach § 147 AO/§ 14b UStG)
 *          → purged (endgültig gelöscht nach Ablauf der Frist)
 *   ohne aufbewahrungspflichtige Belege: active → deleted
 * Jeder Schritt wird im Löschprotokoll ohne personenbezogene Inhalte nachgewiesen.
 */

export function logDeletion(db: Db, entry: { companyId: string; subjectType: string; subjectRef: string | null; action: string; reason: string; retentionUntil?: string | null; details?: unknown; userId?: string | null; source?: 'user' | 'job' | 'admin' }): void {
  db.insert(deletionLog).values({ id: newId(), companyId: entry.companyId, subjectType: entry.subjectType, subjectRef: entry.subjectRef, action: entry.action, reason: entry.reason, retentionUntil: entry.retentionUntil ?? null, detailsJson: JSON.stringify(entry.details ?? {}), performedByUserId: entry.userId ?? null, source: entry.source ?? 'user' }).run();
}

/**
 * Ende der Aufbewahrungsfrist: Die Frist beginnt mit Ablauf des Kalenderjahres, in dem der letzte
 * Beleg entstanden ist (§ 147 Abs. 4 AO), und dauert die im Mandanten eingestellte Anzahl Jahre.
 * Liefert null, wenn keine aufbewahrungspflichtigen Belege existieren.
 */
export function retentionEnd(db: Db, companyId: string, customerId: string, years: number): { until: string; reason: string } | null {
  const latest = db.get<{ d: string | null }>(sql`select max(d) as d from (
    select coalesce(issue_date, created_at) as d from invoices where company_id = ${companyId} and customer_id = ${customerId} and status != 'draft'
    union all select coalesce(issue_date, created_at) from offers where company_id = ${companyId} and customer_id = ${customerId} and status = 'accepted'
    union all select created_at from orders where company_id = ${companyId} and customer_id = ${customerId} and status not in ('planned','cancelled')
  )`)?.d;
  if (!latest) return null;
  const year = new Date(latest).getUTCFullYear();
  const until = new Date(Date.UTC(year + years + 1, 0, 1)).toISOString(); // 31.12. des Endjahres, 24:00
  return { until, reason: `Aufbewahrung von Rechnungen und Buchungsbelegen (§ 147 AO, § 14b UStG), ${years} Jahre ab Ende ${year}` };
}

export function isRestricted(db: Db, companyId: string, customerId: string): boolean {
  return Boolean(db.select({ r: customers.restrictedAt }).from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get()?.r);
}

/**
 * Endgültige Löschung nach Ablauf der Aufbewahrungsfrist: Belege (Rechnungen, Angebote, Aufträge),
 * deren PDFs und alle übrigen Reste des anonymisierten Kunden.
 */
export function purgeCustomer(db: Db, storage: FileStorage, companyId: string, customerId: string): Record<string, number> {
  const c = db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get();
  if (!c) return {};
  const fileRows = db.select({ id: files.id }).from(files).where(and(eq(files.companyId, companyId), eq(files.customerId, customerId))).all();
  let filesDeleted = 0;
  for (const f of fileRows) if (storage.remove(companyId, f.id)) filesDeleted++;
  const invIds = db.select({ id: invoices.id, pdf: invoices.pdfFileId }).from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.customerId, customerId))).all();
  const offIds = db.select({ id: offers.id, pdf: offers.pdfFileId }).from(offers).where(and(eq(offers.companyId, companyId), eq(offers.customerId, customerId))).all();
  for (const r of [...invIds, ...offIds]) if (r.pdf && storage.remove(companyId, r.pdf)) filesDeleted++;
  const ordIds = db.select({ id: orders.id }).from(orders).where(and(eq(orders.companyId, companyId), eq(orders.customerId, customerId))).all();
  const protIds = db.select({ id: protocols.id }).from(protocols).where(and(eq(protocols.companyId, companyId), eq(protocols.customerId, customerId))).all();
  const counts = db.transaction((tx) => {
    for (const i of invIds) { tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, i.id)).run(); tx.delete(payments).where(eq(payments.invoiceId, i.id)).run(); }
    for (const o of offIds) tx.delete(offerItems).where(eq(offerItems.offerId, o.id)).run();
    for (const o of ordIds) tx.delete(orderItems).where(eq(orderItems.orderId, o.id)).run();
    for (const p of protIds) tx.delete(protocolDamages).where(eq(protocolDamages.protocolId, p.id)).run();
    // Stornorechnungen verweisen aufeinander – Verweise vor dem Löschen lösen
    tx.update(invoices).set({ cancelsInvoiceId: null, cancelledByInvoiceId: null }).where(and(eq(invoices.companyId, companyId), eq(invoices.customerId, customerId))).run();
    const n = {
      invoices: tx.delete(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.customerId, customerId))).run().changes,
      offers: tx.delete(offers).where(and(eq(offers.companyId, companyId), eq(offers.customerId, customerId))).run().changes,
      orders: tx.delete(orders).where(and(eq(orders.companyId, companyId), eq(orders.customerId, customerId))).run().changes,
      protocols: tx.delete(protocols).where(and(eq(protocols.companyId, companyId), eq(protocols.customerId, customerId))).run().changes,
      appointments: tx.delete(appointments).where(and(eq(appointments.companyId, companyId), eq(appointments.customerId, customerId))).run().changes,
      tasks: tx.delete(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.customerId, customerId))).run().changes,
      activities: tx.delete(activities).where(and(eq(activities.companyId, companyId), eq(activities.customerId, customerId))).run().changes,
      leads: tx.delete(leads).where(and(eq(leads.companyId, companyId), eq(leads.customerId, customerId))).run().changes,
      vehicles: tx.delete(vehicles).where(and(eq(vehicles.companyId, companyId), eq(vehicles.customerId, customerId))).run().changes,
    };
    tx.delete(customers).where(eq(customers.id, customerId)).run();
    return n;
  });
  return { ...counts, files: filesDeleted };
}

/** Täglich: anonymisierte Kunden mit abgelaufener Aufbewahrungsfrist endgültig löschen. */
export function purgeExpiredRetention(db: Db, storage: FileStorage, now = new Date()): number {
  let n = 0;
  const due = db.select({ id: customers.id, companyId: customers.companyId, number: customers.customerNumber, until: customers.retentionUntil }).from(customers).where(and(isNotNull(customers.anonymizedAt), isNotNull(customers.retentionUntil), lt(customers.retentionUntil, now.toISOString()))).all();
  for (const c of due) {
    const details = purgeCustomer(db, storage, c.companyId, c.id);
    logDeletion(db, { companyId: c.companyId, subjectType: 'customer', subjectRef: c.number, action: 'purged', reason: 'Aufbewahrungsfrist abgelaufen – Belege und Restdaten endgültig gelöscht', retentionUntil: c.until, details, source: 'job' });
    n++;
  }
  return n;
}

/** Suche für Datenschutz → Datenlöschung: Kunden und Leads nach Name, E-Mail, Telefon, Kennzeichen, Fahrzeug. */
export function searchSubjects(db: Db, companyId: string, q: string) {
  const term = `%${q.trim()}%`;
  const plate = q.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const customerRows = db.select().from(customers).where(and(eq(customers.companyId, companyId), sql`(${customers.firstName} || ' ' || ${customers.lastName} like ${term} or ${customers.companyName} like ${term} or ${customers.email} like ${term} or ${customers.phone} like ${term} or ${customers.customerNumber} like ${term}
      or exists (select 1 from vehicles v where v.customer_id = ${customers.id} and v.company_id = ${companyId} and (v.normalized_plate like ${`%${plate || '#'}%`} or (v.make || ' ' || coalesce(v.model,'')) like ${term})))`)).limit(20).all();
  const leadRows = db.select().from(leads).where(and(eq(leads.companyId, companyId), sql`${leads.customerId} is null`, sql`(${leads.firstName} || ' ' || ${leads.lastName} like ${term} or ${leads.email} like ${term} or ${leads.phone} like ${term} or ${leads.vehicleText} like ${term})`)).limit(20).all();
  const company = db.select().from(companies).where(eq(companies.id, companyId)).get()!;
  const years = privacySettings(company).documentRetentionYears;
  return {
    customers: customerRows.map((c) => ({ id: c.id, customerNumber: c.customerNumber, name: `${c.companyName ? `${c.companyName} · ` : ''}${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone, state: c.anonymizedAt ? 'anonymized' : c.restrictedAt ? 'restricted' : c.isActive ? 'active' : 'inactive', restrictedAt: c.restrictedAt, anonymizedAt: c.anonymizedAt, retentionUntil: c.retentionUntil, dependencies: dependenciesOf(db, companyId, c.id), retention: c.anonymizedAt ? (c.retentionUntil ? { until: c.retentionUntil, reason: c.retentionReason } : null) : retentionEnd(db, companyId, c.id, years) })),
    leads: leadRows.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`.trim() || l.email || l.phone || 'Lead', email: l.email, phone: l.phone, status: l.status, createdAt: l.createdAt })),
  };
}

export function dependenciesOf(db: Db, companyId: string, customerId: string) {
  const n = (q: ReturnType<typeof sql>) => db.get<{ n: number }>(q)?.n ?? 0;
  return {
    vehicles: n(sql`select count(*) as n from vehicles where company_id = ${companyId} and customer_id = ${customerId}`),
    appointments: n(sql`select count(*) as n from appointments where company_id = ${companyId} and customer_id = ${customerId}`),
    orders: n(sql`select count(*) as n from orders where company_id = ${companyId} and customer_id = ${customerId}`),
    offers: n(sql`select count(*) as n from offers where company_id = ${companyId} and customer_id = ${customerId}`),
    invoicesIssued: n(sql`select count(*) as n from invoices where company_id = ${companyId} and customer_id = ${customerId} and status != 'draft'`),
    invoiceDrafts: n(sql`select count(*) as n from invoices where company_id = ${companyId} and customer_id = ${customerId} and status = 'draft'`),
    protocols: n(sql`select count(*) as n from protocols where company_id = ${companyId} and customer_id = ${customerId}`),
    files: n(sql`select count(*) as n from files where company_id = ${companyId} and customer_id = ${customerId}`),
    activities: n(sql`select count(*) as n from activities where company_id = ${companyId} and customer_id = ${customerId}`),
    tasks: n(sql`select count(*) as n from tasks where company_id = ${companyId} and customer_id = ${customerId}`),
    leads: n(sql`select count(*) as n from leads where company_id = ${companyId} and customer_id = ${customerId}`),
  };
}
