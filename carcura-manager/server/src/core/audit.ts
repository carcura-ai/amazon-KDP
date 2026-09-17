import type { Db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import { newId } from './ids.js';
import type { Ctx } from './context.js';

export interface AuditEntry {
  action: string; // z. B. customer.create
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export function writeAudit(db: Db, ctx: Pick<Ctx, 'companyId' | 'userId' | 'ip'> | { companyId: string; userId?: null; ip?: string }, entry: AuditEntry): void {
  db.insert(auditLog)
    .values({
      id: newId(),
      companyId: ctx.companyId,
      userId: ctx.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      beforeJson: entry.before === undefined ? null : JSON.stringify(entry.before),
      afterJson: entry.after === undefined ? null : JSON.stringify(entry.after),
      ip: ctx.ip ?? null,
    })
    .run();
}
