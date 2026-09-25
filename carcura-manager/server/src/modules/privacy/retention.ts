import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { companies, leads, emailLog, auditLog, jobs, customers, marketingDaily, webAnalyticsDaily, socialDaily, seoDaily, assistantMessages, aiUsageLog, dataExports, userTokens, supportSessions } from '../../db/schema.js';
import { privacySettings } from './settings.js';
import { eraseCustomer } from './routes.js';
import { logDeletion, purgeExpiredRetention } from './lifecycle.js';
import { nowIso } from '../../core/ids.js';

const monthsAgo = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString(); };
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const dateMonthsAgo = (m: number) => monthsAgo(m).slice(0, 10);

/**
 * Zentrale Retention-Engine (täglich): Speicherbegrenzung nach Art. 5 Abs. 1 lit. e DSGVO gemäß den
 * Fristen je Mandant (Einstellungen → Datenschutz). Jede automatische Löschung einer Datenklasse wird im
 * Löschprotokoll des Mandanten nachgewiesen (Anzahl, Frist, Grund – ohne Inhalte).
 */
export function runRetention(app: FastifyInstance): string {
  const db = app.db;
  const parts: string[] = [];
  for (const company of db.select().from(companies).all()) {
    if (company.deletedAt) continue;
    const p = privacySettings(company);
    const cid = company.id;
    const counts: Record<string, number> = {};
    counts.leads = db.delete(leads).where(and(eq(leads.companyId, cid), eq(leads.status, 'lost'), sql`${leads.customerId} is null`, lt(leads.updatedAt, monthsAgo(p.leadRetentionMonths)))).run().changes
      + db.delete(leads).where(and(eq(leads.companyId, cid), sql`${leads.status} in ('new','contact_attempt')`, sql`${leads.customerId} is null`, lt(leads.updatedAt, monthsAgo(p.leadRetentionMonths * 2)))).run().changes;
    counts.emailLog = db.delete(emailLog).where(and(eq(emailLog.companyId, cid), lt(emailLog.createdAt, monthsAgo(p.emailLogRetentionMonths)))).run().changes;
    counts.auditLog = db.delete(auditLog).where(and(eq(auditLog.companyId, cid), lt(auditLog.createdAt, monthsAgo(p.auditRetentionMonths)))).run().changes;
    const mCut = dateMonthsAgo(p.marketingRetentionMonths);
    counts.marketing = db.delete(marketingDaily).where(and(eq(marketingDaily.companyId, cid), lt(marketingDaily.date, mCut))).run().changes
      + db.delete(webAnalyticsDaily).where(and(eq(webAnalyticsDaily.companyId, cid), lt(webAnalyticsDaily.date, mCut))).run().changes
      + db.delete(socialDaily).where(and(eq(socialDaily.companyId, cid), lt(socialDaily.date, mCut))).run().changes
      + db.delete(seoDaily).where(and(eq(seoDaily.companyId, cid), lt(seoDaily.date, mCut))).run().changes;
    counts.assistant = db.delete(assistantMessages).where(and(eq(assistantMessages.companyId, cid), lt(assistantMessages.createdAt, daysAgo(p.assistantRetentionDays)))).run().changes
      + db.delete(aiUsageLog).where(and(eq(aiUsageLog.companyId, cid), lt(aiUsageLog.createdAt, daysAgo(Math.max(p.assistantRetentionDays, 365))))).run().changes;
    // Export-Dateien nach Ablauf entfernen
    for (const e of db.select().from(dataExports).where(and(eq(dataExports.companyId, cid), eq(dataExports.status, 'ready'), lt(dataExports.expiresAt, nowIso()))).all()) {
      if (e.storagePath) fs.rmSync(e.storagePath, { force: true });
      db.update(dataExports).set({ status: 'expired', storagePath: null }).where(eq(dataExports.id, e.id)).run();
      counts.exports = (counts.exports ?? 0) + 1;
    }
    let anonymized = 0;
    if (p.inactiveCustomerYears > 0) {
      const cutoff = monthsAgo(p.inactiveCustomerYears * 12);
      const candidates = db.select({ id: customers.id }).from(customers).where(and(eq(customers.companyId, cid), eq(customers.isActive, false), sql`${customers.anonymizedAt} is null`, sql`${customers.restrictedAt} is null`, lt(customers.updatedAt, cutoff))).all();
      for (const c of candidates) { eraseCustomer(app, cid, c.id, { userId: null, source: 'job', reason: `Inaktiv seit mehr als ${p.inactiveCustomerYears} Jahren (Löschfrist des Mandanten)` }); anonymized++; }
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    if (total) logDeletion(db, { companyId: cid, subjectType: 'data_class', subjectRef: null, action: 'deleted', reason: 'Automatische Löschung nach Aufbewahrungsfristen des Mandanten', details: counts, source: 'job' });
    const LABEL: Record<string, string> = { leads: 'Leads', emailLog: 'Mailprotokolle', auditLog: 'Audit-Einträge', marketing: 'Marketing-Kennzahlen', assistant: 'KI-Verläufe', exports: 'Exporte' };
    if (total || anonymized) parts.push(`${company.name}: ${Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${LABEL[k] ?? k}`).join(', ')}${anonymized ? `, ${anonymized} Kunden anonymisiert` : ''}`);
  }
  const purged = purgeExpiredRetention(db, app.storage);
  if (purged) parts.push(`${purged} Kunden nach Ablauf der Aufbewahrungsfrist endgültig gelöscht`);
  const sys = db.delete(jobs).where(lt(jobs.runAt, daysAgo(90))).run().changes
    + db.delete(userTokens).where(lt(userTokens.expiresAt, daysAgo(30))).run().changes
    + db.delete(supportSessions).where(and(sql`${supportSessions.status} in ('rejected','revoked','ended','expired')`, lt(supportSessions.updatedAt, monthsAgo(24)))).run().changes;
  if (sys) parts.push(`${sys} Systemeinträge`);
  return parts.length ? parts.join(' · ') : 'nichts zu löschen';
}
