import type { FastifyInstance } from 'fastify';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { leads, customers, vehicles, appointments, orders, invoices } from '../../db/schema.js';
import { ctxOf } from '../../plugins/auth.js';

/**
 * Dashboard-Kennzahlen. Es werden ausschließlich Werte geliefert, die aus echten
 * Systemdaten berechnet werden können. Module, die noch keine Daten liefern
 * (Umsatz, Termine, Lager, Marketing), erscheinen erst, wenn sie existieren.
 */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Montag = 0
  x.setDate(x.getDate() - day);
  return x;
}

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', { preHandler: app.requireAuth('dashboard:read') }, async (req) => {
    const ctx = ctxOf(req);
    const now = new Date();
    const today = startOfDay(now).toISOString();
    const weekStart = startOfWeek(now);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const count = (table: typeof leads | typeof customers | typeof vehicles, ...conds: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lt> | undefined>) =>
      app.db.select({ n: sql<number>`count(*)` }).from(table).where(and(eq(table.companyId, ctx.companyId), ...conds)).get()?.n ?? 0;

    const leadsToday = count(leads, gte(leads.createdAt, today));
    const leadsThisWeek = count(leads, gte(leads.createdAt, weekStart.toISOString()));
    const leadsLastWeek = count(leads, gte(leads.createdAt, lastWeekStart.toISOString()), lt(leads.createdAt, weekStart.toISOString()));
    const leadsThisMonth = count(leads, gte(leads.createdAt, monthStart));
    const openLeads = app.db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, ctx.companyId), sql`${leads.status} not in ('won','lost')`)).get()?.n ?? 0;
    const newLeads = count(leads, eq(leads.status, 'new'));
    const wonThisMonth = count(leads, eq(leads.status, 'won'), gte(leads.updatedAt, monthStart));
    const closedThisMonth = app.db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.companyId, ctx.companyId), sql`${leads.status} in ('won','lost')`, gte(leads.updatedAt, monthStart))).get()?.n ?? 0;
    const customersTotal = count(customers, eq(customers.isActive, true));
    const customersThisMonth = count(customers, eq(customers.isActive, true), gte(customers.createdAt, monthStart));
    const vehiclesTotal = count(vehicles, eq(vehicles.isActive, true));

    const bySource = app.db
      .select({ source: leads.source, n: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.companyId, ctx.companyId), gte(leads.createdAt, monthStart)))
      .groupBy(leads.source)
      .all();

    const tomorrow = new Date(startOfDay(now).getTime() + 86_400_000).toISOString();
    const in7 = new Date(startOfDay(now).getTime() + 7 * 86_400_000).toISOString();
    const apptBase = and(eq(appointments.companyId, ctx.companyId), sql`${appointments.status} in ('planned','confirmed')`);
    const appointmentsToday = app.db.select({ n: sql<number>`count(*)` }).from(appointments).where(and(apptBase, gte(appointments.startsAt, today), lt(appointments.startsAt, tomorrow))).get()?.n ?? 0;
    const appointmentsWeek = app.db.select({ n: sql<number>`count(*)` }).from(appointments).where(and(apptBase, gte(appointments.startsAt, now.toISOString()), lt(appointments.startsAt, in7))).get()?.n ?? 0;
    const nextAppointments = app.db
      .select({ id: appointments.id, title: appointments.title, startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, type: appointments.type, customerName: sql<string | null>`(select trim(coalesce(c.company_name || ' · ','') || c.first_name || ' ' || c.last_name) from customers c where c.id = ${appointments.customerId})`, vehicleLabel: sql<string | null>`(select trim(coalesce(v.make,'') || ' ' || coalesce(v.model,'') || ' ' || coalesce(v.license_plate,'')) from vehicles v where v.id = ${appointments.vehicleId})` })
      .from(appointments)
      .where(and(apptBase, gte(appointments.endsAt, now.toISOString())))
      .orderBy(appointments.startsAt)
      .limit(6)
      .all();
    const ordersInProgress = app.db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.companyId, ctx.companyId), sql`${orders.status} in ('accepted','in_progress','quality_check')`)).get()?.n ?? 0;
    const ordersReady = app.db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.companyId, ctx.companyId), eq(orders.status, 'finished'))).get()?.n ?? 0;
    const completedMonth = app.db.select({ n: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${orders.totalCents}),0)` }).from(orders).where(and(eq(orders.companyId, ctx.companyId), eq(orders.status, 'completed'), gte(orders.completedAt, monthStart))).get();

    const dayStr = today.slice(0, 10);
    const weekStr = weekStart.toISOString().slice(0, 10);
    const monthStr = monthStart.slice(0, 10);
    const yearStr = `${now.getFullYear()}-01-01`;
    const revenue = (from: string) => app.db.select({ s: sql<number>`coalesce(sum(${invoices.totalCents}),0)`, n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), sql`${invoices.status} in ('open','sent','overdue','paid')`, gte(invoices.issueDate, from))).get()!;
    const openInv = app.db.select({ s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)`, n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), sql`${invoices.status} in ('open','sent','overdue')`)).get()!;
    const overdueInv = app.db.select({ s: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}),0)`, n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.status, 'overdue'))).get()!;

    const recentLeads = app.db.select().from(leads).where(eq(leads.companyId, ctx.companyId)).orderBy(sql`${leads.createdAt} desc`).limit(6).all();

    const hints: Array<{ level: 'info' | 'warn'; text: string; kind: 'fact' | 'calc' }> = [];
    if (newLeads > 0) hints.push({ level: 'warn', kind: 'fact', text: `${newLeads} neue${newLeads === 1 ? 'r' : ''} Lead${newLeads === 1 ? '' : 's'} ohne Kontaktversuch.` });
    if (leadsLastWeek > 0 && leadsThisWeek < leadsLastWeek) hints.push({ level: 'info', kind: 'calc', text: `Diese Woche bisher ${leadsThisWeek} Leads gegenüber ${leadsLastWeek} in der Vorwoche.` });
    if (overdueInv.n > 0) hints.push({ level: 'warn', kind: 'fact', text: `${overdueInv.n} überfällige Rechnung${overdueInv.n === 1 ? '' : 'en'} mit ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(overdueInv.s / 100)} offen.` });
    if (ordersReady > 0) hints.push({ level: 'info', kind: 'fact', text: `${ordersReady} fertige${ordersReady === 1 ? 'r' : ''} Auftr${ordersReady === 1 ? 'ag wartet' : 'äge warten'} auf Abholung.` });
    if (leadsLastWeek > 0 && leadsThisWeek > leadsLastWeek) hints.push({ level: 'info', kind: 'calc', text: `Leads liegen diese Woche mit ${leadsThisWeek} über der Vorwoche (${leadsLastWeek}).` });

    return {
      generatedAt: now.toISOString(),
      leads: { today: leadsToday, thisWeek: leadsThisWeek, lastWeek: leadsLastWeek, thisMonth: leadsThisMonth, open: openLeads, new: newLeads, conversionRateMonth: closedThisMonth > 0 ? Math.round((wonThisMonth / closedThisMonth) * 1000) / 10 : null, bySource },
      customers: { total: customersTotal, thisMonth: customersThisMonth },
      appointments: { today: appointmentsToday, next7Days: appointmentsWeek, next: nextAppointments },
      revenue: { todayCents: revenue(dayStr).s, weekCents: revenue(weekStr).s, monthCents: revenue(monthStr).s, yearCents: revenue(yearStr).s, monthCount: revenue(monthStr).n, openCents: openInv.s, openCount: openInv.n, overdueCents: overdueInv.s, overdueCount: overdueInv.n },
      orders: { inProgress: ordersInProgress, ready: ordersReady, completedMonth: completedMonth?.n ?? 0, completedMonthCents: completedMonth?.sum ?? 0 },
      vehicles: { total: vehiclesTotal },
      recentLeads,
      hints,
    };
  });
}
