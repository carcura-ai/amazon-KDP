import { type FetchFn, type AdRow, type DateRange, fetchJson, num, cents } from './types.js';

export interface MetaConfig { accessToken: string; adAccountId: string; apiVersion?: string }

/** Meta Marketing API – Kampagnen-Insights je Tag. */
export class MetaAdsAdapter {
  constructor(private readonly cfg: MetaConfig, private readonly fetchFn: FetchFn = fetch) {}
  private base() { return `https://graph.facebook.com/${this.cfg.apiVersion ?? 'v21.0'}`; }
  private act() { return this.cfg.adAccountId.startsWith('act_') ? this.cfg.adAccountId : `act_${this.cfg.adAccountId}`; }
  async test(): Promise<void> {
    await fetchJson(this.fetchFn, `${this.base()}/${this.act()}?fields=name,currency&access_token=${encodeURIComponent(this.cfg.accessToken)}`);
  }
  async fetchCampaigns(range: DateRange): Promise<AdRow[]> {
    const out: AdRow[] = [];
    const p = new URLSearchParams({ level: 'campaign', time_increment: '1', time_range: JSON.stringify({ since: range.from, until: range.to }), fields: 'campaign_id,campaign_name,impressions,clicks,spend,reach,actions,account_currency', limit: '500', access_token: this.cfg.accessToken });
    let url: string | undefined = `${this.base()}/${this.act()}/insights?${p.toString()}`;
    while (url) {
      const res: { data?: Array<Record<string, unknown>>; paging?: { next?: string } } = await fetchJson(this.fetchFn, url);
      for (const r of res.data ?? []) {
        const actions = (r.actions as Array<{ action_type: string; value: string }> | undefined) ?? [];
        const leadAction = actions.find((a) => a.action_type === 'lead') ?? actions.find((a) => a.action_type === 'onsite_conversion.lead_grouped');
        const leads = leadAction ? num(leadAction.value) : 0;
        out.push({ source: 'meta_ads', date: String(r.date_start ?? '').slice(0, 10), campaignId: String(r.campaign_id ?? ''), campaignName: String(r.campaign_name ?? ''), impressions: num(r.impressions), clicks: num(r.clicks), costCents: cents(r.spend), conversions: leads, conversionValueCents: 0, reach: num(r.reach), leads, currency: String(r.account_currency ?? 'EUR') });
      }
      url = res.paging?.next;
    }
    return out;
  }
}
