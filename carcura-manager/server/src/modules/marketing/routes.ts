import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { marketingDaily, webAnalyticsDaily, socialDaily, seoDaily, leads, invoices, customers } from '../../db/schema.js';
import { parse, zTrimmed, zOptionalText } from '../../core/validation.js';
import { badRequest } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { MARKETING_TYPES, type MarketingType } from '../../integrations/marketing/sync.js';

const schemas: Record<MarketingType, z.ZodTypeAny> = {
  windsor: z.object({ apiKey: z.string().trim().min(10), googleAdsAccount: zOptionalText(40), metaAccount: zOptionalText(40), ga4Account: zOptionalText(40), instagramAccount: zOptionalText(40), leadsAccount: zOptionalText(40) }),
  google_ads: z.object({ developerToken: z.string().trim().min(5), clientId: z.string().trim().min(5), clientSecret: z.string().trim().min(5), refreshToken: z.string().trim().min(5), customerId: zTrimmed(20).min(5), loginCustomerId: zOptionalText(20) }),
  meta_ads: z.object({ accessToken: z.string().trim().min(10), adAccountId: zTrimmed(30).min(3) }),
  ga4: z.object({ clientEmail: z.string().trim().email(), privateKey: z.string().min(50), propertyId: zTrimmed(40).min(3) }),
  search_console: z.object({ clientEmail: z.string().trim().email(), privateKey: z.string().min(50), siteUrl: zTrimmed(200).min(5) }),
};
const SECRET_KEYS = ['apiKey', 'developerToken', 'clientSecret', 'refreshToken', 'accessToken', 'privateKey'];
const LABEL: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', website: 'Website', manual: 'Manuell', phone: 'Telefon', referral: 'Empfehlung', google_business: 'Google Unternehmensprofil', other: 'Sonstige' };

function isType(t: string): t is MarketingType { return (MARKETING_TYPES as readonly string[]).includes(t); }
function publicOf(config: Record<string, unknown>) { return Object.fromEntries(Object.entries(config).filter(([k]) => !SECRET_KEYS.includes(k))); }

export default async function marketingRoutes(app: FastifyInstance) {
  /* ---------------------------------------------------------- Konfiguration je Typ */
  app.get('/api/integrations/marketing/:type', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { type } = req.params as { type: string };
    if (!isType(type)) throw badRequest('Unbekannter Integrationstyp.');
    const found = app.integrations.get<Record<string, unknown>>(ctx.companyId, type);
    if (!found) return { configured: false };
    return { configured: true, config: publicOf(found.config), hasSecrets: Object.fromEntries(SECRET_KEYS.filter((k) => k in found.config).map((k) => [k, Boolean(found.config[k])])), status: found.row.status, lastError: found.row.lastError, lastSyncAt: found.row.lastSyncAt, isActive: found.row.isActive };
  });

  app.put('/api/integrations/marketing/:type', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { type } = req.params as { type: string };
    if (!isType(type)) throw badRequest('Unbekannter Integrationstyp.');
    const existing = app.integrations.get<Record<string, unknown>>(ctx.companyId, type);
    // Leere Geheimnisse = vorhandene behalten
    const body = { ...(req.body as Record<string, unknown>) };
    for (const k of SECRET_KEYS) if (k in body && !body[k] && existing?.config[k]) body[k] = existing.config[k];
    const config = parse(schemas[type], body) as Record<string, unknown>;
    app.integrations.save(ctx.companyId, type, config, publicOf(config), { windsor: 'Windsor.ai', google_ads: 'Google Ads API', meta_ads: 'Meta Marketing API', ga4: 'Google Analytics 4', search_console: 'Google Search Console' }[type]);
    writeAudit(app.db, ctx, { action: 'integration.saved', entityType: 'integration', entityId: type, after: publicOf(config) });
    return { ok: true };
  });

  app.delete('/api/integrations/marketing/:type', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { type } = req.params as { type: string };
    if (!isType(type)) throw badRequest('Unbekannter Integrationstyp.');
    app.integrations.remove(ctx.companyId, type);
    writeAudit(app.db, ctx, { action: 'integration.removed', entityType: 'integration', entityId: type });
    return { ok: true };
  });

  app.post('/api/integrations/marketing/:type/test', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { type } = req.params as { type: string };
    if (!isType(type)) throw badRequest('Unbekannter Integrationstyp.');
    const found = app.integrations.get<Record<string, unknown>>(ctx.companyId, type);
    if (!found) throw badRequest('Bitte zuerst speichern.');
    try {
      await app.marketing.test(type, found.config);
      app.integrations.setStatus(ctx.companyId, type, 'ok', null);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.integrations.setStatus(ctx.companyId, type, 'error', message);
      throw badRequest(`Verbindung fehlgeschlagen: ${message}`);
    }
  });

  app.post('/api/marketing/sync', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(400).default(30) }), req.body ?? {});
    const results = await app.marketing.syncCompany(ctx.companyId, days);
    writeAudit(app.db, ctx, { action: 'marketing.sync', entityType: 'integration', after: results });
    return { results };
  });

  /* ---------------------------------------------------------- Übersicht */
  app.get('/api/marketing/overview', { preHandler: app.requireAuth('marketing:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
    const to = q.to ?? new Date().toISOString().slice(0, 10);
    const from = q.from ?? new Date(new Date(to).getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
    const dayCount = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
    const prevTo = new Date(new Date(from).getTime() - 86_400_000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(prevTo).getTime() - (dayCount - 1) * 86_400_000).toISOString().slice(0, 10);
    const toExcl = new Date(new Date(to).getTime() + 86_400_000).toISOString().slice(0, 10);
    const prevToExcl = from;
    const cid = ctx.companyId;

    const adsAgg = (f: string, t: string) => app.db.select({ source: marketingDaily.source, impressions: sql<number>`coalesce(sum(${marketingDaily.impressions}),0)`, clicks: sql<number>`coalesce(sum(${marketingDaily.clicks}),0)`, cost: sql<number>`coalesce(sum(${marketingDaily.costCents}),0)`, leads: sql<number>`coalesce(sum(${marketingDaily.leads}),0)`, conversions: sql<number>`coalesce(sum(${marketingDaily.conversions}),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, cid), gte(marketingDaily.date, f), lt(marketingDaily.date, t))).groupBy(marketingDaily.source).all();
    const crmBySource = (f: string, t: string) => app.db.select({ source: leads.source, n: sql<number>`count(*)`, won: sql<number>`sum(case when ${leads.status} in ('won','order') then 1 else 0 end)` }).from(leads).where(and(eq(leads.companyId, cid), gte(leads.createdAt, f), lt(leads.createdAt, t))).groupBy(leads.source).all();
    const revenueBySource = (f: string, t: string) => app.db.select({ source: customers.source, cents: sql<number>`coalesce(sum(${invoices.subtotalCents}),0)` }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).where(and(eq(invoices.companyId, cid), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), lt(invoices.issueDate, t))).groupBy(customers.source).all();

    const cur = adsAgg(from, toExcl); const prev = adsAgg(prevFrom, prevToExcl);
    const crm = crmBySource(from, toExcl); const crmPrev = crmBySource(prevFrom, prevToExcl);
    const rev = revenueBySource(from, toExcl);
    const sources = (['google_ads', 'meta_ads'] as const).map((s) => {
      const a = cur.find((x) => x.source === s); const p = prev.find((x) => x.source === s);
      const c = crm.find((x) => x.source === s); const cp = crmPrev.find((x) => x.source === s);
      const r = rev.find((x) => x.source === s);
      const crmLeads = c?.n ?? 0; const cost = a?.cost ?? 0; const revenue = r?.cents ?? 0;
      return { source: s, label: LABEL[s]!, impressions: a?.impressions ?? 0, clicks: a?.clicks ?? 0, costCents: cost, platformLeads: Math.round(s === 'meta_ads' ? a?.leads ?? 0 : a?.conversions ?? 0), crmLeads, wonLeads: c?.won ?? 0, revenueCents: revenue, costPerLeadCents: crmLeads > 0 && cost > 0 ? Math.round(cost / crmLeads) : null, roas: cost > 0 ? Math.round((revenue / cost) * 100) / 100 : null, ctr: (a?.impressions ?? 0) > 0 ? Math.round(((a?.clicks ?? 0) / (a?.impressions ?? 1)) * 10000) / 100 : null, prev: { costCents: p?.cost ?? 0, crmLeads: cp?.n ?? 0, clicks: p?.clicks ?? 0 } };
    });
    const totalCost = sources.reduce((s, x) => s + x.costCents, 0);
    const totalLeads = crm.reduce((s, x) => s + x.n, 0);
    const totalWon = crm.reduce((s, x) => s + x.won, 0);
    const paidLeads = sources.reduce((s, x) => s + x.crmLeads, 0);
    const paidRevenue = sources.reduce((s, x) => s + x.revenueCents, 0);

    const campaigns = app.db.select({ source: marketingDaily.source, campaignId: marketingDaily.campaignId, campaignName: sql<string>`max(${marketingDaily.campaignName})`, impressions: sql<number>`sum(${marketingDaily.impressions})`, clicks: sql<number>`sum(${marketingDaily.clicks})`, costCents: sql<number>`sum(${marketingDaily.costCents})`, platformLeads: sql<number>`coalesce(sum(coalesce(${marketingDaily.leads}, ${marketingDaily.conversions})),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, cid), gte(marketingDaily.date, from), lt(marketingDaily.date, toExcl))).groupBy(marketingDaily.source, marketingDaily.campaignId).orderBy(sql`6 desc`).limit(50).all();
    const crmByCampaign = app.db.select({ campaign: leads.campaign, n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, cid), gte(leads.createdAt, from), lt(leads.createdAt, toExcl), sql`${leads.campaign} is not null`)).groupBy(leads.campaign).all();
    const campaignRows = campaigns.map((c) => ({ ...c, platformLeads: Math.round(c.platformLeads), crmLeads: crmByCampaign.find((x) => x.campaign === c.campaignName)?.n ?? 0 }));

    // Zeitreihe je Tag
    const costByDay = app.db.select({ date: marketingDaily.date, source: marketingDaily.source, cost: sql<number>`sum(${marketingDaily.costCents})` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, cid), gte(marketingDaily.date, from), lt(marketingDaily.date, toExcl))).groupBy(marketingDaily.date, marketingDaily.source).all();
    const leadsByDay = app.db.select({ date: sql<string>`substr(${leads.createdAt},1,10)`, n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, cid), gte(leads.createdAt, from), lt(leads.createdAt, toExcl))).groupBy(sql`substr(${leads.createdAt},1,10)`).all();
    const sessionsByDay = app.db.select({ date: webAnalyticsDaily.date, s: webAnalyticsDaily.sessions }).from(webAnalyticsDaily).where(and(eq(webAnalyticsDaily.companyId, cid), eq(webAnalyticsDaily.dimensionType, 'total'), gte(webAnalyticsDaily.date, from), lt(webAnalyticsDaily.date, toExcl))).all();
    const series = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(new Date(from).getTime() + i * 86_400_000).toISOString().slice(0, 10);
      series.push({ date: d, googleCostCents: costByDay.find((x) => x.date === d && x.source === 'google_ads')?.cost ?? 0, metaCostCents: costByDay.find((x) => x.date === d && x.source === 'meta_ads')?.cost ?? 0, leads: leadsByDay.find((x) => x.date === d)?.n ?? 0, sessions: sessionsByDay.find((x) => x.date === d)?.s ?? 0 });
    }

    // Website
    const webAgg = (f: string, t: string) => app.db.select({ sessions: sql<number>`coalesce(sum(${webAnalyticsDaily.sessions}),0)`, users: sql<number>`coalesce(sum(${webAnalyticsDaily.users}),0)`, pageviews: sql<number>`coalesce(sum(${webAnalyticsDaily.pageviews}),0)`, conversions: sql<number>`coalesce(sum(${webAnalyticsDaily.conversions}),0)`, n: sql<number>`count(*)` }).from(webAnalyticsDaily).where(and(eq(webAnalyticsDaily.companyId, cid), eq(webAnalyticsDaily.dimensionType, 'total'), gte(webAnalyticsDaily.date, f), lt(webAnalyticsDaily.date, t))).get()!;
    const webDim = (type: string, limit: number) => app.db.select({ name: webAnalyticsDaily.dimensionValue, sessions: sql<number>`sum(${webAnalyticsDaily.sessions})` }).from(webAnalyticsDaily).where(and(eq(webAnalyticsDaily.companyId, cid), eq(webAnalyticsDaily.dimensionType, type), gte(webAnalyticsDaily.date, from), lt(webAnalyticsDaily.date, toExcl))).groupBy(webAnalyticsDaily.dimensionValue).orderBy(sql`2 desc`).limit(limit).all();
    const w = webAgg(from, toExcl); const wp = webAgg(prevFrom, prevToExcl);
    const hasWeb = app.db.select({ n: sql<number>`count(*)` }).from(webAnalyticsDaily).where(eq(webAnalyticsDaily.companyId, cid)).get()!.n > 0;
    const web = hasWeb ? { sessions: w.sessions, users: w.users, pageviews: w.pageviews, conversions: w.conversions, prev: { sessions: wp.sessions, users: wp.users }, channels: webDim('channel', 10), devices: webDim('device', 5), landingPages: webDim('landing_page', 10) } : null;

    // Social
    const socialAgg = (f: string, t: string) => app.db.select({ reach: sql<number>`coalesce(sum(${socialDaily.reach}),0)`, views: sql<number>`coalesce(sum(${socialDaily.views}),0)`, likes: sql<number>`coalesce(sum(${socialDaily.likes}),0)`, comments: sql<number>`coalesce(sum(${socialDaily.comments}),0)`, shares: sql<number>`coalesce(sum(${socialDaily.shares}),0)` }).from(socialDaily).where(and(eq(socialDaily.companyId, cid), eq(socialDaily.platform, 'instagram'), gte(socialDaily.date, f), lt(socialDaily.date, t))).get()!;
    const followersAt = (before: string) => app.db.select({ f: socialDaily.followers }).from(socialDaily).where(and(eq(socialDaily.companyId, cid), eq(socialDaily.platform, 'instagram'), sql`${socialDaily.followers} is not null`, lt(socialDaily.date, before))).orderBy(desc(socialDaily.date)).get()?.f ?? null;
    const hasSocial = app.db.select({ n: sql<number>`count(*)` }).from(socialDaily).where(eq(socialDaily.companyId, cid)).get()!.n > 0;
    const sa = socialAgg(from, toExcl); const sp = socialAgg(prevFrom, prevToExcl);
    const social = hasSocial ? { platform: 'instagram', followers: followersAt(toExcl), followersPrev: followersAt(from), ...sa, prev: { reach: sp.reach, views: sp.views } } : null;

    // SEO
    const seoAgg = (f: string, t: string) => app.db.select({ clicks: sql<number>`coalesce(sum(${seoDaily.clicks}),0)`, impressions: sql<number>`coalesce(sum(${seoDaily.impressions}),0)`, position: sql<number | null>`avg(${seoDaily.position})` }).from(seoDaily).where(and(eq(seoDaily.companyId, cid), eq(seoDaily.dimensionType, 'total'), gte(seoDaily.date, f), lt(seoDaily.date, t))).get()!;
    const hasSeo = app.db.select({ n: sql<number>`count(*)` }).from(seoDaily).where(eq(seoDaily.companyId, cid)).get()!.n > 0;
    const se = seoAgg(from, toExcl); const sep = seoAgg(prevFrom, prevToExcl);
    const seo = hasSeo ? { clicks: se.clicks, impressions: se.impressions, position: se.position === null ? null : Math.round(se.position * 10) / 10, prev: { clicks: sep.clicks, impressions: sep.impressions }, queries: app.db.select({ name: seoDaily.dimensionValue, clicks: seoDaily.clicks, impressions: seoDaily.impressions, position: seoDaily.position }).from(seoDaily).where(and(eq(seoDaily.companyId, cid), eq(seoDaily.dimensionType, 'query'))).orderBy(desc(seoDaily.clicks)).limit(20).all() } : null;

    // Hinweise
    const eur = (c: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c / 100);
    const hints: Array<{ kind: 'fact' | 'calc' | 'estimate' | 'advice'; level: 'info' | 'warn'; text: string }> = [];
    const prevTotalLeads = crmPrev.reduce((s, x) => s + x.n, 0);
    if (prevTotalLeads > 0 && totalLeads !== prevTotalLeads) hints.push({ kind: 'calc', level: totalLeads < prevTotalLeads ? 'warn' : 'info', text: `Leads ${totalLeads > prevTotalLeads ? 'gestiegen' : 'gesunken'}: ${totalLeads} gegenüber ${prevTotalLeads} in der Vorperiode (${Math.round(((totalLeads - prevTotalLeads) / prevTotalLeads) * 100)} %).` });
    for (const s of sources) {
      const prevCpl = s.prev.crmLeads > 0 && s.prev.costCents > 0 ? s.prev.costCents / s.prev.crmLeads : null;
      if (s.costPerLeadCents && prevCpl && s.costPerLeadCents > prevCpl * 1.2) hints.push({ kind: 'calc', level: 'warn', text: `${s.label}: Kosten pro Lead gestiegen auf ${eur(s.costPerLeadCents)} (Vorperiode ${eur(Math.round(prevCpl))}).` });
      if (s.costCents > 0 && s.crmLeads === 0) hints.push({ kind: 'fact', level: 'warn', text: `${s.label}: ${eur(s.costCents)} ausgegeben, aber kein Lead im CRM aus dieser Quelle. Prüfen, ob Leads mit Quelle „${s.label}“ erfasst werden (gclid/Lead-Import).` });
      if (s.roas !== null && s.roas < 1 && s.costCents > 5000) hints.push({ kind: 'calc', level: 'warn', text: `${s.label}: ROAS ${s.roas} – die zugeordneten Umsätze (${eur(s.revenueCents)}) liegen unter den Kosten (${eur(s.costCents)}). Zuordnung erfolgt über die Lead-Quelle der Kunden.` });
    }
    for (const c of campaignRows) {
      const prevRow = app.db.select({ leads: sql<number>`coalesce(sum(coalesce(${marketingDaily.leads}, ${marketingDaily.conversions})),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, cid), eq(marketingDaily.campaignId, c.campaignId), gte(marketingDaily.date, prevFrom), lt(marketingDaily.date, prevToExcl))).get();
      if (prevRow && prevRow.leads >= 2 && c.platformLeads < prevRow.leads * 0.5) hints.push({ kind: 'calc', level: 'warn', text: `Kampagne „${c.campaignName}“ liefert weniger Leads als in der Vorperiode (${c.platformLeads} statt ${Math.round(prevRow.leads)}).` });
    }
    if (web && wp.sessions > 0 && w.sessions > wp.sessions * 1.2 && totalLeads <= prevTotalLeads) hints.push({ kind: 'calc', level: 'info', text: `Website-Besucher sind gestiegen (${w.sessions} Sitzungen, +${Math.round(((w.sessions - wp.sessions) / wp.sessions) * 100)} %), die Anfragen jedoch nicht. Landingpage und Formular auf Hürden prüfen.` });
    if (social && social.followers !== null && social.followersPrev !== null && social.followers !== social.followersPrev) hints.push({ kind: 'fact', level: 'info', text: `Instagram-Follower: ${social.followers} (${social.followers - social.followersPrev >= 0 ? '+' : ''}${social.followers - social.followersPrev} im Zeitraum).` });
    if (totalCost === 0 && totalLeads === 0 && !web) hints.push({ kind: 'fact', level: 'info', text: 'Nicht genügend Daten für eine zuverlässige Aussage. Integrationen unter Einstellungen → Integrationen einrichten und synchronisieren.' });

    const integ = app.integrations.listPublic(cid);
    const lastSync = Object.fromEntries(integ.filter((i) => (MARKETING_TYPES as readonly string[]).includes(i.type)).map((i) => [i.type, { at: i.lastSyncAt, status: i.status, error: i.lastError }]));
    return {
      range: { from, to, label: `${from} – ${to}`, prevFrom, prevTo },
      configured: { ads: integ.some((i) => ['windsor', 'google_ads', 'meta_ads'].includes(i.type)), web: integ.some((i) => ['windsor', 'ga4'].includes(i.type)), social: integ.some((i) => i.type === 'windsor'), seo: integ.some((i) => i.type === 'search_console') },
      lastSync,
      totals: { costCents: totalCost, impressions: sources.reduce((s, x) => s + x.impressions, 0), clicks: sources.reduce((s, x) => s + x.clicks, 0), crmLeads: totalLeads, wonLeads: totalWon, costPerLeadCents: paidLeads > 0 && totalCost > 0 ? Math.round(totalCost / paidLeads) : null, conversionRate: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 1000) / 10 : null, revenueCents: paidRevenue, roas: totalCost > 0 ? Math.round((paidRevenue / totalCost) * 100) / 100 : null },
      sources,
      leadsBySource: crm.map((c) => ({ source: c.source, label: LABEL[c.source] ?? c.source, n: c.n, won: c.won })),
      campaigns: campaignRows,
      series, web, social, seo, hints,
    };
  });
}
