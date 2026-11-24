import crypto from 'node:crypto';
import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, sql, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '../../core/context.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js';
import { newId, nowIso } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import { parse } from '../../core/validation.js';
import { companies, documentImports, files, flatpayPayouts, flatpayReceipts, invoices, orderItems, orders, payments, vehicles } from '../../db/schema.js';
import { Lexware, LexwareHttpError } from '../../integrations/lexware.js';
import { ctxOf } from '../../plugins/auth.js';

const CATEGORY = 'f5c7fee8-f184-4e7a-ab04-8f7e7ad6c207'; // Lexware: Einnahmen als Kleinunternehmer
const idSchema = z.string().uuid();
const centsSchema = z.number().int().min(1).max(100_000_000);
const captionSchema = z.string().trim().max(500).default('');
const orderColumns = { id: orders.id, orderNumber: orders.orderNumber, title: orders.title, totalCents: orders.totalCents };
const normalize = (s: string) => s.toLocaleLowerCase('de-DE').trim();
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

type Receipt = typeof flatpayReceipts.$inferSelect;

function assertEnabled(app: FastifyInstance, companyId: string) {
  const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!company?.isActive || !app.hasFeature(companyId, 'LEXWARE')) throw forbidden('Das Lexware-Modul ist pausiert.');
  return company;
}

function selectedOrder(app: FastifyInstance, companyId: string, id: string) {
  return app.db.select().from(orders).where(and(eq(orders.companyId, companyId), eq(orders.id, id), ne(orders.status, 'cancelled'))).get();
}

function getReceipt(app: FastifyInstance, companyId: string, id: string) {
  const row = app.db.select().from(flatpayReceipts).where(and(eq(flatpayReceipts.companyId, companyId), eq(flatpayReceipts.id, id))).get();
  if (!row) throw notFound('Flatpay-Beleg');
  return row;
}

function replyFor(app: FastifyInstance, row: Receipt) {
  const order = row.orderId || row.candidateOrderId;
  const number = order ? selectedOrder(app, row.companyId, order)?.orderNumber : null;
  const message = row.orderId
    ? `Auftrag ${number ?? row.orderId}: Kartenzahlung erfasst. Lexware: ${statusText(row.lexwareState)}.`
    : number
      ? `Flatpay-Beleg für Auftrag ${number} vorgeschlagen. Bitte Betrag und Zahlungsdatum im Manager bestätigen. Lexware: ausstehend.`
      : 'Welcher Auftrag gehört zum Flatpay-Beleg? Bitte Auftragsnummer und tatsächlichen Bonbetrag im Manager prüfen. Lexware: ausstehend.';
  return { id: row.id, message, lexwareState: row.lexwareState };
}

function statusText(state: string) {
  const labels: Record<string, string> = {
    pending: 'ausstehend',
    checking: 'Ergebnis unklar, externe Suche erforderlich',
    review: 'Beleg übertragen, fachliche Prüfung in Lexware offen',
    attachment_pending: 'Beleg vorhanden, Bonanhang offen',
    invoice: 'vorhandene Lexware-Rechnung verknüpft, Bon lokal abgelegt',
    invoice_missing: 'Rechnung in Lexware suchen oder Original übernehmen',
  };
  return labels[state] ?? state;
}

/** Nur Fahrzeug + Leistung oder eine genaue Auftragsnummer ergeben einen Vorschlag. Der Betrag muss passen. */
function matchCaption(app: FastifyInstance, companyId: string, caption: string) {
  // Deutsche Dezimalkommas gehören zum Betrag, daher den Betrag separat vom Ende aus lesen.
  const full = caption.match(/(?:^|,\s*)(\d{1,6})(?:[,.](\d{2}))?\s*€\s*$/);
  const amountMatch = full;
  const amountCents = amountMatch ? Number(amountMatch[1]) * 100 + Number(amountMatch[2] ?? 0) : null;
  const terms = (full ? caption.slice(0, full.index) : caption).split(',').map(normalize).filter(Boolean);
  const [vehicleOrNumber, service] = terms;
  if (!vehicleOrNumber || !amountCents) return { amountCents, candidateOrderId: null };
  const matches = app.db.select(orderColumns).from(orders)
    .leftJoin(vehicles, and(eq(vehicles.id, orders.vehicleId), eq(vehicles.companyId, companyId)))
    .where(and(eq(orders.companyId, companyId), ne(orders.status, 'cancelled'), or(
      eq(orders.orderNumber, vehicleOrNumber.toUpperCase()),
      service ? sql`lower(${vehicles.model}) = ${vehicleOrNumber}` : undefined,
    ))).all();
  const candidates = matches.filter((order) => normalize(order.orderNumber) === vehicleOrNumber ||
    (service && (normalize(order.title ?? '') === service || app.db.select({ name: orderItems.name }).from(orderItems)
      .where(and(eq(orderItems.companyId, companyId), eq(orderItems.orderId, order.id))).all().some((item) => normalize(item.name) === service))));
  const unique = candidates.length === 1 && candidates[0]!.totalCents === amountCents ? candidates[0]!.id : null;
  return { amountCents, candidateOrderId: unique };
}

export async function intakeFlatpay(app: FastifyInstance, ctx: Ctx, rawCaption: unknown, upload?: { buffer: Buffer; filename: string; mimetype: string; truncated: boolean }) {
  assertEnabled(app, ctx.companyId);
  const caption = parse(captionSchema, rawCaption);
  if (!upload || upload.truncated || !['image/jpeg', 'image/png', 'application/pdf'].includes(upload.mimetype)) {
    throw badRequest('Bitte den Bon als JPG, PNG oder PDF bis 25 MB hochladen.');
  }
  const sha256 = crypto.createHash('sha256').update(upload.buffer).digest('hex');
  const find = () => app.db.select().from(flatpayReceipts).where(and(eq(flatpayReceipts.companyId, ctx.companyId), eq(flatpayReceipts.sha256, sha256))).get();
  const haveOriginal = (id: string) => {
    const source = app.db.select({ fileId: documentImports.fileId }).from(documentImports).where(eq(documentImports.id, id)).get();
    const file = source?.fileId && app.storage.get(ctx.companyId, source.fileId);
    return file && fs.existsSync(app.storage.absolute(file.storagePath));
  };
  const existing = find();
  if (existing && haveOriginal(existing.id)) return replyFor(app, existing);
  const file = await app.storage.store({ companyId: ctx.companyId, buffer: upload.buffer, originalName: upload.filename, mimeType: upload.mimetype, category: 'invoice', uploadedByUserId: ctx.userId, preserveOriginal: true });
  const id = newId();
  try {
    assertEnabled(app, ctx.companyId);
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimeType)) throw badRequest('Bitte JPG, PNG oder PDF verwenden.');
    const saved = find();
    if (saved) {
      if (haveOriginal(saved.id)) {
        app.storage.remove(ctx.companyId, file.id);
      } else {
        const order = saved.orderId ? selectedOrder(app, ctx.companyId, saved.orderId) : null;
        app.db.transaction((tx) => {
          tx.update(documentImports).set({ fileId: file.id, fileName: file.originalName, updatedAt: nowIso() }).where(eq(documentImports.id, saved.id)).run();
          if (order) tx.update(files).set({ orderId: order.id, customerId: order.customerId, vehicleId: order.vehicleId }).where(eq(files.id, file.id)).run();
          writeAudit(tx, ctx, { action: 'flatpay.restore_original', entityType: 'document_import', entityId: saved.id });
        });
      }
      return replyFor(app, saved);
    }
    app.db.transaction((tx) => {
      tx.insert(documentImports).values({ id, companyId: ctx.companyId, direction: 'flatpay', status: 'needs_review', method: 'manual', fileId: file.id, fileName: file.originalName, sha256, createdByUserId: ctx.userId }).run();
      tx.insert(flatpayReceipts).values({ id, companyId: ctx.companyId, sha256, caption, ...matchCaption(app, ctx.companyId, caption) }).run();
      writeAudit(tx, ctx, { action: 'flatpay.import', entityType: 'document_import', entityId: id });
    });
  } catch (err) {
    app.storage.remove(ctx.companyId, file.id);
    const duplicate = find();
    if (duplicate) return replyFor(app, duplicate);
    throw err;
  }
  return replyFor(app, getReceipt(app, ctx.companyId, id));
}

const invoiceNumber = z.string().trim().min(1).max(100);

export function flatpayRoutes(app: FastifyInstance) {
  const base = '/api/document-imports/flatpay';
  const preHandler = app.requireAuth('finance:write', 'orders:read');
  const getId = (params: unknown) => parse(z.object({ id: idSchema }), params).id;
  const inFlight = new Set<string>();

  app.get(base, { preHandler }, async (req) => {
    const ctx = ctxOf(req);
    assertEnabled(app, ctx.companyId);
    const items = app.db.select({ receipt: flatpayReceipts, fileId: documentImports.fileId, fileName: documentImports.fileName, createdAt: documentImports.createdAt })
      .from(flatpayReceipts).innerJoin(documentImports, eq(flatpayReceipts.id, documentImports.id))
      .where(eq(flatpayReceipts.companyId, ctx.companyId)).orderBy(desc(documentImports.createdAt)).limit(200).all()
      .map(({ receipt, ...source }) => ({ ...receipt, ...source, message: replyFor(app, receipt).message }));
    const payouts = app.db.select().from(flatpayPayouts).where(eq(flatpayPayouts.companyId, ctx.companyId)).all();
    const cfg = app.integrations.get<{ apiKey: string }>(ctx.companyId, 'lexware');
    return { items, payouts, configured: Boolean(cfg?.row.isActive), canConfigure: ctx.permissions.has('integrations:manage') };
  });

  app.put(`${base}/settings`, { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    assertEnabled(app, ctx.companyId);
    const input = parse(z.object({ apiKey: z.string().trim().min(10).max(500) }), req.body);
    let profile;
    try { profile = await new Lexware(app.fetchFn, input.apiKey).profile(); }
    catch { throw badRequest('Lexware-Konto konnte mit diesem Schlüssel nicht geprüft werden.'); }
    assertEnabled(app, ctx.companyId);
    const previous = app.integrations.get<{ organizationId: string }>(ctx.companyId, 'lexware');
    if (previous && previous.config.organizationId !== profile.organizationId) throw conflict('Der Schlüssel gehört zu einem anderen Lexware-Betrieb.');
    if (!profile.smallBusiness) throw badRequest('Für den Pilot muss das Lexware-Konto als Kleinunternehmen eingerichtet sein.');
    app.integrations.save(ctx.companyId, 'lexware', { ...input, organizationId: profile.organizationId }, {}, 'Lexware Office');
    writeAudit(app.db, ctx, { action: 'flatpay.settings', entityType: 'integration', entityId: null });
    return { configured: true };
  });

  app.post(`${base}/:id/confirm`, { preHandler }, async (req) => {
    const ctx = ctxOf(req);
    assertEnabled(app, ctx.companyId);
    const id = getId(req.params);
    const input = parse(z.object({ orderNumber: z.string().trim().min(1).max(80).optional(), amountCents: centsSchema, paidOn: z.iso.date(), existingInvoiceNumber: invoiceNumber.optional() }), req.body);
    if (input.paidOn > today()) throw badRequest('Das Zahlungsdatum liegt in der Zukunft.');
    return app.db.transaction((tx) => {
      const row = getReceipt(app, ctx.companyId, id);
      if (row.orderId) return replyFor(app, row);
      const order = input.orderNumber
        ? tx.select().from(orders).where(and(eq(orders.companyId, ctx.companyId), eq(orders.orderNumber, input.orderNumber), ne(orders.status, 'cancelled'))).get()
        : row.candidateOrderId && selectedOrder(app, ctx.companyId, row.candidateOrderId);
      if (!order) throw badRequest('Bitte die genaue Auftragsnummer angeben.');
      if (order.totalCents !== input.amountCents) throw conflict('Bonbetrag und Auftragssumme weichen ab. Bitte den tatsächlichen Auftrag und Bon prüfen.');
      const distinctReceipt = tx.select({ id: flatpayReceipts.id }).from(flatpayReceipts)
        .where(and(eq(flatpayReceipts.companyId, ctx.companyId), eq(flatpayReceipts.orderId, order.id))).get();
      if (distinctReceipt) throw conflict('Zum Auftrag gibt es bereits einen Flatpay-Beleg.');
      const matches = tx.select().from(invoices).where(and(eq(invoices.companyId, ctx.companyId), ne(invoices.status, 'cancelled'),
        isNull(invoices.cancelsInvoiceId),
        or(eq(invoices.orderId, order.id), and(isNull(invoices.orderId), eq(invoices.customerId, order.customerId),
          input.existingInvoiceNumber ? eq(invoices.invoiceNumber, input.existingInvoiceNumber) : eq(invoices.totalCents, order.totalCents))))).all();
      if (matches.length > 1 || (matches[0] && !matches[0].orderId && matches[0].invoiceNumber !== input.existingInvoiceNumber)) {
        throw conflict('Es gibt mögliche Kundenrechnungen. Bitte die vorhandene Rechnungsnummer angeben oder den Auftrag in der Rechnung prüfen.');
      }
      const invoice = matches[0];
      if (input.existingInvoiceNumber && invoice && invoice.invoiceNumber !== input.existingInvoiceNumber) throw conflict('Der Auftrag hat eine andere Kundenrechnung.');
      if (invoice && (!invoice.invoiceNumber || invoice.status === 'draft' || invoice.totalCents !== input.amountCents || (invoice.paidCents > 0 && invoice.paidCents !== invoice.totalCents))) {
        throw conflict('Bitte Kundenrechnung, Rechnungsbetrag und bestehende Teilzahlungen prüfen.');
      }
      const service = tx.select({ name: orderItems.name }).from(orderItems)
        .where(and(eq(orderItems.companyId, ctx.companyId), eq(orderItems.orderId, order.id))).all().map((item) => item.name).join(', ') || order.title;
      if (!service?.trim()) throw badRequest('Bitte die Leistung im Auftrag hinterlegen.');
      const reference = invoice?.invoiceNumber ?? input.existingInvoiceNumber ?? `FP-${order.id}`;
      if (tx.select({ id: flatpayReceipts.id }).from(flatpayReceipts).where(and(eq(flatpayReceipts.companyId, ctx.companyId), eq(flatpayReceipts.reference, reference))).get()) {
        throw conflict('Diese Rechnungsreferenz ist bereits mit einer Flatpay-Zahlung verknüpft.');
      }
      if (invoice) {
        if (!ctx.permissions.has('invoices:write')) throw forbidden('Zum Zuordnen der Rechnung ist Rechnungszugriff erforderlich.');
        const existingPayments = tx.select().from(payments).where(and(eq(payments.companyId, ctx.companyId), eq(payments.invoiceId, invoice.id))).all();
        if (invoice.paidCents && existingPayments.some((payment) => !['card', 'other'].includes(payment.method))) {
          throw conflict('Die Rechnung ist bereits mit einer anderen Zahlungsart bezahlt. Bitte die Zuordnung prüfen.');
        }
        if (invoice.paidCents === 0) {
          tx.insert(payments).values({ id: newId(), companyId: ctx.companyId, invoiceId: invoice.id, amountCents: input.amountCents, paidAt: input.paidOn, method: 'card', note: `Flatpay ${id}`, createdByUserId: ctx.userId }).run();
        }
        tx.update(invoices).set({ orderId: order.id, status: 'paid', paidCents: input.amountCents, paidAt: invoice.paidAt ?? input.paidOn, updatedAt: nowIso() }).where(eq(invoices.id, invoice.id)).run();
      }
      tx.update(flatpayReceipts).set({ orderId: order.id, service: service.slice(0, 500), amountCents: input.amountCents, paidOn: input.paidOn, invoiceId: invoice?.id, reference,
        lexwareState: (invoice || input.existingInvoiceNumber) ? 'invoice_missing' : 'pending' }).where(eq(flatpayReceipts.id, id)).run();
      const source = tx.select({ fileId: documentImports.fileId }).from(documentImports).where(eq(documentImports.id, id)).get();
      if (source?.fileId) tx.update(files).set({ orderId: order.id, customerId: order.customerId, vehicleId: order.vehicleId }).where(eq(files.id, source.fileId)).run();
      tx.update(documentImports).set({ status: 'completed', invoiceId: invoice?.id, customerId: order.customerId, appliedAt: nowIso(), updatedAt: nowIso() }).where(eq(documentImports.id, id)).run();
      writeAudit(tx, ctx, { action: 'flatpay.confirm', entityType: 'document_import', entityId: id, after: { orderId: order.id, amountCents: input.amountCents } });
      return replyFor(app, getReceipt(app, ctx.companyId, id));
    });
  });

  app.post(`${base}/:id/transfer`, { preHandler }, async (req) => {
    const ctx = ctxOf(req);
    const company = assertEnabled(app, ctx.companyId);
    const id = getId(req.params);
    const row = getReceipt(app, ctx.companyId, id);
    const order = row.orderId && selectedOrder(app, ctx.companyId, row.orderId);
    if (!order || !row.amountCents || !row.paidOn || !row.reference || !row.service) throw conflict('Bitte den Beleg zuerst einem Auftrag zuordnen und bestätigen.');
    if (!ctx.permissions.has('invoices:write')) throw forbidden('Zum Lexware-Transfer ist Rechnungszugriff erforderlich.');
    const cfg = app.integrations.get<{ apiKey: string }>(ctx.companyId, 'lexware');
    if (!cfg?.row.isActive || !cfg.config.apiKey) throw conflict('Bitte zuerst den Lexware-Zugang einrichten.');
    if (inFlight.has(id)) throw conflict('Die Lexware-Prüfung läuft bereits.');
    const lexware = new Lexware(app.fetchFn, cfg.config.apiKey);
    const set = (patch: Partial<Receipt>) => app.db.update(flatpayReceipts).set(patch).where(eq(flatpayReceipts.id, id)).run();
    inFlight.add(id);
    try {
      if (row.lexwareState === 'invoice' || row.lexwareState === 'review') return replyFor(app, row);
      let externalId = row.lexwareId;
      const invoiceOnly = row.lexwareState === 'invoice_missing';
      if (!externalId) {
        const vouchers = await lexware.vouchers(row.reference);
        if (invoiceOnly) {
          assertEnabled(app, ctx.companyId);
          const existingInvoices = await lexware.invoices(row.reference);
          const existing = [...existingInvoices.map((item) => ({ ...item, total: item.totalAmount })), ...vouchers.map((item) => ({ ...item, total: item.totalGrossAmount }))];
          if (existing.length !== 1 || Math.round(existing[0]!.total * 100) !== row.amountCents || ['draft', 'voided'].includes(existing[0]!.voucherStatus)) {
            throw conflict('Bitte vorhandene Rechnung in Lexware anhand von Rechnungsnummer und Betrag prüfen. Es wurde kein neuer Erlösbeleg angelegt.');
          }
          set({ lexwareId: existing[0]!.id, lexwareState: 'invoice' });
          return replyFor(app, getReceipt(app, ctx.companyId, id));
        }
        if (vouchers.length && (vouchers.length !== 1 || Math.round(vouchers[0]!.totalGrossAmount * 100) !== row.amountCents || vouchers[0]!.voucherStatus === 'voided')) {
          throw conflict('Der Lexware-Treffer ist mehrdeutig oder weicht ab. Bitte den bestehenden Beleg prüfen.');
        }
        externalId = vouchers[0]?.id ?? null;
        if (!externalId) {
          if (row.lexwareState === 'checking') throw conflict('Lexware zeigt noch keinen Beleg. Die frühere Übertragung kann verspätet eintreffen. Bitte Belegnummer prüfen und später erneut abgleichen.');
          if (!company.smallBusiness || order.vatCents !== 0) throw conflict('Diese Übertragung ist für Kleinunternehmer-Aufträge ohne Umsatzsteuer eingerichtet.');
          assertEnabled(app, ctx.companyId);
          const claimed = app.db.update(flatpayReceipts).set({ lexwareState: 'checking' })
            .where(and(eq(flatpayReceipts.id, id), eq(flatpayReceipts.lexwareState, 'pending'))).run();
          if (!claimed.changes) throw conflict('Eine andere Übertragung hat begonnen. Bitte erneut abgleichen.');
          try {
            externalId = await lexware.create({ number: row.reference, date: row.paidOn, cents: row.amountCents, service: row.service, categoryId: CATEGORY, orderNumber: order.orderNumber });
          } catch (error) {
            // Dokumentierte Ablehnungen des Requests bedeuten, dass kein Beleg angelegt wurde.
            // Bei Verbindungsausfall, unlesbarer Antwort und 5xx bleibt der Zustand unklar.
            if (error instanceof LexwareHttpError && [400, 401, 403, 406, 422, 429].includes(error.status)) set({ lexwareState: 'pending' });
            throw error;
          }
        }
        set({ lexwareId: externalId, lexwareState: 'attachment_pending' });
      }
      assertEnabled(app, ctx.companyId);
      const source = app.db.select({ fileId: documentImports.fileId }).from(documentImports).where(eq(documentImports.id, id)).get();
      const file = source?.fileId && app.storage.get(ctx.companyId, source.fileId);
      if (!file) throw conflict('Bitte den Originalbon im Manager prüfen.');
      const fileId = await lexware.attach(externalId, fs.readFileSync(app.storage.absolute(file.storagePath)), file.mimeType, file.originalName);
      set({ lexwareFileId: fileId, lexwareState: 'review' });
      writeAudit(app.db, ctx, { action: 'flatpay.transfer', entityType: 'document_import', entityId: id, after: { lexwareId: externalId, fileId } });
      return replyFor(app, getReceipt(app, ctx.companyId, id));
    } catch (err) {
      if (err instanceof Error && 'statusCode' in err) throw err;
      app.log.warn({ receiptId: id }, 'Lexware-Aufruf fehlgeschlagen');
      const result = replyFor(app, getReceipt(app, ctx.companyId, id));
      return { ...result, message: result.message + ' Der letzte Lexware-Aufruf ist fehlgeschlagen.' };
    } finally {
      inFlight.delete(id);
    }
  });

  app.post(`${base}/payouts`, { preHandler }, async (req) => {
    const ctx = ctxOf(req);
    assertEnabled(app, ctx.companyId);
    const input = parse(z.object({ reportReference: z.string().trim().min(1).max(100), receiptIds: z.array(idSchema).min(1).max(200),
      grossCents: centsSchema, feeCents: z.number().int().min(0).max(100_000_000), netCents: z.number().int().min(0).max(100_000_000) }), req.body);
    return app.db.transaction((tx) => {
      const ids = [...new Set(input.receiptIds)];
      const rows = tx.select().from(flatpayReceipts).where(and(eq(flatpayReceipts.companyId, ctx.companyId), inArray(flatpayReceipts.id, ids))).all();
      const existing = tx.select().from(flatpayPayouts).where(and(eq(flatpayPayouts.companyId, ctx.companyId), eq(flatpayPayouts.reportReference, input.reportReference))).get();
      if (existing) {
        const count = tx.select({ id: flatpayReceipts.id }).from(flatpayReceipts).where(eq(flatpayReceipts.payoutId, existing.id)).all().length;
        if (existing.netCents !== input.netCents || existing.feeCents !== input.feeCents || existing.grossCents !== input.grossCents || ids.length !== rows.length || count !== rows.length || rows.some((row) => row.payoutId !== existing.id)) {
          throw conflict('Dieser Auszahlungsbericht ist bereits mit anderen Angaben erfasst.');
        }
        return existing;
      }
      if (rows.length !== ids.length || rows.some((row) => !row.orderId || row.payoutId)) throw conflict('Bitte ausschließlich bestätigte und noch nicht zugeordnete Zahlungen wählen.');
      if (rows.reduce((sum, row) => sum + (row.amountCents ?? 0), 0) !== input.grossCents || input.grossCents - input.feeCents !== input.netCents) {
        throw conflict('Belegsumme, Gebühren und Nettoauszahlung müssen mit dem Flatpay-Bericht übereinstimmen.');
      }
      const { receiptIds: _receiptIds, ...report } = input;
      const payout = { id: newId(), companyId: ctx.companyId, ...report };
      tx.insert(flatpayPayouts).values(payout).run();
      tx.update(flatpayReceipts).set({ payoutId: payout.id }).where(and(eq(flatpayReceipts.companyId, ctx.companyId), inArray(flatpayReceipts.id, ids))).run();
      writeAudit(tx, ctx, { action: 'flatpay.payout_report', entityType: 'flatpay_payout', entityId: payout.id, after: report });
      return payout;
    });
  });
}
