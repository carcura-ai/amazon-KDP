import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { BackupService, applyPendingRestore } from './integrations/backup.js';
import { createRequire } from 'node:module';
import { createApiKey } from './core/apikeys.js';
import { newId } from './core/ids.js';
import { apiKeys, companies, tenantFeatureOverrides, users } from './db/schema.js';
import { and, asc, eq, isNull } from 'drizzle-orm';

/**
 * Kommandozeile für Wartung ohne laufenden Server:
 *   node dist/cli.js backup [manual|pre-update]   Sicherung erstellen
 *   node dist/cli.js list                          Sicherungen auflisten
 *   node dist/cli.js restore <datei.zip>           Sicherung sofort einspielen (Server muss gestoppt sein)
 */
async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const config = loadConfig();
  const version = (createRequire(import.meta.url)('../package.json') as { version: string }).version;
  const log = { info: (o: unknown, m?: string) => console.log(m ?? '', typeof o === 'object' ? JSON.stringify(o) : o), warn: console.warn, error: console.error };
  if (cmd === 'backup') {
    const handle = openDatabase(config.dbPath);
    const svc = new BackupService(config, handle.sqlite, log, version);
    const info = await svc.create(arg === 'pre-update' ? 'pre-update' : 'manual');
    handle.close();
    console.log(`Sicherung erstellt: ${info.name} (${Math.round(info.sizeBytes / 1024)} KB)`);
    return;
  }
  if (cmd === 'list') {
    const handle = openDatabase(config.dbPath);
    const svc = new BackupService(config, handle.sqlite, log, version);
    for (const b of svc.list()) console.log(`${b.createdAt.replace('T', ' ')}  ${b.kind.padEnd(11)}  ${String(Math.round(b.sizeBytes / 1024)).padStart(8)} KB  ${b.name}`);
    handle.close();
    return;
  }
  if (cmd === 'restore') {
    if (!arg) throw new Error('Pfad zur ZIP-Sicherung fehlt.');
    const handle = openDatabase(config.dbPath);
    const svc = new BackupService(config, handle.sqlite, log, version);
    await svc.stageRestore(arg);
    handle.close();
    const ok = await applyPendingRestore(config, log);
    console.log(ok ? 'Wiederherstellung abgeschlossen. Server kann gestartet werden.' : 'Wiederherstellung fehlgeschlagen.');
    process.exit(ok ? 0 : 1);
  }
  if (cmd === 'lexware-enable' || cmd === 'lexware-pause') {
    if (!arg) throw new Error('Mandanten-ID fehlt.');
    const handle = openDatabase(config.dbPath);
    const { db } = handle;
    if (!db.select().from(companies).where(eq(companies.id, arg)).get()) {
      handle.close();
      throw new Error('Betrieb nicht gefunden.');
    }
    db.insert(tenantFeatureOverrides).values({ id: newId(), companyId: arg, featureKey: 'LEXWARE', enabled: cmd === 'lexware-enable' })
      .onConflictDoUpdate({ target: [tenantFeatureOverrides.companyId, tenantFeatureOverrides.featureKey], set: { enabled: cmd === 'lexware-enable' } }).run();
    handle.close();
    return;
  }
  if (cmd === 'api-key-create' || cmd === 'receipt-key-create') {
    const handle = openDatabase(config.dbPath);
    const db = handle.db;
    const receiptOnly = cmd === 'receipt-key-create';
    if (receiptOnly && !arg) { handle.close(); throw new Error('Mandanten-ID fehlt.'); }
    const company = receiptOnly ? db.select().from(companies).where(eq(companies.id, arg!)).get() : db.select().from(companies).orderBy(asc(companies.createdAt)).get();
    const admin = company && db.select().from(users).where(and(eq(users.companyId, company.id), eq(users.role, 'admin'), eq(users.isActive, true))).orderBy(asc(users.createdAt)).get();
    if (!company || !admin) { handle.close(); throw new Error('Keine Firma bzw. kein aktiver Administrator gefunden – erst die Ersteinrichtung abschließen.'); }
    const name = receiptOnly ? 'WhatsApp-Belegimport' : arg || 'API';
    const k = createApiKey(db, { companyId: company.id, name, createdByUserId: admin.id, receiptOnly });
    handle.close();
    console.log(`API-Schlüssel „${name}“ für ${company.name} angelegt (Kennung ${k.prefix}).`);
    if (receiptOnly) console.log('Rechte: WhatsApp-Belege entgegennehmen.');
    else console.log('Rechte: Kunden, Fahrzeuge, Aufträge, Leads, Termine lesen/anlegen/ändern – kein Löschen, keine Rechnungen.');
    console.log('Der Schlüssel wird nur JETZT angezeigt:');
    console.log(k.key);
    return;
  }
  if (cmd === 'api-key-list') {
    const handle = openDatabase(config.dbPath);
    for (const k of handle.db.select().from(apiKeys).all()) console.log(`${k.prefix}  ${k.name.padEnd(20)}  ${k.revokedAt ? 'GESPERRT ' + k.revokedAt : 'aktiv'}  zuletzt: ${k.lastUsedAt ?? '–'}`);
    handle.close();
    return;
  }
  if (cmd === 'api-key-revoke') {
    if (!arg) throw new Error('Kennung fehlt (z. B. cm_1a2b3c4d).');
    const handle = openDatabase(config.dbPath);
    const r = handle.db.update(apiKeys).set({ revokedAt: new Date().toISOString() }).where(and(eq(apiKeys.prefix, arg), isNull(apiKeys.revokedAt))).run();
    handle.close();
    console.log(r.changes ? `Schlüssel ${arg} gesperrt.` : `Kein aktiver Schlüssel ${arg} gefunden.`);
    return;
  }
  console.log('Befehle: backup [manual|pre-update] | list | restore <datei.zip> | api-key-create <name> | receipt-key-create <Mandanten-ID> | lexware-enable <Mandanten-ID> | lexware-pause <Mandanten-ID> | api-key-list | api-key-revoke <kennung>');
}
main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
