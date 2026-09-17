import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { setupCompany, as, type Session } from './helpers.js';

/** Gefälschter Fetch, der Windsor-, Google- und Meta-Antworten in echtem Format liefert. */
const calls: string[] = [];
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
let failNext429 = false;
const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  calls.push(url);
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  if (failNext429) { failNext429 = false; return json({ error: 'rate limited' }, 429, { 'retry-after': '0' }); }
  if (url.includes('connectors.windsor.ai/google_ads')) return json({ data: [{ date: yesterday, campaign: 'Suche Köln', campaign_id: '111', clicks: 40, impressions: 1000, spend: 25.5, conversions: 2, conversions_value: 0, currency: 'EUR' }] });
  if (url.includes('connectors.windsor.ai/facebook_leads')) return json({ data: [{ id: '9001', created_time: `${yesterday}T10:00:00+0000`, campaign: 'Leasingrückgabe', campaign_id: '222', form_name: 'Carcura privat', ad_name: 'Beitrag', full_name: 'Lena Lead', email: 'lena@example.de', phone_number: '+491701234567', welche_leistung_interessiert_dich: 'Innenreinigung' }] });
  if (url.includes('connectors.windsor.ai/facebook')) return json({ data: [{ date: yesterday, campaign: 'Leasingrückgabe', campaign_id: '222', impressions: 500, clicks: 60, spend: 4.92, reach: 400, actions_lead: 1, currency: 'EUR' }, { date: today, campaign: 'Leasingrückgabe', campaign_id: '222', impressions: 100, clicks: 10, spend: 1, reach: 90, actions_lead: null, currency: 'EUR' }] });
  if (url.includes('connectors.windsor.ai/googleanalytics4')) {
    if (url.includes('session_default_channel_group')) return json({ data: [{ date: yesterday, sessions: 5, totalusers: 4, conversions: 0, session_default_channel_group: 'Organic Search' }, { date: yesterday, sessions: 3, totalusers: 3, conversions: 1, session_default_channel_group: 'Direct' }] });
    if (url.includes('devicecategory')) return json({ data: [{ date: yesterday, sessions: 6, totalusers: 5, conversions: 1, devicecategory: 'mobile' }] });
    if (url.includes('landing_page')) return json({ data: [{ date: yesterday, sessions: 8, totalusers: 7, conversions: 1, landing_page: '/' }] });
    return json({ data: [{ date: yesterday, sessions: 8, totalusers: 7, conversions: 1 }] });
  }
  if (url.includes('connectors.windsor.ai/instagram')) return json({ data: [{ date: yesterday, followers_count: null, reach: 162, views: 248, likes: 14, comments: 0, shares: 1 }, { date: today, followers_count: 188, reach: null, views: null, likes: null, comments: null, shares: null }, { date: today, followers_count: null, reach: 39, views: 81, likes: 2, comments: 0, shares: 0 }] });
  if (url.includes('oauth2.googleapis.com/token')) return json({ access_token: 'tok' });
  if (url.includes('googleads.googleapis.com')) { const body = JSON.parse(String(init?.body)); expect(body.query).toContain('FROM campaign'); return json({ results: [{ segments: { date: yesterday }, campaign: { id: '333', name: 'Direkt' }, metrics: { impressions: '200', clicks: '20', costMicros: '12500000', conversions: 1, conversionsValue: 0 }, customer: { currencyCode: 'EUR' } }] }); }
  if (url.includes('graph.facebook.com') && url.includes('/insights')) return json({ data: [{ date_start: yesterday, campaign_id: '444', campaign_name: 'Meta direkt', impressions: '300', clicks: '30', spend: '9.99', reach: '250', actions: [{ action_type: 'lead', value: '3' }], account_currency: 'EUR' }] });
  if (url.includes('graph.facebook.com')) return json({ name: 'Konto', currency: 'EUR' });
  if (url.includes('analyticsdata.googleapis.com')) return json({ rows: [{ dimensionValues: [{ value: yesterday.replace(/-/g, '') }], metricValues: [{ value: '12' }, { value: '10' }, { value: '30' }, { value: '2' }] }] });
  if (url.includes('searchconsole.googleapis.com')) { const body = JSON.parse(String(init?.body)); if (body.dimensions[0] === 'date') return json({ rows: [{ keys: [yesterday], clicks: 7, impressions: 300, position: 12.4 }] }); if (body.dimensions[0] === 'query') return json({ rows: [{ keys: ['fahrzeugaufbereitung köln'], clicks: 5, impressions: 120, position: 4.2 }] }); return json({ rows: [{ keys: ['https://example.de/'], clicks: 6, impressions: 200, position: 8 }] }); }
  return json({ error: 'unbekannt' }, 404);
};

let app: FastifyInstance;
let admin: Session;
beforeAll(async () => {
  const dataDir = `/tmp/cm-test/mk-${process.pid}`;
  const config = loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', chromiumPath: '/opt/pw-browsers/chromium' });
  app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false, fetchFn: fakeFetch });
  admin = await setupCompany(app);
});
afterAll(async () => app.close());

describe('Marketing-Integrationen', () => {
  it('speichert Windsor verschlüsselt, Test mit Retry bei 429, Sync importiert Ads, Web, Social und Meta-Leads', async () => {
    const put = await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/marketing/windsor', payload: { apiKey: 'windsor-test-key-1234', ga4Account: '548650753' } }));
    expect(put.statusCode).toBe(200);
    const get = (await app.inject(as(admin, { url: '/api/integrations/marketing/windsor' }))).json();
    expect(get.config.apiKey).toBeUndefined();
    expect(get.hasSecrets.apiKey).toBe(true);
    failNext429 = true;
    const test = await app.inject(as(admin, { method: 'POST', url: '/api/integrations/marketing/windsor/test' }));
    expect(test.statusCode).toBe(200);
    const sync = await app.inject(as(admin, { method: 'POST', url: '/api/marketing/sync', payload: { days: 7 } }));
    expect(sync.statusCode).toBe(200);
    const r = sync.json().results.find((x: { type: string }) => x.type === 'windsor');
    expect(r.ok).toBe(true);
    expect(r.rows).toBeGreaterThan(5);
    expect(r.leadsImported).toBe(1);
    const leads = (await app.inject(as(admin, { url: '/api/leads?source=meta_ads' }))).json();
    expect(leads.total).toBe(1);
    expect(leads.items[0].firstName).toBe('Lena');
    expect(leads.items[0].campaign).toBe('Leasingrückgabe');
    expect(leads.items[0].requestedService).toBe('Innenreinigung');
    // erneuter Sync legt den Lead nicht doppelt an
    await app.inject(as(admin, { method: 'POST', url: '/api/marketing/sync', payload: { days: 7 } }));
    expect((await app.inject(as(admin, { url: '/api/leads?source=meta_ads' }))).json().total).toBe(1);
  });

  it('Übersicht berechnet Kosten, Kosten pro Lead, Website-, Social-Kennzahlen und Hinweise', async () => {
    const ov = (await app.inject(as(admin, { url: '/api/marketing/overview' }))).json();
    expect(ov.totals.costCents).toBe(2550 + 492 + 100);
    const meta = ov.sources.find((s: { source: string }) => s.source === 'meta_ads');
    expect(meta.crmLeads).toBe(1);
    expect(meta.platformLeads).toBe(1);
    expect(meta.costPerLeadCents).toBe(592);
    const google = ov.sources.find((s: { source: string }) => s.source === 'google_ads');
    expect(google.crmLeads).toBe(0);
    expect(ov.hints.some((h: { text: string }) => h.text.includes('Google Ads') && h.text.includes('kein Lead'))).toBe(true);
    expect(ov.web.sessions).toBe(8);
    expect(ov.web.channels[0].name).toBe('Organic Search');
    expect(ov.social.followers).toBe(188);
    expect(ov.social.reach).toBe(162 + 39);
    expect(ov.campaigns.find((c: { campaignId: string }) => c.campaignId === '222').crmLeads).toBe(1);
    expect(ov.series.length).toBe(30);
    expect(ov.lastSync.windsor.status).toBe('ok');
  });

  it('direkte Adapter: Google Ads, Meta, GA4, Search Console', async () => {
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/marketing/google_ads', payload: { developerToken: 'dev-token', clientId: 'client-id', clientSecret: 'client-secret', refreshToken: 'refresh-token', customerId: '919-151-5213' } }));
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/marketing/meta_ads', payload: { accessToken: 'meta-token-1234', adAccountId: '4466807416930043' } }));
    const key = '-----BEGIN PRIVATE KEY-----\n' + 'x'.repeat(60) + '\n-----END PRIVATE KEY-----';
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/marketing/ga4', payload: { clientEmail: 'sa@project.iam.gserviceaccount.com', privateKey: key, propertyId: '548650753' } }));
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/marketing/search_console', payload: { clientEmail: 'sa@project.iam.gserviceaccount.com', privateKey: key, siteUrl: 'https://carcura.info/' } }));
    const gtest = await app.inject(as(admin, { method: 'POST', url: '/api/integrations/marketing/meta_ads/test' }));
    expect(gtest.statusCode).toBe(200);
    const sync = (await app.inject(as(admin, { method: 'POST', url: '/api/marketing/sync', payload: { days: 3 } }))).json();
    const byType = Object.fromEntries(sync.results.map((r: { type: string; ok: boolean; error?: string }) => [r.type, r]));
    expect(byType.google_ads.ok).toBe(true);
    expect(byType.meta_ads.ok).toBe(true);
    // GA4/GSC scheitern erwartungsgemäß am Dummy-Schlüssel (RSA-Signatur), Fehler wird sauber gemeldet
    expect(byType.ga4.ok).toBe(false);
    expect(byType.ga4.error).toBeTruthy();
    const ov = (await app.inject(as(admin, { url: '/api/marketing/overview' }))).json();
    expect(ov.campaigns.some((c: { campaignName: string }) => c.campaignName === 'Meta direkt')).toBe(true);
    expect(ov.lastSync.ga4.status).toBe('error');
  });

  it('Mandant ohne Berechtigung sieht keine Konfiguration', async () => {
    await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'mit@carcura.test', password: 'Mitarbeit3rIn', firstName: 'Mia', lastName: 'K', role: 'employee' } }));
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'mit@carcura.test', password: 'Mitarbeit3rIn' } });
    const cookie = `cm_sid=${login.cookies[0]!.value}`;
    expect((await app.inject({ url: '/api/integrations/marketing/windsor', headers: { cookie } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/marketing/overview', headers: { cookie } })).statusCode).toBe(403);
  });
});
