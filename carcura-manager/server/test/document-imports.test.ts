import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { documentImports, aiUsageLog, files } from '../src/db/schema.js';
import { parseEInvoice } from '../src/integrations/einvoice/parse.js';
import { parseXml } from '../src/integrations/einvoice/xml.js';
import { toCents, toIsoDate } from '../src/integrations/einvoice/model.js';
import { extractEmbeddedFiles } from '../src/integrations/einvoice/pdf.js';
import { pdfHasActiveContent } from '../src/integrations/storage.js';
import { splitPersonName, splitStreet } from '../src/modules/imports/service.js';
import { setupCompany, login, as, type Session } from './helpers.js';
import { ciiXml, ublXml, zugferdPdf, plainPdf } from './fixtures/einvoice.js';

/* ------------------------------------------------------------------ Simulierte KI (Anthropic Messages API) */
const aiCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
let aiExtraction: Record<string, unknown> = {};
const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('api.anthropic.com')) {
    aiCalls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(aiExtraction) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1800, output_tokens: 420 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 404 });
};

const party = (o: Record<string, unknown> = {}) => ({ name: null, is_company: false, contact_person: null, street: null, zip: null, city: null, country: 'DE', email: null, phone: null, vat_id: null, tax_number: null, party_number: null, ...o });
const receiptExtraction = (o: Record<string, unknown> = {}) => ({
  document_type: 'receipt', invoice_number: 'BON-7781', referenced_invoice_number: null, issue_date: '2026-09-22', due_date: null, service_date: null, currency: 'EUR',
  seller: party({ name: 'Autoteile Schmidt e.K.', is_company: true, street: 'Marktplatz 3', zip: '57610', city: 'Altenkirchen', vat_id: 'DE298765432' }),
  buyer: party({ name: null }),
  line_items: [{ name: 'Mikrofasertücher 10er', description: null, quantity: 2, unit: 'Stk', unit_net_price: 8.40, net_amount: 16.80, vat_rate_percent: 19 }, { name: 'Felgenreiniger 1 l', description: null, quantity: 1, unit: 'Stk', unit_net_price: 12.61, net_amount: 12.61, vat_rate_percent: 19 }],
  vat_breakdown: [{ vat_rate_percent: 19, net_amount: 29.41, vat_amount: 5.59 }],
  total_net: 29.41, total_vat: 5.59, total_gross: 35.00, amount_due: null, payment_terms: null, paid: true, small_business_note: false,
  suggested_category: 'Material', confidence: 'high', issues: [],
  ...o,
});

let app: FastifyInstance;
let admin: Session;
const upload = async (s: Session | string, direction: 'outgoing' | 'incoming', file: { name: string; type: string; data: Buffer }, extra: Record<string, string> = {}) => {
  const boundary = '----imp' + Math.random().toString(36).slice(2);
  const fields = { direction, ...extra };
  const parts: Buffer[] = Object.entries(fields).map(([k, v]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.data, Buffer.from('\r\n')]));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const res = await app.inject(as(s, { method: 'POST', url: '/api/document-imports', payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }));
  await app.importQueue.idle();
  return res;
};
const detail = async (id: string) => (await app.inject(as(admin, { url: `/api/document-imports/${id}` }))).json();

beforeAll(async () => {
  const dataDir = `/tmp/cm-test/imp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const config = loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', chromiumPath: '/opt/pw-browsers/chromium' });
  app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false, fetchFn: fakeFetch });
  admin = await setupCompany(app, 'Carcura');
  await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { legalName: 'Carcura GbR', street: 'Hauptstr. 7', zip: '57632', city: 'Walterschen' } }));
});
afterAll(async () => app.close());

describe('E-Rechnung lesen (ohne KI)', () => {
  it('liest ZUGFeRD/Factur-X (CII) vollständig und rechnet Beträge ohne Rundungsfehler', () => {
    const r = parseEInvoice(ciiXml())!;
    expect(r.syntax).toBe('cii');
    const inv = r.invoice;
    expect(inv).toMatchObject({ kind: 'invoice', number: 'RE0042', issueDate: '2026-09-15', dueDate: '2026-09-29', serviceDate: '2026-09-15', currency: 'EUR', netCents: 24900, vatCents: 0, grossCents: 24900, dueCents: 24900 });
    expect(inv.seller.name).toBe('Carcura GbR');
    expect(inv.buyer).toMatchObject({ name: 'Max Mustermann', street: 'Bahnhofstraße 12a', zip: '57610', city: 'Altenkirchen', email: 'max.mustermann@example.de' });
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[1]).toMatchObject({ name: 'Lackpolitur einstufig', quantity: 2.5, unit: 'HUR', unitNetCents: 4000, netCents: 10000, vatBp: 0 });
    expect(inv.paymentTerms).toContain('14 Tagen');
  });

  it('liest XRechnung (UBL) mit zwei Steuersätzen', () => {
    const r = parseEInvoice(ublXml())!;
    expect(r.syntax).toBe('ubl');
    expect(r.invoice).toMatchObject({ number: 'LS-2026-0815', issueDate: '2026-09-20', dueDate: '2026-10-04', netCents: 13857, vatCents: 2170, grossCents: 16027 });
    expect(r.invoice.seller).toMatchObject({ name: 'PflegeProfi Handels GmbH', vatId: 'DE811223344', zip: '50667', email: 'rechnung@pflegeprofi.example' });
    expect(r.invoice.vat).toEqual([{ vatBp: 1900, netCents: 10000, vatCents: 1900 }, { vatBp: 700, netCents: 3857, vatCents: 270 }]);
  });

  it('Hilfsfunktionen: Beträge, Datum, Namen, Anschrift; XML ohne DOCTYPE (XXE-Schutz)', () => {
    expect(toCents('1234.5')).toBe(123450);
    expect(toCents('1.234,56')).toBe(123456);
    expect(toCents('-12,99')).toBe(-1299);
    expect(toCents(1.005)).toBe(101);
    expect(toCents('0.125')).toBe(13);
    expect(toCents('abc')).toBeNull();
    expect(toIsoDate('20260230')).toBeNull();
    expect(toIsoDate('15.09.2026')).toBe('2026-09-15');
    expect(splitPersonName('Herrn Dr. Max Peter Mustermann')).toEqual({ salutation: 'Herr', firstName: 'Max Peter', lastName: 'Mustermann' });
    expect(splitPersonName('Mustermann, Erika')).toEqual({ salutation: null, firstName: 'Erika', lastName: 'Mustermann' });
    expect(splitStreet('Bahnhofstraße 12a')).toEqual({ street: 'Bahnhofstraße', houseNumber: '12a' });
    expect(splitStreet('Am Markt 3-5, Hinterhaus')).toEqual({ street: 'Am Markt', houseNumber: '3-5' });
    expect(() => parseXml('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>')).toThrow();
  });

  it('findet die eingebettete XML in der PDF; PDFs mit anderen Anhängen oder Skripten bleiben gesperrt', () => {
    const pdf = zugferdPdf(ciiXml());
    expect(extractEmbeddedFiles(pdf)[0]!.isXml).toBe(true);
    expect(extractEmbeddedFiles(zugferdPdf(ciiXml(), { compress: false }))[0]!.isXml).toBe(true);
    expect(pdfHasActiveContent(pdf)).toBe(true); // normale Uploads: weiterhin gesperrt
    expect(pdfHasActiveContent(pdf, { allowEmbeddedXml: true })).toBe(false);
    expect(pdfHasActiveContent(zugferdPdf('MZ\x90\x00 keine xml'), { allowEmbeddedXml: true })).toBe(true);
    expect(pdfHasActiveContent(Buffer.concat([pdf, Buffer.from('<< /S /JavaScript /JS (app.alert(1)) >>')]), { allowEmbeddedXml: true })).toBe(true);
  });
});

describe('Ausgangsrechnungen (z. B. Lexware Office) hochladen', () => {
  let firstImport = '';
  let customerId = '';
  it('neuer Kunde: wird automatisch angelegt, Rechnung übernommen und im Kundenprofil abgelegt', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0042.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml()) });
    expect(res.statusCode).toBe(200);
    firstImport = res.json().items[0].id;
    const d = await detail(firstImport);
    expect(d.import.status).toBe('completed');
    expect(d.import.method).toBe('einvoice_cii');
    expect(d.import.customerCreated).toBe(true);
    customerId = d.import.customerId;
    const c = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json().customer;
    expect(c).toMatchObject({ type: 'private', firstName: 'Max', lastName: 'Mustermann', street: 'Bahnhofstraße', houseNumber: '12a', zip: '57610', city: 'Altenkirchen', email: 'max.mustermann@example.de', source: 'import' });
    const inv = (await app.inject(as(admin, { url: `/api/invoices/${d.import.invoiceId}` }))).json();
    expect(inv.imported).toBe(true);
    expect(inv.invoice).toMatchObject({ invoiceNumber: 'RE0042', status: 'overdue', issueDate: '2026-09-15', dueDate: '2026-09-29', subtotalCents: 24900, vatCents: 0, totalCents: 24900, source: 'import' });
    expect(inv.totals.totalCents).toBe(24900);
    expect(inv.items).toHaveLength(2);
    expect(inv.items[1]).toMatchObject({ quantity: 1, unitPriceCents: 10000, totalCents: 10000 });
    expect(inv.items[1].description).toContain('2,5 Std. × 40,00 €');
    // Original wird ausgeliefert, nicht neu erzeugt
    const pdf = await app.inject(as(admin, { url: `/api/invoices/${d.import.invoiceId}/pdf` }));
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.rawPayload.toString('latin1')).toContain('/EmbeddedFile');
    // Beleg liegt im Kundenprofil
    const docs = (await app.inject(as(admin, { url: `/api/files?customerId=${customerId}` }))).json().items;
    expect(docs.some((f: { category: string }) => f.category === 'invoice')).toBe(true);
    // Rechnungsliste und Kennzahlen enthalten die importierte Rechnung
    const list = (await app.inject(as(admin, { url: `/api/invoices?customerId=${customerId}` }))).json();
    expect(list.total).toBe(1);
  });

  it('dieselbe Datei erneut: wird als bereits hochgeladen erkannt', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0042-kopie.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml()) });
    expect(res.json().items[0]).toMatchObject({ status: 'duplicate', existingId: firstImport });
  });

  it('gleiche Rechnungsnummer als andere Datei (z. B. XML): Dublette, keine zweite Rechnung', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0042.xml', type: 'application/xml', data: Buffer.from(ciiXml()) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('duplicate');
    expect((await app.inject(as(admin, { url: `/api/invoices?customerId=${customerId}` }))).json().total).toBe(1);
  });

  it('bestehender Kunde (E-Mail): Rechnung wird zugeordnet, fehlende Angaben ergänzt, kein neuer Kunde', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0043.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0043', date: '20260920', due: '20261004', buyerPhone: '02681 12345' })) }, { markPaid: 'true' });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    expect(d.import.customerCreated).toBe(false);
    expect(d.import.customerId).toBe(customerId);
    expect(d.import.warnings.join(' ')).toContain('Telefon');
    const c = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json().customer;
    expect(c.phone).toBe('02681 12345');
    const inv = (await app.inject(as(admin, { url: `/api/invoices/${d.import.invoiceId}` }))).json();
    expect(inv.invoice.status).toBe('paid');
    expect(inv.invoice.paidCents).toBe(24900);
    expect(inv.payments).toHaveLength(1);
  });

  it('bestehender Kunde ohne E-Mail: Zuordnung über Name und PLZ', async () => {
    const created = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Erika', lastName: 'Beispiel', zip: '57632', city: 'Walterschen' } }))).json().customer;
    const res = await upload(admin, 'outgoing', { name: 'RE0044.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0044', buyerName: 'Frau Erika Beispiel', buyerEmail: null, buyerZip: '57632', buyerCity: 'Walterschen', buyerStreet: 'Lindenweg 4' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    expect(d.import.customerId).toBe(created.id);
    const c = (await app.inject(as(admin, { url: `/api/customers/${created.id}` }))).json().customer;
    expect(c.street).toBeNull(); // Anschrift war teilweise vorhanden (PLZ/Ort) – nichts überschreiben
  });

  it('Firmenkunde: Firma mit Ansprechpartner wird als Geschäftskunde angelegt', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0045.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0045', buyerName: 'Autohaus Becker GmbH', buyerContact: 'Thomas Becker', buyerEmail: 'service@autohaus-becker.example', buyerZip: '57627', buyerCity: 'Hachenburg', buyerStreet: 'Industriestraße 20' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    const c = (await app.inject(as(admin, { url: `/api/customers/${d.import.customerId}` }))).json().customer;
    expect(c).toMatchObject({ type: 'business', companyName: 'Autohaus Becker GmbH', firstName: 'Thomas', lastName: 'Becker' });
  });

  it('mehrdeutiger Kunde: Prüfung nötig, Freigabe mit gewähltem Kunden', async () => {
    for (const city of ['Montabaur', 'Westerburg']) await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Jonas', lastName: 'Klein', city } }));
    const res = await upload(admin, 'outgoing', { name: 'RE0046.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0046', buyerName: 'Jonas Klein', buyerEmail: null, buyerZip: '56410', buyerCity: 'Montabaur' })) });
    const id = res.json().items[0].id;
    const d = await detail(id);
    expect(d.import.status).toBe('needs_review');
    expect(d.candidates.length).toBeGreaterThanOrEqual(2);
    const apply = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${id}/apply`, payload: { data: d.data, customerId: d.candidates[0].id } }));
    expect(apply.statusCode).toBe(200);
    expect(apply.json().import).toMatchObject({ status: 'completed', customerId: d.candidates[0].id, customerCreated: false });
  });

  it('Eingangsrechnung versehentlich bei den Ausgangsrechnungen: wird erkannt und nicht gebucht', async () => {
    const res = await upload(admin, 'outgoing', { name: 'lieferant.xml', type: 'application/xml', data: Buffer.from(ublXml()) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    expect(d.import.error).toContain('Eingangsrechnung');
  });

  it('rechnerisch widersprüchliche E-Rechnung: Prüfung nötig', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0047.xml', type: 'application/xml', data: Buffer.from(ciiXml({ number: 'RE0047', net: '249.00', tax: '10.00', gross: '249.00' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    expect(d.import.error).toContain('Summen passen nicht');
  });

  it('importierte Rechnung stornieren: nur Kennzeichnung, keine neue Rechnungsnummer', async () => {
    const d = await detail(firstImport);
    const before = (await app.inject(as(admin, { url: '/api/invoices' }))).json().total;
    const res = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${d.import.invoiceId}/cancel` }));
    expect(res.statusCode).toBe(200);
    expect(res.json().invoice.status).toBe('cancelled');
    expect((await app.inject(as(admin, { url: '/api/invoices' }))).json().total).toBe(before);
  });

  it('Rückgängig: Rechnung und nur dafür angelegter Kunde werden entfernt, Beleg geht zurück in die Prüfung', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0050.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0050', buyerName: 'Nina Neu', buyerEmail: 'nina@example.de' })) });
    const id = res.json().items[0].id;
    const d = await detail(id);
    expect(d.import.customerCreated).toBe(true);
    const undo = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${id}/undo` }));
    expect(undo.json()).toMatchObject({ ok: true, invoiceRemoved: true, customerRemoved: true });
    expect((await app.inject(as(admin, { url: `/api/invoices/${d.import.invoiceId}` }))).statusCode).toBe(404);
    expect((await app.inject(as(admin, { url: `/api/customers/${d.import.customerId}` }))).statusCode).toBe(404);
    const back = await detail(id);
    expect(back.import.status).toBe('needs_review');
    expect(back.data.number).toBe('RE0050');
    // erneut übernehmen
    const apply = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${id}/apply`, payload: { data: back.data, createCustomer: true } }));
    expect(apply.statusCode).toBe(200);
    expect(apply.json().import.status).toBe('completed');
  });

  it('Rückgängig löscht keine fremden Daten: mit erfasster Zahlung gesperrt; Notizen halten den Kunden', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0051.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0051', buyerName: 'Paul Zahler', buyerEmail: 'paul@example.de' })) });
    const d = await detail(res.json().items[0].id);
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${d.import.invoiceId}/payments`, payload: { amountCents: 5000, method: 'cash' } }));
    const blocked = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/undo` }));
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().message).toContain('Zahlungen');
    const res2 = await upload(admin, 'outgoing', { name: 'RE0052.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0052', buyerName: 'Nora Notiz', buyerEmail: 'nora@example.de' })) });
    const d2 = await detail(res2.json().items[0].id);
    await app.inject(as(admin, { method: 'POST', url: `/api/customers/${d2.import.customerId}/activities`, payload: { type: 'note', content: 'Wichtige Notiz' } }));
    const undo = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d2.import.id}/undo` }));
    expect(undo.json()).toMatchObject({ invoiceRemoved: true, customerRemoved: false });
    expect((await app.inject(as(admin, { url: `/api/customers/${d2.import.customerId}` }))).statusCode).toBe(200);
  });

  it('Firma mit Ansprechpartner wird nie einem Privatkunden gleichen Namens zugeordnet; Kundendaten bleiben unverändert', async () => {
    const priv = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Thomas', lastName: 'Müller' } }))).json().customer;
    const res = await upload(admin, 'outgoing', { name: 'RE0053.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0053', buyerName: 'Weber Logistik GmbH', buyerContact: 'Thomas Müller', buyerEmail: 'info@weber.example', buyerZip: '10115', buyerCity: 'Berlin' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    expect(d.import.customerId).not.toBe(priv.id);
    const after = (await app.inject(as(admin, { url: `/api/customers/${priv.id}` }))).json().customer;
    expect(after).toMatchObject({ type: 'private', companyName: null, email: null, city: null });
  });

  it('Branchenwörter im Firmennamen führen zu keiner Fehlzuordnung („Autohaus Weber“ ≠ „Werkstatt Weber“)', async () => {
    const w = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { type: 'business', companyName: 'Werkstatt Weber', firstName: '', lastName: '' } }))).json().customer;
    const res = await upload(admin, 'outgoing', { name: 'RE0054.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0054', buyerName: 'Autohaus Weber', buyerEmail: null, buyerZip: '57610' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.customerId).not.toBe(w.id);
  });

  it('nur über den Namen erkannter Kunde: Vorschlag zur Bestätigung statt automatischer Zuordnung', async () => {
    const lead = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Sabine', lastName: 'Sommer', phone: '0170 5555555' } }))).json().customer;
    const res = await upload(admin, 'outgoing', { name: 'RE0055.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0055', buyerName: 'Sabine Sommer', buyerEmail: null, buyerZip: '57627', buyerCity: 'Hachenburg' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    expect(d.matchDecision).toBe('uncertain');
    expect(d.suggestedCustomerId).toBe(lead.id);
    const apply = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/apply`, payload: { data: d.data, customerId: lead.id } }));
    expect(apply.json().import).toMatchObject({ status: 'completed', customerId: lead.id });
  });

  it('Storno aus Lexware: Gutschrift mit Verweis verknüpft die Rechnung; der Umsatz wird nicht doppelt gemindert', async () => {
    const before = (await app.inject(as(admin, { url: '/api/finance/overview?period=month&date=2026-09-10' }))).json().revenueNetCents;
    const r1 = await upload(admin, 'outgoing', { name: 'RE0070.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0070', date: '20260910', buyerName: 'Stefan Storno', buyerEmail: 'storno@example.de' })) });
    const inv = (await detail(r1.json().items[0].id)).import;
    expect((await app.inject(as(admin, { url: '/api/finance/overview?period=month&date=2026-09-10' }))).json().revenueNetCents).toBe(before + 24900);
    const r2 = await upload(admin, 'outgoing', { name: 'GS0070.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'GS0070', typeCode: '381', date: '20260912', referenced: 'RE0070', buyerName: 'Stefan Storno', buyerEmail: 'storno@example.de' })) });
    const credit = (await detail(r2.json().items[0].id)).import;
    expect(credit.status).toBe('completed');
    expect(credit.warnings.join(' ')).toContain('Storniert Rechnung RE0070');
    const orig = (await app.inject(as(admin, { url: `/api/invoices/${inv.invoiceId}` }))).json();
    expect(orig.invoice.status).toBe('cancelled');
    expect((await app.inject(as(admin, { url: '/api/finance/overview?period=month&date=2026-09-10' }))).json().revenueNetCents).toBe(before);
  });

  it('interner Storno mindert den Umsatz genau einmal', async () => {
    const c = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Ivo', lastName: 'Intern' } }))).json().customer;
    const today = new Date().toISOString().slice(0, 10);
    const rev = async () => (await app.inject(as(admin, { url: `/api/finance/overview?period=month&date=${today}` }))).json().revenueNetCents as number;
    const base = await rev();
    const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId: c.id, items: [{ name: 'Politur', quantity: 1, unitPriceCents: 10000, vatBp: 0 }] } }))).json().invoice;
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.id}/issue`, payload: {} }));
    expect(await rev()).toBe(base + 10000);
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.id}/cancel`, payload: {} }));
    expect(await rev()).toBe(base);
  });

  it('Rechnungskorrektur (Typ 384) wird nicht automatisch gebucht', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RK0071.xml', type: 'application/xml', data: Buffer.from(ciiXml({ number: 'RK0071', typeCode: '384', buyerName: 'Karl Korrektur', buyerEmail: 'karl@example.de' })) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    expect(d.import.error).toContain('Rechnungskorrektur');
  });
});

describe('Eingangsrechnungen von Händlern hochladen', () => {
  it('XRechnung: Ausgaben je Steuersatz mit Lieferant, Belegnummer, Kategorie und Beleg', async () => {
    const res = await upload(admin, 'incoming', { name: 'LS-2026-0815.xml', type: 'application/xml', data: Buffer.from(ublXml()) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    expect(d.expenses).toHaveLength(2);
    const list = (await app.inject(as(admin, { url: '/api/expenses?q=PflegeProfi' }))).json().items;
    expect(list).toHaveLength(2);
    const e19 = list.find((e: { vatBp: number }) => e.vatBp === 1900);
    expect(e19).toMatchObject({ vendor: 'PflegeProfi Handels GmbH', netCents: 10000, vatCents: 1900, grossCents: 11900, category: 'Material', documentNumber: 'LS-2026-0815', isPaid: false, dueDate: '2026-10-04' });
    expect(e19.receiptFileId).toBeTruthy();
    const total = list.reduce((s: number, e: { grossCents: number }) => s + e.grossCents, 0);
    expect(total).toBe(16027);
  });

  it('dieselbe Lieferantenrechnung als PDF: Dublette, keine doppelte Ausgabe', async () => {
    const res = await upload(admin, 'incoming', { name: 'LS-2026-0815.pdf', type: 'application/pdf', data: zugferdPdf(ublXml(), { name: 'xrechnung.xml' }) });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('duplicate');
    expect((await app.inject(as(admin, { url: '/api/expenses?q=PflegeProfi' }))).json().items).toHaveLength(2);
  });

  it('Foto ohne E-Rechnungsdaten bei ausgeschalteter KI: manuelle Erfassung, danach Übernahme', async () => {
    const img = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const res = await upload(admin, 'incoming', { name: 'kassenbon.jpg', type: 'image/jpeg', data: img });
    const id = res.json().items[0].id;
    const d = await detail(id);
    expect(d.import.status).toBe('needs_review');
    expect(d.import.method).toBe('manual');
    expect(d.import.error).toContain('ausgeschaltet');
    const data = { ...d.data, number: 'Q-1', issueDate: '2026-09-25', grossCents: 2380, netCents: 2000, vatCents: 380, vat: [{ vatBp: 1900, netCents: 2000, vatCents: 380 }], seller: { ...d.data.seller, name: 'Baumarkt Weber' } };
    const apply = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${id}/apply`, payload: { data, category: 'Werkzeug/Ausstattung', markPaid: true } }));
    expect(apply.statusCode).toBe(200);
    const exp = (await app.inject(as(admin, { url: '/api/expenses?q=Baumarkt' }))).json().items[0];
    expect(exp).toMatchObject({ vendor: 'Baumarkt Weber', grossCents: 2380, category: 'Werkzeug/Ausstattung', isPaid: true });
  });

  it('Foto mit KI-Erkennung: Ausgabe automatisch erfasst, Nutzung protokolliert', async () => {
    expect((await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/claude', payload: { apiKey: 'sk-ant-test-1234567890abcdef', model: 'claude-opus-5' } }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'PUT', url: '/api/document-imports/ai', payload: { enabled: true } }))).json()).toEqual({ aiEnabled: true });
    aiExtraction = receiptExtraction();
    const img = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#fafafa' } }).jpeg().toBuffer();
    const res = await upload(admin, 'incoming', { name: 'bon-schmidt.jpg', type: 'image/jpeg', data: img });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('completed');
    expect(d.import.method).toBe('ai');
    const call = aiCalls.at(-1)!;
    expect(call.body.model).toBe('claude-opus-5-5');
    const content = (call.body.messages as Array<{ content: Array<{ type: string; source?: { media_type: string; data: string } }> }>)[0]!.content;
    expect(content[0]!.type).toBe('image');
    const sent = await sharp(Buffer.from(content[0]!.source!.data, 'base64')).metadata();
    expect(Math.max(sent.width!, sent.height!)).toBeLessThanOrEqual(2400); // verkleinert, Text bleibt lesbar
    expect((call.body.output_config as { format: { type: string } }).format.type).toBe('json_schema');
    const exp = (await app.inject(as(admin, { url: '/api/expenses?q=Schmidt' }))).json().items[0];
    expect(exp).toMatchObject({ vendor: 'Autoteile Schmidt e.K.', grossCents: 3500, netCents: 2941, vatCents: 559, category: 'Material', isPaid: true, documentNumber: 'BON-7781' });
    const usage = app.db.select().from(aiUsageLog).all().filter((u) => u.toolsJson.includes('document_recognition'));
    expect(usage).toHaveLength(1);
    expect(usage[0]!.personalData).toBe(true);
  });

  it('KI unsicher (schlecht lesbar): Prüfung statt automatischer Buchung', async () => {
    aiExtraction = receiptExtraction({ invoice_number: 'BON-9000', confidence: 'low', issues: ['Gesamtbetrag teilweise verdeckt'] });
    const res = await upload(admin, 'incoming', { name: 'unscharf.pdf', type: 'application/pdf', data: plainPdf() });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    expect(d.import.warnings.join(' ')).toContain('verdeckt');
    expect((aiCalls.at(-1)!.body.messages as Array<{ content: Array<{ type: string }> }>)[0]!.content[0]!.type).toBe('document');
  });

  it('manuelle Korrektur: Ausgabe wird aus den korrigierten Summen gebucht, nicht aus einer veralteten Steueraufteilung', async () => {
    const img = await sharp({ create: { width: 500, height: 700, channels: 3, background: '#fefefe' } }).jpeg().toBuffer();
    aiExtraction = receiptExtraction({ invoice_number: 'BON-5000', confidence: 'low', issues: ['schwer lesbar'] });
    const res = await upload(admin, 'incoming', { name: 'bon-korrektur.jpg', type: 'image/jpeg', data: img });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('needs_review');
    const data = { ...d.data, netCents: 200000, vatCents: 38000, grossCents: 238000 }; // vat-Aufteilung bleibt alt (29,41 €)
    const apply = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/apply`, payload: { data, markPaid: true } }));
    expect(apply.statusCode).toBe(200);
    const exp = (await app.inject(as(admin, { url: '/api/expenses?q=BON-5000' }))).json().items;
    expect(exp).toHaveLength(1);
    expect(exp[0]).toMatchObject({ netCents: 200000, vatCents: 38000, grossCents: 238000, vatBp: 1900 });
    // mehrere Steuersätze, die nicht zu den Summen passen → klare Fehlermeldung statt Fehlbuchung
    aiExtraction = receiptExtraction({ invoice_number: 'BON-5001', confidence: 'low', issues: ['schwer lesbar'], vat_breakdown: [{ vat_rate_percent: 19, net_amount: 10, vat_amount: 1.9 }, { vat_rate_percent: 7, net_amount: 19.41, vat_amount: 1.36 }], total_vat: 3.26, total_gross: 32.67 });
    const img2 = await sharp({ create: { width: 501, height: 700, channels: 3, background: '#fefefe' } }).jpeg().toBuffer();
    const d2 = await detail((await upload(admin, 'incoming', { name: 'bon-mix.jpg', type: 'image/jpeg', data: img2 })).json().items[0].id);
    const bad = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d2.import.id}/apply`, payload: { data: { ...d2.data, grossCents: 9999, netCents: 8403, vatCents: 1596 } } }));
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toContain('Steuersätzen');
  });

  it('zwei gleiche Kassenbons ohne Nummer: zweiter nach Bestätigung erfassbar', async () => {
    const mk = async (w: number) => (await sharp({ create: { width: w, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer());
    const data = (base: Record<string, unknown>) => ({ ...base, number: null, issueDate: '2026-09-26', netCents: 420, vatCents: 80, grossCents: 500, vat: [{ vatBp: 1900, netCents: 420, vatCents: 80 }], seller: { ...(base.seller as object), name: 'Bäckerei Korn' } });
    for (const [i, w] of [[0, 300], [1, 301]] as const) {
      await app.inject(as(admin, { method: 'PUT', url: '/api/document-imports/ai', payload: { enabled: false } }));
      const d = await detail((await upload(admin, 'incoming', { name: `korn-${i}.jpg`, type: 'image/jpeg', data: await mk(w) })).json().items[0].id);
      const first = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/apply`, payload: { data: data(d.data), markPaid: true } }));
      if (i === 0) { expect(first.statusCode).toBe(200); continue; }
      expect(first.statusCode).toBe(409);
      const again = await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/apply`, payload: { data: data(d.data), markPaid: true, allowDuplicate: true } }));
      expect(again.statusCode).toBe(200);
    }
    expect((await app.inject(as(admin, { url: '/api/expenses?q=Korn' }))).json().items).toHaveLength(2);
    await app.inject(as(admin, { method: 'PUT', url: '/api/document-imports/ai', payload: { enabled: true } }));
  });

  it('Fehler beim Lesen: Beleg bleibt bearbeitbar (Formular, erneut auslesen, verwerfen)', async () => {
    const res = await upload(admin, 'incoming', { name: 'keine-rechnung.xml', type: 'application/xml', data: Buffer.from('<?xml version="1.0"?><Bestellung><Nr>1</Nr></Bestellung>') });
    const d = await detail(res.json().items[0].id);
    expect(d.import.status).toBe('failed');
    expect(d.data).not.toBeNull();
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${d.import.id}/retry` }))).statusCode).toBe(200);
    await app.importQueue.idle();
  });

  it('abgebrochene Verarbeitung: ein Neustart versucht es einmal erneut, danach Fehler statt Endlosschleife', async () => {
    const res = await upload(admin, 'incoming', { name: 'LS-9.xml', type: 'application/xml', data: Buffer.from(ublXml({ number: 'LS-9' })) });
    const id = res.json().items[0].id;
    app.db.update(documentImports).set({ status: 'processing', optionsJson: JSON.stringify({ interrupted: 1 }) }).where(eq(documentImports.id, id)).run();
    app.importQueue.resume();
    await app.importQueue.idle();
    expect((await detail(id)).import.status).toBe('failed');
  });

  it('Verwerfen löscht den unbenutzten Beleg', async () => {
    const list = (await app.inject(as(admin, { url: '/api/document-imports?direction=incoming&status=needs_review' }))).json().items;
    const target = list.find((i: { fileName: string }) => i.fileName === 'unscharf.pdf');
    const fileId = target.fileId;
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/document-imports/${target.id}/discard` }))).statusCode).toBe(200);
    expect(app.db.select().from(files).where(eq(files.id, fileId)).get()).toBeUndefined();
  });
});

describe('Rechte, Mandantentrennung, Datenschutz', () => {
  it('Mitarbeiter ohne Finanz-/Rechnungsrechte darf keine Belege importieren oder sehen', async () => {
    await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'ma@carcura.test', password: 'Mitarbeit3rIn', firstName: 'Mia', lastName: 'K', role: 'employee' } }));
    const cookie = await login(app, 'ma@carcura.test', 'Mitarbeit3rIn');
    const st = (await app.inject(as(cookie, { url: '/api/document-imports/status' }))).json();
    expect(st.canWrite).toEqual([]);
    expect((await app.inject(as(cookie, { url: '/api/document-imports?direction=incoming' }))).statusCode).toBe(403);
    const res = await upload(cookie, 'incoming', { name: 'x.xml', type: 'application/xml', data: Buffer.from(ublXml({ number: 'X-1' })) });
    expect(res.statusCode).toBe(403);
  });

  it('anderer Mandant sieht und ändert keine Importe', async () => {
    const created = await app.inject(as(admin, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'Fremdbetrieb' }, admin: { email: 'chef@fremd.test', password: 'Fremd-Passwort1', firstName: 'F', lastName: 'B' } } }));
    expect(created.statusCode).toBe(200);
    const other = await login(app, 'chef@fremd.test', 'Fremd-Passwort1');
    const mine = app.db.select().from(documentImports).all()[0]!;
    for (const [method, url] of [['GET', `/api/document-imports/${mine.id}`], ['POST', `/api/document-imports/${mine.id}/undo`], ['POST', `/api/document-imports/${mine.id}/discard`], ['POST', `/api/document-imports/${mine.id}/retry`]] as const) {
      expect((await app.inject(as(other, { method, url }))).statusCode).toBe(404);
    }
    expect((await app.inject(as(other, { url: '/api/document-imports?direction=outgoing' }))).json().items).toEqual([]);
  });

  it('Kunde löschen: auch noch nicht zugeordnete Belege mit seinen Daten werden bereinigt', async () => {
    const c = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Petra', lastName: 'Privat', email: 'petra.privat@example.de' } }))).json().customer;
    const res = await upload(admin, 'outgoing', { name: 'RE0080.xml', type: 'application/xml', data: Buffer.from(ciiXml({ number: 'RE0080', typeCode: '384', buyerName: 'Petra Privat', buyerEmail: 'petra.privat@example.de' })) });
    const id = res.json().items[0].id;
    expect((await detail(id)).import.status).toBe('needs_review');
    await app.inject(as(admin, { method: 'POST', url: `/api/customers/${c.id}/anonymize`, payload: {} }));
    expect(app.db.select().from(documentImports).where(eq(documentImports.id, id)).get()!.dataJson).toBeNull();
  });

  it('Kunde löschen: ausgelesene Importdaten werden entfernt, der Rechnungsbeleg bleibt aufbewahrt', async () => {
    const res = await upload(admin, 'outgoing', { name: 'RE0060.pdf', type: 'application/pdf', data: zugferdPdf(ciiXml({ number: 'RE0060', buyerName: 'Daniel Datenschutz', buyerEmail: 'daniel@example.de' })) });
    const d = await detail(res.json().items[0].id);
    const erase = await app.inject(as(admin, { method: 'POST', url: `/api/customers/${d.import.customerId}/anonymize`, payload: {} }));
    expect(erase.statusCode).toBe(200);
    const row = app.db.select().from(documentImports).where(eq(documentImports.id, d.import.id)).get()!;
    expect(row.dataJson).toBeNull();
    expect(row.fileName).toBe('Beleg (anonymisiert)');
    expect(app.db.select().from(files).where(eq(files.id, row.fileId!)).get()).toBeTruthy();
  });
});
