import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, isNull, isNotNull, lt } from 'drizzle-orm';
import { companies, tenantSubscriptions, users, subprocessors } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { logDeletion } from '../privacy/lifecycle.js';

/** Tabellen, die bei der Mandantenlöschung erhalten bleiben (Vertrags-/Nachweisdaten des Betreibers, ohne Kundendaten des Mandanten). */
const KEEP_TABLES = new Set(['companies', 'deletion_log', 'tenant_subscriptions', 'subscription_events', 'legal_acceptances', 'payment_webhook_events', 'incidents', 'jobs']);

/**
 * Löscht alle Daten eines Mandanten (Auftragsverarbeitung endet, Art. 28 Abs. 3 lit. g DSGVO).
 * Erhalten bleiben nur Vertrags- und Nachweisdaten des Betreibers (Abo, Zustimmungen, Löschprotokoll).
 * Sicherungen der Installation enthalten die Daten noch bis zu ihrer Rotation; nach einer
 * Wiederherstellung wird die Löschung über das Löschregister erneut angewendet.
 */
export function purgeTenant(app: FastifyInstance, companyId: string, reason: string, userId: string | null): Record<string, number> {
  const sqlite = app.dbHandle.sqlite;
  const tables = (sqlite.prepare(`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != '__drizzle_migrations'`).all() as Array<{ name: string }>).map((t) => t.name)
    .filter((t) => !KEEP_TABLES.has(t) && (sqlite.prepare(`pragma table_info("${t}")`).all() as Array<{ name: string }>).some((c) => c.name === 'company_id'));
  const counts: Record<string, number> = {};
  const userIds = app.db.select({ id: users.id }).from(users).where(eq(users.companyId, companyId)).all().map((u) => u.id);
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec('PRAGMA defer_foreign_keys = ON');
    for (const id of userIds) sqlite.prepare('delete from user_tokens where user_id = ?').run(id);
    for (const t of tables) {
      const r = sqlite.prepare(`delete from "${t}" where company_id = ?`).run(companyId) as { changes: number };
      if (r.changes) counts[t] = Number(r.changes);
    }
    sqlite.prepare(`update companies set name = 'Gelöschter Mandant', legal_name = null, email = null, phone = null, website = null, street = null, zip = null, city = null, tax_number = null, vat_id = null, bank_name = null, iban = null, bic = null, logo_file_id = null, invoice_footer = null, settings_json = '{}', website_lead_token = null, powered_by = null, is_active = 0, deleted_at = ?, deletion_reason = ? where id = ?`).run(nowIso(), reason, companyId);
    sqlite.exec('COMMIT');
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
  fs.rmSync(path.join(app.config.filesDir, companyId), { recursive: true, force: true });
  fs.rmSync(path.join(app.config.dataDir, 'exports', companyId), { recursive: true, force: true });
  logDeletion(app.db, { companyId, subjectType: 'tenant', subjectRef: companyId, action: 'tenant_deleted', reason, details: counts, userId, source: userId ? 'admin' : 'job' });
  appendLedger(app, { kind: 'tenant', companyId, at: nowIso() });
  return counts;
}

/* ---------------------------------------------------------- Löschregister außerhalb der Datenbank */
/**
 * Das Register liegt neben der Datenbank (data/deletion-ledger.jsonl) und wird nicht mit der
 * Datenbank wiederhergestellt. Nach einer Wiederherstellung werden alle Löschungen, die nach dem
 * Stand der Sicherung erfolgt sind, erneut angewendet – gelöschte Daten kommen nicht zurück.
 * Es enthält nur interne IDs, keine Namen oder Kontaktdaten.
 */
export interface LedgerEntry { kind: 'tenant' | 'customer'; companyId: string; customerId?: string; at: string }
const ledgerFile = (app: FastifyInstance) => path.join(app.config.dataDir, 'deletion-ledger.jsonl');
export function appendLedger(app: FastifyInstance, e: LedgerEntry): void {
  if (!app.config.dataDir) return;
  fs.mkdirSync(app.config.dataDir, { recursive: true });
  fs.appendFileSync(ledgerFile(app), `${JSON.stringify(e)}\n`);
}
export function readLedger(app: FastifyInstance): LedgerEntry[] {
  const f = ledgerFile(app);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as LedgerEntry; } catch { return null; } }).filter((e): e is LedgerEntry => e !== null);
}

/**
 * Täglich: Mandanten, deren Abo seit mehr als `graceDays` abgelaufen ist, zur Löschung vormerken
 * (mit E-Mail an die Admins und 14 Tagen Vorlauf für den Export); vorgemerkte Mandanten nach Ablauf löschen.
 */
export async function runTenantLifecycle(app: FastifyInstance, graceDays: number, now = new Date()): Promise<string> {
  if (app.config.deploymentMode !== 'saas') return 'Self-Hosted: keine automatische Mandantenlöschung';
  let scheduled = 0; let deleted = 0;
  const cutoff = new Date(now.getTime() - graceDays * 86_400_000).toISOString();
  const expired = app.db.select({ c: companies, s: tenantSubscriptions }).from(companies).innerJoin(tenantSubscriptions, eq(tenantSubscriptions.companyId, companies.id))
    .where(and(eq(tenantSubscriptions.status, 'expired'), lt(tenantSubscriptions.updatedAt, cutoff), isNull(companies.deletionScheduledAt), isNull(companies.deletedAt))).all();
  for (const { c } of expired) {
    const when = new Date(now.getTime() + 14 * 86_400_000);
    app.db.update(companies).set({ deletionScheduledAt: when.toISOString(), deletionReason: `Vertragsende; Frist von ${graceDays} Tagen abgelaufen` }).where(eq(companies.id, c.id)).run();
    for (const u of app.db.select().from(users).where(and(eq(users.companyId, c.id), eq(users.role, 'admin'), eq(users.isActive, true))).all()) {
      if (app.mail.canSendAccountMail(c.id)) await app.mail.sendAccountMail(c.id, { to: u.email, subject: 'Ihre Daten werden gelöscht', text: `Guten Tag ${u.firstName},\n\ndas Abonnement für ${c.name} ist beendet. Wie vereinbart werden alle Daten am ${when.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })} endgültig gelöscht.\n\nBis dahin können Sie sich anmelden und unter Einstellungen → Datenschutz → Datenexport eine vollständige Kopie herunterladen. Bitte beachten Sie Ihre gesetzlichen Aufbewahrungspflichten für Rechnungen.`, refType: 'tenant_deletion' });
    }
    scheduled++;
  }
  for (const c of app.db.select().from(companies).where(and(isNotNull(companies.deletionScheduledAt), isNull(companies.deletedAt), lt(companies.deletionScheduledAt, now.toISOString()))).all()) {
    purgeTenant(app, c.id, c.deletionReason ?? 'Vertragsende', null);
    deleted++;
  }
  return `${scheduled} Mandanten zur Löschung vorgemerkt, ${deleted} gelöscht`;
}

/** Wendet nach einer Wiederherstellung Löschungen an, die nach dem Sicherungsstand erfolgt sind. */
export async function reapplyDeletionLedger(app: FastifyInstance, since: string): Promise<number> {
  const { eraseCustomerById } = await import('../privacy/reapply.js');
  let n = 0;
  for (const e of readLedger(app).filter((x) => x.at > since)) {
    const company = app.db.select().from(companies).where(eq(companies.id, e.companyId)).get();
    if (!company) continue;
    if (e.kind === 'tenant' && !company.deletedAt) { purgeTenant(app, e.companyId, 'Erneut angewendet nach Wiederherstellung', null); n++; }
    if (e.kind === 'customer' && e.customerId && eraseCustomerById(app, e.companyId, e.customerId)) n++;
  }
  return n;
}

/** Startwerte des Subprozessor-Registers. Vertragsstatus bewusst „zu prüfen“ – nie ungeprüft als erledigt eintragen. */
export function seedSubprocessors(app: FastifyInstance): void {
  if (app.db.select({ id: subprocessors.id }).from(subprocessors).limit(1).get()) return;
  const rows = [
    { key: 'hosting', name: 'Server-Hosting (vom Betreiber zu benennen)', purpose: 'Betrieb von Datenbank, Dateien und Anwendung', dataCategories: 'alle im System gespeicherten Daten', location: 'EU (Deutschland empfohlen)', thirdCountry: false, activation: 'always', integrationType: null },
    { key: 'smtp', name: 'E-Mail-Anbieter des Mandanten (SMTP)', purpose: 'Versand von Terminbestätigungen, Angeboten, Rechnungen', dataCategories: 'Name, E-Mail-Adresse, Inhalt der Nachricht, Anhänge', location: 'je nach Anbieter', thirdCountry: false, activation: 'optional', integrationType: 'smtp' },
    { key: 'windsor', name: 'Windsor.ai', purpose: 'Abruf von Marketing-Kennzahlen und Meta-Lead-Formularen', dataCategories: 'Kampagnenkennzahlen; bei Lead-Import: Name, E-Mail, Telefon aus Formularen', location: 'zu prüfen', thirdCountry: true, activation: 'optional', integrationType: 'windsor' },
    { key: 'google', name: 'Google (Ads, Analytics 4, Search Console, Places)', purpose: 'Marketing-Kennzahlen, Wettbewerberdaten', dataCategories: 'aggregierte Kennzahlen, öffentliche Unternehmensdaten', location: 'USA/EU', thirdCountry: true, activation: 'optional', integrationType: 'google_ads' },
    { key: 'meta', name: 'Meta Platforms (Werbekonten)', purpose: 'Marketing-Kennzahlen', dataCategories: 'aggregierte Kampagnenkennzahlen', location: 'USA/Irland', thirdCountry: true, activation: 'optional', integrationType: 'meta_ads' },
    { key: 'anthropic', name: 'Anthropic (KI-Assistent Claude)', purpose: 'Beantwortung von Fragen zu Betriebsdaten', dataCategories: 'aggregierte Geschäftszahlen; personenbezogene Daten nur bei ausdrücklicher Freigabe, sonst pseudonymisiert', location: 'USA', thirdCountry: true, activation: 'optional', integrationType: 'claude' },
    { key: 'payment', name: 'Zahlungsanbieter (noch nicht festgelegt)', purpose: 'Abrechnung der Abonnements', dataCategories: 'Vertragsdaten des Mandanten; Zahlungsdaten nur beim Anbieter', location: 'zu prüfen', thirdCountry: false, activation: 'optional', integrationType: null },
  ];
  for (const r of rows) app.db.insert(subprocessors).values({ id: newId(), ...r, transferMechanism: r.thirdCountry ? 'zu prüfen (z. B. EU-US Data Privacy Framework oder Standardvertragsklauseln)' : null, dpaStatus: 'to_review' }).run();
}
