import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ZipArchive } from 'archiver';
import { and, eq, sql } from 'drizzle-orm';
import { companies, dataExports, files } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { toCsv } from '../../core/csv.js';
import { privacySettings } from './settings.js';
import { customerDossier } from './routes.js';

export const EXPORT_FORMAT_VERSION = 1;

type Entry = { name: string; content?: string | Buffer; file?: string };

export async function writeZip(target: string, entries: Entry[]): Promise<void> {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(`${target}.part`);
    const zip = new ZipArchive({ zlib: { level: 6 } });
    out.on('close', resolve); out.on('error', reject); zip.on('error', reject);
    zip.pipe(out);
    for (const e of entries) {
      if (e.file) { if (fs.existsSync(e.file)) zip.file(e.file, { name: e.name }); }
      else zip.append(e.content ?? '', { name: e.name });
    }
    void zip.finalize();
  });
  fs.renameSync(`${target}.part`, target);
}

/** Tabellen, die nie exportiert werden (Anmeldesitzungen, Einmal-Token, Systemjobs, interne Zahlungsereignisse). */
const SKIP_TABLES = new Set(['sessions', 'user_tokens', 'jobs', 'payment_webhook_events', 'number_sequences', '__drizzle_migrations']);
/** Spalten mit Geheimnissen oder Sicherheitsdaten, die nie in einen Export gehören. */
const SECRET_COLUMNS = new Set(['password_hash', 'totp_secret_enc', 'backup_codes_json', 'config_encrypted', 'website_lead_token', 'token_hash']);

function tenantTables(app: FastifyInstance): string[] {
  const names = app.dbHandle.sqlite.prepare(`select name from sqlite_master where type = 'table' and name not like 'sqlite_%'`).all() as Array<{ name: string }>;
  return names.map((n) => n.name).filter((t) => !SKIP_TABLES.has(t) && (app.dbHandle.sqlite.prepare(`pragma table_info("${t}")`).all() as Array<{ name: string }>).some((c) => c.name === 'company_id'));
}

function rowsOf(app: FastifyInstance, table: string, companyId: string): Array<Record<string, unknown>> {
  const rows = app.dbHandle.sqlite.prepare(`select * from "${table}" where company_id = ?`).all(companyId) as Array<Record<string, unknown>>;
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_COLUMNS.has(k))));
}

function csvOf(rows: Array<Record<string, unknown>>): string {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return toCsv(rows, keys.map((k) => ({ key: k, label: k, get: (r: Record<string, unknown>) => r[k] })));
}

const safeName = (s: string) => s.replace(/[^\w.\-äöüÄÖÜß ]+/g, '_').slice(0, 80);

const README = (name: string, at: string) => `Datenexport ${name}
Erstellt: ${at}
Format-Version: ${EXPORT_FORMAT_VERSION}

Inhalt
- manifest.json  Übersicht: Tabellen, Anzahl Datensätze, Dateien, ausgelassene Felder
- json/          alle Datensätze je Tabelle (vollständig, maschinenlesbar)
- csv/           dieselben Daten als CSV (Semikolon, UTF-8, für Excel)
- dateien/       Originaldateien: Fotos, Dokumente, Unterschriften, Angebots-, Rechnungs- und Protokoll-PDFs

Nicht enthalten (aus Sicherheitsgründen): Passwort-Hashes, Zwei-Faktor-Geheimnisse, Wiederherstellungscodes,
verschlüsselte Zugangsdaten von Integrationen (API-Schlüssel, SMTP-Passwort), Anmeldesitzungen.

Aufbewahrung: Rechnungen und Buchungsbelege unterliegen gesetzlichen Aufbewahrungspflichten (u. a. § 147 AO,
§ 14b UStG). Bewahren Sie diesen Export entsprechend auf, wenn Sie den Dienst beenden.
`;

/** Vollständiger Mandantenexport (ZIP) – z. B. bei Vertragsende. Protokolliert in data_exports. */
export async function buildTenantExport(app: FastifyInstance, companyId: string, requestedByUserId: string | null) {
  const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
  const id = newId();
  const target = path.join(app.config.dataDir, 'exports', companyId, `${id}.zip`);
  app.db.insert(dataExports).values({ id, companyId, scope: 'tenant', formatVersion: EXPORT_FORMAT_VERSION, status: 'running', requestedByUserId }).run();
  try {
    const at = nowIso();
    const entries: Entry[] = [];
    const tables: Record<string, number> = {};
    for (const t of tenantTables(app)) {
      const rows = rowsOf(app, t, companyId);
      tables[t] = rows.length;
      entries.push({ name: `json/${t}.json`, content: JSON.stringify(rows, null, 1) });
      if (rows.length) entries.push({ name: `csv/${t}.csv`, content: csvOf(rows) });
    }
    const companyRow = Object.fromEntries(Object.entries(company).filter(([k]) => k !== 'websiteLeadToken'));
    entries.push({ name: 'json/companies.json', content: JSON.stringify([companyRow], null, 1) });
    const fileRows = app.db.select().from(files).where(eq(files.companyId, companyId)).all();
    for (const f of fileRows) {
      const ext = path.extname(f.storagePath);
      entries.push({ name: `dateien/${f.category}/${safeName(path.basename(f.originalName, path.extname(f.originalName)))}_${f.id.slice(0, 8)}${ext}`, file: app.storage.absolute(f.storagePath) });
    }
    const manifest = { format: 'carcura-tenant-export', formatVersion: EXPORT_FORMAT_VERSION, appVersion: app.appVersion, exportedAt: at, tenant: { id: company.id, name: company.name, legalName: company.legalName }, tables, files: fileRows.length, excludedColumns: [...SECRET_COLUMNS], excludedTables: [...SKIP_TABLES] };
    entries.unshift({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }, { name: 'LIESMICH.txt', content: README(company.name, at) });
    await writeZip(target, entries);
    const buf = fs.readFileSync(target);
    const days = privacySettings(company).exportRetentionDays;
    app.db.update(dataExports).set({ status: 'ready', storagePath: target, sizeBytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), contentsJson: JSON.stringify({ tables, files: fileRows.length }), completedAt: nowIso(), expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() }).where(eq(dataExports.id, id)).run();
  } catch (err) {
    app.db.update(dataExports).set({ status: 'failed', error: err instanceof Error ? err.message : String(err), completedAt: nowIso() }).where(eq(dataExports.id, id)).run();
    fs.rmSync(target, { force: true });
    throw err;
  }
  return app.db.select().from(dataExports).where(eq(dataExports.id, id)).get()!;
}

/** Export für eine betroffene Person (Art. 20 DSGVO): Dossier als JSON/CSV plus eigene Dateien. */
export async function buildCustomerExport(app: FastifyInstance, companyId: string, customerId: string): Promise<{ path: string; name: string }> {
  const d = customerDossier(app, companyId, customerId);
  const entries: Entry[] = [{ name: 'daten.json', content: JSON.stringify(d, null, 2) }];
  const tables: Record<string, Array<Record<string, unknown>>> = { kunde: [d.customer as unknown as Record<string, unknown>], fahrzeuge: d.vehicles as never, termine: d.appointments as never, auftraege: d.orders as never, angebote: d.offers as never, rechnungen: d.invoices as never, protokolle: d.protocols as never, kommunikation: d.activities as never };
  for (const [name, rows] of Object.entries(tables)) if (rows.length) entries.push({ name: `csv/${name}.csv`, content: csvOf(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v !== 'object' || v === null)))) });
  const fileIds = d.files.map((f) => f.id);
  const rows = fileIds.length ? app.db.select().from(files).where(and(eq(files.companyId, companyId), sql`${files.id} in ${fileIds}`)).all() : [];
  for (const f of rows) entries.push({ name: `dateien/${safeName(f.originalName)}`, file: app.storage.absolute(f.storagePath) });
  const target = path.join(app.config.dataDir, 'exports', companyId, `kunde-${newId()}.zip`);
  await writeZip(target, entries);
  return { path: target, name: `datenexport-${d.customer.customerNumber}.zip` };
}
