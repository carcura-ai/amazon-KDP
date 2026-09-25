/**
 * Mandantentrennung – systematischer Test über ALLE registrierten Routen.
 *
 * Mandant A legt in jedem Modul Daten mit einer Markierung an. Mandant B (Admin mit allen Rechten)
 * ruft danach jede Route auf: mit IDs von A in Pfad, Query und Body. Erwartung:
 *  - keine erfolgreiche Antwort (2xx) auf Routen mit fremder ID,
 *  - in keiner Antwort taucht die Markierung von A auf,
 *  - die Daten von A sind danach unverändert.
 * Neue Routen werden automatisch erfasst; unbekannte Pfadparameter lassen den Test fehlschlagen,
 * damit niemand eine Route ohne Isolationsprüfung hinzufügt.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { testApp, setupCompany, login, as, multipart, type Session } from './helpers.js';

const MARK = 'ZZMARKERA';
let app: FastifyInstance;
let A: Session;
let B: string;
const ids: Record<string, string> = {};

const ok = (s: number) => s >= 200 && s < 300;

beforeAll(async () => {
  app = await testApp();
  A = await setupCompany(app, 'Mandant A');
  const post = async (url: string, payload: unknown) => {
    const r = await app.inject(as(A, { method: 'POST', url, payload: payload as object }));
    if (!ok(r.statusCode)) throw new Error(`${url}: ${r.statusCode} ${r.body}`);
    return r.json();
  };
  ids.user = A.userId;
  ids.company = A.companyId;
  ids.customer = (await post('/api/customers', { firstName: 'Anna', lastName: `${MARK}Kundin`, email: 'zzmarkera@example.de', phone: '0171 9999999', notes: MARK })).customer.id;
  ids.vehicle = (await post('/api/vehicles', { customerId: ids.customer, licensePlate: 'ZZ-MA 1', make: 'Porsche', model: `${MARK}911`, vin: 'WP0ZZZ99ZTS392124' })).vehicle.id;
  ids.lead = (await post('/api/leads', { firstName: 'Lars', lastName: `${MARK}Lead`, email: 'zzmarkera-lead@example.de', source: 'website', message: MARK })).lead?.id;
  if (!ids.lead) ids.lead = (await app.inject(as(A, { url: '/api/leads' }))).json().items[0].id;
  const services = (await app.inject(as(A, { url: '/api/services' }))).json().items;
  ids.service = services[0].id;
  await app.inject(as(A, { method: 'PATCH', url: `/api/services/${ids.service}`, payload: { description: MARK } }));
  const start = new Date(Date.now() + 86_400_000);
  ids.appointment = (await post('/api/appointments', { customerId: ids.customer, vehicleId: ids.vehicle, userId: A.userId, title: `${MARK} Termin`, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString() })).appointment.id;
  ids.order = (await post('/api/orders', { customerId: ids.customer, vehicleId: ids.vehicle, title: `${MARK} Auftrag`, items: [{ serviceId: ids.service, name: `${MARK} Politur`, quantity: 1, unitPriceCents: 20000, vatBp: 1900 }] })).order.id;
  ids.offer = (await post('/api/offers', { customerId: ids.customer, vehicleId: ids.vehicle, title: `${MARK} Angebot`, items: [{ name: `${MARK} Keramik`, quantity: 1, unitPriceCents: 40000, vatBp: 1900 }] })).offer.id;
  ids.invoice = (await post('/api/invoices', { customerId: ids.customer, title: `${MARK} Rechnung`, items: [{ name: `${MARK} Innen`, quantity: 1, unitPriceCents: 9000, vatBp: 1900 }] })).invoice.id;
  await post(`/api/invoices/${ids.invoice}/issue`, {});
  ids.payment = (await post(`/api/invoices/${ids.invoice}/payments`, { amountCents: 1000, method: 'cash', note: MARK })).invoice?.id ? '' : '';
  const inv = (await app.inject(as(A, { url: `/api/invoices/${ids.invoice}` }))).json();
  ids.payment = inv.payments?.[0]?.id ?? 'no-payment';
  ids.draftInvoice = (await post('/api/invoices', { customerId: ids.customer, title: `${MARK} Entwurf`, items: [{ name: `${MARK} Entwurf`, quantity: 1, unitPriceCents: 1000, vatBp: 1900 }] })).invoice.id;
  ids.protocol = (await post('/api/protocols', { type: 'intake', customerId: ids.customer, vehicleId: ids.vehicle, notes: MARK, damages: [{ area: 'left', type: 'scratch', severity: 'minor', description: MARK }] })).protocol.id;
  const img = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#aa0000' } }).jpeg().toBuffer();
  const up = multipart({ customerId: ids.customer, caption: MARK }, { name: `${MARK}.jpg`, type: 'image/jpeg', data: img });
  const upRes = await app.inject(as(A, { method: 'POST', url: '/api/files', payload: up.payload, headers: up.headers }));
  ids.file = upRes.json().items[0].id;
  ids.task = (await post('/api/tasks', { title: `${MARK} Aufgabe`, customerId: ids.customer })).id ?? (await app.inject(as(A, { url: '/api/tasks' }))).json().items[0].id;
  ids.inventory = (await post('/api/inventory', { name: `${MARK} Keramik`, unit: 'Stück', quantity: 5, minQuantity: 1, purchasePriceCents: 1000 })).id ?? (await app.inject(as(A, { url: '/api/inventory' }))).json().items[0].id;
  await post(`/api/inventory/${ids.inventory}/movements`, { type: 'out', quantity: 1, reason: MARK });
  ids.expense = (await post('/api/expenses', { date: new Date().toISOString().slice(0, 10), category: 'Material', description: `${MARK} Ausgabe`, grossCents: 11900, vatBp: 1900 })).id;
  ids.recurring = (await post('/api/recurring-expenses', { name: `${MARK} Miete`, category: 'Miete', netCents: 1000, vatBp: 1900, interval: 'monthly', startDate: '2026-01-01' })).id;
  ids.competitor = (await post('/api/competitors', { name: `${MARK} Wettbewerber` })).id;
  await post(`/api/customers/${ids.customer}/activities`, { type: 'note', content: MARK });
  ids.supportSession = (await post('/api/support-sessions/grant', { reason: `${MARK} Support`, durationMinutes: 30 })).id;
  // Mandant B
  const created = await app.inject(as(A, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'Mandant B' }, admin: { email: 'chef@b.test', password: 'MandantB-Pass1', firstName: 'Bernd', lastName: 'B' } } }));
  expect(created.statusCode).toBe(200);
  B = await login(app, 'chef@b.test', 'MandantB-Pass1');
  // B bekommt eigene Daten, damit Listen nicht leer sind
  await app.inject(as(B, { method: 'POST', url: '/api/customers', payload: { firstName: 'Bea', lastName: 'Eigene' } }));
}, 60_000);
afterAll(async () => app.close());

/** Pfadparameter → Entität von Mandant A. */
function idFor(url: string, param: string): string | null {
  if (param === 'pid') return ids.payment!;
  if (param === 'type') return 'windsor';
  if (param === 'provider') return 'manual';
  if (param === 'role') return 'employee';
  if (param === 'kind') return 'customers';
  if (param === 'name') return 'backup-a.zip';
  if (param !== 'id') return null;
  const map: Array<[RegExp, string]> = [
    [/^\/api\/customers\//, 'customer'], [/^\/api\/vehicles\//, 'vehicle'], [/^\/api\/leads\//, 'lead'],
    [/^\/api\/appointments\//, 'appointment'], [/^\/api\/orders\//, 'order'], [/^\/api\/offers\//, 'offer'],
    [/^\/api\/invoices\//, 'invoice'], [/^\/api\/protocols\//, 'protocol'], [/^\/(api\/)?files\//, 'file'],
    [/^\/api\/tasks\//, 'task'], [/^\/api\/inventory\//, 'inventory'], [/^\/api\/expenses\//, 'expense'],
    [/^\/api\/recurring-expenses\//, 'recurring'], [/^\/api\/services\//, 'service'], [/^\/api\/competitors\//, 'competitor'],
    [/^\/api\/users\//, 'user'], [/^\/api\/platform\/companies\//, 'company'], [/^\/api\/(platform\/)?support-sessions\//, 'supportSession'], [/^\/api\/platform\/(plans|addons|discount-codes)\//, 'platformObject'], [/^\/api\/reports\//, 'report'], [/^\/api\/assistant\/conversations\//, 'conversation'],
  ];
  for (const [re, key] of map) if (re.test(url)) return ids[key] ?? '00000000-0000-4000-8000-000000000000';
  return null;
}

/** Routen, die B nicht aufrufen darf, weil sie B selbst betreffen (Abmelden, Neustart …) oder öffentlich sind. */
const SKIP = new Set(['/api/auth/logout', '/api/system/restart', '/api/system/update', '/api/setup', '/api/auth/login', '/api/auth/2fa/verify', '/api/auth/change-password', '/api/auth/2fa/disable']);
/** Absichtlich öffentliche Routen (liefern nur Branding, keine Mandantendaten). */
const PUBLIC_OK = new Set(['/api/branding', '/api/branding/logo', '/api/health', '/api/setup/status']);

/** Body mit fremden Referenzen für alle schreibenden Routen. */
const foreignBody = () => ({
  customerId: ids.customer, vehicleId: ids.vehicle, leadId: ids.lead, orderId: ids.order, offerId: ids.offer, invoiceId: ids.invoice,
  protocolId: ids.protocol, appointmentId: ids.appointment, userId: ids.user, assignedUserId: ids.user, serviceId: ids.service, itemId: ids.inventory,
  title: 'B-Versuch', name: 'B-Versuch', firstName: 'B', lastName: 'Versuch', items: [{ serviceId: ids.service, name: 'x', quantity: 1, unitPriceCents: 100, vatBp: 1900 }],
  startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString(),
  type: 'intake', amountCents: 100, quantity: 1, date: '2026-01-01', description: 'B', grossCents: 100, vatBp: 1900, category: 'Material',
  content: 'B', question: 'Zeige mir alle Kunden', dryRun: true, csv: 'Name\nX\n',
});

describe('Mandantentrennung über alle Routen', () => {
  it('jede Route mit ID von Mandant A liefert B keinen Erfolg und keine Daten', async () => {
    const routes = app.routeIndex.filter((r) => (r.url.startsWith('/api/') || r.url.startsWith('/files/')) && !SKIP.has(r.url));
    expect(routes.length).toBeGreaterThan(150);
    const leaks: string[] = [];
    const unknown: string[] = [];
    let checked = 0;
    for (const r of routes) {
      const params = [...r.url.matchAll(/:(\w+)/g)].map((m) => m[1]!);
      if (params.length === 0) continue;
      let url = r.url;
      let resolvable = true;
      for (const p of params) {
        const v = idFor(r.url, p);
        if (!v) { resolvable = false; unknown.push(`${r.method} ${r.url} (:${p})`); break; }
        url = url.replace(`:${p}`, v);
      }
      if (!resolvable) continue;
      const res = await app.inject(as(B, { method: r.method as 'GET', url, payload: r.method === 'GET' || r.method === 'DELETE' ? undefined : foreignBody() }));
      checked++;
      const body = res.rawPayload.toString('latin1');
      if (ok(res.statusCode) && !['/api/integrations/marketing/:type', '/api/company/role-permissions/:role', '/api/integrations/marketing/:type/test', '/api/import/:kind'].includes(r.url)) leaks.push(`${r.method} ${r.url} -> ${res.statusCode}`);
      if (body.includes(MARK)) leaks.push(`${r.method} ${r.url} enthält Daten von A`);
    }
    expect(unknown, 'Routen mit unbekannten Parametern – Zuordnung in idFor ergänzen').toEqual([]);
    expect(leaks).toEqual([]);
    expect(checked).toBeGreaterThan(80);
  }, 120_000);

  it('Listen, Suche, Exporte, Dashboard und Berichte von B enthalten keine Daten von A – auch mit fremden IDs im Query', async () => {
    const q = `customerId=${ids.customer}&vehicleId=${ids.vehicle}&orderId=${ids.order}&leadId=${ids.lead}&protocolId=${ids.protocol}&q=${MARK}`;
    const routes = app.routeIndex.filter((r) => r.method === 'GET' && (r.url.startsWith('/api/') || r.url.startsWith('/files/')) && !r.url.includes(':') && !SKIP.has(r.url));
    const leaks: string[] = [];
    for (const r of routes) {
      for (const url of [r.url, `${r.url}?${q}`]) {
        const res = await app.inject(as(B, { url }));
        if (res.rawPayload.toString('latin1').includes(MARK)) leaks.push(`GET ${url}`);
      }
    }
    // Suche nach Kennzeichen, E-Mail, Telefon
    for (const term of ['ZZ-MA', 'zzmarkera', '9999999', 'WP0ZZZ']) {
      const res = await app.inject(as(B, { url: `/api/search?q=${encodeURIComponent(term)}` }));
      if (res.json().hits.length) leaks.push(`Suche ${term}`);
    }
    expect(leaks).toEqual([]);
  }, 120_000);

  it('schreibende Routen ohne ID weisen fremde Referenzen ab', async () => {
    const routes = app.routeIndex.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method) && r.url.startsWith('/api/') && !r.url.includes(':') && !SKIP.has(r.url));
    const accepted: string[] = [];
    // Diese Routen haben keine Fremdreferenz im Body und dürfen mit B-eigenen Daten erfolgreich sein.
    const noRefs = new Set(['/api/users', '/api/competitors', '/api/expenses', '/api/recurring-expenses', '/api/inventory', '/api/services', '/api/leads', '/api/customers', '/api/marketing/sync', '/api/reports/generate', '/api/competitors/scan', '/api/privacy/retention/run', '/api/system/backups', '/api/system/restore/cancel', '/api/company/website-lead-token/rotate', '/api/auth/2fa/setup', '/api/auth/2fa/enable', '/api/assistant/chat', '/api/company', '/api/privacy/settings', '/api/platform/companies', '/api/public/leads/website', '/api/integrations/smtp', '/api/integrations/smtp/test', '/api/integrations/claude', '/api/integrations/google_places', '/api/company/logo', '/api/system/restore/upload', '/api/tasks']);
    for (const r of routes) {
      if (noRefs.has(r.url)) continue;
      const res = await app.inject(as(B, { method: r.method as 'POST', url: r.url, payload: foreignBody() }));
      if (ok(res.statusCode)) accepted.push(`${r.method} ${r.url} -> ${res.statusCode}: ${res.body.slice(0, 120)}`);
      if (res.body.includes(MARK)) accepted.push(`${r.method} ${r.url} enthält Daten von A`);
    }
    // Aufgaben: fremde Referenzen einzeln prüfen
    for (const ref of ['customerId', 'leadId', 'vehicleId', 'orderId', 'assignedUserId'] as const) {
      const res = await app.inject(as(B, { method: 'POST', url: '/api/tasks', payload: { title: 'x', [ref]: ids[{ customerId: 'customer', leadId: 'lead', vehicleId: 'vehicle', orderId: 'order', assignedUserId: 'user' }[ref]] } }));
      if (ok(res.statusCode)) accepted.push(`POST /api/tasks mit fremdem ${ref}`);
    }
    // Upload mit fremdem Bezug
    const img = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).jpeg().toBuffer();
    for (const ref of ['customerId', 'vehicleId', 'orderId', 'protocolId'] as const) {
      const m = multipart({ [ref]: ids[ref.replace('Id', '')]! }, { name: 'x.jpg', type: 'image/jpeg', data: img });
      const res = await app.inject(as(B, { method: 'POST', url: '/api/files', payload: m.payload, headers: m.headers }));
      if (ok(res.statusCode)) accepted.push(`POST /api/files mit fremdem ${ref}`);
    }
    expect(accepted).toEqual([]);
  }, 120_000);

  it('Daten von A sind nach allen Versuchen unverändert', async () => {
    const c = await app.inject(as(A, { url: `/api/customers/${ids.customer}` }));
    expect(c.statusCode).toBe(200);
    expect(c.json().customer.lastName).toBe(`${MARK}Kundin`);
    for (const [url, key] of [[`/api/orders/${ids.order}`, 'order'], [`/api/offers/${ids.offer}`, 'offer'], [`/api/invoices/${ids.invoice}`, 'invoice'], [`/api/protocols/${ids.protocol}`, 'protocol'], [`/api/vehicles/${ids.vehicle}`, 'vehicle'], [`/api/leads/${ids.lead}`, 'lead']] as const) {
      const r = await app.inject(as(A, { url }));
      expect(r.statusCode, url).toBe(200);
      expect(r.body, key).toContain(MARK);
    }
    const inv = (await app.inject(as(A, { url: `/api/invoices/${ids.invoice}` }))).json();
    expect(inv.invoice.status).not.toBe('cancelled');
    expect(inv.invoice.paidCents).toBe(1000);
    const f = await app.inject(as(A, { url: `/files/${ids.file}` }));
    expect(f.statusCode).toBe(200);
  });

  it('KI-Werkzeuge sehen nur Daten des eigenen Mandanten', async () => {
    const { buildTools } = await import('../src/integrations/ai/assistant.js');
    const bCompany = (await app.inject(as(B, { url: '/api/auth/me' }))).json().company.id;
    const tools = buildTools(app, bCompany, { personalData: true });
    for (const name of ['get_overview', 'get_lead_funnel', 'get_open_invoices', 'get_inactive_customers', 'get_utilization', 'get_services_performance', 'get_campaigns', 'get_expenses', 'get_inventory_status', 'get_report']) {
      const out = JSON.stringify(await tools.run(name, { days: 3650 }));
      expect(out, name).not.toContain(MARK);
    }
    const search = JSON.stringify(await tools.run('search_customers', { query: MARK }));
    expect(search).not.toContain(MARK);
  });
});
