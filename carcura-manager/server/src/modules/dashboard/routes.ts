import type { FastifyInstance } from 'fastify';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { leads, customers, vehicles } from '../../db/schema.js';
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

    const recentLeads = app.db.select().from(leads).where(eq(leads.companyId, ctx.companyId)).orderBy(sql`${leads.createdAt} desc`).limit(6).all();

    const hints: Array<{ level: 'info' | 'warn'; text: string; kind: 'fact' | 'calc' }> = [];
    if (newLeads > 0) hints.push({ level: 'warn', kind: 'fact', text: `${newLeads} neue${newLeads === 1 ? 'r' : ''} Lead${newLeads === 1 ? '' : 's'} ohne Kontaktversuch.` });
    if (leadsLastWeek > 0 && leadsThisWeek < leadsLastWeek) hints.push({ level: 'info', kind: 'calc', text: `Diese Woche bisher ${leadsThisWeek} Leads gegenüber ${leadsLastWeek} in der Vorwoche.` });
    if (leadsLastWeek > 0 && leadsThisWeek > leadsLastWeek) hints.push({ level: 'info', kind: 'calc', text: `Leads liegen diese Woche mit ${leadsThisWeek} über der Vorwoche (${leadsLastWeek}).` });

    return {
      generatedAt: now.toISOString(),
      leads: { today: leadsToday, thisWeek: leadsThisWeek, lastWeek: leadsLastWeek, thisMonth: leadsThisMonth, open: openLeads, new: newLeads, conversionRateMonth: closedThisMonth > 0 ? Math.round((wonThisMonth / closedThisMonth) * 1000) / 10 : null, bySource },
      customers: { total: customersTotal, thisMonth: customersThisMonth },
      vehicles: { total: vehiclesTotal },
      recentLeads,
      hints,
    };
  });
}
