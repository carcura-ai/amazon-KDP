import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { activities } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';

export const ACTIVITY_TYPES = ['call', 'email', 'message', 'whatsapp', 'note', 'appointment', 'offer', 'invoice', 'reminder', 'system', 'status'] as const;

export interface ActivityInput {
  customerId?: string | null;
  leadId?: string | null;
  vehicleId?: string | null;
  userId?: string | null;
  type: (typeof ACTIVITY_TYPES)[number];
  direction?: 'in' | 'out' | null;
  subject?: string | null;
  content?: string | null;
  refType?: string | null;
  refId?: string | null;
  occurredAt?: string;
}

export function logActivity(db: Db, companyId: string, input: ActivityInput) {
  const id = newId();
  db.insert(activities)
    .values({
      id,
      companyId,
      customerId: input.customerId ?? null,
      leadId: input.leadId ?? null,
      vehicleId: input.vehicleId ?? null,
      userId: input.userId ?? null,
      type: input.type,
      direction: input.direction ?? null,
      subject: input.subject ?? null,
      content: input.content ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      occurredAt: input.occurredAt ?? nowIso(),
    })
    .run();
  return id;
}

export function listActivities(db: Db, companyId: string, by: { customerId?: string; leadId?: string }, limit = 200) {
  const cond = by.customerId ? eq(activities.customerId, by.customerId) : eq(activities.leadId, by.leadId ?? '');
  return db.select().from(activities).where(and(eq(activities.companyId, companyId), cond)).orderBy(desc(activities.occurredAt)).limit(limit).all();
}
