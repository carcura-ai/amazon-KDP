import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const dbHandle = openDatabase(config.dbPath);
  const app = await buildApp({ config, dbHandle });
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
