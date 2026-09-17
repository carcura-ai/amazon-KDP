import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { testApp, setupCompany, as, type Session } from './helpers.js';
import { runOverdueCheck } from '../src/jobs/overdue.js';

let app: FastifyInstance;
let admin: Session;
let customerId: string;
let vehicleId: string;
let leadId: string;
const sent: Array<{ to: string; subject: string; attachments?: Array<{ filename: string; content: Buffer }> }> = [];

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  const t = nodemailer.createTransport({ jsonTransport: true });
  const orig = t.sendMail.bind(t);
  t.sendMail = (async (opts: { to: string; subject: string; attachments?: Array<{ filename: string; content: Buffer }> }) => { sent.push({ to: opts.to, subject: opts.subject, attachments: opts.attachments }); return orig({ ...opts, attachments: undefined }); }) as typeof t.sendMail;
  app.mail.transportOverride = t;
  await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { legalName: 'Carcura GbR', street: 'Werkstr. 1', zip: '50667', city: 'Köln', taxNumber: '215/5000/1234', iban: 'DE00 1234 5678 9012 3456 78', bankName: 'Sparkasse', paymentTermsDays: 10 } }));
  leadId = (await app.inject(as(admin, { method: 'POST', url: '/api/leads', payload: { firstName: 'Lena', lastName: 'Lead', email: 'lena@example.de', source: 'website' } }))).json().lead.id;
  const conv = (await app.inject(as(admin, { method: 'POST', url: `/api/leads/${leadId}/convert`, payload: { status: 'contacted' } }))).json();
  customerId = conv.customer.id;
  vehicleId = (await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId, licensePlate: 'K-LL 5', make: 'Tesla', model: 'Model 3' } }))).json().vehicle.id;
});
afterAll(async () => app.close());

describe('Angebote', () => {
  let offerId: string;
  it('erstellt Angebot mit Nummer, Gültigkeit und Summen; Lead-Status folgt', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/offers', payload: { customerId, vehicleId, leadId, title: 'Keramikversiegelung', items: [{ name: 'Keramikversiegelung', quantity: 1, unitPriceCents: 89900, vatBp: 1900 }, { name: 'Vorreinigung', quantity: 1, unitPriceCents: 9900, vatBp: 1900 }] } }));
    expect(res.statusCode).toBe(200);
    offerId = res.json().offer.id;
    expect(res.json().offer.offerNumber).toMatch(/^AN-\d{4}-0001$/);
    expect(res.json().offer.validUntil).toBeTruthy();
    expect(res.json().totals.totalCents).toBe(Math.round(99800 * 1.19));
    expect((await app.inject(as(admin, { url: `/api/leads/${leadId}` }))).json().lead.status).toBe('offer_created');
  });

  it('PDF und E-Mail-Versand mit Anhang, Status wird versendet, PDF in Kundenakte', async () => {
    const pdf = await app.inject(as(admin, { url: `/api/offers/${offerId}/pdf` }));
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    const send = await app.inject(as(admin, { method: 'POST', url: `/api/offers/${offerId}/send`, payload: {} }));
    expect(send.statusCode).toBe(200);
    expect(send.json().offer.status).toBe('sent');
    expect(sent.at(-1)?.to).toBe('lena@example.de');
    expect(sent.at(-1)?.attachments?.[0]?.filename).toMatch(/^AN-.*\.pdf$/);
    expect((await app.inject(as(admin, { url: `/api/leads/${leadId}` }))).json().lead.status).toBe('offer_sent');
    const files = (await app.inject(as(admin, { url: `/api/files?customerId=${customerId}&kind=pdf` }))).json();
    expect(files.items.some((f: { category: string }) => f.category === 'offer')).toBe(true);
  }, 60000);

  it('Annahme → Auftrag mit kopierten Positionen; zweite Umwandlung scheitert', async () => {
    const conv = await app.inject(as(admin, { method: 'POST', url: `/api/offers/${offerId}/convert`, payload: { to: 'order' } }));
    expect(conv.statusCode).toBe(200);
    const order = (await app.inject(as(admin, { url: `/api/orders/${conv.json().orderId}` }))).json();
    expect(order.items).toHaveLength(2);
    expect(order.totals.totalCents).toBe(Math.round(99800 * 1.19));
    expect((await app.inject(as(admin, { url: `/api/offers/${offerId}` }))).json().offer.status).toBe('accepted');
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/offers/${offerId}/convert`, payload: { to: 'order' } }))).statusCode).toBe(409);
    expect((await app.inject(as(admin, { method: 'PATCH', url: `/api/offers/${offerId}`, payload: { title: 'x' } }))).statusCode).toBe(409);
  });
});

describe('Rechnungen', () => {
  let invoiceId: string;
  let orderId: string;
  it('Rechnung aus Auftrag: Entwurf ohne Nummer, Ausstellen vergibt Nummer und Fälligkeit', async () => {
    const order = (await app.inject(as(admin, { method: 'POST', url: '/api/orders', payload: { customerId, vehicleId, title: 'Innenreinigung', status: 'completed', items: [{ name: 'Innenreinigung Intensiv', quantity: 1, unitPriceCents: 18900, vatBp: 1900 }] } }))).json();
    orderId = order.order.id;
    const inv = await app.inject(as(admin, { method: 'POST', url: '/api/invoices/from-order', payload: { orderId } }));
    expect(inv.statusCode).toBe(200);
    invoiceId = inv.json().invoice.id;
    expect(inv.json().invoice.invoiceNumber).toBeNull();
    expect(inv.json().invoice.status).toBe('draft');
    expect(inv.json().totals.totalCents).toBe(22491);
    const issued = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invoiceId}/issue`, payload: {} }));
    expect(issued.statusCode).toBe(200);
    expect(issued.json().invoice.invoiceNumber).toMatch(/^RE-\d{4}-0001$/);
    expect(issued.json().invoice.status).toBe('open');
    const issue = new Date(issued.json().invoice.issueDate);
    const due = new Date(issued.json().invoice.dueDate);
    expect(Math.round((due.getTime() - issue.getTime()) / 86_400_000)).toBe(10);
    expect((await app.inject(as(admin, { method: 'PATCH', url: `/api/invoices/${invoiceId}`, payload: { title: 'x' } }))).statusCode).toBe(409);
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/invoices/from-order', payload: { orderId } }))).statusCode).toBe(409);
  }, 60000);

  it('Versand mit PDF, Teilzahlung und Vollzahlung, Status bezahlt', async () => {
    const send = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invoiceId}/send`, payload: { message: 'Hallo, anbei die Rechnung.' } }));
    expect(send.statusCode).toBe(200);
    expect(send.json().invoice.status).toBe('sent');
    expect(sent.at(-1)?.subject).toMatch(/^Rechnung RE-/);
    const p1 = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invoiceId}/payments`, payload: { amountCents: 10000, method: 'cash' } }));
    expect(p1.statusCode).toBe(200);
    expect(p1.json().invoice.paidCents).toBe(10000);
    expect(p1.json().invoice.status).toBe('sent');
    const p2 = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invoiceId}/payments`, payload: { amountCents: 12491, method: 'transfer' } }));
    expect(p2.json().invoice.status).toBe('paid');
    expect(p2.json().invoice.paidAt).toBeTruthy();
    const tooMuch = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invoiceId}/payments`, payload: { amountCents: 1 } }));
    expect(tooMuch.statusCode).toBe(400);
    const pdf = await app.inject(as(admin, { url: `/api/invoices/${invoiceId}/pdf` }));
    expect(pdf.headers['content-disposition']).toContain('RE-');
  }, 60000);

  it('Überfällig-Job und Statistik', async () => {
    const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId, items: [{ name: 'Politur', quantity: 1, unitPriceCents: 30000, vatBp: 1900 }] } }))).json();
    const issued = (await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.invoice.id}/issue`, payload: { issueDate: '2024-01-10' } }))).json();
    expect(issued.invoice.invoiceNumber).toMatch(/-0002$/);
    expect(issued.invoice.dueDate).toBe('2024-01-20');
    const summary = await runOverdueCheck(app.db);
    expect(summary).toContain('1');
    expect((await app.inject(as(admin, { url: `/api/invoices/${inv.invoice.id}` }))).json().invoice.status).toBe('overdue');
    const stats = (await app.inject(as(admin, { url: '/api/invoices/stats' }))).json();
    expect(stats.openCents).toBe(35700);
    expect(stats.overdueCents).toBe(35700);
    expect(stats.overdueCount).toBe(1);
  }, 60000);

  it('Storno erzeugt Gegenrechnung mit eigener Nummer; Original wird storniert', async () => {
    const list = (await app.inject(as(admin, { url: '/api/invoices?status=overdue' }))).json();
    const target = list.items[0].invoice;
    const storno = await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${target.id}/cancel`, payload: {} }));
    expect(storno.statusCode).toBe(200);
    expect(storno.json().invoice.invoiceNumber).toMatch(/-0003$/);
    expect(storno.json().invoice.totalCents).toBe(-35700);
    expect(storno.json().invoice.cancelsInvoiceId).toBe(target.id);
    const orig = (await app.inject(as(admin, { url: `/api/invoices/${target.id}` }))).json();
    expect(orig.invoice.status).toBe('cancelled');
    expect(orig.invoice.cancelledByInvoiceId).toBe(storno.json().invoice.id);
    const stats = (await app.inject(as(admin, { url: '/api/invoices/stats' }))).json();
    expect(stats.openCents).toBe(0);
    const pdf = await app.inject(as(admin, { url: `/api/invoices/${storno.json().invoice.id}/pdf` }));
    expect(pdf.statusCode).toBe(200);
  }, 60000);

  it('Entwurf kann gelöscht werden, ausgestellte nicht', async () => {
    const draft = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId, items: [{ name: 'Test', quantity: 1, unitPriceCents: 100 }] } }))).json();
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/invoices/${draft.invoice.id}` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/invoices/${invoiceId}` }))).statusCode).toBe(400);
  });
});
