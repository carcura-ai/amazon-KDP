import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { BackupService, applyPendingRestore } from './integrations/backup.js';
import { createRequire } from 'node:module';

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
  console.log('Befehle: backup [manual|pre-update] | list | restore <datei.zip>');
}
main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
