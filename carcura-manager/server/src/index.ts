import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { buildApp } from './app.js';
import { Scheduler } from './jobs/scheduler.js';
import { runReminders } from './jobs/reminders.js';
import { purgeExpiredSessions } from './core/session.js';
import { runOverdueCheck } from './jobs/overdue.js';
import { runRecurringExpenses } from './jobs/recurring.js';
import { runScheduledReports } from './modules/reports/generator.js';
import { runCompetitorScanAll } from './modules/competitors/routes.js';

async function main() {
  const config = loadConfig();
  const dbHandle = openDatabase(config.dbPath);
  const app = await buildApp({ config, dbHandle });
  const scheduler = new Scheduler(dbHandle.db, app.log);
  scheduler.register({ type: 'reminders', cron: '*/10 * * * *', runOnStart: true, handler: () => runReminders(dbHandle.db, app.mail) });
  scheduler.register({ type: 'invoices.overdue', cron: '5 0 * * *', runOnStart: true, handler: () => runOverdueCheck(dbHandle.db) });
  scheduler.register({ type: 'expenses.recurring', cron: '10 0 * * *', runOnStart: true, handler: () => runRecurringExpenses(dbHandle.db) });
  scheduler.register({ type: 'marketing.sync', cron: '20 */6 * * *', runOnStart: true, handler: () => app.marketing.syncAll(7) });
  scheduler.register({ type: 'reports.weekly', cron: '0 6 * * 1', handler: () => runScheduledReports(app, 'weekly') });
  scheduler.register({ type: 'reports.monthly', cron: '30 6 1 * *', handler: () => runScheduledReports(app, 'monthly') });
  scheduler.register({ type: 'reports.yearly', cron: '0 7 2 1 *', handler: () => runScheduledReports(app, 'yearly') });
  scheduler.register({ type: 'competitors.scan', cron: '0 5 * * 1', runOnStart: true, handler: () => runCompetitorScanAll(app) });
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
}

main().catch((err) => {
  console.error('Start fehlgeschlagen:', err);
  process.exit(1);
});
