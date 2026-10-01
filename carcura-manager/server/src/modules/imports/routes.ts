import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { companies, documentImports, customers, invoices, expenses } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js';
import { newId, nowIso } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import type { Permission } from '../../core/permissions.js';
import { ctxOf } from '../../plugins/auth.js';
import { privacySettings } from '../privacy/settings.js';
import { EXPENSE_CATEGORIES } from '../finance/routes.js';
import type { NormalizedInvoice } from '../../integrations/einvoice/model.js';
import { type ImportQueue, applyImport, checkInvoice, emptyInvoice, finishWith, matchCustomer, normalizedInvoiceSchema, summarize, undoImport, categoryFor, type ImportDirection } from './service.js';

declare module 'fastify' {
  interface FastifyInstance {
    importQueue: ImportQueue;
  }
}

const DIRECTIONS = ['outgoing', 'incoming'] as const;
const STATUSES = ['queued', 'processing', 'needs_review', 'completed', 'failed', 'duplicate', 'discarded', 'undone'] as const;
const MAX_FILES_PER_UPLOAD = 20;

/** Rechte je Bereich: Ausgangsrechnungen = Rechnungen + Kunden, Eingangsrechnungen = Finanzen. */
const PERMS: Record<ImportDirection, { read: Permission[]; write: Permission[] }> = {
  outgoing: { read: ['invoices:read'], write: ['invoices:write', 'customers:write'] },
  incoming: { read: ['finance:read'], write: ['finance:write'] },
};
const can = (ctx: Ctx, direction: ImportDirection, mode: 'read' | 'write') => PERMS[direction][mode].every((p) => ctx.permissions.has(p));

export default async function importRoutes(app: FastifyInstance) {
  const queue = app.importQueue;

  const assertAccess = (req: FastifyRequest, direction: ImportDirection, mode: 'read' | 'write') => {
    const ctx = ctxOf(req);
    if (!can(ctx, direction, mode)) throw forbidden('Keine Berechtigung für diesen Bereich.');
    // Eingangsrechnungen erzeugen Ausgaben: nur mit gebuchtem Modul „Finanzen“ (im Eigenbetrieb immer aktiv)
    if (direction === 'incoming' && !app.hasFeature(ctx.companyId, 'FINANCE')) throw forbidden('Das Modul „Finanzen“ ist in Ihrem Tarif nicht enthalten.');
    return ctx;
  };
  const getRow = (companyId: string, id: string) => {
    const row = app.db.select().from(documentImports).where(and(eq(documentImports.id, id), eq(documentImports.companyId, companyId))).get();
    if (!row) throw notFound('Beleg');
    return row;
  };
  const company = (id: string) => app.db.select().from(companies).where(eq(companies.id, id)).get()!;

  /** Status: KI-Erkennung verfügbar/erlaubt, offene Prüfungen. */
  app.get('/api/document-imports/status', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const directions = DIRECTIONS.filter((d) => can(ctx, d, 'read'));
    const counts = directions.length ? app.db.select({ direction: documentImports.direction, status: documentImports.status, n: sql<number>`count(*)` }).from(documentImports).where(and(eq(documentImports.companyId, ctx.companyId), inArray(documentImports.direction, directions))).groupBy(documentImports.direction, documentImports.status).all() : [];
    const p = privacySettings(company(ctx.companyId));
    return {
      directions,
      canWrite: DIRECTIONS.filter((d) => can(ctx, d, 'write')),
      aiEnabled: p.aiDocumentRecognition,
      aiConfigured: Boolean(app.integrations.get(ctx.companyId, 'claude')),
      canManageAi: ctx.permissions.has('privacy:manage'),
      counts,
      categories: EXPENSE_CATEGORIES,
    };
  });

  /** KI-Belegerkennung ein-/ausschalten (Datenschutz-Einstellung, protokolliert). */
  app.put('/api/document-imports/ai', { preHandler: app.requireAuth('privacy:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { enabled } = parse(z.object({ enabled: z.boolean() }), req.body);
    const c = company(ctx.companyId);
    const settings = JSON.parse(c.settingsJson || '{}') as Record<string, unknown>;
    const before = privacySettings(c);
    settings.privacy = { ...before, aiDocumentRecognition: enabled };
    app.db.update(companies).set({ settingsJson: JSON.stringify(settings), updatedAt: nowIso() }).where(eq(companies.id, ctx.companyId)).run();
    writeAudit(app.db, ctx, { action: 'privacy.ai_document_recognition', entityType: 'company', entityId: ctx.companyId, before: { aiDocumentRecognition: before.aiDocumentRecognition }, after: { aiDocumentRecognition: enabled } });
    return { aiEnabled: enabled };
  });

  /** Belege hochladen (PDF, Foto, XML). Jede Datei wird einzeln verarbeitet; identische Dateien werden erkannt. */
  app.post('/api/document-imports', { preHandler: app.requireAuth(), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req) => {
    const fields: Record<string, string> = {};
    const uploaded: Array<{ buffer: Buffer; filename: string; mimetype: string; truncated: boolean }> = [];
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (uploaded.length >= MAX_FILES_PER_UPLOAD) throw badRequest(`Höchstens ${MAX_FILES_PER_UPLOAD} Dateien auf einmal.`);
        const buffer = await part.toBuffer();
        uploaded.push({ buffer, filename: part.filename || 'Beleg', mimetype: part.mimetype, truncated: part.file.truncated });
      } else fields[part.fieldname] = String(part.value);
    }
    const { direction, markPaid } = parse(z.object({ direction: z.enum(DIRECTIONS), markPaid: z.enum(['true', 'false']).default('false') }), fields);
    const ctx = assertAccess(req, direction, 'write');
    if (uploaded.length === 0) throw badRequest('Keine Datei übermittelt.');
    const results: Array<{ fileName: string; status: 'queued' | 'duplicate' | 'rejected'; id?: string; existingId?: string; message?: string }> = [];
    for (const u of uploaded) {
      if (u.truncated) { results.push({ fileName: u.filename, status: 'rejected', message: 'Datei ist größer als 25 MB.' }); continue; }
      const sha = crypto.createHash('sha256').update(u.buffer).digest('hex');
      const existing = app.db.select({ id: documentImports.id, createdAt: documentImports.createdAt }).from(documentImports).where(and(eq(documentImports.companyId, ctx.companyId), eq(documentImports.sha256, sha), eq(documentImports.direction, direction), notInArray(documentImports.status, ['discarded', 'undone', 'failed']))).get();
      if (existing) { results.push({ fileName: u.filename, status: 'duplicate', existingId: existing.id, message: `Bereits hochgeladen am ${new Date(existing.createdAt).toLocaleDateString('de-DE')}.` }); continue; }
      let file;
      try {
        file = await app.storage.store({ companyId: ctx.companyId, buffer: u.buffer, originalName: u.filename, mimeType: u.mimetype, category: 'invoice', uploadedByUserId: ctx.userId, allowEInvoice: true, caption: direction === 'outgoing' ? 'Ausgangsrechnung (Import)' : 'Eingangsrechnung (Import)' });
      } catch (err) {
        results.push({ fileName: u.filename, status: 'rejected', message: err instanceof Error ? err.message : 'Datei abgelehnt.' });
        continue;
      }
      const id = newId();
      app.db.insert(documentImports).values({ id, companyId: ctx.companyId, direction, status: 'queued', fileId: file.id, fileName: u.filename.slice(0, 200), sha256: sha, optionsJson: JSON.stringify({ markPaid: markPaid === 'true' }), createdByUserId: ctx.userId }).run();
      writeAudit(app.db, ctx, { action: 'import.upload', entityType: 'document_import', entityId: id, after: { direction, file: u.filename, size: u.buffer.length } });
      queue.enqueue(id);
      results.push({ fileName: u.filename, status: 'queued', id });
    }
    return { items: results };
  });

  app.get('/api/document-imports', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ direction: z.enum(DIRECTIONS), status: z.enum(STATUSES).optional(), open: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }), req.query);
    assertAccess(req, q.direction, 'read');
    const conds = [eq(documentImports.companyId, ctx.companyId), eq(documentImports.direction, q.direction)];
    if (q.status) conds.push(eq(documentImports.status, q.status));
    if (q.open === 'true') conds.push(inArray(documentImports.status, ['queued', 'processing', 'needs_review', 'failed']));
    const rows = app.db.select().from(documentImports).where(and(...conds)).orderBy(desc(documentImports.createdAt)).limit(q.limit).all();
    return { items: rows.map(summarize) };
  });

  app.get('/api/document-imports/:id', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const row = getRow(ctx.companyId, (req.params as { id: string }).id);
    assertAccess(req, row.direction as ImportDirection, 'read');
    const data = row.dataJson ? (JSON.parse(row.dataJson) as NormalizedInvoice) : null;
    const match = row.direction === 'outgoing' && data && ['needs_review', 'failed'].includes(row.status) ? matchCustomer(app, ctx.companyId, data.buyer) : null;
    const customer = row.customerId ? app.db.select({ id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }).from(customers).where(and(eq(customers.id, row.customerId), eq(customers.companyId, ctx.companyId))).get() ?? null : null;
    const invoice = row.invoiceId ? app.db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, totalCents: invoices.totalCents }).from(invoices).where(and(eq(invoices.id, row.invoiceId), eq(invoices.companyId, ctx.companyId))).get() ?? null : null;
    const expIds = JSON.parse(row.expenseIdsJson || '[]') as string[];
    const expenseRows = expIds.length ? app.db.select({ id: expenses.id, date: expenses.date, category: expenses.category, grossCents: expenses.grossCents, vatBp: expenses.vatBp, isPaid: expenses.isPaid }).from(expenses).where(and(eq(expenses.companyId, ctx.companyId), inArray(expenses.id, expIds))).all() : [];
    const file = row.fileId ? app.storage.get(ctx.companyId, row.fileId) : null;
    return {
      import: summarize(row),
      data: data ?? (row.status === 'needs_review' ? emptyInvoice() : null),
      file: file ? { id: file.id, mimeType: file.mimeType, originalName: file.originalName, sizeBytes: file.sizeBytes } : null,
      candidates: match?.candidates ?? [],
      suggestedCustomerId: match?.decision === 'matched' ? match.customerId : null,
      suggestedCategory: row.direction === 'incoming' && data ? categoryFor(data) : null,
      customer, invoice, expenses: expenseRows,
      options: JSON.parse(row.optionsJson || '{}') as { markPaid?: boolean },
    };
  });

  /** Geprüfte/korrigierte Daten übernehmen (manuelle Freigabe). */
  app.post('/api/document-imports/:id/apply', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const row = getRow(ctx.companyId, (req.params as { id: string }).id);
    assertAccess(req, row.direction as ImportDirection, 'write');
    if (!['needs_review', 'failed', 'duplicate'].includes(row.status)) throw conflict('Dieser Beleg ist bereits verarbeitet.');
    const input = parse(z.object({ data: normalizedInvoiceSchema, customerId: z.string().uuid().nullable().default(null), createCustomer: z.boolean().default(false), category: z.enum(EXPENSE_CATEGORIES).nullable().default(null), markPaid: z.boolean().default(false) }), req.body);
    const data = input.data as NormalizedInvoice;
    const check = checkInvoice(data, row.direction as ImportDirection, company(ctx.companyId));
    // Bei manueller Freigabe bleiben nur harte Pflichtangaben blockierend; rechnerische Hinweise werden protokolliert
    const hard = check.blocking.filter((b) => /fehlt|nicht erkannt|Währung|Zukunft/.test(b));
    if (hard.length) throw badRequest(hard.join(' '));
    // Dubletten-Status nur übernehmen, wenn keine echte Dublette mehr vorliegt (applyImport prüft erneut)
    const result = applyImport(app, row, data, { customerId: input.customerId, createCustomer: input.createCustomer, category: input.category, markPaid: input.markPaid });
    if (result.status !== 'completed') throw conflict(result.message ?? 'Übernahme nicht möglich.');
    finishWith(app, row.id, { dataJson: JSON.stringify(data), method: row.method === 'manual' || !row.method ? 'manual' : row.method, processedAt: row.processedAt ?? nowIso() }, result, check.blocking.filter((b) => !hard.includes(b)).concat(check.warnings).map((w) => `Manuell freigegeben: ${w}`));
    writeAudit(app.db, ctx, { action: 'import.apply_manual', entityType: 'document_import', entityId: row.id, after: { invoiceId: result.invoiceId, expenseIds: result.expenseIds, customerCreated: result.customerCreated } });
    return { import: summarize(getRow(ctx.companyId, row.id)) };
  });

  /** Erneut auslesen (z. B. nach Aktivieren der KI oder bei Verbindungsfehler). */
  app.post('/api/document-imports/:id/retry', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const row = getRow(ctx.companyId, (req.params as { id: string }).id);
    assertAccess(req, row.direction as ImportDirection, 'write');
    if (!['needs_review', 'failed'].includes(row.status)) throw conflict('Nur Belege in Prüfung oder mit Fehler können erneut verarbeitet werden.');
    app.db.update(documentImports).set({ status: 'queued', error: null, warningsJson: '[]', updatedAt: nowIso() }).where(eq(documentImports.id, row.id)).run();
    queue.enqueue(row.id);
    return { import: summarize(getRow(ctx.companyId, row.id)) };
  });

  /** Verwerfen: Beleg wird nicht übernommen, die hochgeladene Datei wird gelöscht. */
  app.post('/api/document-imports/:id/discard', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const row = getRow(ctx.companyId, (req.params as { id: string }).id);
    assertAccess(req, row.direction as ImportDirection, 'write');
    if (row.status === 'completed') throw conflict('Übernommene Belege bitte über „Rückgängig“ zurücknehmen.');
    if (row.status === 'processing') throw conflict('Der Beleg wird gerade verarbeitet.');
    const fileInUse = row.fileId ? app.db.get<{ n: number }>(sql`select (select count(*) from invoices where company_id = ${ctx.companyId} and pdf_file_id = ${row.fileId}) + (select count(*) from expenses where company_id = ${ctx.companyId} and receipt_file_id = ${row.fileId}) as n`)?.n ?? 0 : 0;
    if (row.fileId && fileInUse === 0) app.storage.remove(ctx.companyId, row.fileId);
    app.db.update(documentImports).set({ status: 'discarded', fileId: fileInUse ? row.fileId : null, dataJson: null, updatedAt: nowIso() }).where(eq(documentImports.id, row.id)).run();
    writeAudit(app.db, ctx, { action: 'import.discard', entityType: 'document_import', entityId: row.id, after: { file: row.fileName } });
    return { ok: true };
  });

  /** Übernahme zurücknehmen: erzeugte Rechnung/Ausgaben (und ein nur dafür angelegter Kunde) werden entfernt. */
  app.post('/api/document-imports/:id/undo', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const row = getRow(ctx.companyId, (req.params as { id: string }).id);
    assertAccess(req, row.direction as ImportDirection, 'write');
    if (row.status !== 'completed') throw conflict('Nur übernommene Belege können zurückgenommen werden.');
    if (row.invoiceId) {
      const inv = app.db.select({ status: invoices.status, sentAt: invoices.sentAt }).from(invoices).where(and(eq(invoices.id, row.invoiceId), eq(invoices.companyId, ctx.companyId))).get();
      if (inv?.sentAt) throw conflict('Die Rechnung wurde bereits aus dieser Software versendet und kann nicht zurückgenommen werden.');
    }
    const result = undoImport(app, row, ctx.userId);
    return { ok: true, ...result };
  });
}
