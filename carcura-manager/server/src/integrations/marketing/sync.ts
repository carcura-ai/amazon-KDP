import { and, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../../db/index.js';
import { marketingDaily, webAnalyticsDaily, socialDaily, seoDaily, leads, companies } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { normalizeEmail, normalizePhone } from '../../core/normalize.js';
import type { IntegrationStore } from '../store.js';
import { WindsorAdapter, type WindsorConfig } from './windsor.js';
import { GoogleAdsAdapter, Ga4Adapter, SearchConsoleAdapter, type GoogleAdsConfig, type ServiceAccountConfig } from './google.js';
import { MetaAdsAdapter, type MetaConfig } from './meta.js';
import type { AdRow, WebRow, SocialRow, SeoRow, ExternalLead, DateRange, FetchFn } from './types.js';
import { logActivity } from '../../modules/crm/activities.js';

export const MARKETING_TYPES = ['windsor', 'google_ads', 'meta_ads', 'ga4', 'search_console'] as const;
export type MarketingType = (typeof MARKETING_TYPES)[number];

export interface SyncResult { type: string; ok: boolean; rows: number; leadsImported?: number; error?: string }

export function rangeDays(days: number, endOffsetDays = 0): DateRange {
  const to = new Date(Date.now() - endOffsetDays * 86_400_000);
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export class MarketingSync {
  constructor(private readonly db: Db, private readonly store: IntegrationStore, private readonly log: FastifyBaseLogger, private readonly fetchFn: FetchFn = fetch) {}

  upsertAds(companyId: string, rows: AdRow[]): number {
    const now = nowIso();
    for (const r of rows) {
      if (!r.date) continue;
      this.db.insert(marketingDaily).values({ id: newId(), companyId, source: r.source, date: r.date, campaignId: r.campaignId || 'unknown', campaignName: r.campaignName, impressions: r.impressions, clicks: r.clicks, costCents: r.costCents, conversions: r.conversions, conversionValueCents: r.conversionValueCents, reach: r.reach, leads: r.leads, currency: r.currency, fetchedAt: now })
        .onConflictDoUpdate({ target: [marketingDaily.companyId, marketingDaily.source, marketingDaily.date, marketingDaily.campaignId], set: { campaignName: r.campaignName, impressions: r.impressions, clicks: r.clicks, costCents: r.costCents, conversions: r.conversions, conversionValueCents: r.conversionValueCents, reach: r.reach, leads: r.leads, currency: r.currency, fetchedAt: now } })
        .run();
    }
    return rows.length;
  }
  upsertWeb(companyId: string, rows: WebRow[]): number {
    const now = nowIso();
    for (const r of rows) {
      if (!r.date) continue;
      this.db.insert(webAnalyticsDaily).values({ id: newId(), companyId, date: r.date, dimensionType: r.dimensionType, dimensionValue: r.dimensionValue, sessions: r.sessions, users: r.users, pageviews: r.pageviews, conversions: r.conversions, fetchedAt: now })
        .onConflictDoUpdate({ target: [webAnalyticsDaily.companyId, webAnalyticsDaily.date, webAnalyticsDaily.dimensionType, webAnalyticsDaily.dimensionValue], set: { sessions: r.sessions, users: r.users, pageviews: r.pageviews, conversions: r.conversions, fetchedAt: now } })
        .run();
    }
    return rows.length;
  }
  upsertSocial(companyId: string, rows: SocialRow[]): number {
    const now = nowIso();
    for (const r of rows) {
      this.db.insert(socialDaily).values({ id: newId(), companyId, platform: r.platform, date: r.date, followers: r.followers, reach: r.reach, impressions: r.impressions, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, fetchedAt: now })
        .onConflictDoUpdate({ target: [socialDaily.companyId, socialDaily.platform, socialDaily.date], set: { followers: sql`coalesce(${r.followers}, ${socialDaily.followers})`, reach: r.reach, impressions: r.impressions, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, fetchedAt: now } })
        .run();
    }
    return rows.length;
  }
  upsertSeo(companyId: string, rows: SeoRow[]): number {
    const now = nowIso();
    // Query-/Seiten-Ranglisten gelten für den Abrufzeitraum → alte Ranglisten desselben Typs ersetzen
    if (rows.some((r) => r.dimensionType !== 'total')) this.db.delete(seoDaily).where(and(eq(seoDaily.companyId, companyId), sql`${seoDaily.dimensionType} != 'total'`)).run();
    for (const r of rows) {
      this.db.insert(seoDaily).values({ id: newId(), companyId, date: r.date, dimensionType: r.dimensionType, dimensionValue: r.dimensionValue, clicks: r.clicks, impressions: r.impressions, position: r.position, fetchedAt: now })
        .onConflictDoUpdate({ target: [seoDaily.companyId, seoDaily.date, seoDaily.dimensionType, seoDaily.dimensionValue], set: { clicks: r.clicks, impressions: r.impressions, position: r.position, fetchedAt: now } })
        .run();
    }
    return rows.length;
  }

  /** Meta-Lead-Ads in das CRM übernehmen (idempotent über externalId). */
  importLeads(companyId: string, list: ExternalLead[]): number {
    let imported = 0;
    for (const l of list) {
      const externalId = `meta:${l.externalId}`;
      const exists = this.db.select({ id: leads.id }).from(leads).where(and(eq(leads.companyId, companyId), eq(leads.externalId, externalId))).get();
      if (exists) continue;
      const parts = l.fullName.split(/\s+/).filter(Boolean);
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      const lastName = parts.length ? parts[parts.length - 1]! : '';
      const id = newId();
      this.db.insert(leads).values({ id, companyId, firstName, lastName, email: l.email, phone: l.phone, source: 'meta_ads', sourceDetail: [l.formName, l.adName].filter(Boolean).join(' · ') || 'Lead Ad', campaign: l.campaign, requestedService: l.message, message: l.message, externalId, normalizedEmail: normalizeEmail(l.email), normalizedPhone: normalizePhone(l.phone), createdAt: l.createdAt, updatedAt: l.createdAt }).run();
      logActivity(this.db, companyId, { leadId: id, type: 'message', direction: 'in', subject: 'Meta Lead Ad (Formular)', content: [l.campaign ? `Kampagne: ${l.campaign}` : null, l.formName ? `Formular: ${l.formName}` : null, l.message].filter(Boolean).join('\n') || null, occurredAt: l.createdAt });
      imported++;
    }
    return imported;
  }

  async syncCompany(companyId: string, days = 7): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const range = rangeDays(days);
    const run = async (type: string, fn: () => Promise<Partial<SyncResult>>) => {
      try {
        const r = await fn();
        this.store.setStatus(companyId, type, 'ok', null, true);
        results.push({ type, ok: true, rows: 0, ...r });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.log.warn({ companyId, type, err: message }, 'Marketing-Sync fehlgeschlagen');
        this.store.setStatus(companyId, type, 'error', message);
        results.push({ type, ok: false, rows: 0, error: message });
      }
    };
    const windsor = this.store.get<WindsorConfig>(companyId, 'windsor');
    if (windsor?.row.isActive) {
      const a = new WindsorAdapter(windsor.config, this.fetchFn);
      await run('windsor', async () => {
        let rows = 0; let leadsImported = 0;
        rows += this.upsertAds(companyId, await a.fetchGoogleAds(range));
        rows += this.upsertAds(companyId, await a.fetchMetaAds(range));
        rows += this.upsertWeb(companyId, await a.fetchGa4(range));
        rows += this.upsertSocial(companyId, await a.fetchInstagram(range));
        leadsImported = this.importLeads(companyId, await a.fetchMetaLeads(rangeDays(Math.max(days, 30))));
        return { rows, leadsImported };
      });
    }
    const gads = this.store.get<GoogleAdsConfig>(companyId, 'google_ads');
    if (gads?.row.isActive) await run('google_ads', async () => ({ rows: this.upsertAds(companyId, await new GoogleAdsAdapter(gads.config, this.fetchFn).fetchCampaigns(range)) }));
    const meta = this.store.get<MetaConfig>(companyId, 'meta_ads');
    if (meta?.row.isActive) await run('meta_ads', async () => ({ rows: this.upsertAds(companyId, await new MetaAdsAdapter(meta.config, this.fetchFn).fetchCampaigns(range)) }));
    const ga4 = this.store.get<ServiceAccountConfig & { propertyId: string }>(companyId, 'ga4');
    if (ga4?.row.isActive) await run('ga4', async () => ({ rows: this.upsertWeb(companyId, await new Ga4Adapter(ga4.config, this.fetchFn).fetch(range)) }));
    const gsc = this.store.get<ServiceAccountConfig & { siteUrl: string }>(companyId, 'search_console');
    if (gsc?.row.isActive) await run('search_console', async () => ({ rows: this.upsertSeo(companyId, await new SearchConsoleAdapter(gsc.config, this.fetchFn).fetch(rangeDays(days, 2))) }));
    return results;
  }

  async syncAll(days = 7): Promise<string> {
    const active = this.db.select({ id: companies.id }).from(companies).where(eq(companies.isActive, true)).all();
    let ok = 0; let failed = 0;
    for (const c of active) for (const r of await this.syncCompany(c.id, days)) r.ok ? ok++ : failed++;
    return `${ok} Sync(s) erfolgreich, ${failed} fehlgeschlagen`;
  }

  async test(type: MarketingType, config: Record<string, unknown>): Promise<void> {
    if (type === 'windsor') return new WindsorAdapter(config as unknown as WindsorConfig, this.fetchFn).test();
    if (type === 'google_ads') return new GoogleAdsAdapter(config as unknown as GoogleAdsConfig, this.fetchFn).test();
    if (type === 'meta_ads') return new MetaAdsAdapter(config as unknown as MetaConfig, this.fetchFn).test();
    if (type === 'ga4') return new Ga4Adapter(config as unknown as ServiceAccountConfig & { propertyId: string }, this.fetchFn).test();
    return new SearchConsoleAdapter(config as unknown as ServiceAccountConfig & { siteUrl: string }, this.fetchFn).test();
  }
}
