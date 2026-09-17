import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { desc, sql } from 'drizzle-orm';
import { companies, jobs } from '../../db/schema.js';
import { badRequest, forbidden, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';

/**
 * Systemverwaltung: Sicherungen, Wiederherstellung, Neustart, Update, Job-Protokoll.
 * Sicherungen umfassen die gesamte Installation (alle Mandanten). Bei mehreren
 * Mandanten ist deshalb der Betreiber-Status erforderlich.
 */
export default async function systemRoutes(app: FastifyInstance) {
  const guard = async (req: FastifyRequest, _reply: FastifyReply) => {
    const ctx = ctxOf(req);
    const n = app.db.select({ n: sql<number>`count(*)` }).from(companies).get()?.n ?? 0;
    if (n > 1 && !ctx.isPlatformAdmin) throw forbidden('Sicherungen umfassen alle Mandanten und sind dem Softwarebetreiber vorbehalten.');
  };
  const pre = [app.requireAuth('backups:manage'), guard];
  const launcher = Boolean(process.env.CM_LAUNCHER);

  app.get('/api/system/status', { preHandler: pre }, async () => {
    const backups = app.backups.list();
    const lastRuns = app.db.select().from(jobs).orderBy(desc(jobs.runAt)).limit(40).all();
    const restoreLastFile = path.join(app.config.dataDir, 'restore-last.json');
    return {
      version: app.appVersion, node: process.version, platform: `${os.type()} ${os.release()} (${os.arch()})`, hostname: os.hostname(),
      uptimeSeconds: Math.round(process.uptime()), startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      dataDir: app.config.dataDir, usage: app.backups.usage(), diskFreeBytes: (() => { try { const s = fs.statfsSync(app.config.dataDir); return s.bavail * s.bsize; } catch { return null; } })(),
      backups: { count: backups.length, last: backups[0] ?? null, lastAuto: backups.find((b) => b.kind === 'auto') ?? null, totalBytes: backups.reduce((s, b) => s + b.sizeBytes, 0), keepAuto: 14, keepManual: 20 },
      pendingRestore: app.backups.hasPendingRestore(), restoreLast: fs.existsSync(restoreLastFile) ? JSON.parse(fs.readFileSync(restoreLastFile, 'utf8')) : null,
      launcher, jobs: lastRuns.map((j) => ({ id: j.id, type: j.type, status: j.status, runAt: j.runAt, finishedAt: j.finishedAt, lastError: j.lastError, summary: (JSON.parse(j.payloadJson || '{}') as { summary?: string }).summary ?? null })),
    };
  });

  app.get('/api/system/backups', { preHandler: pre }, async () => ({ items: app.backups.list() }));

  app.post('/api/system/backups', { preHandler: pre }, async (req) => {
    const ctx = ctxOf(req);
    const info = await app.backups.create('manual');
    writeAudit(app.db, ctx, { action: 'system.backup_create', entityType: 'backup', entityId: info.name, after: { sizeBytes: info.sizeBytes } });
    return info;
  });

  app.get('/api/system/backups/:name/download', { preHandler: pre }, async (req, reply) => {
    const { name } = req.params as { name: string };
    let file: string; try { file = app.backups.pathOf(name); } catch { throw notFound('Sicherung'); }
    if (!fs.existsSync(file)) throw notFound('Sicherung');
    writeAudit(app.db, ctxOf(req), { action: 'system.backup_download', entityType: 'backup', entityId: name });
    reply.header('Content-Type', 'application/zip'); reply.header('Content-Disposition', `attachment; filename="${name}"`); reply.header('Content-Length', String(fs.statSync(file).size));
    return reply.send(fs.createReadStream(file));
  });

  app.delete('/api/system/backups/:name', { preHandler: pre }, async (req) => {
    const { name } = req.params as { name: string };
    try { app.backups.remove(name); } catch { throw notFound('Sicherung'); }
    writeAudit(app.db, ctxOf(req), { action: 'system.backup_delete', entityType: 'backup', entityId: name });
    return { ok: true };
  });

  const scheduleRestart = (req: FastifyRequest, reason: string, code: number) => {
    writeAudit(app.db, ctxOf(req), { action: 'system.restart', entityType: 'system', after: { reason, code } });
    app.log.warn({ reason, code }, 'Neustart angefordert');
    app.exitFn(code, reason);
  };

  app.post('/api/system/backups/:name/restore', { preHandler: pre }, async (req) => {
    const { name } = req.params as { name: string };
    let file: string; try { file = app.backups.pathOf(name); } catch { throw notFound('Sicherung'); }
    if (!fs.existsSync(file)) throw notFound('Sicherung');
    const { manifest } = await app.backups.stageRestore(file);
    writeAudit(app.db, ctxOf(req), { action: 'system.restore_staged', entityType: 'backup', entityId: name, after: manifest });
    if (launcher) scheduleRestart(req, `restore:${name}`, 75);
    return { staged: true, manifest, restarting: launcher };
  });

  app.post('/api/system/restore/upload', { preHandler: pre }, async (req) => {
    const part = await req.file();
    if (!part) throw badRequest('Keine Datei übermittelt.');
    if (!/\.zip$/i.test(part.filename)) throw badRequest('Bitte eine ZIP-Sicherung hochladen.');
    const tmp = path.join(app.config.backupsDir, `.upload-${Date.now()}.zip`);
    await pipeline(part.file, fs.createWriteStream(tmp));
    try {
      if (part.file.truncated) throw badRequest('Datei zu groß für den Upload.');
      const { manifest } = await app.backups.stageRestore(tmp);
      writeAudit(app.db, ctxOf(req), { action: 'system.restore_staged', entityType: 'backup', entityId: part.filename, after: manifest });
      if (launcher) scheduleRestart(req, `restore-upload:${part.filename}`, 75);
      return { staged: true, manifest, restarting: launcher };
    } finally { fs.rmSync(tmp, { force: true }); }
  });

  app.post('/api/system/restore/cancel', { preHandler: pre }, async (req) => {
    app.backups.cancelPendingRestore();
    writeAudit(app.db, ctxOf(req), { action: 'system.restore_cancelled', entityType: 'backup' });
    return { ok: true };
  });

  app.post('/api/system/restart', { preHandler: pre }, async (req) => {
    if (!launcher) throw badRequest('Neustart nur möglich, wenn die Anwendung über das Startskript läuft (start.cmd / start.sh).');
    scheduleRestart(req, 'manual', 75);
    return { restarting: true };
  });

  app.post('/api/system/update', { preHandler: pre }, async (req) => {
    if (!launcher) throw badRequest('Update nur möglich, wenn die Anwendung über das Startskript läuft. Alternativ: scripts/update.sh bzw. update.cmd ausführen.');
    const info = await app.backups.create('pre-update');
    writeAudit(app.db, ctxOf(req), { action: 'system.update_requested', entityType: 'system', after: { backup: info.name } });
    scheduleRestart(req, 'update', 76);
    return { backup: info, updating: true };
  });
}
