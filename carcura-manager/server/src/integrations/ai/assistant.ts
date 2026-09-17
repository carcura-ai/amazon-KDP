import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { customers, invoices, leads, orders, expenses, appointments, marketingDaily, inventoryItems, services } from '../../db/schema.js';
import { pricingAnalysis } from '../../modules/analysis/pricing.js';
import { buildReport } from '../../modules/reports/generator.js';

export interface AssistantConfig { apiKey: string; model?: string }
export const DEFAULT_MODEL = 'claude-opus-5';

/** Werkzeuge, die dem Modell ausschließlich echte Systemdaten des Mandanten liefern. */
export function buildTools(app: FastifyInstance, companyId: string) {
  const db = app.db;
  const today = () => new Date().toISOString().slice(0, 10);
  const rangeOf = (days: number) => ({ from: new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10), to: today() });
  const toEx = (d: string) => new Date(new Date(d).getTime() + 86_400_000).toISOString().slice(0, 10);
  const money = (c: number) => `${(c / 100).toFixed(2)} EUR`;
  const definitions: Anthropic.Beta.Messages.BetaTool[] = [
    { name: 'get_overview', description: 'Kennzahlen für einen Zeitraum (Umsatz netto aus Rechnungen, Kosten, Gewinn, Leads, Aufträge, Termine, Werbekosten) inklusive Vorperiode. Nutze days für „diese Woche“ (7), „dieser Monat“ (30), Quartal (90), Jahr (365).', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 730 } }, required: ['days'] } },
    { name: 'get_services_performance', description: 'Umsatz, Buchungen, Marge und Stundenertrag je Leistung (Preisanalyse) für die letzten N Tage.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 30, maximum: 365 } }, required: ['days'] } },
    { name: 'get_lead_funnel', description: 'Leads nach Quelle und Status, Verlustgründe, Kosten pro Lead je Werbequelle für die letzten N Tage.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 730 } }, required: ['days'] } },
    { name: 'get_campaigns', description: 'Kampagnen-Kennzahlen (Google Ads / Meta Ads) mit Kosten, Klicks, Impressionen, Leads für die letzten N Tage.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }, required: ['days'] } },
    { name: 'get_open_invoices', description: 'Offene und überfällige Rechnungen mit Kunde, Betrag, Fälligkeit.', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'get_expenses', description: 'Ausgaben nach Kategorie und die größten Einzelbuchungen für die letzten N Tage.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 730 } }, required: ['days'] } },
    { name: 'get_inactive_customers', description: 'Kunden, die seit mindestens N Tagen keinen Auftrag/keine Rechnung mehr hatten.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 30, maximum: 1000 } }, required: ['days'] } },
    { name: 'get_utilization', description: 'Auslastung: Termine je Wochentag und je Woche, Aufträge in Bearbeitung, nächste Termine.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 7, maximum: 365 } }, required: ['days'] } },
    { name: 'get_inventory_status', description: 'Lagerartikel unter Mindestbestand und Lagerwert.', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'search_customers', description: 'Kunden per Name, Firma, E-Mail oder Telefon suchen (max. 10 Treffer).', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'get_report', description: 'Vollständiger Wochen-, Monats- oder Jahresbericht (letzte abgeschlossene Periode) mit Fakten, Veränderungen, Ursachen und Empfehlungen.', input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] } }, required: ['type'] } },
  ];

  const run = async (name: string, input: Record<string, unknown>): Promise<unknown> => {
    const days = typeof input.days === 'number' ? input.days : 30;
    const r = rangeOf(days); const prev = { from: new Date(new Date(r.from).getTime() - days * 86_400_000).toISOString().slice(0, 10), to: new Date(new Date(r.from).getTime() - 86_400_000).toISOString().slice(0, 10) };
    const agg = (f: string, t: string) => ({
      revenueNet: money(db.select({ s: sql<number>`coalesce(sum(${invoices.subtotalCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), lt(invoices.issueDate, toEx(t)))).get()!.s),
      invoices: db.select({ n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), lt(invoices.issueDate, toEx(t)))).get()!.n,
      expensesNet: money(db.select({ s: sql<number>`coalesce(sum(${expenses.netCents}),0)` }).from(expenses).where(and(eq(expenses.companyId, companyId), gte(expenses.date, f), lt(expenses.date, toEx(t)))).get()!.s),
      leads: db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, f), lt(leads.createdAt, toEx(t)))).get()!.n,
      orders: db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.companyId, companyId), sql`${orders.status} != 'cancelled'`, gte(orders.createdAt, f), lt(orders.createdAt, toEx(t)))).get()!.n,
      appointments: db.select({ n: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.companyId, companyId), gte(appointments.startsAt, f), lt(appointments.startsAt, toEx(t)))).get()!.n,
      adCost: money(db.select({ s: sql<number>`coalesce(sum(${marketingDaily.costCents}),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, companyId), gte(marketingDaily.date, f), lt(marketingDaily.date, toEx(t)))).get()!.s),
    });
    switch (name) {
      case 'get_overview': return { period: r, current: agg(r.from, r.to), previousPeriod: { ...prev, ...agg(prev.from, prev.to) }, note: 'Umsatz = ausgestellte Rechnungen nach Rechnungsdatum, netto. Gewinn = Umsatz netto − Kosten netto (vor Steuern).' };
      case 'get_services_performance': { const p = pricingAnalysis(db, companyId, days); return { days, avgMarginPct: p.avgMarginPct, avgHourlyYieldEur: p.avgHourlyYieldCents === null ? null : p.avgHourlyYieldCents / 100, services: p.items.map((i) => ({ name: i.name, listPrice: money(i.priceCents), bookings: i.bookings90, bookingsPreviousPeriod: i.bookingsPrev90, revenue: money(i.revenue90Cents), marginPct: i.marginPct, hourlyYieldEur: i.hourlyYieldCents === null ? null : i.hourlyYieldCents / 100, demandTrendPct: i.demandTrendPct, hints: i.hints })) }; }
      case 'get_lead_funnel': {
        const bySource = db.select({ source: leads.source, n: sql<number>`count(*)`, won: sql<number>`sum(case when ${leads.status} in ('won','order') then 1 else 0 end)`, lost: sql<number>`sum(case when ${leads.status}='lost' then 1 else 0 end)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, r.from), lt(leads.createdAt, toEx(r.to)))).groupBy(leads.source).all();
        const byStatus = db.select({ status: leads.status, n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), gte(leads.createdAt, r.from), lt(leads.createdAt, toEx(r.to)))).groupBy(leads.status).all();
        const lostReasons = db.select({ reason: leads.lostReason, n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, companyId), eq(leads.status, 'lost'), sql`${leads.lostReason} is not null`, gte(leads.updatedAt, r.from))).groupBy(leads.lostReason).all();
        const cost = db.select({ source: marketingDaily.source, s: sql<number>`sum(${marketingDaily.costCents})` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, companyId), gte(marketingDaily.date, r.from), lt(marketingDaily.date, toEx(r.to)))).groupBy(marketingDaily.source).all();
        return { period: r, bySource: bySource.map((s) => ({ ...s, adCost: money(cost.find((c) => c.source === s.source)?.s ?? 0), costPerLead: s.n > 0 && (cost.find((c) => c.source === s.source)?.s ?? 0) > 0 ? money(Math.round((cost.find((c) => c.source === s.source)!.s) / s.n)) : null })), byStatus, lostReasons };
      }
      case 'get_campaigns': return { period: r, campaigns: db.select({ source: marketingDaily.source, campaign: sql<string>`max(${marketingDaily.campaignName})`, cost: sql<number>`sum(${marketingDaily.costCents})`, clicks: sql<number>`sum(${marketingDaily.clicks})`, impressions: sql<number>`sum(${marketingDaily.impressions})`, leads: sql<number>`coalesce(sum(coalesce(${marketingDaily.leads},${marketingDaily.conversions})),0)` }).from(marketingDaily).where(and(eq(marketingDaily.companyId, companyId), gte(marketingDaily.date, r.from), lt(marketingDaily.date, toEx(r.to)))).groupBy(marketingDaily.source, marketingDaily.campaignId).orderBy(sql`3 desc`).limit(30).all().map((c) => ({ ...c, cost: money(c.cost) })) };
      case 'get_open_invoices': return { items: db.select({ number: invoices.invoiceNumber, status: invoices.status, total: invoices.totalCents, paid: invoices.paidCents, dueDate: invoices.dueDate, customer: sql<string>`(select first_name || ' ' || last_name from customers c where c.id = ${invoices.customerId})` }).from(invoices).where(and(eq(invoices.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue')`)).orderBy(invoices.dueDate).limit(50).all().map((i) => ({ ...i, open: money(i.total - i.paid), total: money(i.total) })) };
      case 'get_expenses': return { period: r, byCategory: db.select({ category: expenses.category, net: sql<number>`sum(${expenses.netCents})`, n: sql<number>`count(*)` }).from(expenses).where(and(eq(expenses.companyId, companyId), gte(expenses.date, r.from), lt(expenses.date, toEx(r.to)))).groupBy(expenses.category).orderBy(sql`2 desc`).all().map((c) => ({ ...c, net: money(c.net) })), largest: db.select({ date: expenses.date, description: expenses.description, vendor: expenses.vendor, net: expenses.netCents }).from(expenses).where(and(eq(expenses.companyId, companyId), gte(expenses.date, r.from), lt(expenses.date, toEx(r.to)))).orderBy(desc(expenses.netCents)).limit(15).all().map((e) => ({ ...e, net: money(e.net) })) };
      case 'get_inactive_customers': { const cutoff = new Date(Date.now() - days * 86_400_000).toISOString(); return { days, customers: db.select({ id: customers.id, name: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`, company: customers.companyName, phone: customers.phone, email: customers.email, lastOrder: sql<string | null>`(select max(created_at) from orders o where o.customer_id = ${customers.id})` }).from(customers).where(and(eq(customers.companyId, companyId), eq(customers.isActive, true), sql`coalesce((select max(created_at) from orders o where o.customer_id = ${customers.id}), ${customers.createdAt}) < ${cutoff}`)).limit(50).all() }; }
      case 'get_utilization': { const from = r.from; const dow = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']; return { period: r, byWeekday: db.select({ d: sql<number>`cast(strftime('%w', ${appointments.startsAt}) as integer)`, n: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.companyId, companyId), sql`${appointments.status} in ('planned','confirmed','done')`, gte(appointments.startsAt, from))).groupBy(sql`1`).all().map((x) => ({ weekday: dow[x.d], appointments: x.n })), inProgressOrders: db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.companyId, companyId), sql`${orders.status} in ('accepted','in_progress','quality_check')`)).get()!.n, upcoming: db.select({ startsAt: appointments.startsAt, title: appointments.title }).from(appointments).where(and(eq(appointments.companyId, companyId), sql`${appointments.status} in ('planned','confirmed')`, gte(appointments.startsAt, new Date().toISOString()))).orderBy(appointments.startsAt).limit(10).all() }; }
      case 'get_inventory_status': return { low: db.select({ name: inventoryItems.name, quantity: inventoryItems.quantity, min: inventoryItems.minQuantity, unit: inventoryItems.unit, supplier: inventoryItems.supplier }).from(inventoryItems).where(and(eq(inventoryItems.companyId, companyId), eq(inventoryItems.isActive, true), sql`${inventoryItems.minQuantity} > 0 and ${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`)).all(), stockValue: money(Math.round(db.select({ s: sql<number>`coalesce(sum(${inventoryItems.quantity} * ${inventoryItems.purchasePriceCents}),0)` }).from(inventoryItems).where(and(eq(inventoryItems.companyId, companyId), eq(inventoryItems.isActive, true))).get()!.s)) };
      case 'search_customers': { const t = `%${String(input.query ?? '')}%`; return { items: db.select({ id: customers.id, number: customers.customerNumber, name: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`, company: customers.companyName, phone: customers.phone, email: customers.email, city: customers.city }).from(customers).where(and(eq(customers.companyId, companyId), sql`(${customers.firstName} like ${t} or ${customers.lastName} like ${t} or ${customers.companyName} like ${t} or ${customers.email} like ${t} or ${customers.phone} like ${t})`)).limit(10).all() }; }
      case 'get_report': return buildReport(app, companyId, (input.type as 'weekly' | 'monthly' | 'yearly') ?? 'weekly');
      default: return { error: `Unbekanntes Werkzeug ${name}` };
    }
  };
  void services;
  return { definitions, run };
}

export const SYSTEM_PROMPT = (companyName: string) => `Du bist der Business-Assistent von ${companyName}, einem Fahrzeugaufbereitungsbetrieb. Du beantwortest Fragen ausschließlich auf Basis der Daten aus den bereitgestellten Werkzeugen.
Regeln:
- Erfinde niemals Zahlen. Wenn ein Werkzeug keine oder zu wenige Daten liefert, sage: „Nicht genügend Daten für eine zuverlässige Aussage.“
- Kennzeichne klar: Fakt (gemessen), Berechnung, Schätzung/Prognose, Empfehlung.
- Antworte auf Deutsch, kurz, konkret, unternehmerisch; Beträge in Euro mit zwei Nachkommastellen; nenne den betrachteten Zeitraum.
- Keine verbindliche Steuer- oder Rechtsberatung; bei Steuerfragen auf den Steuerberater verweisen.
- Rufe die Werkzeuge auf, die zur Beantwortung nötig sind (mehrere gleichzeitig sind erlaubt), bevor du antwortest.`;

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function runAssistant(app: FastifyInstance, companyId: string, companyName: string, cfg: AssistantConfig, history: ChatTurn[], question: string, fetchFn?: typeof fetch): Promise<{ answer: string; toolsUsed: string[]; inputTokens: number; outputTokens: number; stopReason: string }> {
  const client = new Anthropic({ apiKey: cfg.apiKey, fetch: fetchFn, maxRetries: 2, timeout: 120_000 });
  const tools = buildTools(app, companyId);
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [...history.slice(-12).map((h) => ({ role: h.role, content: h.content })), { role: 'user', content: question }];
  const toolsUsed: string[] = [];
  let inputTokens = 0; let outputTokens = 0;
  for (let i = 0; i < 8; i++) {
    const response = await client.beta.messages.create({
      model: cfg.model ?? DEFAULT_MODEL,
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT(companyName), cache_control: { type: 'ephemeral' } }],
      tools: tools.definitions,
      messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    inputTokens += response.usage.input_tokens; outputTokens += response.usage.output_tokens;
    const text = response.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (response.stop_reason === 'refusal') return { answer: 'Diese Anfrage kann nicht beantwortet werden.', toolsUsed, inputTokens, outputTokens, stopReason: 'refusal' };
    const toolUses = response.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) return { answer: text || 'Keine Antwort erhalten.', toolsUsed, inputTokens, outputTokens, stopReason: response.stop_reason ?? 'end_turn' };
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const t of toolUses) {
      toolsUsed.push(t.name);
      try { results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(await tools.run(t.name, (t.input ?? {}) as Record<string, unknown>)) }); }
      catch (err) { results.push({ type: 'tool_result', tool_use_id: t.id, content: `Fehler: ${err instanceof Error ? err.message : String(err)}`, is_error: true }); }
    }
    messages.push({ role: 'user', content: results });
  }
  return { answer: 'Die Analyse wurde nach zu vielen Schritten abgebrochen. Bitte Frage eingrenzen.', toolsUsed, inputTokens, outputTokens, stopReason: 'max_iterations' };
}
