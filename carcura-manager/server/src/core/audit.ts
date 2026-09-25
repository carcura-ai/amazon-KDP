import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import { newId, nowIso } from './ids.js';
import type { Ctx } from './context.js';

export interface AuditEntry {
  action: string; // z. B. customer.create
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

type AuditCtx = (Pick<Ctx, 'companyId' | 'userId' | 'ip'> & { supportSessionId?: string | null; requestId?: string }) | { companyId: string; userId?: null; ip?: string; supportSessionId?: string | null; requestId?: string };

/** Felder, deren Werte nie im Audit-Log landen (Geheimnisse, Zugangsdaten). */
const SECRET_KEYS = /^(password|pass|passwordHash|apiKey|api_key|token|secret|accessToken|refreshToken|clientSecret|developerToken|privateKey|totpSecret|totpSecretEnc|backupCodes|backupCodesJson|configEncrypted|websiteLeadToken|keyHash)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[entfernt]' : redact(v, depth + 1)]));
  return value;
}

const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Inhalt der Kette – bewusst ohne die Vorher/Nachher-Texte, damit Anonymisierung die Kette nicht bricht. */
function chainInput(r: { id: string; companyId: string; userId: string | null; action: string; entityType: string; entityId: string | null; ip: string | null; supportSessionId: string | null; requestId: string | null; contentHash: string | null; createdAt: string }, prev: string | null): string {
  return [prev ?? '', r.id, r.companyId, r.userId ?? '', r.action, r.entityType, r.entityId ?? '', r.ip ?? '', r.supportSessionId ?? '', r.requestId ?? '', r.contentHash ?? '', r.createdAt].join('|');
}

/**
 * Schreibt einen Audit-Eintrag. Manipulationserschwert: Jeder Eintrag enthält den Hash seines Inhalts
 * (content_hash) und ist mit dem vorherigen Eintrag desselben Mandanten verkettet (prev_hash → hash).
 * Nachträgliche Änderung oder Löschung einzelner Einträge wird bei der Prüfung erkannt.
 * Geheimnisse werden vor dem Speichern entfernt.
 */
export function writeAudit(db: Db, ctx: AuditCtx, entry: AuditEntry): void {
  const beforeJson = entry.before === undefined ? null : JSON.stringify(redact(entry.before));
  const afterJson = entry.after === undefined ? null : JSON.stringify(redact(entry.after));
  const row = {
    id: newId(), companyId: ctx.companyId, userId: ctx.userId ?? null, action: entry.action, entityType: entry.entityType, entityId: entry.entityId ?? null,
    ip: ctx.ip ?? null, supportSessionId: ctx.supportSessionId ?? null, requestId: ctx.requestId ?? null,
    contentHash: h(`${beforeJson ?? ''}|${afterJson ?? ''}`), createdAt: nowIso(),
  };
  const prev = db.select({ hash: auditLog.hash }).from(auditLog).where(eq(auditLog.companyId, ctx.companyId)).orderBy(sql`rowid desc`).limit(1).get()?.hash ?? null;
  db.insert(auditLog).values({ ...row, beforeJson, afterJson, prevHash: prev, hash: h(chainInput(row, prev)) }).run();
}

export interface AuditVerification { ok: boolean; checked: number; legacy: number; firstBreak: { id: string; createdAt: string; reason: string } | null; contentMismatches: number }

/**
 * Reihenfolge = Einfügereihenfolge (SQLite-rowid). Bei einer späteren PostgreSQL-Migration wird dafür
 * eine fortlaufende Spalte (bigserial) ergänzt.
 *
 * Prüft die Kette eines Mandanten. Einträge vor Einführung der Kette (ohne Hash) werden gezählt, aber
 * nicht geprüft. Der älteste verbleibende Eintrag dient als Anker (ältere wurden nach Frist gelöscht).
 * Inhalte anonymisierter Einträge (Vorher/Nachher entfernt) gelten nicht als Manipulation.
 */
export function verifyAuditChain(db: Db, companyId: string): AuditVerification {
  const rows = db.select().from(auditLog).where(eq(auditLog.companyId, companyId)).orderBy(sql`rowid`).all();
  let prev: string | null | undefined;
  let checked = 0; let legacy = 0; let contentMismatches = 0;
  for (const r of rows) {
    if (!r.hash) { legacy++; continue; }
    if (prev === undefined) prev = r.prevHash; // Anker
    if (r.prevHash !== prev) return { ok: false, checked, legacy, contentMismatches, firstBreak: { id: r.id, createdAt: r.createdAt, reason: 'Verkettung unterbrochen (Eintrag gelöscht oder eingefügt)' } };
    if (h(chainInput(r, prev)) !== r.hash) return { ok: false, checked, legacy, contentMismatches, firstBreak: { id: r.id, createdAt: r.createdAt, reason: 'Eintrag verändert' } };
    const anonymized = r.beforeJson === null && r.afterJson === null;
    if (!anonymized && h(`${r.beforeJson ?? ''}|${r.afterJson ?? ''}`) !== r.contentHash) contentMismatches++;
    prev = r.hash;
    checked++;
  }
  return { ok: contentMismatches === 0, checked, legacy, contentMismatches, firstBreak: null };
}
