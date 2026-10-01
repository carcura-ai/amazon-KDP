import { loadConfig } from './config.js';
import { openDatabase, pendingMigrationCount } from './db/index.js';
import { CompatDatabase } from './db/sqlite.js';
import { BackupService } from './integrations/backup.js';
import { createRequire } from 'node:module';
import { buildApp } from './app.js';
import { Scheduler } from './jobs/scheduler.js';
import { runReminders } from './jobs/reminders.js';
import { purgeExpiredSessions } from './core/session.js';
import { runOverdueCheck } from './jobs/overdue.js';
import { runRecurringExpenses } from './jobs/recurring.js';
import { runScheduledReports } from './modules/reports/generator.js';
import { runCompetitorScanAll } from './modules/competitors/routes.js';
import { applyPendingRestore } from './integrations/backup.js';
import { runRetention } from './modules/privacy/retention.js';
import { runSubscriptionLifecycle } from './core/subscriptions.js';
import { reapplyDeletionLedger, runTenantLifecycle } from './modules/platform/tenant-lifecycle.js';
import fs from 'node:fs';
import path from 'node:path';
import { expireSupportSessions } from './modules/platform/support.routes.js';

async function main() {
  const config = loadConfig();
  const restored = await applyPendingRestore(config, console);
  await backupBeforeMigrations(config);
  const dbHandle = openDatabase(config.dbPath);
  const app = await buildApp({ config, dbHandle });
  const scheduler = new Scheduler(dbHandle.db, app.log);
  scheduler.register({ type: 'reminders', cron: '*/10 * * * *', runOnStart: true, handler: () => runReminders(dbHandle.db, app.mail) });
  scheduler.register({ type: 'invoices.overdue', cron: '5 0 * * *', runOnStart: true, handler: () => runOverdueCheck(dbHandle.db) });
  scheduler.register({ type: 'expenses.recurring', cron: '10 0 * * *', runOnStart: true, handler: () => runRecurringExpenses(dbHandle.db) });
  scheduler.register({ type: 'marketing.sync', cron: '20 */6 * * *', runOnStart: true, handler: () => app.marketing.syncAll(7, (id) => app.hasFeature(id, 'MARKETING')) });
  scheduler.register({ type: 'reports.weekly', cron: '0 6 * * 1', handler: () => runScheduledReports(app, 'weekly') });
  scheduler.register({ type: 'reports.monthly', cron: '30 6 1 * *', handler: () => runScheduledReports(app, 'monthly') });
  scheduler.register({ type: 'reports.yearly', cron: '0 7 2 1 *', handler: () => runScheduledReports(app, 'yearly') });
  scheduler.register({ type: 'competitors.scan', cron: '0 5 * * 1', runOnStart: true, handler: () => runCompetitorScanAll(app) });
  scheduler.register({ type: 'backup.daily', cron: '30 2 * * *', runOnStart: true, handler: async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (app.backups.list().some((b) => b.kind === 'auto' && b.createdAt.startsWith(today))) return 'Tagessicherung existiert bereits';
    const info = await app.backups.create('auto');
    return `${info.name} (${Math.round(info.sizeBytes / 1024)} KB)`;
  } });
  scheduler.register({ type: 'privacy.retention', cron: '45 3 * * *', runOnStart: true, handler: async () => runRetention(app) });
  scheduler.register({ type: 'subscriptions.lifecycle', cron: '20 1 * * *', runOnStart: true, handler: async () => runSubscriptionLifecycle(dbHandle.db) });
  scheduler.register({ type: 'tenants.lifecycle', cron: '40 1 * * *', handler: () => runTenantLifecycle(app, config.tenantDataGraceDays) });
  scheduler.register({ type: 'support.expire', cron: '*/15 * * * *', handler: async () => `${expireSupportSessions(dbHandle.db)} Supportzugriffe abgelaufen` });
  scheduler.register({ type: 'sessions.cleanup', cron: '15 3 * * *', handler: async () => `${purgeExpiredSessions(dbHandle.db)} Sessions entfernt` });
  app.addHook('onClose', async () => scheduler.stop());
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Beende Anwendung');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Oberfläche: ${config.publicUrl}`);
  const resumed = app.importQueue.resume();
  if (resumed) app.log.info({ resumed }, 'Belegimport: unterbrochene Verarbeitungen fortgesetzt');
  if (restored) {
    app.log.warn('Eine Sicherung wurde beim Start wiederhergestellt (Details: data/restore-last.json).');
    // Löschungen, die nach dem Sicherungsstand erfolgt sind, erneut anwenden (Löschregister außerhalb der DB)
    try {
      const info = JSON.parse(fs.readFileSync(path.join(config.dataDir, 'restore-last.json'), 'utf8')) as { backupCreatedAt?: string | null };
      const n = await reapplyDeletionLedger(app, info.backupCreatedAt ?? '1970-01-01T00:00:00.000Z');
      if (n) app.log.warn({ n }, 'Löschungen nach Wiederherstellung erneut angewendet');
    } catch (err) { app.log.error({ err }, 'Löschregister konnte nicht angewendet werden'); }
  }
}

/** Sicherung vor Schemaänderungen (Update mit neuen Migrationen). Schlägt sie fehl, startet der Server nicht. */
async function backupBeforeMigrations(config: ReturnType<typeof loadConfig>): Promise<void> {
  const pending = pendingMigrationCount(config.dbPath);
  if (pending === 0) return;
  const version = (createRequire(import.meta.url)('../package.json') as { version: string }).version;
  const sqlite = new CompatDatabase(config.dbPath);
  try {
    const log = { info: (o: unknown, m?: string) => console.log(m ?? '', JSON.stringify(o)), warn: console.warn, error: console.error };
    const info = await new BackupService(config, sqlite, log, version).create('pre-update');
    console.log(`${pending} Datenbank-Änderung(en) ausstehend – Sicherung vorab erstellt: ${info.name}`);
  } finally { sqlite.close(); }
}

main().catch((err) => {
  console.error('Start fehlgeschlagen:', err);
  process.exit(1);
});
