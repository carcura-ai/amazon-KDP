import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { plans, planFeatures, addons, discountCodes, tenantSubscriptions, tenantAddons, tenantFeatureOverrides, subscriptionEvents, companies } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { FEATURE_KEYS, FEATURES } from '../../core/entitlements.js';
import { logEvent, monthlyRevenueCents, planByCode, startSubscription, subscriptionOf } from '../../core/subscriptions.js';

const money = z.number().int().min(0).max(100_000_000);
const featureEnum = z.enum(FEATURE_KEYS as [string, ...string[]]);
const planSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, 'Code: Großbuchstaben, Ziffern, Unterstrich'),
  name: zTrimmed(80).min(2),
  description: zOptionalText(500),
  monthlyPriceCents: money.nullable(),
  yearlyPriceCents: money.nullable(),
  setupFeeCents: money.default(0),
  trialDays: z.number().int().min(0).max(90).default(14),
  maxUsers: z.number().int().min(1).max(10_000).nullable(),
  maxLocations: z.number().int().min(1).max(1000).nullable(),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  features: z.array(featureEnum).max(FEATURE_KEYS.length),
});

/**
 * Betreiberbereich für Tarife, Module, Rabatte und Abos. Enthält keine Kundendaten der Mandanten.
 * Kennzahlen (MRR, ARR, Churn) werden nur aus vorhandenen Abo-Daten berechnet; fehlen Daten, wird
 * „null“ geliefert statt einer Schätzung.
 */
export default async function saasAdminRoutes(app: FastifyInstance) {
  const pre = { preHandler: app.requirePlatformAdmin() };
  const withFeatures = (p: typeof plans.$inferSelect) => ({ ...p, features: app.db.select({ k: planFeatures.featureKey }).from(planFeatures).where(eq(planFeatures.planId, p.id)).all().map((r) => r.k) });
  const setFeatures = (planId: string, keys: string[]) => {
    app.db.delete(planFeatures).where(eq(planFeatures.planId, planId)).run();
    for (const k of new Set(keys)) app.db.insert(planFeatures).values({ id: newId(), planId, featureKey: k }).run();
  };

  app.get('/api/platform/plans', pre, async () => ({
    items: app.db.select().from(plans).orderBy(asc(plans.sortOrder)).all().map(withFeatures),
    addons: app.db.select().from(addons).orderBy(asc(addons.sortOrder)).all(),
    discountCodes: app.db.select().from(discountCodes).all(),
    featureLabels: FEATURES,
    note: 'Preise sind Platzhalter und vor Verkaufsstart festzulegen.',
  }));

  app.post('/api/platform/plans', pre, async (req) => {
    const ctx = ctxOf(req);
    const { features, ...input } = parse(planSchema, req.body);
    if (app.db.select({ id: plans.id }).from(plans).where(eq(plans.code, input.code)).get()) throw conflict('Dieser Tarif-Code existiert bereits.');
    const id = newId();
    app.db.insert(plans).values({ id, ...input }).run();
    setFeatures(id, features);
    writeAudit(app.db, ctx, { action: 'platform.plan_create', entityType: 'plan', entityId: id, after: { ...input, features } });
    return withFeatures(app.db.select().from(plans).where(eq(plans.id, id)).get()!);
  });

  app.patch('/api/platform/plans/:id', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = app.db.select().from(plans).where(eq(plans.id, id)).get();
    if (!before) throw notFound('Tarif');
    const { features, ...input } = parse(planSchema.omit({ code: true }).partial(), req.body);
    app.db.update(plans).set({ ...input, updatedAt: nowIso() }).where(eq(plans.id, id)).run();
    if (features) setFeatures(id, features);
    writeAudit(app.db, ctx, { action: 'platform.plan_update', entityType: 'plan', entityId: id, before: withFeatures(before), after: { ...input, features } });
    return withFeatures(app.db.select().from(plans).where(eq(plans.id, id)).get()!);
  });

  app.patch('/api/platform/addons/:id', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    if (!app.db.select({ id: addons.id }).from(addons).where(eq(addons.id, id)).get()) throw notFound('Zusatzmodul');
    const input = parse(z.object({ name: zTrimmed(80).min(2), description: zOptionalText(500), monthlyPriceCents: money.nullable(), yearlyPriceCents: money.nullable(), isActive: z.boolean(), features: z.array(featureEnum) }).partial(), req.body);
    const { features, ...rest } = input;
    app.db.update(addons).set({ ...rest, ...(features ? { featureKeysJson: JSON.stringify(features) } : {}), updatedAt: nowIso() }).where(eq(addons.id, id)).run();
    writeAudit(app.db, ctx, { action: 'platform.addon_update', entityType: 'addon', entityId: id, after: input });
    return app.db.select().from(addons).where(eq(addons.id, id)).get();
  });

  app.post('/api/platform/discount-codes', pre, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ code: z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9-]{3,40}$/)), description: zOptionalText(300), percentOff: z.number().int().min(1).max(100).nullable().default(null), amountOffCents: money.nullable().default(null), durationMonths: z.number().int().min(1).max(60).nullable().default(null), maxRedemptions: z.number().int().min(1).nullable().default(null), validUntil: z.string().datetime({ offset: true }).nullable().default(null) }), req.body);
    if (!input.percentOff && !input.amountOffCents) throw badRequest('Prozent- oder Betragsrabatt angeben.');
    if (app.db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, input.code)).get()) throw conflict('Code existiert bereits.');
    const id = newId();
    app.db.insert(discountCodes).values({ id, ...input }).run();
    writeAudit(app.db, ctx, { action: 'platform.discount_create', entityType: 'discount_code', entityId: id, after: input });
    return app.db.select().from(discountCodes).where(eq(discountCodes.id, id)).get();
  });

  app.patch('/api/platform/discount-codes/:id', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
    if (!app.db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.id, id)).get()) throw notFound('Rabattcode');
    app.db.update(discountCodes).set({ isActive }).where(eq(discountCodes.id, id)).run();
    writeAudit(app.db, ctx, { action: 'platform.discount_update', entityType: 'discount_code', entityId: id, after: { isActive } });
    return { ok: true };
  });

  /* ---------------------------------------------------------- Abo eines Mandanten */
  const companyOr404 = (id: string) => { const c = app.db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, id)).get(); if (!c) throw notFound('Mandant'); return c; };

  app.get('/api/platform/companies/:id/subscription', pre, async (req) => {
    const { id } = req.params as { id: string };
    companyOr404(id);
    const ent = app.entitlementsFor(id);
    return {
      subscription: subscriptionOf(app.db, id), entitlements: { ...ent, features: [...ent.features] },
      addons: app.db.select({ id: tenantAddons.id, code: addons.code, name: addons.name, quantity: tenantAddons.quantity, status: tenantAddons.status }).from(tenantAddons).innerJoin(addons, eq(addons.id, tenantAddons.addonId)).where(eq(tenantAddons.companyId, id)).all(),
      overrides: app.db.select().from(tenantFeatureOverrides).where(eq(tenantFeatureOverrides.companyId, id)).all(),
      events: app.db.select().from(subscriptionEvents).where(eq(subscriptionEvents.companyId, id)).orderBy(sql`${subscriptionEvents.createdAt} desc`).limit(50).all(),
    };
  });

  /** Manuelle Pflege: Tarif zuweisen, freischalten nach Zahlungseingang, Status und Termine setzen. */
  app.put('/api/platform/companies/:id/subscription', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    companyOr404(id);
    const input = parse(z.object({
      planCode: z.string().min(2).max(40),
      status: z.enum(['trial', 'active', 'past_due', 'paused', 'cancelled', 'expired']).optional(),
      billingInterval: z.enum(['monthly', 'yearly']).optional(),
      trialEnd: z.string().datetime({ offset: true }).nullable().optional(),
      nextBillingDate: z.string().datetime({ offset: true }).nullable().optional(),
      cancellationDate: z.string().datetime({ offset: true }).nullable().optional(),
      paymentProvider: z.string().max(40).optional(),
      externalCustomerId: zOptionalText(200),
      externalSubscriptionId: zOptionalText(200),
    }), req.body);
    const plan = planByCode(app.db, input.planCode);
    let sub = subscriptionOf(app.db, id);
    if (!sub) sub = startSubscription(app.db, id, plan.code, { interval: input.billingInterval, trial: input.status === 'trial' || input.status === undefined, provider: input.paymentProvider }, { userId: ctx.userId, source: 'admin' });
    const { planCode: _p, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest, planId: plan.id, updatedAt: nowIso() };
    if (input.status === 'active' && !sub.currentPeriodStart) patch.currentPeriodStart = nowIso();
    app.db.update(tenantSubscriptions).set(patch).where(eq(tenantSubscriptions.id, sub.id)).run();
    logEvent(app.db, id, sub.id, 'admin_update', input, { userId: ctx.userId, source: 'admin' });
    writeAudit(app.db, ctx, { action: 'platform.subscription_update', entityType: 'subscription', entityId: sub.id, after: { companyId: id, ...input } });
    return subscriptionOf(app.db, id);
  });

  app.put('/api/platform/companies/:id/features', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    companyOr404(id);
    const input = parse(z.object({ featureKey: featureEnum, enabled: z.boolean().nullable(), reason: zOptionalText(300) }), req.body);
    app.db.delete(tenantFeatureOverrides).where(and(eq(tenantFeatureOverrides.companyId, id), eq(tenantFeatureOverrides.featureKey, input.featureKey))).run();
    if (input.enabled !== null) app.db.insert(tenantFeatureOverrides).values({ id: newId(), companyId: id, featureKey: input.featureKey, enabled: input.enabled, reason: input.reason, createdByUserId: ctx.userId }).run();
    logEvent(app.db, id, null, 'feature_override', input, { userId: ctx.userId, source: 'admin' });
    writeAudit(app.db, ctx, { action: 'platform.feature_override', entityType: 'company', entityId: id, after: input });
    return { ok: true, features: [...app.entitlementsFor(id).features] };
  });

  app.put('/api/platform/companies/:id/addons', pre, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    companyOr404(id);
    const input = parse(z.object({ addonCode: z.string().min(2).max(40), quantity: z.number().int().min(0).max(1000) }), req.body);
    const addon = app.db.select().from(addons).where(eq(addons.code, input.addonCode)).get();
    if (!addon) throw notFound('Zusatzmodul');
    const existing = app.db.select().from(tenantAddons).where(and(eq(tenantAddons.companyId, id), eq(tenantAddons.addonId, addon.id), eq(tenantAddons.status, 'active'))).get();
    if (input.quantity === 0 && existing) app.db.update(tenantAddons).set({ status: 'cancelled', endedAt: nowIso() }).where(eq(tenantAddons.id, existing.id)).run();
    else if (existing) app.db.update(tenantAddons).set({ quantity: input.quantity }).where(eq(tenantAddons.id, existing.id)).run();
    else if (input.quantity > 0) app.db.insert(tenantAddons).values({ id: newId(), companyId: id, addonId: addon.id, quantity: input.quantity, startedAt: nowIso() }).run();
    logEvent(app.db, id, subscriptionOf(app.db, id)?.id ?? null, 'addon_changed', input, { userId: ctx.userId, source: 'admin' });
    writeAudit(app.db, ctx, { action: 'platform.addon_assign', entityType: 'company', entityId: id, after: input });
    return { ok: true };
  });

  /** Kennzahlen nur aus vorhandenen Daten. MRR = Summe der Monatsbeträge aktiver (nicht Test-)Abos. */
  app.get('/api/platform/metrics', pre, async () => {
    const subs = app.db.select().from(tenantSubscriptions).all();
    const byStatus: Record<string, number> = {};
    for (const s of subs) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const paying = subs.filter((s) => s.status === 'active' || s.status === 'past_due' || (s.status === 'cancelled' && s.cancellationDate && new Date(s.cancellationDate) > new Date()));
    const mrr = paying.length ? paying.reduce((sum, s) => sum + monthlyRevenueCents(app.db, s), 0) : null;
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const churned = app.db.select({ n: sql<number>`count(distinct ${subscriptionEvents.companyId})` }).from(subscriptionEvents).where(and(inArray(subscriptionEvents.type, ['expired']), gte(subscriptionEvents.createdAt, since))).get()!.n;
    const base = paying.length + churned;
    const moduleUsage: Record<string, number> = {};
    for (const c of app.db.select({ id: companies.id }).from(companies).all()) for (const f of app.entitlementsFor(c.id).features) moduleUsage[f] = (moduleUsage[f] ?? 0) + 1;
    return {
      tenants: app.db.select({ n: sql<number>`count(*)` }).from(companies).get()!.n,
      tenantsWithoutSubscription: app.db.select({ n: sql<number>`count(*)` }).from(companies).where(sql`not exists (select 1 from tenant_subscriptions s where s.company_id = ${companies.id})`).get()!.n,
      subscriptionsByStatus: byStatus,
      mrrCents: mrr, arrCents: mrr === null ? null : mrr * 12,
      churn30d: base > 0 ? { churned, base, rate: Math.round((churned / base) * 1000) / 10 } : null,
      moduleUsage,
      note: mrr === null ? 'Noch keine zahlenden Abonnements – keine Umsatzkennzahlen.' : 'MRR ohne Testphasen, inkl. Add-ons und laufender Rabatte, ohne Einrichtungsgebühren.',
    };
  });
}
