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
  chromiumPath: string | null;
  /** selfhosted: alle Module ohne Abo (Standard). saas: Tarife, Entitlements, strengere Admin-Regeln. */
  deploymentMode: 'selfhosted' | 'saas';
  /** Anzahl vertrauenswürdiger Proxys vor dem Server (z. B. 1 bei Caddy/Nginx). 0 = direkt erreichbar. */
  trustProxy: number;
  /** Betreiber-SMTP für Konto-E-Mails (Passwort-Reset, Bestätigung). Ohne Angabe wird das SMTP des Mandanten genutzt. */
  systemSmtp: { host: string; port: number; secure: boolean; user: string; pass: string; fromName: string; fromEmail: string } | null;
  /** Mindestversion der Desktop-App, die dieser Server akzeptiert (Hinweis zur Aktualisierung). */
  minDesktopVersion: string;
  /** SaaS: Tage nach Vertragsende, bis die Löschung eines Mandanten vorgemerkt wird (plus 14 Tage Vorlauf). */
  tenantDataGraceDays: number;
  /** Globales API-Limit je Sitzung/IP und Minute. */
  rateLimitPerMinute: number;
  /** Optional: Passphrase zur Verschlüsselung der Sicherungen (AES-256-GCM). */
  backupPassphrase: string | null;
  /**
   * Einrichtungscode für die Ersteinrichtung. Ist der Server aus dem Netz erreichbar (Produktion, nicht nur
   * localhost), darf nur einrichten, wer den Code kennt – sonst könnte ein Fremder auf einem frisch
   * gestarteten Server das erste Administratorkonto anlegen. Ohne SETUP_TOKEN wird ein Code erzeugt und
   * beim Start ins Log geschrieben.
   */
  setupToken: string | null;
  /** Neustart durch einen Supervisor (Docker: restart unless-stopped) möglich – für Wiederherstellung per Oberfläche. */
  supervised: boolean;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Ungültiger Wert für ${name}: ${raw}`);
  return n;
}

/**
 * Liefert das Anwendungsgeheimnis: APP_SECRET aus der Umgebung oder ein beim ersten Start
 * erzeugter Schlüssel im Datenordner,
 * damit Sessions und verschlüsselte Zugangsdaten Neustarts überstehen.
 */
function resolveSecret(dataDir: string, isProduction: boolean): string {
  const fromEnv = process.env.APP_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error('APP_SECRET muss mindestens 32 Zeichen lang sein.');
    return fromEnv;
  }
  // Ohne APP_SECRET wird ein zufälliger Schlüssel erzeugt und im Datenordner abgelegt (nur für den
  // Besitzer lesbar). Das ist für den Laptop-Betrieb die richtige Lösung. Auf einem Server, der aus
  // dem Internet erreichbar ist, sollte APP_SECRET in der .env gesetzt und separat gesichert werden.
  const keyFile = path.join(dataDir, 'app-secret.key');
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyFile, secret, { mode: 0o600 });
  if (isProduction && (process.env.HOST ?? '127.0.0.1') !== '127.0.0.1') console.warn('Hinweis: Kein APP_SECRET gesetzt – Schlüssel wurde unter data/app-secret.key erzeugt. Diese Datei separat sichern.');
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
    chromiumPath: overrides.chromiumPath ?? process.env.CHROMIUM_PATH ?? null,
    deploymentMode: overrides.deploymentMode ?? (process.env.DEPLOYMENT_MODE === 'saas' ? 'saas' : 'selfhosted'),
    trustProxy: overrides.trustProxy ?? (Number.parseInt(process.env.TRUST_PROXY ?? '0', 10) || 0),
    systemSmtp: overrides.systemSmtp !== undefined ? overrides.systemSmtp : process.env.SYSTEM_SMTP_HOST ? {
      host: process.env.SYSTEM_SMTP_HOST, port: Number(process.env.SYSTEM_SMTP_PORT ?? 587), secure: process.env.SYSTEM_SMTP_SECURE === 'true',
      user: process.env.SYSTEM_SMTP_USER ?? '', pass: process.env.SYSTEM_SMTP_PASS ?? '',
      fromName: process.env.SYSTEM_SMTP_FROM_NAME ?? 'Carcura Management', fromEmail: process.env.SYSTEM_SMTP_FROM ?? process.env.SYSTEM_SMTP_USER ?? '',
    } : null,
    minDesktopVersion: overrides.minDesktopVersion ?? process.env.MIN_DESKTOP_VERSION ?? '1.0.0',
    tenantDataGraceDays: overrides.tenantDataGraceDays ?? readInt('TENANT_DATA_GRACE_DAYS', 30),
    rateLimitPerMinute: overrides.rateLimitPerMinute ?? readInt('RATE_LIMIT_PER_MINUTE', 1200),
    setupToken: overrides.setupToken !== undefined ? overrides.setupToken : (process.env.SETUP_TOKEN?.trim() || null),
    supervised: overrides.supervised ?? (Boolean(process.env.CM_LAUNCHER) || process.env.CM_SUPERVISOR === 'docker'),
    backupPassphrase: overrides.backupPassphrase !== undefined ? overrides.backupPassphrase : (process.env.BACKUP_PASSPHRASE && process.env.BACKUP_PASSPHRASE.length >= 16 ? process.env.BACKUP_PASSPHRASE : null),
  };
}
