import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { ManualProvider, SignedWebhookProvider } from '../src/integrations/payments/provider.js';
import { tenantSubscriptions } from '../src/db/schema.js';
import { runSubscriptionLifecycle } from '../src/core/subscriptions.js';
import { setupCompany, login, as, testApp, type Session } from './helpers.js';

const SECRET = 'webhook-secret-webhook-secret-webhook-secret-1234';
let app: FastifyInstance;
let sys: Session;
let b: string;
let bId: string;

beforeAll(async () => {
  const dataDir = `/tmp/cm-test/saas-sub-${process.pid}`;
  const config = loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', deploymentMode: 'saas', chromiumPath: '/opt/pw-browsers/chromium' });
  app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false, exitFn: () => undefined, payments: new Map([['manual', new ManualProvider()], ['signed', new SignedWebhookProvider(SECRET)]]) });
  sys = await setupCompany(app, 'Carcura Betreiber');
  // Im SaaS-Modus braucht der System-Admin 2FA – für den Test direkt als aktiviert markieren
  app.dbHandle.sqlite.exec(`update users set totp_enabled_at = '2026-01-01T00:00:00Z', totp_secret_enc = 'x' where id = '${sys.userId}'`);
  // Login mit 2FA wäre nötig; die bestehende Sitzung bleibt gültig
  const created = await app.inject(as(sys, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'Glanzwerk' }, admin: { email: 'chef@glanzwerk.test', password: 'Glanzwerk-2026', firstName: 'G', lastName: 'W' }, planCode: 'START' } }));
  expect(created.statusCode).toBe(200);
  bId = created.json().companyId;
  b = await login(app, 'chef@glanzwerk.test', 'Glanzwerk-2026');
});
afterAll(async () => app.close());

describe('Tarife und Module', () => {
  it('neuer Mandant startet mit Testphase im gewählten Tarif; Betreiber-Mandant ohne Abo hat alle Module', async () => {
    const s = (await app.inject(as(b, { url: '/api/subscription' }))).json();
    expect(s.plan.code).toBe('START');
    expect(s.status).toBe('trial');
    expect(s.features).toContain('INVOICES');
    expect(s.features).not.toContain('CRM_LEADS');
    const me = (await app.inject(as(sys, { url: '/api/auth/me' }))).json();
    expect(me.entitlements.source).toBe('legacy');
    expect(me.entitlements.features).toContain('AI_ASSISTANT');
  });

  it('nicht gebuchte Module sind serverseitig gesperrt, Kernfunktionen frei', async () => {
    const leads = await app.inject(as(b, { url: '/api/leads' }));
    expect(leads.statusCode).toBe(402);
    expect(leads.json().error).toBe('feature_not_included');
    expect((await app.inject(as(b, { url: '/api/inventory' }))).statusCode).toBe(402);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/assistant/chat', payload: { question: 'x' } }))).statusCode).toBe(402);
    expect((await app.inject(as(b, { url: '/api/customers' }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'PATCH', url: '/api/company', payload: { productName: 'Mein System' } }))).statusCode).toBe(402);
  });

  it('Upgrade schaltet frei; Downgrade sperrt, löscht aber keine Daten', async () => {
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'BUSINESS' } }))).json().effective).toBe('now');
    const lead = await app.inject(as(b, { method: 'POST', url: '/api/leads', payload: { firstName: 'Lena', lastName: 'Lead', source: 'phone' } }));
    expect(lead.statusCode).toBe(200);
    await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'START' } }));
    expect((await app.inject(as(b, { url: '/api/leads' }))).statusCode).toBe(402);
    await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'BUSINESS' } }));
    const list = (await app.inject(as(b, { url: '/api/leads' }))).json();
    expect(list.items.map((l: { lastName: string }) => l.lastName)).toContain('Lead');
  });

  it('Freischaltung einzelner Module durch den Betreiber und Benutzerlimit', async () => {
    expect((await app.inject(as(b, { url: '/api/assistant/status' }))).statusCode).toBe(402);
    expect((await app.inject(as(sys, { method: 'PUT', url: `/api/platform/companies/${bId}/features`, payload: { featureKey: 'AI_ASSISTANT', enabled: true, reason: 'Pilotkunde' } }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { url: '/api/assistant/status' }))).statusCode).toBe(200);
    await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'START' } })); // max. 2 Benutzer
    expect((await app.inject(as(b, { method: 'POST', url: '/api/users', payload: { email: 'm1@glanzwerk.test', password: 'Mitarbeit3r-Pass', firstName: 'M', lastName: '1' } }))).statusCode).toBe(200);
    const third = await app.inject(as(b, { method: 'POST', url: '/api/users', payload: { email: 'm2@glanzwerk.test', password: 'Mitarbeit3r-Pass', firstName: 'M', lastName: '2' } }));
    expect(third.statusCode).toBe(402);
    expect(third.json().error).toBe('user_limit');
    expect((await app.inject(as(sys, { method: 'PUT', url: `/api/platform/companies/${bId}/addons`, payload: { addonCode: 'EXTRA_USER', quantity: 1 } }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/users', payload: { email: 'm2@glanzwerk.test', password: 'Mitarbeit3r-Pass', firstName: 'M', lastName: '2' } }))).statusCode).toBe(200);
    // Downgrade unter die aktuelle Benutzerzahl wird abgelehnt
    await app.inject(as(sys, { method: 'PUT', url: `/api/platform/companies/${bId}/addons`, payload: { addonCode: 'EXTRA_USER', quantity: 0 } }));
    await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'BUSINESS' } }));
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'START' } }))).statusCode).toBe(400);
  });
});

describe('Kündigung und Vertragsende', () => {
  it('Kündigung braucht Bestätigung, gilt zum Periodenende und lässt sich zurücknehmen', async () => {
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/cancel', payload: {} }))).statusCode).toBe(400);
    const c = await app.inject(as(b, { method: 'POST', url: '/api/subscription/cancel', payload: { confirm: true, reason: 'Test' } }));
    expect(c.statusCode).toBe(200);
    expect(c.json().cancellationDate).toBeTruthy();
    expect((await app.inject(as(b, { method: 'POST', url: '/api/customers', payload: { firstName: 'Noch', lastName: 'Aktiv' } }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/reactivate' }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { url: '/api/subscription' }))).json().status).toBe('trial');
  });

  it('nach Vertragsende: Lesen und Export möglich, Ändern gesperrt – Daten bleiben erhalten', async () => {
    await app.inject(as(b, { method: 'POST', url: '/api/subscription/cancel', payload: { confirm: true } }));
    app.db.update(tenantSubscriptions).set({ cancellationDate: '2026-01-01T00:00:00.000Z', trialEnd: '2026-01-01T00:00:00.000Z' }).where(eq(tenantSubscriptions.companyId, bId)).run();
    expect(runSubscriptionLifecycle(app.db)).toMatch(/1 abgelaufen/);
    expect((await app.inject(as(b, { url: '/api/subscription' }))).json().status).toBe('expired');
    const blocked = await app.inject(as(b, { method: 'POST', url: '/api/customers', payload: { firstName: 'Zu', lastName: 'Spät' } }));
    expect(blocked.statusCode).toBe(402);
    expect(blocked.json().error).toBe('subscription_inactive');
    const customers = (await app.inject(as(b, { url: '/api/customers' }))).json();
    expect(customers.total).toBeGreaterThan(0);
    expect((await app.inject(as(b, { url: '/api/export/customers.csv' }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/reactivate' }))).statusCode).toBe(409);
  });
});

describe('Betreiber: Freischaltung, Rabatt, Kennzahlen, Webhooks', () => {
  it('keine Umsatzkennzahl ohne zahlende Abos; nach Freischaltung und Rabatt korrekte MRR', async () => {
    const m0 = (await app.inject(as(sys, { url: '/api/platform/metrics' }))).json();
    expect(m0.mrrCents).toBeNull();
    await app.inject(as(sys, { method: 'PUT', url: `/api/platform/companies/${bId}/subscription`, payload: { planCode: 'BUSINESS', status: 'active', billingInterval: 'monthly', cancellationDate: null, nextBillingDate: new Date(Date.now() + 20 * 86_400_000).toISOString(), paymentProvider: 'signed', externalSubscriptionId: 'sub_123' } }));
    app.db.update(tenantSubscriptions).set({ cancelAtPeriodEnd: false, cancelledAt: null }).where(eq(tenantSubscriptions.companyId, bId)).run();
    expect((await app.inject(as(sys, { method: 'POST', url: '/api/platform/discount-codes', payload: { code: 'start20', percentOff: 20, durationMonths: 3 } }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/discount', payload: { code: 'START20' } }))).statusCode).toBe(200);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/subscription/discount', payload: { code: 'START20' } }))).statusCode).toBe(409);
    const m1 = (await app.inject(as(sys, { url: '/api/platform/metrics' }))).json();
    expect(m1.mrrCents).toBe(Math.round(5900 * 0.8));
    expect(m1.arrCents).toBe(Math.round(5900 * 0.8) * 12);
    expect((await app.inject(as(b, { method: 'POST', url: '/api/customers', payload: { firstName: 'Wieder', lastName: 'Aktiv' } }))).statusCode).toBe(200);
  });

  it('Webhooks: Signatur, Zeitfenster und Idempotenz', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'invoice.payment_failed', externalSubscriptionId: 'sub_123' });
    const send = (sig: string, payload = body) => app.inject({ method: 'POST', url: '/api/webhooks/payments/signed', payload, headers: { 'content-type': 'application/json', 'x-carcura-signature': sig } });
    expect((await send('t=1,v1=00')).statusCode).toBe(401);
    expect((await send(SignedWebhookProvider.sign(SECRET, body, Math.floor(Date.now() / 1000) - 3600))).statusCode).toBe(401);
    expect((await send(SignedWebhookProvider.sign('falsches-geheimnis-falsches-geheimnis-123', body))).statusCode).toBe(401);
    const ok = await send(SignedWebhookProvider.sign(SECRET, body));
    expect(ok.statusCode).toBe(200);
    expect((await app.inject(as(b, { url: '/api/subscription' }))).json().status).toBe('past_due');
    const again = await send(SignedWebhookProvider.sign(SECRET, body));
    expect(again.json().duplicate).toBe(true);
    const paid = JSON.stringify({ id: 'evt_2', type: 'invoice.paid', externalSubscriptionId: 'sub_123' });
    await send(SignedWebhookProvider.sign(SECRET, paid), paid);
    expect((await app.inject(as(b, { url: '/api/subscription' }))).json().status).toBe('active');
    expect((await app.inject({ method: 'POST', url: '/api/webhooks/payments/manual', payload: body, headers: { 'content-type': 'application/json' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/webhooks/payments/unbekannt', payload: body, headers: { 'content-type': 'application/json' } })).statusCode).toBe(404);
  });

  it('Mandanten sehen keine Betreiberdaten', async () => {
    expect((await app.inject(as(b, { url: '/api/platform/metrics' }))).statusCode).toBe(403);
    expect((await app.inject(as(b, { url: '/api/platform/plans' }))).statusCode).toBe(403);
  });
});

describe('Self-Hosted', () => {
  it('alle Module frei, Abo-Änderungen nicht vorgesehen', async () => {
    const self = await testApp();
    const s = await setupCompany(self);
    const sub = (await self.inject(as(s, { url: '/api/subscription' }))).json();
    expect(sub.mode).toBe('selfhosted');
    expect(sub.features).toContain('AI_ASSISTANT');
    expect((await self.inject(as(s, { method: 'POST', url: '/api/subscription/change', payload: { planCode: 'PRO' } }))).statusCode).toBe(409);
    await self.close();
  });
});
