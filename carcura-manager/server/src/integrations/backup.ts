import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import extractZip from 'extract-zip';
import type { FastifyBaseLogger } from 'fastify';

export type BackupKind = 'auto' | 'manual' | 'pre-update' | 'pre-restore';
export interface BackupInfo { name: string; kind: BackupKind; createdAt: string; sizeBytes: number }
export interface BackupConfig { dataDir: string; dbPath: string; filesDir: string; backupsDir: string; keepAuto?: number; keepManual?: number }

const NAME_RE = /^backup-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})-(auto|manual|pre-update|pre-restore)\.zip$/;
export const PENDING_RESTORE = 'restore-pending.zip';

/**
 * Sicherungen: ZIP mit konsistenter Datenbankkopie (VACUUM INTO, WAL-sicher),
 * allen Dateien (Bilder, PDFs) und einem Manifest. Wiederherstellung wird
 * vorgemerkt und beim nächsten Start vor dem Öffnen der Datenbank ausgeführt.
 */
export class BackupService {
  constructor(private readonly cfg: BackupConfig, private readonly sqlite: { pragma(text: string): unknown; exec(sql: string): unknown }, private readonly log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>, private readonly version: string) {
    fs.mkdirSync(cfg.backupsDir, { recursive: true });
  }

  list(): BackupInfo[] {
    return fs.readdirSync(this.cfg.backupsDir)
      .map((name) => ({ name, m: NAME_RE.exec(name) }))
      .filter((x): x is { name: string; m: RegExpExecArray } => Boolean(x.m))
      .map(({ name, m }) => ({ name, kind: m[5] as BackupKind, createdAt: `${m[1]}T${m[2]}:${m[3]}:${m[4]}`, sizeBytes: fs.statSync(path.join(this.cfg.backupsDir, name)).size }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  pathOf(name: string): string {
    if (!NAME_RE.test(name)) throw new Error('Ungültiger Sicherungsname.');
    return path.join(this.cfg.backupsDir, name);
  }

  async create(kind: BackupKind): Promise<BackupInfo> {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const name = `backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}-${kind}.zip`;
    const target = path.join(this.cfg.backupsDir, name);
    const tmpDb = path.join(this.cfg.backupsDir, `.tmp-${process.pid}-${Date.now()}.db`);
    this.sqlite.pragma('wal_checkpoint(PASSIVE)');
    this.sqlite.exec(`VACUUM INTO '${tmpDb.replace(/'/g, "''")}'`);
    try {
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(`${target}.part`);
        const zip = new ZipArchive({ zlib: { level: 6 } });
        out.on('close', resolve); out.on('error', reject); zip.on('error', reject); zip.on('warning', (w: unknown) => this.log.warn({ w }, 'Backup-Warnung'));
        zip.pipe(out);
        zip.file(tmpDb, { name: 'app.db' });
        if (fs.existsSync(this.cfg.filesDir)) zip.directory(this.cfg.filesDir, 'files');
        zip.append(JSON.stringify({ version: this.version, createdAt: now.toISOString(), kind, format: 1 }, null, 2), { name: 'manifest.json' });
        void zip.finalize();
      });
      fs.renameSync(`${target}.part`, target);
    } finally {
      fs.rmSync(tmpDb, { force: true });
      fs.rmSync(`${target}.part`, { force: true });
    }
    this.prune();
    const info = { name, kind, createdAt: now.toISOString(), sizeBytes: fs.statSync(target).size };
    this.log.info({ backup: name, bytes: info.sizeBytes }, 'Sicherung erstellt');
    return info;
  }

  /** Behält die letzten N automatischen und N manuellen Sicherungen. */
  prune(): void {
    const keepAuto = this.cfg.keepAuto ?? 14; const keepManual = this.cfg.keepManual ?? 20;
    const all = this.list();
    const drop = [...all.filter((b) => b.kind === 'auto').slice(keepAuto), ...all.filter((b) => b.kind !== 'auto').slice(keepManual)];
    for (const b of drop) fs.rmSync(path.join(this.cfg.backupsDir, b.name), { force: true });
  }

  remove(name: string): void { fs.rmSync(this.pathOf(name), { force: true }); }

  /** Prüft ein ZIP und legt es als ausstehende Wiederherstellung ab. */
  async stageRestore(zipPath: string): Promise<{ manifest: Record<string, unknown> }> {
    const probeDir = fs.mkdtempSync(path.join(this.cfg.backupsDir, '.probe-'));
    try {
      await extractZip(zipPath, { dir: probeDir });
      if (!fs.existsSync(path.join(probeDir, 'app.db'))) throw new Error('Die Datei enthält keine Datenbank (app.db) – keine gültige Sicherung.');
      const head = Buffer.alloc(16); const fd = fs.openSync(path.join(probeDir, 'app.db'), 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
      if (!head.toString('utf8').startsWith('SQLite format 3')) throw new Error('app.db ist keine SQLite-Datenbank.');
      const manifest = fs.existsSync(path.join(probeDir, 'manifest.json')) ? (JSON.parse(fs.readFileSync(path.join(probeDir, 'manifest.json'), 'utf8')) as Record<string, unknown>) : {};
      fs.copyFileSync(zipPath, path.join(this.cfg.dataDir, PENDING_RESTORE));
      return { manifest };
    } finally { fs.rmSync(probeDir, { recursive: true, force: true }); }
  }

  hasPendingRestore(): boolean { return fs.existsSync(path.join(this.cfg.dataDir, PENDING_RESTORE)); }
  cancelPendingRestore(): void { fs.rmSync(path.join(this.cfg.dataDir, PENDING_RESTORE), { force: true }); }

  usage(): { dbBytes: number; filesBytes: number; backupsBytes: number } {
    const size = (p: string): number => { if (!fs.existsSync(p)) return 0; const st = fs.statSync(p); if (st.isFile()) return st.size; return fs.readdirSync(p).reduce((s, f) => s + size(path.join(p, f)), 0); };
    return { dbBytes: size(this.cfg.dbPath) + size(`${this.cfg.dbPath}-wal`), filesBytes: size(this.cfg.filesDir), backupsBytes: size(this.cfg.backupsDir) };
  }
}

/**
 * Wird beim Start VOR dem Öffnen der Datenbank aufgerufen: Liegt eine vorgemerkte
 * Wiederherstellung vor, wird der aktuelle Stand gesichert und durch das Backup ersetzt.
 */
export async function applyPendingRestore(cfg: BackupConfig, log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>): Promise<boolean> {
  const pending = path.join(cfg.dataDir, PENDING_RESTORE);
  if (!fs.existsSync(pending)) return false;
  const work = fs.mkdtempSync(path.join(cfg.dataDir, '.restore-'));
  try {
    await extractZip(pending, { dir: work });
    if (!fs.existsSync(path.join(work, 'app.db'))) throw new Error('Sicherung ohne app.db');
    // Sicherheitskopie des aktuellen Stands (Datei-Ebene, Server ist noch nicht gestartet)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safety = path.join(cfg.backupsDir, `pre-restore-${stamp}`);
    fs.mkdirSync(safety, { recursive: true });
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(cfg.dbPath + suffix)) fs.renameSync(cfg.dbPath + suffix, path.join(safety, `app.db${suffix}`));
    if (fs.existsSync(cfg.filesDir)) fs.renameSync(cfg.filesDir, path.join(safety, 'files'));
    fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
    fs.copyFileSync(path.join(work, 'app.db'), cfg.dbPath);
    if (fs.existsSync(path.join(work, 'files'))) fs.cpSync(path.join(work, 'files'), cfg.filesDir, { recursive: true });
    else fs.mkdirSync(cfg.filesDir, { recursive: true });
    fs.rmSync(pending, { force: true });
    fs.writeFileSync(path.join(cfg.dataDir, 'restore-last.json'), JSON.stringify({ restoredAt: new Date().toISOString(), safetyCopy: safety }, null, 2));
    log.info({ safety }, 'Wiederherstellung angewendet');
    return true;
  } catch (err) {
    log.error({ err }, 'Wiederherstellung fehlgeschlagen – aktueller Stand bleibt erhalten');
    fs.renameSync(pending, `${pending}.failed`);
    return false;
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
