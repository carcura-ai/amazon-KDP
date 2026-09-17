import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm';
import { expenses, recurringExpenses, invoices, payments, inventoryItems, companies } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination, zMoneyCents } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { runRecurringExpenses, nextDateAfter } from '../../jobs/recurring.js';

export const EXPENSE_CATEGORIES = ['Material', 'Miete', 'Software', 'Versicherung', 'Telefon/Internet', 'Strom/Wasser', 'Leasing/Fahrzeug', 'Marketing', 'Personal', 'Steuern/Abgaben', 'Werkzeug/Ausstattung', 'Reparatur/Wartung', 'Fortbildung', 'Sonstiges'] as const;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const METHODS = ['cash', 'transfer', 'card', 'paypal', 'direct_debit', 'other'] as const;

const expenseFields = {
  date: dateStr,
  category: zTrimmed(80).min(1),
  description: zTrimmed(300).min(1),
  vendor: zOptionalText(160),
  netCents: z.number().int().min(0).max(1_000_000_000).optional(),
  grossCents: z.number().int().min(0).max(1_000_000_000).optional(),
  vatBp: z.number().int().min(0).max(10000),
  paymentMethod: z.enum(METHODS),
  isPaid: z.boolean(),
  paidAt: dateStr.nullable(),
  dueDate: dateStr.nullable(),
  receiptFileId: z.string().uuid().nullable(),
  notes: zOptionalText(2000),
};
const expenseCreate = z.object({ ...expenseFields, category: expenseFields.category.default('Sonstiges'), vatBp: expenseFields.vatBp.default(1900), paymentMethod: expenseFields.paymentMethod.default('transfer'), isPaid: expenseFields.isPaid.default(true), paidAt: expenseFields.paidAt.default(null), dueDate: expenseFields.dueDate.default(null), receiptFileId: expenseFields.receiptFileId.default(null) });
const expenseUpdate = z.object(expenseFields).partial();

const recFields = {
  name: zTrimmed(160).min(1),
  category: zTrimmed(80).min(1),
  vendor: zOptionalText(160),
  netCents: zMoneyCents,
  vatBp: z.number().int().min(0).max(10000),
  interval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: dateStr,
  endDate: dateStr.nullable(),
  paymentMethod: z.enum(METHODS),
  autoPaid: z.boolean(),
  isActive: z.boolean(),
  notes: zOptionalText(2000),
};
const recCreate = z.object({ ...recFields, category: recFields.category.default('Sonstiges'), vatBp: recFields.vatBp.default(1900), interval: recFields.interval.default('monthly'), endDate: recFields.endDate.default(null), paymentMethod: recFields.paymentMethod.default('transfer'), autoPaid: recFields.autoPaid.default(true), isActive: recFields.isActive.default(true) });
const recUpdate = z.object(recFields).partial();

/** Netto/Brutto/MwSt. aus zwei beliebigen Angaben ableiten. */
function amounts(net: number | undefined, gross: number | undefined, vatBp: number) {
  if (net === undefined && gross === undefined) throw badRequest('Bitte Netto- oder Bruttobetrag angeben.');
  if (net !== undefined) { const vat = Math.round((net * vatBp) / 10000); return { netCents: net, vatCents: vat, grossCents: net + vat }; }
  const n = Math.round((gross! * 10000) / (10000 + vatBp));
  return { netCents: n, vatCents: gross! - n, grossCents: gross! };
}

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
function periodRange(period: Period, date: string): { from: string; to: string; prevFrom: string; prevTo: string; label: string } {
  const d = new Date(date + 'T00:00:00Z');
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  let from: Date; let to: Date; let prevFrom: Date; let prevTo: Date; let label: string;
  if (period === 'day') { from = d; to = new Date(d); to.setUTCDate(to.getUTCDate() + 1); prevFrom = new Date(d); prevFrom.setUTCDate(prevFrom.getUTCDate() - 1); prevTo = d; label = d.toLocaleDateString('de-DE', { timeZone: 'UTC' }); }
  else if (period === 'week') { from = new Date(d); from.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); to = new Date(from); to.setUTCDate(from.getUTCDate() + 7); prevFrom = new Date(from); prevFrom.setUTCDate(from.getUTCDate() - 7); prevTo = from; label = `KW ${isoWeek(from)}`; }
  else if (period === 'quarter') { const qm = Math.floor(d.getUTCMonth() / 3) * 3; from = new Date(Date.UTC(d.getUTCFullYear(), qm, 1)); to = new Date(Date.UTC(d.getUTCFullYear(), qm + 3, 1)); prevFrom = new Date(Date.UTC(d.getUTCFullYear(), qm - 3, 1)); prevTo = from; label = `Q${qm / 3 + 1} ${d.getUTCFullYear()}`; }
  else if (period === 'year') { from = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); to = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)); prevFrom = new Date(Date.UTC(d.getUTCFullYear() - 1, 0, 1)); prevTo = from; label = String(d.getUTCFullYear()); }
  else { from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); prevFrom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); prevTo = from; label = from.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo), label };
}
function isoWeek(d: Date): number { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7); }

export default async function financeRoutes(app: FastifyInstance) {
  /* ---------------------------------------------------------- Ausgaben */
  app.get('/api/expenses', { preHandler: app.requireAuth('finance:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(zPagination.extend({ from: dateStr.optional(), to: dateStr.optional(), category: z.string().optional(), unpaid: z.coerce.boolean().optional() }), req.query);
    const conds = [eq(expenses.companyId, ctx.companyId)];
    if (q.from) conds.push(gte(expenses.date, q.from));
    if (q.to) conds.push(lte(expenses.date, q.to));
    if (q.category) conds.push(eq(expenses.category, q.category));
    if (q.unpaid) conds.push(eq(expenses.isPaid, false));
    if (q.q) { const t = `%${q.q}%`; conds.push(or(like(expenses.description, t), like(expenses.vendor, t), like(expenses.category, t))!); }
    const where = and(...conds);
    const items = app.db.select().from(expenses).where(where).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize).all();
    const agg = app.db.select({ n: sql<number>`count(*)`, net: sql<number>`coalesce(sum(${expenses.netCents}),0)`, gross: sql<number>`coalesce(sum(${expenses.grossCents}),0)` }).from(expenses).where(where).get()!;
    return { items, total: agg.n, sumNetCents: agg.net, sumGrossCents: agg.gross, page: q.page, pageSize: q.pageSize, categories: EXPENSE_CATEGORIES };
  });

  app.post('/api/expenses', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { netCents, grossCents, ...input } = parse(expenseCreate, req.body);
    const a = amounts(netCents, grossCents, input.vatBp);
    const id = newId();
    app.db.insert(expenses).values({ id, companyId: ctx.companyId, ...input, ...a, paidAt: input.isPaid ? input.paidAt ?? input.date : null, createdByUserId: ctx.userId }).run();
    writeAudit(app.db, ctx, { action: 'expense.create', entityType: 'expense', entityId: id, after: { ...input, ...a } });
    return app.db.select().from(expenses).where(eq(expenses.id, id)).get();
  });

  app.patch('/api/expenses/:id', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { netCents, grossCents, ...input } = parse(expenseUpdate, req.body);
    const before = app.db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Ausgabe');
    const vatBp = input.vatBp ?? before.vatBp;
    const a = netCents !== undefined || grossCents !== undefined || input.vatBp !== undefined ? amounts(netCents ?? (grossCents === undefined ? before.netCents : undefined), grossCents, vatBp) : {};
    const patch: Record<string, unknown> = { ...input, ...a, updatedAt: nowIso() };
    if (input.isPaid === true && !before.paidAt && !input.paidAt) patch.paidAt = before.date;
    if (input.isPaid === false) patch.paidAt = null;
    app.db.update(expenses).set(patch).where(eq(expenses.id, id)).run();
    writeAudit(app.db, ctx, { action: 'expense.update', entityType: 'expense', entityId: id, before, after: patch });
    return app.db.select().from(expenses).where(eq(expenses.id, id)).get();
  });

  app.delete('/api/expenses/:id', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Ausgabe');
    app.db.delete(expenses).where(eq(expenses.id, id)).run();
    writeAudit(app.db, ctx, { action: 'expense.delete', entityType: 'expense', entityId: id, before });
    return { ok: true };
  });

  /* ---------------------------------------------------------- Wiederkehrende Ausgaben */
  app.get('/api/recurring-expenses', { preHandler: app.requireAuth('finance:read') }, async (req) => {
    const ctx = ctxOf(req);
    const items = app.db.select().from(recurringExpenses).where(eq(recurringExpenses.companyId, ctx.companyId)).orderBy(asc(recurringExpenses.name)).all();
    const monthlyNet = items.filter((r) => r.isActive).reduce((s, r) => s + (r.interval === 'weekly' ? r.netCents * 4.33 : r.interval === 'monthly' ? r.netCents : r.interval === 'quarterly' ? r.netCents / 3 : r.netCents / 12), 0);
    return { items, monthlyNetCents: Math.round(monthlyNet) };
  });

  app.post('/api/recurring-expenses', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(recCreate, req.body);
    const id = newId();
    app.db.insert(recurringExpenses).values({ id, companyId: ctx.companyId, ...input, nextDate: input.startDate }).run();
    writeAudit(app.db, ctx, { action: 'recurring_expense.create', entityType: 'recurring_expense', entityId: id, after: input });
    await runRecurringExpenses(app.db);
    return app.db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).get();
  });

  app.patch('/api/recurring-expenses/:id', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(recUpdate, req.body);
    const before = app.db.select().from(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Wiederkehrende Ausgabe');
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (input.startDate && input.startDate > before.nextDate) patch.nextDate = input.startDate;
    if (input.interval && input.interval !== before.interval) patch.nextDate = nextDateAfter(before.nextDate, input.interval) > before.nextDate ? before.nextDate : before.nextDate;
    app.db.update(recurringExpenses).set(patch).where(eq(recurringExpenses.id, id)).run();
    writeAudit(app.db, ctx, { action: 'recurring_expense.update', entityType: 'recurring_expense', entityId: id, before, after: input });
    return app.db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).get();
  });

  app.delete('/api/recurring-expenses/:id', { preHandler: app.requireAuth('finance:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.companyId, ctx.companyId))).get();
    if (!before) throw notFound('Wiederkehrende Ausgabe');
    app.db.update(recurringExpenses).set({ isActive: false, updatedAt: nowIso() }).where(eq(recurringExpenses.id, id)).run();
    writeAudit(app.db, ctx, { action: 'recurring_expense.deactivate', entityType: 'recurring_expense', entityId: id });
    return { ok: true };
  });

  /* ---------------------------------------------------------- Übersicht */
  app.get('/api/finance/overview', { preHandler: app.requireAuth('finance:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { period, date } = parse(z.object({ period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'), date: dateStr.default(() => new Date().toISOString().slice(0, 10)) }), req.query);
    const r = periodRange(period, date);
    const revenueIn = (from: string, to: string) => app.db.select({ net: sql<number>`coalesce(sum(${invoices.subtotalCents}),0)`, vat: sql<number>`coalesce(sum(${invoices.vatCents}),0)`, gross: sql<number>`coalesce(sum(${invoices.totalCents}),0)`, n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, from), sql`${invoices.issueDate} < ${to}`)).get()!;
    const expensesIn = (from: string, to: string) => app.db.select({ net: sql<number>`coalesce(sum(${expenses.netCents}),0)`, vat: sql<number>`coalesce(sum(${expenses.vatCents}),0)`, gross: sql<number>`coalesce(sum(${expenses.grossCents}),0)`, n: sql<number>`count(*)` }).from(expenses).where(and(eq(expenses.companyId, ctx.companyId), gte(expenses.date, from), sql`${expenses.date} < ${to}`)).get()!;
    const paymentsIn = (from: string, to: string) => app.db.select({ s: sql<number>`coalesce(sum(${payments.amountCents}),0)` }).from(payments).where(and(eq(payments.companyId, ctx.companyId), gte(payments.paidAt, from), sql`${payments.paidAt} < ${to}`)).get()!.s;
    const expensesPaidIn = (from: string, to: string) => app.db.select({ s: sql<number>`coalesce(sum(${expenses.grossCents}),0)` }).from(expenses).where(and(eq(expenses.companyId, ctx.companyId), eq(expenses.isPaid, true), gte(expenses.paidAt, from), sql`${expenses.paidAt} < ${to}`)).get()!.s;

    const rev = revenueIn(r.from, r.to);
    const exp = expensesIn(r.from, r.to);
    const prevRev = revenueIn(r.prevFrom, r.prevTo);
    const prevExp = expensesIn(r.prevFrom, r.prevTo);
    const profit = rev.net - exp.net;
    const openReceivables = app.db.select({ s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), sql`${invoices.status} in ('open','sent','overdue')`)).get()!.s;
    const openPayables = app.db.select({ s: sql<number>`coalesce(sum(${expenses.grossCents}),0)` }).from(expenses).where(and(eq(expenses.companyId, ctx.companyId), eq(expenses.isPaid, false))).get()!.s;
    const byCategory = app.db.select({ category: expenses.category, netCents: sql<number>`coalesce(sum(${expenses.netCents}),0)`, n: sql<number>`count(*)` }).from(expenses).where(and(eq(expenses.companyId, ctx.companyId), gte(expenses.date, r.from), sql`${expenses.date} < ${r.to}`)).groupBy(expenses.category).orderBy(sql`2 desc`).all();

    // Zeitreihe: Tage (Tag/Woche/Monat) bzw. Monate (Quartal/Jahr)
    const series: Array<{ label: string; from: string; revenueNetCents: number; expensesNetCents: number }> = [];
    if (period === 'year' || period === 'quarter') {
      const start = new Date(r.from + 'T00:00:00Z');
      const months = period === 'year' ? 12 : 3;
      for (let i = 0; i < months; i++) {
        const f = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1));
        series.push({ label: f.toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }), from: f.toISOString().slice(0, 10), revenueNetCents: revenueIn(f.toISOString().slice(0, 10), t.toISOString().slice(0, 10)).net, expensesNetCents: expensesIn(f.toISOString().slice(0, 10), t.toISOString().slice(0, 10)).net });
      }
    } else {
      const start = new Date(r.from + 'T00:00:00Z'); const end = new Date(r.to + 'T00:00:00Z');
      for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        const f = d.toISOString().slice(0, 10); const t = new Date(d); t.setUTCDate(t.getUTCDate() + 1);
        series.push({ label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }), from: f, revenueNetCents: revenueIn(f, t.toISOString().slice(0, 10)).net, expensesNetCents: expensesIn(f, t.toISOString().slice(0, 10)).net });
      }
    }

    // Hinweise – klar getrennt nach Fakt / Berechnung / Schätzung / Empfehlung
    const hints: Array<{ kind: 'fact' | 'calc' | 'estimate' | 'advice'; level: 'info' | 'warn'; text: string }> = [];
    const eur = (c: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c / 100);
    if (prevRev.net > 0) { const pct = Math.round(((rev.net - prevRev.net) / prevRev.net) * 100); hints.push({ kind: 'calc', level: 'info', text: `Umsatz (netto) liegt ${pct >= 0 ? '+' : ''}${pct} % gegenüber der Vorperiode (${eur(prevRev.net)}).` }); }
    if (prevExp.net > 0 && exp.net > prevExp.net * 1.15) hints.push({ kind: 'calc', level: 'warn', text: `Die Kosten sind gegenüber der Vorperiode um ${Math.round(((exp.net - prevExp.net) / prevExp.net) * 100)} % gestiegen (${eur(prevExp.net)} → ${eur(exp.net)}).` });
    if (rev.net > 0 && profit / rev.net < 0.2) hints.push({ kind: 'calc', level: 'warn', text: `Die Marge liegt bei ${Math.round((profit / rev.net) * 100)} % – unter 20 %. Preise und Materialkosten prüfen.` });
    const vatBalance = rev.vat - exp.vat;
    const company = app.db.select({ smallBusiness: companies.smallBusiness }).from(companies).where(eq(companies.id, ctx.companyId)).get();
    if (!company?.smallBusiness) hints.push({ kind: 'estimate', level: 'info', text: `Umsatzsteuer-Zahllast dieser Periode: ca. ${eur(vatBalance)} (vereinnahmte USt ${eur(rev.vat)} abzüglich Vorsteuer ${eur(exp.vat)}). Schätzung nach Rechnungsdatum, keine Steuerberatung.` });
    if (profit > 0) hints.push({ kind: 'estimate', level: 'info', text: `Rücklage für Einkommen-/Gewerbesteuer: als grobe Orientierung 25–30 % des Gewinns, also ${eur(Math.round(profit * 0.25))} bis ${eur(Math.round(profit * 0.3))}. Individuelle Sätze bitte mit dem Steuerberater abstimmen.` });
    if (openPayables > 0) hints.push({ kind: 'fact', level: 'warn', text: `Unbezahlte Eingangsrechnungen: ${eur(openPayables)}.` });
    if (openReceivables > 0) hints.push({ kind: 'fact', level: 'info', text: `Offene Forderungen: ${eur(openReceivables)}.` });
    const lowStock = app.db.select({ n: sql<number>`count(*)` }).from(inventoryItems).where(and(eq(inventoryItems.companyId, ctx.companyId), eq(inventoryItems.isActive, true), sql`${inventoryItems.minQuantity} > 0 and ${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`)).get()?.n ?? 0;
    if (lowStock > 0) hints.push({ kind: 'fact', level: 'warn', text: `${lowStock} Lagerartikel unter Mindestbestand – Nachbestellung einplanen.` });
    if (rev.n === 0 && exp.n === 0) hints.push({ kind: 'fact', level: 'info', text: 'Nicht genügend Daten für eine zuverlässige Aussage in dieser Periode.' });

    return {
      period, date, range: { from: r.from, to: r.to, label: r.label },
      revenueNetCents: rev.net, revenueVatCents: rev.vat, revenueGrossCents: rev.gross, invoiceCount: rev.n,
      expensesNetCents: exp.net, expensesVatCents: exp.vat, expensesGrossCents: exp.gross, expenseCount: exp.n,
      profitNetCents: profit, marginPct: rev.net > 0 ? Math.round((profit / rev.net) * 1000) / 10 : null,
      paymentsInCents: paymentsIn(r.from, r.to), expensesPaidCents: expensesPaidIn(r.from, r.to), cashflowCents: paymentsIn(r.from, r.to) - expensesPaidIn(r.from, r.to),
      openReceivablesCents: openReceivables, openPayablesCents: openPayables, vatBalanceCents: vatBalance,
      previous: { revenueNetCents: prevRev.net, expensesNetCents: prevExp.net, profitNetCents: prevRev.net - prevExp.net },
      byCategory, series, hints,
    };
  });
}
