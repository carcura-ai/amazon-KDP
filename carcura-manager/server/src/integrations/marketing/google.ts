import crypto from 'node:crypto';
import { type FetchFn, type AdRow, type WebRow, type SeoRow, type DateRange, fetchJson, num, normDate, IntegrationError } from './types.js';

/** OAuth-Token aus Refresh-Token (Google Ads) */
async function refreshAccessToken(fetchFn: FetchFn, clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' });
  const res = await fetchJson<{ access_token?: string }>(fetchFn, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.access_token) throw new IntegrationError('Google OAuth: kein Access-Token erhalten – Refresh-Token prüfen.');
  return res.access_token;
}

/** Service-Account-Token (GA4, Search Console): signiertes JWT gegen Token-Endpunkt tauschen. */
async function serviceAccountToken(fetchFn: FetchFn, clientEmail: string, privateKey: string, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey.replace(/\\n/g, '\n'), 'base64url');
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` });
  const res = await fetchJson<{ access_token?: string }>(fetchFn, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.access_token) throw new IntegrationError('Service-Account: kein Access-Token erhalten – JSON-Schlüssel prüfen.');
  return res.access_token;
}

export interface GoogleAdsConfig { developerToken: string; clientId: string; clientSecret: string; refreshToken: string; customerId: string; loginCustomerId?: string | null }

export class GoogleAdsAdapter {
  constructor(private readonly cfg: GoogleAdsConfig, private readonly fetchFn: FetchFn = fetch) {}
  private cid() { return this.cfg.customerId.replace(/-/g, ''); }
  async test(): Promise<void> { await this.fetchCampaigns({ from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }); }
  async fetchCampaigns(range: DateRange): Promise<AdRow[]> {
    const token = await refreshAccessToken(this.fetchFn, this.cfg.clientId, this.cfg.clientSecret, this.cfg.refreshToken);
    const query = `SELECT segments.date, campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, customer.currency_code FROM campaign WHERE segments.date BETWEEN '${range.from}' AND '${range.to}' AND metrics.impressions > 0`;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'developer-token': this.cfg.developerToken, 'Content-Type': 'application/json' };
    if (this.cfg.loginCustomerId) headers['login-customer-id'] = this.cfg.loginCustomerId.replace(/-/g, '');
    const out: AdRow[] = [];
    let pageToken: string | undefined;
    do {
      const res = await fetchJson<{ results?: Array<{ segments: { date: string }; campaign: { id: string; name: string }; metrics: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; conversionsValue?: number }; customer?: { currencyCode?: string } }>; nextPageToken?: string }>(this.fetchFn, `https://googleads.googleapis.com/v18/customers/${this.cid()}/googleAds:search`, { method: 'POST', headers, body: JSON.stringify({ query, pageSize: 1000, pageToken }) });
      for (const r of res.results ?? []) out.push({ source: 'google_ads', date: r.segments.date, campaignId: String(r.campaign.id), campaignName: r.campaign.name, impressions: num(r.metrics.impressions), clicks: num(r.metrics.clicks), costCents: Math.round(num(r.metrics.costMicros) / 10_000), conversions: num(r.metrics.conversions), conversionValueCents: Math.round(num(r.metrics.conversionsValue) * 100), reach: null, leads: null, currency: r.customer?.currencyCode ?? 'EUR' });
      pageToken = res.nextPageToken;
    } while (pageToken);
    return out;
  }
}

export interface ServiceAccountConfig { clientEmail: string; privateKey: string }

export class Ga4Adapter {
  constructor(private readonly cfg: ServiceAccountConfig & { propertyId: string }, private readonly fetchFn: FetchFn = fetch) {}
  async test(): Promise<void> { await this.fetch({ from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }); }
  async fetch(range: DateRange): Promise<WebRow[]> {
    const token = await serviceAccountToken(this.fetchFn, this.cfg.clientEmail, this.cfg.privateKey, 'https://www.googleapis.com/auth/analytics.readonly');
    const out: WebRow[] = [];
    const dims: Array<[WebRow['dimensionType'], string | null]> = [['total', null], ['channel', 'sessionDefaultChannelGroup'], ['device', 'deviceCategory'], ['landing_page', 'landingPage']];
    for (const [type, dim] of dims) {
      const body = { dateRanges: [{ startDate: range.from, endDate: range.to }], dimensions: [{ name: 'date' }, ...(dim ? [{ name: dim }] : [])], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'keyEvents' }], limit: 10000 };
      const res = await fetchJson<{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }>(this.fetchFn, `https://analyticsdata.googleapis.com/v1beta/properties/${this.cfg.propertyId.replace(/^properties\//, '')}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      for (const r of res.rows ?? []) out.push({ date: normDate(r.dimensionValues[0]?.value), dimensionType: type, dimensionValue: dim ? r.dimensionValues[1]?.value ?? '' : '', sessions: num(r.metricValues[0]?.value), users: num(r.metricValues[1]?.value), pageviews: num(r.metricValues[2]?.value), conversions: num(r.metricValues[3]?.value) });
    }
    return out;
  }
}

export class SearchConsoleAdapter {
  constructor(private readonly cfg: ServiceAccountConfig & { siteUrl: string }, private readonly fetchFn: FetchFn = fetch) {}
  async test(): Promise<void> { await this.fetch({ from: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }); }
  async fetch(range: DateRange): Promise<SeoRow[]> {
    const token = await serviceAccountToken(this.fetchFn, this.cfg.clientEmail, this.cfg.privateKey, 'https://www.googleapis.com/auth/webmasters.readonly');
    const out: SeoRow[] = [];
    const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.cfg.siteUrl)}/searchAnalytics/query`;
    const run = async (dimensions: string[], rowLimit: number) => fetchJson<{ rows?: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> }>(this.fetchFn, url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: range.from, endDate: range.to, dimensions, rowLimit }) });
    for (const r of (await run(['date'], 1000)).rows ?? []) out.push({ date: r.keys[0]!, dimensionType: 'total', dimensionValue: '', clicks: r.clicks, impressions: r.impressions, position: r.position });
    for (const r of (await run(['query'], 100)).rows ?? []) out.push({ date: range.to, dimensionType: 'query', dimensionValue: r.keys[0]!, clicks: r.clicks, impressions: r.impressions, position: r.position });
    for (const r of (await run(['page'], 50)).rows ?? []) out.push({ date: range.to, dimensionType: 'page', dimensionValue: r.keys[0]!, clicks: r.clicks, impressions: r.impressions, position: r.position });
    return out;
  }
}
