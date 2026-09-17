import fs from 'node:fs';
import { and, eq, gte, lt, sql, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { leads, customers, orders, invoices, expenses, appointments, marketingDaily, webAnalyticsDaily, socialDaily, inventoryItems, competitors, competitorSnapshots, reports, companies, users } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { pricingAnalysis } from '../analysis/pricing.js';
import { documentShell, documentFooter, esc, money, dateDe } from '../../integrations/pdf-templates.js';

export type ReportType = 'weekly' | 'monthly' | 'yearly';
export interface Metric { label: string; value: number; prev: number; unit: 'eur' | 'n' | 'pct' }
export interface Section { title: string; metrics: Metric[]; facts: string[]; changes: string[]; reasons: string[]; actions: string[]; table?: { head: string[]; rows: string[][] } }
export interface ReportContent { type: ReportType; period: { from: string; to: string; label: string; prevFrom: string; prevTo: string }; sections: Section[]; summary: string; months?: Array<{ label: string; revenueCents: number; expensesCents: number; leads: number; orders: number }>; generatedAt: string }

const eur = (c: number) => money(c);
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const chg = (label: string, cur: number, prev: number, fmt: (n: number) => string): string | null => { const p = pct(cur, prev); if (p === null) return prev === 0 && cur > 0 ? `${label}: ${fmt(cur)} (Vorperiode: keine).` : null; if (Math.abs(p) < 5) return null; return `${label} ${p > 0 ? 'gestiegen' : 'gesunken'}: ${fmt(cur)} gegenüber ${fmt(prev)} (${p > 0 ? '+' : ''}${p} %).`; };

export function periodFor(type: ReportType, ref = new Date()): ReportContent['period'] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  if (type === 'weekly') {
    const dow = (d.getUTCDay() + 6) % 7; const thisMon = new Date(d); thisMon.setUTCDate(d.getUTCDate() - dow);
    const from = new Date(thisMon); from.setUTCDate(thisMon.getUTCDate() - 7); const to = new Date(thisMon); to.setUTCDate(thisMon.getUTCDate() - 1);
    const pf = new Date(from); pf.setUTCDate(from.getUTCDate() - 7); const pt = new Date(from); pt.setUTCDate(from.getUTCDate() - 1);
    return { from: iso(from), to: iso(to), label: `Woche ${iso(from)} – ${iso(to)}`, prevFrom: iso(pf), prevTo: iso(pt) };
  }
  if (type === 'monthly') {
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    const pf = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1)); const pt = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0));
    return { from: iso(from), to: iso(to), label: from.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }), prevFrom: iso(pf), prevTo: iso(pt) };
  }
  const y = d.getUTCMonth() === 0 && d.getUTCDate() < 8 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jahr ${y}`, prevFrom: `${y - 1}-01-01`, prevTo: `${y - 1}-12-31` };
}

export function buildReport(app: FastifyInstance, companyId: string, type: ReportType, period = periodFor(type)): ReportContent {
  const db = app.db;
  const toEx = (d: string) => new Date(new Date(d).getTime() + 86_400_000).toISOString().slice(0, 10);
  const R = { f: period.from, t: toEx(period.to), pf: period.prevFrom, pt: toEx(period.prevTo) };
  const count = <T,>(fn: (f: string, t: string) => T) => ({ cur: fn(R.f, R.t), prev: fn(R.pf, R.pt) });

  const leadsN = count((f, t) => db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, f), lt(leads.createdAt, t))).get()!.n);
  const wonN = count((f, t) => db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), sql`${leads.status} in ('won','order')`, gte(leads.updatedAt, f), lt(leads.updatedAt, t))).get()!.n);
  const lostN = count((f, t) => db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), eq(leads.status, 'lost'), gte(leads.updatedAt, f), lt(leads.updatedAt, t))).get()!.n);
  const custN = count((f, t) => db.select({ n: sql<number>`count(*)` }).from(customers).where(and(eq(customers.companyId, companyId), gte(customers.createdAt, f), lt(customers.createdAt, t))).get()!.n);
  const ordN = count((f, t) => db.select({ n: sql<number>`count(*)`, s: sql<number>`coalesce(sum(${orders.totalCents}),0)` }).from(orders).where(and(eq(orders.companyId, companyId), sql`${orders.status} != 'cancelled'`, gte(orders.createdAt, f), lt(orders.createdAt, t))).get()!);
  const rev = count((f, t) => db.select({ n: sql<number>`count(*)`, net: sql<number>`coalesce(sum(${invoices.subtotalCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), lt(invoices.issueDate, t))).get()!);
  const exp = count((f, t) => db.select({ net: sql<number>`coalesce(sum(${expenses.netCents}),0)`, n: sql<number>`count(*)` }).from(expenses).where(and(eq(expenses.companyId, companyId), gte(expenses.date, f), lt(expenses.date, t))).get()!);
  const appt = count((f, t) => db.select({ n: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.companyId, companyId), sql`${appointments.status} in ('planned','confirmed','done')`, gte(appointments.startsAt, f), lt(appointments.startsAt, t))).get()!.n);
  const ads = count((f, t) => db.select({ cost: sql<number>`coalesce(sum(${marketingDaily.costCents}),0)`, clicks: sql<number>`coalesce(sum(${marketingDaily.clicks}),0)`, impr: sql<number>`coalesce(sum(${marketingDaily.impressions}),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, companyId), gte(marketingDaily.date, f), lt(marketingDaily.date, t))).get()!);
  const web = count((f, t) => db.select({ s: sql<number>`coalesce(sum(${webAnalyticsDaily.sessions}),0)` }).from(webAnalyticsDaily).where(and(eq(webAnalyticsDaily.companyId, companyId), eq(webAnalyticsDaily.dimensionType, 'total'), gte(webAnalyticsDaily.date, f), lt(webAnalyticsDaily.date, t))).get()!.s);
  const social = count((f, t) => db.select({ r: sql<number>`coalesce(sum(${socialDaily.reach}),0)` }).from(socialDaily).where(and(eq(socialDaily.companyId, companyId), gte(socialDaily.date, f), lt(socialDaily.date, t))).get()!.r);
  const openInv = db.select({ n: sql<number>`count(*)`, s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue')`)).get()!;
  const overdueInv = db.select({ n: sql<number>`count(*)`, s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.status, 'overdue'))).get()!;
  const lowStock = db.select({ name: inventoryItems.name, q: inventoryItems.quantity, min: inventoryItems.minQuantity, unit: inventoryItems.unit }).from(inventoryItems).where(and(eq(inventoryItems.companyId, companyId), eq(inventoryItems.isActive, true), sql`${inventoryItems.minQuantity} > 0 and ${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`)).all();
  const bySource = db.select({ source: leads.source, n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, R.f), lt(leads.createdAt, R.t))).groupBy(leads.source).orderBy(sql`2 desc`).all();
  const topServices = pricingAnalysis(db, companyId, Math.max(30, Math.round((new Date(R.t).getTime() - new Date(R.f).getTime()) / 86_400_000))).items.filter((i) => i.bookings90 > 0).slice(0, 8);
  const weekdayLoad = db.select({ dow: sql<number>`cast(strftime('%w', ${appointments.startsAt}) as integer)`, n: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.companyId, companyId), sql`${appointments.status} in ('planned','confirmed','done')`, gte(appointments.startsAt, new Date(Date.now() - 90 * 86_400_000).toISOString()))).groupBy(sql`1`).all();
  const compNew = db.select({ name: competitors.name }).from(competitors).where(and(eq(competitors.companyId, companyId), eq(competitors.isOwn, false), gte(competitors.firstSeenAt, R.f), lt(competitors.firstSeenAt, R.t))).all();
  const compRating = db.select({ name: competitors.name, rating: competitorSnapshots.rating, count: competitorSnapshots.ratingCount }).from(competitorSnapshots).innerJoin(competitors, eq(competitors.id, competitorSnapshots.competitorId)).where(and(eq(competitorSnapshots.companyId, companyId), eq(competitors.isOwn, false), gte(competitorSnapshots.date, R.f), lt(competitorSnapshots.date, R.t))).orderBy(desc(competitorSnapshots.date)).limit(200).all();

  const profit = { cur: rev.cur.net - exp.cur.net, prev: rev.prev.net - exp.prev.net };
  const sections: Section[] = [];
  const push = (s: Section) => sections.push(s);

  // Umsatz & Finanzen
  {
    const changes = [chg('Umsatz (netto)', rev.cur.net, rev.prev.net, eur), chg('Kosten (netto)', exp.cur.net, exp.prev.net, eur), chg('Gewinn (netto)', profit.cur, profit.prev, eur)].filter(Boolean) as string[];
    const reasons: string[] = [];
    if (rev.cur.n !== rev.prev.n) reasons.push(`Anzahl ausgestellter Rechnungen: ${rev.cur.n} (Vorperiode ${rev.prev.n}).`);
    if (rev.cur.n > 0 && rev.prev.n > 0) { const a = rev.cur.net / rev.cur.n; const b = rev.prev.net / rev.prev.n; if (Math.abs(a - b) / b > 0.1) reasons.push(`Durchschnittlicher Rechnungswert ${eur(Math.round(a))} gegenüber ${eur(Math.round(b))}.`); }
    if (exp.cur.n > exp.prev.n) reasons.push(`Mehr Ausgabenbuchungen (${exp.cur.n} statt ${exp.prev.n}).`);
    const actions: string[] = [];
    if (overdueInv.n > 0) actions.push(`${overdueInv.n} überfällige Rechnung(en) über ${eur(overdueInv.s)} mahnen.`);
    if (rev.cur.net > 0 && profit.cur / rev.cur.net < 0.2) actions.push('Marge unter 20 % – Preise und Materialkosten je Leistung prüfen (Preisanalyse).');
    push({ title: 'Umsatz, Kosten, Gewinn', metrics: [{ label: 'Umsatz netto', value: rev.cur.net, prev: rev.prev.net, unit: 'eur' }, { label: 'Kosten netto', value: exp.cur.net, prev: exp.prev.net, unit: 'eur' }, { label: 'Gewinn netto', value: profit.cur, prev: profit.prev, unit: 'eur' }, { label: 'Offene Forderungen', value: openInv.s, prev: openInv.s, unit: 'eur' }], facts: [`${rev.cur.n} Rechnungen ausgestellt, ${exp.cur.n} Ausgaben gebucht.`, `Offene Forderungen: ${eur(openInv.s)} (${openInv.n}), davon überfällig ${eur(overdueInv.s)} (${overdueInv.n}).`], changes, reasons, actions });
  }
  // Leads & Kunden
  {
    const conv = leadsN.cur > 0 ? Math.round((wonN.cur / Math.max(1, wonN.cur + lostN.cur)) * 100) : null;
    const changes = [chg('Leads', leadsN.cur, leadsN.prev, String), chg('Neue Kunden', custN.cur, custN.prev, String), chg('Gewonnene Leads', wonN.cur, wonN.prev, String)].filter(Boolean) as string[];
    const reasons: string[] = [];
    if (bySource.length) reasons.push(`Lead-Quellen: ${bySource.map((s) => `${s.source} ${s.n}`).join(', ')}.`);
    if (ads.cur.cost !== ads.prev.cost && ads.prev.cost > 0) reasons.push(`Werbekosten ${pct(ads.cur.cost, ads.prev.cost)! > 0 ? 'erhöht' : 'gesenkt'} (${eur(ads.cur.cost)} statt ${eur(ads.prev.cost)}).`);
    const actions: string[] = [];
    const openLeads = db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), eq(leads.status, 'new'))).get()!.n;
    if (openLeads > 0) actions.push(`${openLeads} neue Leads ohne Kontaktversuch – zeitnah anrufen.`);
    if (lostN.cur > wonN.cur && lostN.cur >= 3) actions.push('Mehr verlorene als gewonnene Leads – Verlustgründe in den Leads auswerten.');
    push({ title: 'Leads und Kunden', metrics: [{ label: 'Leads', value: leadsN.cur, prev: leadsN.prev, unit: 'n' }, { label: 'Gewonnen', value: wonN.cur, prev: wonN.prev, unit: 'n' }, { label: 'Verloren', value: lostN.cur, prev: lostN.prev, unit: 'n' }, { label: 'Neue Kunden', value: custN.cur, prev: custN.prev, unit: 'n' }], facts: [conv !== null ? `Abschlussquote (gewonnen ÷ entschieden): ${conv} %.` : 'Keine Leads im Zeitraum.'], changes, reasons, actions });
  }
  // Aufträge & Auslastung
  {
    const dowNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const total = weekdayLoad.reduce((s, x) => s + x.n, 0);
    const facts = [`${ordN.cur.n} Aufträge (${eur(ordN.cur.s)} Auftragsvolumen), ${appt.cur} Termine.`];
    const actions: string[] = [];
    if (total >= 10) {
      const work = weekdayLoad.filter((x) => x.dow >= 1 && x.dow <= 5);
      const avg = work.reduce((s, x) => s + x.n, 0) / Math.max(1, work.length);
      const weak = work.filter((x) => x.n < avg * 0.5);
      facts.push(`Auslastung nach Wochentag (90 Tage): ${[1, 2, 3, 4, 5, 6].map((d) => `${dowNames[d]} ${weekdayLoad.find((x) => x.dow === d)?.n ?? 0}`).join(', ')}.`);
      for (const w of weak) actions.push(`${dowNames[w.dow]} ist deutlich weniger ausgelastet – Aktion oder Terminfenster anbieten.`);
    }
    push({ title: 'Aufträge und Auslastung', metrics: [{ label: 'Aufträge', value: ordN.cur.n, prev: ordN.prev.n, unit: 'n' }, { label: 'Auftragsvolumen', value: ordN.cur.s, prev: ordN.prev.s, unit: 'eur' }, { label: 'Termine', value: appt.cur, prev: appt.prev, unit: 'n' }], facts, changes: [chg('Aufträge', ordN.cur.n, ordN.prev.n, String)].filter(Boolean) as string[], reasons: [], actions, table: topServices.length ? { head: ['Leistung', 'Buchungen', 'Umsatz', 'Marge'], rows: topServices.map((s) => [s.name, String(s.bookings90), eur(s.revenue90Cents), s.marginPct === null ? '–' : `${s.marginPct} %`]) } : undefined });
  }
  // Marketing
  {
    const cpl = leadsN.cur > 0 && ads.cur.cost > 0 ? Math.round(ads.cur.cost / leadsN.cur) : null;
    const cplPrev = leadsN.prev > 0 && ads.prev.cost > 0 ? Math.round(ads.prev.cost / leadsN.prev) : null;
    const changes = [chg('Werbekosten', ads.cur.cost, ads.prev.cost, eur), chg('Klicks', ads.cur.clicks, ads.prev.clicks, String), chg('Website-Sitzungen', web.cur, web.prev, String), chg('Instagram-Reichweite', social.cur, social.prev, String), cpl !== null && cplPrev !== null ? chg('Kosten pro Lead', cpl, cplPrev, eur) : null].filter(Boolean) as string[];
    const facts = ads.cur.cost > 0 ? [`${eur(ads.cur.cost)} Werbekosten, ${ads.cur.impr} Impressionen, ${ads.cur.clicks} Klicks${cpl !== null ? `, ${eur(cpl)} je Lead` : ''}.`] : ['Keine Werbekosten erfasst (keine Anbindung oder keine aktiven Kampagnen).'];
    if (web.cur > 0) facts.push(`${web.cur} Website-Sitzungen.`); if (social.cur > 0) facts.push(`Instagram-Reichweite ${social.cur}.`);
    const actions: string[] = [];
    if (web.prev > 0 && web.cur > web.prev * 1.2 && leadsN.cur <= leadsN.prev) actions.push('Besucher gestiegen, Anfragen nicht – Landingpage und Formular prüfen.');
    if (cpl !== null && cplPrev !== null && cpl > cplPrev * 1.3) actions.push('Kosten pro Lead deutlich gestiegen – Kampagnen und Zielgruppen prüfen.');
    push({ title: 'Marketing und Website', metrics: [{ label: 'Werbekosten', value: ads.cur.cost, prev: ads.prev.cost, unit: 'eur' }, { label: 'Klicks', value: ads.cur.clicks, prev: ads.prev.clicks, unit: 'n' }, { label: 'Website-Sitzungen', value: web.cur, prev: web.prev, unit: 'n' }, { label: 'Instagram-Reichweite', value: social.cur, prev: social.prev, unit: 'n' }], facts, changes, reasons: [], actions });
  }
  // Lager & Wettbewerb
  {
    const facts = lowStock.length ? [`${lowStock.length} Artikel unter Mindestbestand: ${lowStock.map((l) => `${l.name} (${l.q} ${l.unit})`).join(', ')}.`] : ['Alle Lagerartikel über Mindestbestand.'];
    const compFacts: string[] = [];
    if (compNew.length) compFacts.push(`Neue Wettbewerber erkannt: ${compNew.map((c) => c.name).join(', ')}.`);
    const seen = new Map<string, { rating: number | null; count: number | null }>();
    for (const r of compRating) if (!seen.has(r.name)) seen.set(r.name, { rating: r.rating, count: r.count });
    if (seen.size) compFacts.push(`Bewertungen: ${[...seen.entries()].slice(0, 8).map(([n, v]) => `${n} ${v.rating ?? '–'} (${v.count ?? 0})`).join(', ')}.`);
    push({ title: 'Lager und Wettbewerb', metrics: [], facts: [...facts, ...(compFacts.length ? compFacts : ['Keine Wettbewerberdaten im Zeitraum (Wettbewerber-Monitoring unter Einstellungen einrichten).'])], changes: [], reasons: [], actions: lowStock.length ? ['Nachbestellung für Artikel unter Mindestbestand auslösen.'] : [] });
  }

  const summary = [`Umsatz ${eur(rev.cur.net)}${pct(rev.cur.net, rev.prev.net) !== null ? ` (${pct(rev.cur.net, rev.prev.net)! >= 0 ? '+' : ''}${pct(rev.cur.net, rev.prev.net)} %)` : ''}`, `Gewinn ${eur(profit.cur)}`, `${leadsN.cur} Leads`, `${ordN.cur.n} Aufträge`, `${custN.cur} neue Kunden`].join(' · ');
  const content: ReportContent = { type, period, sections, summary, generatedAt: nowIso() };
  if (type === 'yearly') {
    content.months = [];
    for (let m = 0; m < 12; m++) {
      const f = `${period.from.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`; const t = m === 11 ? `${Number(period.from.slice(0, 4)) + 1}-01-01` : `${period.from.slice(0, 4)}-${String(m + 2).padStart(2, '0')}-01`;
      content.months.push({ label: new Date(f).toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }), revenueCents: db.select({ s: sql<number>`coalesce(sum(${invoices.subtotalCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), lt(invoices.issueDate, t))).get()!.s, expensesCents: db.select({ s: sql<number>`coalesce(sum(${expenses.netCents}),0)` }).from(expenses).where(and(eq(expenses.companyId, companyId), gte(expenses.date, f), lt(expenses.date, t))).get()!.s, leads: db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, f), lt(leads.createdAt, t))).get()!.n, orders: db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.companyId, companyId), gte(orders.createdAt, f), lt(orders.createdAt, t))).get()!.n });
    }
  }
  return content;
}

export function reportHtmlBody(c: ReportContent): string {
  const fmt = (m: Metric) => (m.unit === 'eur' ? money(m.value) : m.unit === 'pct' ? `${m.value} %` : String(m.value));
  const fmtPrev = (m: Metric) => (m.unit === 'eur' ? money(m.prev) : String(m.prev));
  const list = (title: string, items: string[]) => (items.length ? `<div style="margin-top:6px"><b style="font-size:9pt;color:#555;text-transform:uppercase;letter-spacing:.05em">${title}</b><ul style="margin:3px 0 0 16px;padding:0">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');
  return `<p style="font-size:11.5pt;margin-bottom:14px"><b>Kurzfassung:</b> ${esc(c.summary)}</p>
<p class="small muted">Vergleichszeitraum: ${dateDe(c.period.prevFrom)} – ${dateDe(c.period.prevTo)}. Kennzeichnung: <b>Fakt</b> = gemessen, <b>Veränderung</b> = berechnet, <b>Mögliche Ursache</b> = Interpretation aus Daten, <b>Empfehlung</b> = Handlungsvorschlag.</p>
${c.sections.map((s) => `<h2>${esc(s.title)}</h2>${s.metrics.length ? `<table><thead><tr><th>Kennzahl</th><th class="num">Zeitraum</th><th class="num">Vorperiode</th><th class="num">Δ</th></tr></thead><tbody>${s.metrics.map((m) => { const p = m.prev > 0 ? Math.round(((m.value - m.prev) / m.prev) * 100) : null; return `<tr><td>${esc(m.label)}</td><td class="num"><b>${fmt(m)}</b></td><td class="num">${fmtPrev(m)}</td><td class="num">${p === null ? '–' : `${p >= 0 ? '+' : ''}${p} %`}</td></tr>`; }).join('')}</tbody></table>` : ''}${list('Fakten', s.facts)}${list('Was hat sich verändert', s.changes)}${list('Mögliche Ursachen (aus den Daten)', s.reasons)}${list('Empfehlungen', s.actions)}${s.table ? `<table style="margin-top:8px"><thead><tr>${s.table.head.map((h, i) => `<th${i > 0 ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((cell, i) => `<td${i > 0 ? ' class="num"' : ''}>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}`).join('')}
${c.months ? `<h2>Monat für Monat</h2><table><thead><tr><th>Monat</th><th class="num">Umsatz netto</th><th class="num">Kosten netto</th><th class="num">Gewinn</th><th class="num">Leads</th><th class="num">Aufträge</th></tr></thead><tbody>${c.months.map((m) => `<tr><td>${esc(m.label)}</td><td class="num">${money(m.revenueCents)}</td><td class="num">${money(m.expensesCents)}</td><td class="num">${money(m.revenueCents - m.expensesCents)}</td><td class="num">${m.leads}</td><td class="num">${m.orders}</td></tr>`).join('')}</tbody></table>` : ''}`;
}

const TITLE: Record<ReportType, string> = { weekly: 'Wochenbericht', monthly: 'Monatsbericht', yearly: 'Jahresbericht' };

/** Erzeugt Bericht, PDF und Datensatz; sendet optional per E-Mail an Administratoren (Einstellung reportEmail). */
export async function generateAndStoreReport(app: FastifyInstance, companyId: string, type: ReportType, period?: ReportContent['period'], opts: { email?: boolean } = {}): Promise<{ id: string; content: ReportContent; pdfFileId: string | null; sentTo: string | null }> {
  const content = buildReport(app, companyId, type, period);
  const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
  const title = `${TITLE[type]} ${content.period.label}`;
  let pdfFileId: string | null = null;
  try {
    const logo = company.logoFileId ? app.storage.get(companyId, company.logoFileId) : null;
    const html = documentShell({ company, logoDataUrl: logo ? app.storage.dataUrl(logo, 'original') : null, title: TITLE[type], subtitle: content.period.label, docDate: dateDe(content.generatedAt), body: reportHtmlBody(content) });
    const pdf = await app.pdf.render(html, { footerHtml: documentFooter(company, title) });
    pdfFileId = (await app.storage.store({ companyId, buffer: pdf, originalName: `${title.replace(/[^\wäöüÄÖÜß.-]+/g, '_')}.pdf`, mimeType: 'application/pdf', kind: 'pdf', category: 'other' })).id;
  } catch (err) {
    app.log.warn({ err }, 'Report-PDF konnte nicht erzeugt werden');
  }
  // Ersetzt vorhandenen Bericht desselben Zeitraums
  const existing = app.db.select({ id: reports.id, pdfFileId: reports.pdfFileId }).from(reports).where(and(eq(reports.companyId, companyId), eq(reports.type, type), eq(reports.periodStart, content.period.from))).get();
  if (existing) { if (existing.pdfFileId) app.storage.remove(companyId, existing.pdfFileId); app.db.delete(reports).where(eq(reports.id, existing.id)).run(); }
  const id = newId();
  let sentTo: string | null = null;
  if (opts.email !== false && pdfFileId) {
    const settings = JSON.parse(company.settingsJson || '{}') as { reportEmail?: string };
    const to = settings.reportEmail ?? app.db.select({ email: users.email }).from(users).where(and(eq(users.companyId, companyId), eq(users.role, 'admin'), eq(users.isActive, true))).get()?.email ?? null;
    if (to && app.mail.isConfigured(companyId)) {
      const file = app.storage.get(companyId, pdfFileId)!;
      const res = await app.mail.send(companyId, { to, subject: `${title} – ${company.name}`, text: `Guten Tag,\n\nanbei der ${TITLE[type]} für ${content.period.label}.\n\nKurzfassung: ${content.summary}\n\n${content.sections.flatMap((s) => s.actions).length ? 'Empfehlungen:\n' + content.sections.flatMap((s) => s.actions).map((a) => `• ${a}`).join('\n') : 'Keine Handlungsempfehlungen.'}\n\nAutomatisch erstellt.`, attachments: [{ filename: file.originalName, content: fs.readFileSync(app.storage.absolute(file.storagePath)), contentType: 'application/pdf' }], refType: 'report', refId: id });
      if (res.ok) sentTo = to;
    }
  }
  app.db.insert(reports).values({ id, companyId, type, periodStart: content.period.from, periodEnd: content.period.to, title, summary: content.summary, contentJson: JSON.stringify(content), pdfFileId, sentTo }).run();
  return { id, content, pdfFileId, sentTo };
}

export async function runScheduledReports(app: FastifyInstance, type: ReportType): Promise<string> {
  const active = app.db.select({ id: companies.id }).from(companies).where(eq(companies.isActive, true)).all();
  let n = 0;
  for (const c of active) { try { await generateAndStoreReport(app, c.id, type); n++; } catch (err) { app.log.error({ err, companyId: c.id }, 'Report fehlgeschlagen'); } }
  return `${n} ${TITLE[type]}(e) erstellt`;
}
