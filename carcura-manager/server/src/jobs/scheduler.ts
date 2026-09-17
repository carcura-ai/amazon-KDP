import { Cron } from 'croner';
import type { FastifyBaseLogger } from 'fastify';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { newId, nowIso } from '../core/ids.js';

export interface JobDef {
  type: string;
  cron: string;
  runOnStart?: boolean;
  handler: () => Promise<string | void>;
}

/**
 * In-Prozess-Scheduler. Jeder Lauf wird in der Tabelle `jobs` protokolliert
 * (Status, Dauer, Fehler), damit Ausfälle in der Oberfläche sichtbar sind.
 */
export class Scheduler {
  private crons: Cron[] = [];
  private running = new Set<string>();

  constructor(private readonly db: Db, private readonly log: FastifyBaseLogger) {}

  register(def: JobDef): void {
    const cron = new Cron(def.cron, { timezone: 'Europe/Berlin', protect: true }, () => void this.run(def));
    this.crons.push(cron);
    if (def.runOnStart) setTimeout(() => void this.run(def), 3000);
  }

  async run(def: JobDef): Promise<void> {
    if (this.running.has(def.type)) return;
    this.running.add(def.type);
    const id = newId();
    this.db.insert(jobs).values({ id, type: def.type, status: 'running', runAt: nowIso(), startedAt: nowIso(), attempts: 1 }).run();
    try {
      const summary = await def.handler();
      this.db.update(jobs).set({ status: 'done', finishedAt: nowIso(), lastError: null, payloadJson: JSON.stringify({ summary: summary ?? null }) }).where(eq(jobs.id, id)).run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err, job: def.type }, 'Job fehlgeschlagen');
      this.db.update(jobs).set({ status: 'failed', finishedAt: nowIso(), lastError: message }).where(eq(jobs.id, id)).run();
    } finally {
      this.running.delete(def.type);
    }
  }

  stop(): void {
    for (const c of this.crons) c.stop();
    this.crons = [];
  }
}
