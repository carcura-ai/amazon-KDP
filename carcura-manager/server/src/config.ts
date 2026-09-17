import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  filesDir: string;
  backupsDir: string;
  appSecret: string;
  sessionIdleMinutes: number;
  sessionMaxDays: number;
  logLevel: string;
  isProduction: boolean;
  publicUrl: string;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Ungültiger Wert für ${name}: ${raw}`);
  return n;
}

/**
 * Liefert das Anwendungsgeheimnis. In Produktion muss APP_SECRET gesetzt sein.
 * Lokal wird beim ersten Start ein Schlüssel erzeugt und im Datenordner abgelegt,
 * damit Sessions und verschlüsselte Zugangsdaten Neustarts überstehen.
 */
function resolveSecret(dataDir: string, isProduction: boolean): string {
  const fromEnv = process.env.APP_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error('APP_SECRET muss mindestens 32 Zeichen lang sein.');
    return fromEnv;
  }
  if (isProduction) throw new Error('APP_SECRET ist in Produktion Pflicht.');
  const keyFile = path.join(dataDir, 'app-secret.key');
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyFile, secret, { mode: 0o600 });
  return secret;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const dataDir = path.resolve(overrides.dataDir ?? process.env.DATA_DIR ?? './data');
  const port = overrides.port ?? readInt('PORT', 4800);
  const host = overrides.host ?? process.env.HOST ?? '127.0.0.1';
  return {
    port,
    host,
    dataDir,
    dbPath: overrides.dbPath ?? path.join(dataDir, 'app.db'),
    filesDir: overrides.filesDir ?? path.join(dataDir, 'files'),
    backupsDir: overrides.backupsDir ?? path.join(dataDir, 'backups'),
    appSecret: overrides.appSecret ?? resolveSecret(dataDir, isProduction),
    sessionIdleMinutes: overrides.sessionIdleMinutes ?? readInt('SESSION_IDLE_MINUTES', 480),
    sessionMaxDays: overrides.sessionMaxDays ?? readInt('SESSION_MAX_DAYS', 30),
    logLevel: overrides.logLevel ?? process.env.LOG_LEVEL ?? 'info',
    isProduction,
    publicUrl: overrides.publicUrl ?? process.env.PUBLIC_URL ?? `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
  };
}
