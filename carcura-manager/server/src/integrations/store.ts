import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { integrations } from '../db/schema.js';
import { SecretBox } from '../core/crypto.js';
import { newId, nowIso } from '../core/ids.js';

/** Verschlüsselte Ablage von Integrations-Zugangsdaten je Mandant. */
export class IntegrationStore {
  constructor(private readonly db: Db, private readonly box: SecretBox) {}

  get<T = Record<string, unknown>>(companyId: string, type: string): { row: typeof integrations.$inferSelect; config: T } | null {
    const row = this.db.select().from(integrations).where(and(eq(integrations.companyId, companyId), eq(integrations.type, type))).get();
    if (!row) return null;
    return { row, config: JSON.parse(this.box.decrypt(row.configEncrypted)) as T };
  }

  save(companyId: string, type: string, config: Record<string, unknown>, publicInfo: Record<string, unknown>, name?: string): void {
    const existing = this.db.select({ id: integrations.id }).from(integrations).where(and(eq(integrations.companyId, companyId), eq(integrations.type, type))).get();
    const values = { configEncrypted: this.box.encrypt(JSON.stringify(config)), publicJson: JSON.stringify(publicInfo), name: name ?? null, status: 'configured', lastError: null, isActive: true, updatedAt: nowIso() };
    if (existing) this.db.update(integrations).set(values).where(eq(integrations.id, existing.id)).run();
    else this.db.insert(integrations).values({ id: newId(), companyId, type, ...values }).run();
  }

  setStatus(companyId: string, type: string, status: string, error?: string | null, synced?: boolean): void {
    this.db
      .update(integrations)
      .set({ status, lastError: error ?? null, ...(synced ? { lastSyncAt: nowIso() } : {}), updatedAt: nowIso() })
      .where(and(eq(integrations.companyId, companyId), eq(integrations.type, type)))
      .run();
  }

  remove(companyId: string, type: string): void {
    this.db.delete(integrations).where(and(eq(integrations.companyId, companyId), eq(integrations.type, type))).run();
  }

  listPublic(companyId: string) {
    return this.db
      .select({ id: integrations.id, type: integrations.type, name: integrations.name, publicJson: integrations.publicJson, status: integrations.status, lastSyncAt: integrations.lastSyncAt, lastError: integrations.lastError, isActive: integrations.isActive, updatedAt: integrations.updatedAt })
      .from(integrations)
      .where(eq(integrations.companyId, companyId))
      .all()
      .map((r) => ({ ...r, public: JSON.parse(r.publicJson) as Record<string, unknown> }));
  }
}
