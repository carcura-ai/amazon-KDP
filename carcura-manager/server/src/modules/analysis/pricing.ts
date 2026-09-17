import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { services, invoiceItems, invoices, orderItems, orders } from '../../db/schema.js';

export interface ServicePricing {
  serviceId: string; name: string; category: string | null; priceCents: number; materialCostCents: number; durationMinutes: number;
  bookings90: number; bookingsPrev90: number; revenue90Cents: number; avgPriceCents: number | null;
  marginCents: number; marginPct: number | null; hourlyYieldCents: number | null; demandTrendPct: number | null; hints: string[];
}

/** Preis- und Margenanalyse je Leistung: Buchungen (Aufträge + Rechnungen), Umsatz, Marge, Stundenertrag, Nachfragetrend. */
export function pricingAnalysis(db: Db, companyId: string, days = 90): { items: ServicePricing[]; avgMarginPct: number | null; avgHourlyYieldCents: number | null; generatedAt: string } {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.now() - 2 * days * 86_400_000).toISOString().slice(0, 10);
  const svc = db.select().from(services).where(and(eq(services.companyId, companyId), eq(services.isActive, true))).all();
  const inv = (f: string, t: string) => db.select({ serviceId: invoiceItems.serviceId, n: sql<number>`sum(${invoiceItems.quantity})`, rev: sql<number>`sum(${invoiceItems.totalCents})` }).from(invoiceItems).innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId)).where(and(eq(invoiceItems.companyId, companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, f), sql`${invoices.issueDate} < ${t}`, sql`${invoiceItems.serviceId} is not null`)).groupBy(invoiceItems.serviceId).all();
  const ord = (f: string, t: string) => db.select({ serviceId: orderItems.serviceId, n: sql<number>`sum(${orderItems.quantity})`, rev: sql<number>`sum(${orderItems.totalCents})` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(eq(orderItems.companyId, companyId), sql`${orders.status} != 'cancelled'`, gte(orders.createdAt, f), sql`${orders.createdAt} < ${t}`, sql`${orderItems.serviceId} is not null`)).groupBy(orderItems.serviceId).all();
  const today = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const cur = inv(from, today); const curO = ord(from, today);
  const prev = inv(prevFrom, from); const prevO = ord(prevFrom, from);
  const items: ServicePricing[] = svc.map((s) => {
    const ci = cur.find((x) => x.serviceId === s.id); const co = curO.find((x) => x.serviceId === s.id);
    // Rechnungen sind die verlässliche Basis; Aufträge zählen nur, wenn (noch) keine Rechnung existiert
    const bookings = (ci?.n ?? 0) > 0 ? ci!.n : co?.n ?? 0;
    const revenue = (ci?.n ?? 0) > 0 ? ci!.rev : co?.rev ?? 0;
    const pi = prev.find((x) => x.serviceId === s.id); const po = prevO.find((x) => x.serviceId === s.id);
    const bookingsPrev = (pi?.n ?? 0) > 0 ? pi!.n : po?.n ?? 0;
    const avgPrice = bookings > 0 ? Math.round(revenue / bookings) : null;
    const price = avgPrice ?? s.priceCents;
    const margin = price - s.materialCostCents;
    const marginPct = price > 0 ? Math.round((margin / price) * 1000) / 10 : null;
    const hourly = s.durationMinutes > 0 ? Math.round((margin / s.durationMinutes) * 60) : null;
    const trend = bookingsPrev > 0 ? Math.round(((bookings - bookingsPrev) / bookingsPrev) * 100) : null;
    return { serviceId: s.id, name: s.name, category: s.category, priceCents: s.priceCents, materialCostCents: s.materialCostCents, durationMinutes: s.durationMinutes, bookings90: bookings, bookingsPrev90: bookingsPrev, revenue90Cents: revenue, avgPriceCents: avgPrice, marginCents: margin, marginPct, hourlyYieldCents: hourly, demandTrendPct: trend, hints: [] };
  });
  const withMargin = items.filter((i) => i.marginPct !== null && i.priceCents > 0);
  const avgMargin = withMargin.length ? Math.round((withMargin.reduce((s, i) => s + (i.marginPct ?? 0), 0) / withMargin.length) * 10) / 10 : null;
  const withHourly = items.filter((i) => i.hourlyYieldCents !== null && i.priceCents > 0);
  const avgHourly = withHourly.length ? Math.round(withHourly.reduce((s, i) => s + (i.hourlyYieldCents ?? 0), 0) / withHourly.length) : null;
  for (const i of items) {
    if (i.priceCents === 0) i.hints.push('Kein Preis hinterlegt – Katalog pflegen.');
    if (avgMargin !== null && i.marginPct !== null && i.priceCents > 0 && i.marginPct < avgMargin - 15) i.hints.push(`Marge ${i.marginPct} % liegt deutlich unter dem Durchschnitt (${avgMargin} %).`);
    if (avgHourly !== null && i.hourlyYieldCents !== null && i.priceCents > 0 && i.hourlyYieldCents < avgHourly * 0.7) i.hints.push(`Stundenertrag ${(i.hourlyYieldCents / 100).toFixed(0)} € liegt unter dem Durchschnitt (${(avgHourly / 100).toFixed(0)} €) – Dauer oder Preis prüfen.`);
    if (i.demandTrendPct !== null && i.demandTrendPct >= 30 && i.bookings90 >= 3) i.hints.push(`Nachfrage um ${i.demandTrendPct} % gestiegen – Preisüberprüfung könnte sinnvoll sein.`);
    if (i.avgPriceCents !== null && i.priceCents > 0 && i.avgPriceCents < i.priceCents * 0.9) i.hints.push(`Tatsächlich abgerechnet wurden im Schnitt ${(i.avgPriceCents / 100).toFixed(2)} € statt Listenpreis ${(i.priceCents / 100).toFixed(2)} € (Rabatte?).`);
  }
  items.sort((a, b) => b.revenue90Cents - a.revenue90Cents);
  return { items, avgMarginPct: avgMargin, avgHourlyYieldCents: avgHourly, generatedAt: new Date().toISOString() };
}
