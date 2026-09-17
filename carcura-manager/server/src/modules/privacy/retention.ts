import { and, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { companies, leads, emailLog, auditLog, jobs, customers } from '../../db/schema.js';
import type { FileStorage } from '../../integrations/storage.js';
import { privacySettings } from './settings.js';
import { anonymizeCustomer } from './anonymize.js';

const monthsAgo = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString(); };
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Täglicher Job: Speicherbegrenzung nach Art. 5 Abs. 1 lit. e DSGVO gemäß Löschkonzept je Mandant. */
export function runRetention(db: Db, storage: FileStorage): string {
  const parts: string[] = [];
  for (const company of db.select().from(companies).all()) {
    const p = privacySettings(company);
    const cid = company.id;
    const lostLeads = db.delete(leads).where(and(eq(leads.companyId, cid), eq(leads.status, 'lost'), sql`${leads.customerId} is null`, lt(leads.updatedAt, monthsAgo(p.leadRetentionMonths)))).run().changes;
    const staleLeads = db.delete(leads).where(and(eq(leads.companyId, cid), sql`${leads.status} in ('new','contact_attempt')`, sql`${leads.customerId} is null`, lt(leads.updatedAt, monthsAgo(p.leadRetentionMonths * 2)))).run().changes;
    const mails = db.delete(emailLog).where(and(eq(emailLog.companyId, cid), lt(emailLog.createdAt, monthsAgo(p.emailLogRetentionMonths)))).run().changes;
    const audits = db.delete(auditLog).where(and(eq(auditLog.companyId, cid), lt(auditLog.createdAt, monthsAgo(p.auditRetentionMonths)))).run().changes;
    let anonymized = 0;
    if (p.inactiveCustomerYears > 0) {
      const cutoff = monthsAgo(p.inactiveCustomerYears * 12);
      const candidates = db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, cid), eq(customers.isActive, false), sql`${customers.anonymizedAt} is null`, lt(customers.updatedAt, cutoff))).all();
      for (const c of candidates) { anonymizeCustomer(db, storage, cid, c.id); anonymized++; }
    }
    if (lostLeads || staleLeads || mails || audits || anonymized) parts.push(`${company.name}: ${lostLeads + staleLeads} Leads, ${mails} Mailprotokolle, ${audits} Audit-Einträge, ${anonymized} Kunden anonymisiert`);
  }
  const jobRows = db.delete(jobs).where(lt(jobs.runAt, daysAgo(90))).run().changes;
  if (jobRows) parts.push(`${jobRows} Job-Protokolle`);
  return parts.length ? parts.join(' · ') : 'nichts zu löschen';
}
