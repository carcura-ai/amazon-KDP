import { randomUUID } from 'node:crypto';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApiKey } from '../src/core/apikeys.js';
import { companies, documentImports, expenses, flatpayReceipts, invoices, payments, tenantFeatureOverrides } from '../src/db/schema.js';
import { ublXml } from './fixtures/einvoice.js';
import { ADMIN, as, login, multipart, setupCompany, testApp, type Session } from './helpers.js';

const PATH = '/api/document-imports/flatpay';
const date = '2026-11-23';
const account = randomUUID();
const token = 'test-key-from-lexware';
let remote: { id: string; type: string; voucherNumber: string; voucherStatus: string; totalGrossAmount: number } | null = null;
let actualBytes: Buffer | null = null;
let posts = 0;
let uploads = 0;
let visible = false;
let invoiceNumber = '';
const fetchFn: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  expect(url.origin).toBe('https://api.lexware.io');
  expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
  if (url.pathname === '/v1/profile') return Response.json({ organizationId: account, smallBusiness: true });
  if (url.pathname === '/v1/vouchers' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ type: 'salesinvoice', voucherStatus: 'unchecked', totalGrossAmount: 90, totalTaxAmount: 0, useCollectiveContact: true });
    expect(body.remark).toContain('Innenreinigung');
    posts++;
    remote = { id: randomUUID(), type: 'salesinvoice', voucherNumber: body.voucherNumber, voucherStatus: 'unchecked', totalGrossAmount: 90 };
    throw new Error('Timeout nach Verarbeitung in Lexware');
  }
  if (url.pathname === '/v1/vouchers') return Response.json({ content: visible && remote && remote.voucherNumber === url.searchParams.get('voucherNumber') ? [remote] : [] });
  if (url.pathname === '/v1/voucherlist') return Response.json({ content: [{ id: randomUUID(), voucherNumber: invoiceNumber, voucherStatus: 'open', totalAmount: 145 }] });
  if (url.pathname === `/v1/vouchers/${remote?.id}/files` && init?.body instanceof FormData) {
    uploads++;
    const file = init.body.get('file') as File;
    actualBytes = Buffer.from(await file.arrayBuffer());
    if (uploads === 1) return Response.json({}, { status: 503 });
    return Response.json({ id: randomUUID() });
  }
  throw new Error('Unerwartete Lexware-Anfrage');
};

let app: FastifyInstance;
let admin: Session;
let other: Session;
let receiptKey: string;
let mainReceipt: string;
let invoiceReceipt: string;
const request = (options: InjectOptions, session: Session = admin) => app.inject(as(session, options));
const post = async (url: string, payload: object) => {
  const r = await request({ method: 'POST', url, payload });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
};
const photo = (color = '#556600') => sharp({ create: { width: 20, height: 20, channels: 3, background: color } }).jpeg().toBuffer();
const upload = (caption: string, data: Buffer, key?: string) => {
  const form = multipart({ caption, direction: 'flatpay' }, { name: 'Flatpay-Testbon.jpg', type: 'image/jpeg', data });
  return key
    ? app.inject({ method: 'POST', url: '/api/document-imports/whatsapp', ...form, headers: { ...form.headers, authorization: `Bearer ${key}` } })
    : request({ method: 'POST', url: PATH, ...form });
};
const makeOrder = async (model: string, service: string, cents: number) => {
  const customer = (await post('/api/customers', { firstName: 'Lea', lastName: 'Testkundin' })).customer;
  const vehicle = (await post('/api/vehicles', { customerId: customer.id, make: 'VW', model })).vehicle;
  const { order } = await post('/api/orders', { customerId: customer.id, vehicleId: vehicle.id, items: [{ name: service, unitPriceCents: cents, vatBp: 0 }] });
  return order;
};
function enable(companyId: string, active: boolean) {
  app.db.insert(tenantFeatureOverrides).values({ id: randomUUID(), companyId, featureKey: 'LEXWARE', enabled: active })
    .onConflictDoUpdate({ target: [tenantFeatureOverrides.companyId, tenantFeatureOverrides.featureKey], set: { enabled: active } }).run();
}

beforeAll(async () => {
  app = await testApp({ fetchFn });
  admin = await setupCompany(app);
  app.db.update(companies).set({ smallBusiness: true }).where(eq(companies.id, admin.companyId)).run();
  enable(admin.companyId, true);
  const setup = await request({ method: 'PUT', url: PATH + '/settings', payload: { apiKey: token } });
  expect(setup.statusCode, setup.body).toBe(200);
  const { companyId, userId } = await post('/api/platform/companies', { company: { name: 'Glanzwerk', productName: 'Glanz Manager', accentColor: '#335577' }, admin: { email: 'chef@glanzwerk.test', password: 'Glanzwerk-2026', firstName: 'G', lastName: 'W' } });
  other = { companyId, userId, cookie: await login(app, 'chef@glanzwerk.test', 'Glanzwerk-2026') };
  receiptKey = createApiKey(app.db, { companyId: admin.companyId, createdByUserId: admin.userId, name: 'Bot', receiptOnly: true }).key;
});
afterAll(async () => app?.close());

it('verknüpft Golf, 90 Euro und die ursprünglichen Bytes; ein Timeout erzeugt genau einen Erlösbeleg', async () => {
  const order = await makeOrder('Golf', 'Innenreinigung', 9000);
  const bytes = await photo();
  const results = await Promise.all([upload('Golf, Innenreinigung, 90 €', bytes, receiptKey), upload('Golf, Innenreinigung, 90 €', bytes)]);
  expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
  mainReceipt = results[0]!.json().id;
  expect(results[1]!.json().id).toBe(mainReceipt);
  expect(results[0]!.json().message).toContain(order.orderNumber);
  const confirmation = await post(`${PATH}/${mainReceipt}/confirm`, { amountCents: 9000, paidOn: date });
  expect(confirmation.message).toContain('Kartenzahlung erfasst');
  const transfer = () => post(`${PATH}/${mainReceipt}/transfer`, {});
  expect((await transfer()).lexwareState).toBe('checking');
  expect((await request({ method: 'POST', url: `${PATH}/${mainReceipt}/transfer`, payload: {} })).statusCode).toBe(409);
  expect(posts).toBe(1);
  visible = true;
  expect((await transfer()).lexwareState).toBe('attachment_pending');
  expect((await transfer()).lexwareState).toBe('review');
  expect((await transfer()).lexwareState).toBe('review');
  expect(posts).toBe(1);
  expect(uploads).toBe(2);
  expect(actualBytes).toEqual(bytes);
  const row = app.db.select().from(flatpayReceipts).where(eq(flatpayReceipts.id, mainReceipt)).get();
  expect(row).toMatchObject({ orderId: order.id, amountCents: 9000, paidOn: date, service: 'Innenreinigung', lexwareId: remote?.id, lexwareState: 'review', payoutId: null });
  expect(app.db.select().from(invoices).all()).toHaveLength(0);
  expect((await request({ method: 'POST', url: '/api/invoices/from-order', payload: { orderId: order.id } })).statusCode).toBe(409);
});

it('verwendet die bestehende Kundenrechnung und erfasst dieselbe Zahlung nur einmal', async () => {
  const order = await makeOrder('Polo', 'Innen und außen', 14500);
  const invoiceId = randomUUID();
  invoiceNumber = 'RE-TEST-001';
  app.db.insert(invoices).values({ id: invoiceId, companyId: admin.companyId, customerId: order.customerId, orderId: order.id, invoiceNumber, totalCents: 14500, status: 'open' }).run();
  const res = await upload('Polo, Innen und außen, 145,00 €', await photo('#113355'));
  expect(res.statusCode, res.body).toBe(200);
  invoiceReceipt = res.json().id;
  for (let i = 0; i < 2; i++) await post(`${PATH}/${invoiceReceipt}/confirm`, { amountCents: 14500, paidOn: date });
  expect((await post(`${PATH}/${invoiceReceipt}/transfer`, {})).lexwareState).toBe('invoice');
  expect(app.db.select().from(invoices).all()).toHaveLength(1);
  expect(app.db.select().from(payments).all()).toMatchObject([{ invoiceId, amountCents: 14500, method: 'card' }]);
  expect(posts).toBe(1);
});

it('fragt bei mehreren Treffern, fehlendem Treffer und abweichendem Betrag nach', async () => {
  const first = await makeOrder('Tiguan', 'Politur', 34900);
  await makeOrder('Tiguan', 'Politur', 35000);
  for (const [hint, color] of [['Tiguan, Politur, 349 €', '#119947'], ['Panda, Politur, 349 €', '#349905'], ['Golf, Innenreinigung, 91 €', '#490084']] as const) {
    const r = await upload(hint, await photo(color));
    expect(r.json().message).toContain('Welcher Auftrag');
    expect((await request({ method: 'POST', url: `${PATH}/${r.json().id}/confirm`, payload: { amountCents: 9000, paidOn: date } })).statusCode).toBe(400);
    expect((await request({ method: 'POST', url: `${PATH}/${r.json().id}/confirm`, payload: { orderNumber: first.orderNumber, amountCents: 9000, paidOn: date } })).statusCode).toBe(409);
  }
});

it('nutzt den bestehenden Lieferantenimport mit verknüpftem Original und Ausgabe', async () => {
  const form = multipart({ direction: 'incoming' }, { name: 'lieferant.xml', type: 'application/xml', data: Buffer.from(ublXml()) });
  const response = await app.inject({ method: 'POST', url: '/api/document-imports/whatsapp', ...form, headers: { ...form.headers, authorization: `Bearer ${receiptKey}` } });
  expect(response.statusCode, response.body).toBe(200);
  await app.importQueue.idle();
  const row = app.db.select().from(documentImports).where(eq(documentImports.id, response.json().items[0].id)).get()!;
  expect(row.status).toBe('completed');
  expect(JSON.parse(row.dataJson!).seller.name).toBe('PflegeProfi Handels GmbH');
  const linked = app.db.select().from(expenses).where(eq(expenses.receiptFileId, row.fileId!)).all();
  expect(linked.reduce((sum, expense) => sum + expense.grossCents, 0)).toBe(16027);
});

it('ordnet die Sammelauszahlung mit Brutto und echten Gebühren zu, ohne Bankzahlung auszulösen', async () => {
  const report = { reportReference: 'FP-TEST-SAMMEL-1', receiptIds: [mainReceipt, invoiceReceipt], grossCents: 23500, feeCents: 250, netCents: 23250 };
  const wrong = await request({ method: 'POST', url: PATH + '/payouts', payload: { ...report, netCents: 23500 } });
  expect(wrong.statusCode).toBe(409);
  const saved = await post(PATH + '/payouts', report);
  expect(await post(PATH + '/payouts', report)).toEqual(saved);
  expect(saved).toMatchObject(reportWithoutIds(report));
  function reportWithoutIds({ receiptIds: _receiptIds, ...rest }: typeof report) { return rest; }
});

it('isoliert Betrieb, Branding und Schlüssel und behält Belege beim Pausieren', async () => {
  await request({ method: 'PATCH', url: '/api/company', payload: { productName: 'Glanz Manager', accentColor: '#335577' } }, other);
  const identity = await request({ url: '/api/auth/me' }, other);
  expect(identity.json().company.productName).toBe('Glanz Manager');
  const otherKey = createApiKey(app.db, { companyId: other.companyId, createdByUserId: other.userId, name: 'Anderer Bot', receiptOnly: true }).key;
  expect((await request({ url: PATH }, other)).statusCode).toBe(403);
  expect((await upload('Golf, Innenreinigung, 90 €', await photo(), otherKey)).statusCode).toBe(403);
  expect((await app.inject({ url: '/api/orders', headers: { authorization: `Bearer ${receiptKey}` } })).statusCode).toBe(403);
  enable(other.companyId, true);
  expect((await request({ url: PATH }, other)).json()).toMatchObject({ items: [], configured: false });
  expect((await request({ method: 'POST', url: `${PATH}/${mainReceipt}/transfer`, payload: {} }, other)).statusCode).toBe(404);
  enable(admin.companyId, false);
  expect((await request({ url: '/api/document-imports/status' })).json().flatpayEnabled).toBe(false);
  expect((await request({ url: PATH })).statusCode).toBe(403);
  enable(admin.companyId, true);
  expect((await request({ url: PATH })).json().items.some((row: { id: string }) => row.id === mainReceipt)).toBe(true);
});

it('sperrt bestehende Sitzungen, Anmeldung und Programmschlüssel bei deaktiviertem Betrieb', async () => {
  app.db.update(companies).set({ isActive: false }).where(eq(companies.id, admin.companyId)).run();
  expect((await request({ url: '/api/orders' })).statusCode).toBe(401);
  expect((await upload('Golf, Innenreinigung, 90 €', await photo(), receiptKey)).statusCode).toBe(401);
  expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } })).statusCode).toBe(401);
  expect(app.db.select().from(flatpayReceipts).where(and(eq(flatpayReceipts.id, mainReceipt), eq(flatpayReceipts.companyId, admin.companyId))).get()).toBeTruthy();
});

it('verhindert Änderung von Rollenrechten durch Mitarbeitende mit delegierter Benutzerverwaltung', async () => {
  const email = 'mitarbeiter@glanzwerk.test';
  const password = 'Mitarbeiter-2026';
  const roles = await request({ method: 'PUT', url: '/api/company/role-permissions/employee', payload: { permissions: ['users:manage'] } }, other);
  expect(roles.statusCode, roles.body).toBe(200);
  const employee = await request({ method: 'POST', url: '/api/users', payload: { email, password, firstName: 'M', lastName: 'Test', role: 'employee' } }, other);
  expect(employee.statusCode, employee.body).toBe(200);
  const session = await login(app, email, password);
  expect((await app.inject(as(session, { url: '/api/company/role-permissions' }))).statusCode).toBe(200);
  expect((await app.inject(as(session, { method: 'PUT', url: '/api/company/role-permissions/employee', payload: { permissions: ['integrations:manage'] } }))).statusCode).toBe(403);
});
