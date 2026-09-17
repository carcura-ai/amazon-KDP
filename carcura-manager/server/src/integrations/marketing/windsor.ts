import { type FetchFn, type AdRow, type WebRow, type SocialRow, type ExternalLead, type DateRange, fetchJson, num, cents, normDate } from './types.js';

export interface WindsorConfig { apiKey: string; googleAdsAccount?: string | null; metaAccount?: string | null; ga4Account?: string | null; instagramAccount?: string | null; leadsAccount?: string | null; retryBaseMs?: number }

/**
 * Windsor ersetzt bei pausiertem oder überzogenem Tarif die Werte durch einen Hinweistext
 * („Uh-oh! These are not your real numbers …“). Solche Zeilen dürfen nie als Kennzahlen landen.
 */
export function planNotice(rows: Array<Record<string, unknown>>): string | null {
  for (const r of rows.slice(0, 5)) {
    for (const v of Object.values(r)) {
      if (typeof v === 'string' && /not your real numbers|reads are paused|upgrade at https:\/\/onboard\.windsor\.ai/i.test(v)) return v.replace(/^Uh-oh!\s*/i, '').trim();
    }
  }
  return null;
}

/**
 * Windsor.ai – ein API-Key für Google Ads, Meta Ads, GA4, Instagram und Meta Lead Ads.
 * Feldnamen wurden gegen die Windsor-Felddefinitionen verifiziert (Stand 2026-09).
 */
export class WindsorAdapter {
  constructor(private readonly cfg: WindsorConfig, private readonly fetchFn: FetchFn = fetch, private readonly baseUrl = 'https://connectors.windsor.ai') {}

  private async query(connector: string, fields: string[], range: DateRange, account?: string | null): Promise<Array<Record<string, unknown>>> {
    const p = new URLSearchParams({ api_key: this.cfg.apiKey, date_from: range.from, date_to: range.to, fields: fields.join(',') });
    if (account) p.set('select_accounts', account);
    const res = await fetchJson<{ data?: unknown[]; result?: unknown[]; error?: string }>(this.fetchFn, `${this.baseUrl}/${connector}?${p.toString()}`, {}, { baseDelayMs: this.cfg.retryBaseMs });
    const rows = (res.data ?? res.result ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) throw new Error(`Unerwartete Antwort von Windsor (${connector}).`);
    const notice = planNotice(rows);
    if (notice) throw new Error(`Windsor liefert keine echten Daten (${connector}): ${notice}`);
    return rows;
  }

  /**
   * Verbindungstest: GA4 plus, falls konfiguriert, Google Ads oder Meta. Bei pausiertem Tarif
   * liefert Windsor für GA4 eine leere Nullzeile, die Sperre steht nur in den Ads-Antworten.
   */
  async test(): Promise<void> {
    const to = new Date().toISOString().slice(0, 10);
    const range = { from: to, to };
    await this.query('googleanalytics4', ['date', 'sessions'], range, this.cfg.ga4Account);
    if (this.cfg.googleAdsAccount) await this.query('google_ads', ['date', 'campaign', 'clicks'], range, this.cfg.googleAdsAccount);
    else if (this.cfg.metaAccount) await this.query('facebook', ['date', 'campaign', 'spend'], range, this.cfg.metaAccount);
  }

  async fetchGoogleAds(range: DateRange): Promise<AdRow[]> {
    const rows = await this.query('google_ads', ['date', 'campaign', 'campaign_id', 'clicks', 'impressions', 'spend', 'conversions', 'conversions_value', 'currency'], range, this.cfg.googleAdsAccount);
    return rows.map((r) => ({ source: 'google_ads', date: normDate(r.date), campaignId: String(r.campaign_id ?? ''), campaignName: String(r.campaign ?? ''), impressions: num(r.impressions), clicks: num(r.clicks), costCents: cents(r.spend), conversions: num(r.conversions), conversionValueCents: cents(r.conversions_value), reach: null, leads: null, currency: String(r.currency ?? 'EUR') }));
  }

  async fetchMetaAds(range: DateRange): Promise<AdRow[]> {
    const rows = await this.query('facebook', ['date', 'campaign', 'campaign_id', 'impressions', 'clicks', 'spend', 'reach', 'actions_lead', 'currency'], range, this.cfg.metaAccount);
    return rows.map((r) => ({ source: 'meta_ads', date: normDate(r.date), campaignId: String(r.campaign_id ?? ''), campaignName: String(r.campaign ?? ''), impressions: num(r.impressions), clicks: num(r.clicks), costCents: cents(r.spend), conversions: num(r.actions_lead), conversionValueCents: 0, reach: r.reach === null || r.reach === undefined ? null : num(r.reach), leads: r.actions_lead === null || r.actions_lead === undefined ? 0 : num(r.actions_lead), currency: String(r.currency ?? 'EUR') }));
  }

  async fetchGa4(range: DateRange): Promise<WebRow[]> {
    const out: WebRow[] = [];
    const dims: Array<[WebRow['dimensionType'], string | null]> = [['total', null], ['channel', 'session_default_channel_group'], ['device', 'devicecategory'], ['landing_page', 'landing_page']];
    for (const [type, dim] of dims) {
      const fields = ['date', 'sessions', 'totalusers', 'conversions', ...(dim ? [dim] : [])];
      const rows = await this.query('googleanalytics4', fields, range, this.cfg.ga4Account);
      for (const r of rows) out.push({ date: normDate(r.date), dimensionType: type, dimensionValue: dim ? String(r[dim] ?? '') : '', sessions: num(r.sessions), users: num(r.totalusers), pageviews: 0, conversions: num(r.conversions) });
    }
    return out;
  }

  async fetchInstagram(range: DateRange): Promise<SocialRow[]> {
    const rows = await this.query('instagram', ['date', 'followers_count', 'reach', 'views', 'likes', 'comments', 'shares'], range, this.cfg.instagramAccount);
    const byDate = new Map<string, SocialRow>();
    for (const r of rows) {
      const date = normDate(r.date);
      const cur = byDate.get(date) ?? { platform: 'instagram', date, followers: null, reach: 0, impressions: null, views: 0, likes: 0, comments: 0, shares: 0 };
      if (r.followers_count !== null && r.followers_count !== undefined) cur.followers = num(r.followers_count);
      cur.reach += num(r.reach); cur.views += num(r.views); cur.likes += num(r.likes); cur.comments += num(r.comments); cur.shares += num(r.shares);
      byDate.set(date, cur);
    }
    return [...byDate.values()];
  }

  async fetchMetaLeads(range: DateRange): Promise<ExternalLead[]> {
    const rows = await this.query('facebook_leads', ['id', 'created_time', 'campaign', 'campaign_id', 'form_name', 'ad_name', 'full_name', 'email', 'phone_number', 'phone', 'vollständiger_name', 'e-mail', 'telefonnummer', 'welche_leistung_interessiert_dich', 'welcheleistunginteressiertdich'], range, this.cfg.leadsAccount);
    return rows.map((r) => ({
      externalId: String(r.id ?? ''),
      createdAt: new Date(String(r.created_time ?? new Date().toISOString())).toISOString(),
      fullName: String(r.full_name ?? r['vollständiger_name'] ?? '').trim(),
      email: (String(r.email ?? r['e-mail'] ?? '').trim() || null),
      phone: (String(r.phone_number ?? r.phone ?? r.telefonnummer ?? '').trim() || null),
      campaign: r.campaign ? String(r.campaign) : null,
      campaignId: r.campaign_id ? String(r.campaign_id) : null,
      formName: r.form_name ? String(r.form_name) : null,
      adName: r.ad_name ? String(r.ad_name) : null,
      message: [r.welche_leistung_interessiert_dich, r.welcheleistunginteressiertdich].filter(Boolean).map(String).join(' ') || null,
    })).filter((l) => l.externalId);
  }
}
