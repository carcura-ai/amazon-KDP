import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { plans, planFeatures, addons, tenantAddons, subscriptionEvents, companies, users } from '../../db/schema.js';
import { parse, zOptionalText } from '../../core/validation.js';
import { conflict } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { FEATURES } from '../../core/entitlements.js';
import { cancelSubscription, changePlan, reactivateSubscription, redeemDiscount, subscriptionOf } from '../../core/subscriptions.js';

/** Vertrag & Abo aus Sicht des Mandanten: Tarif, Module, Tarifwechsel, Kündigung (Einstellungen → Vertrag). */
export default async function subscriptionRoutes(app: FastifyInstance) {
  const publicPlans = () => app.db.select().from(plans).where(and(eq(plans.isActive, true), eq(plans.isPublic, true))).orderBy(asc(plans.sortOrder)).all().map((p) => ({
    ...p, features: app.db.select({ k: planFeatures.featureKey }).from(planFeatures).where(eq(planFeatures.planId, p.id)).all().map((r) => r.k),
  }));
  const saasOnly = () => { if (app.config.deploymentMode !== 'saas') throw conflict('In dieser Installation (Self-Hosted) sind alle Module ohne Abonnement freigeschaltet.'); };

  app.get('/api/subscription', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    const ent = req.entitlements();
    const sub = subscriptionOf(app.db, ctx.companyId);
    const canManage = ctx.permissions.has('subscription:manage');
    return {
      mode: ent.mode, source: ent.source, status: ent.status, canWrite: ent.canWrite,
      plan: ent.plan, features: [...ent.features], featureLabels: FEATURES, limits: ent.limits,
      subscription: sub && canManage ? { id: sub.id, status: sub.status, billingInterval: sub.billingInterval, startDate: sub.startDate, trialEnd: sub.trialEnd, nextBillingDate: sub.nextBillingDate, cancellationDate: sub.cancellationDate, cancelledAt: sub.cancelledAt, pendingPlanId: sub.pendingPlanId, discountPercent: sub.discountPercent, discountAmountCents: sub.discountAmountCents, discountUntil: sub.discountUntil, paymentProvider: sub.paymentProvider, currency: sub.currency, setupFeeCents: sub.setupFeeCents } : null,
      plans: canManage ? publicPlans() : [],
      addons: canManage ? app.db.select().from(addons).where(eq(addons.isActive, true)).orderBy(asc(addons.sortOrder)).all() : [],
      activeAddons: canManage ? app.db.select({ code: addons.code, name: addons.name, quantity: tenantAddons.quantity }).from(tenantAddons).innerJoin(addons, eq(addons.id, tenantAddons.addonId)).where(and(eq(tenantAddons.companyId, ctx.companyId), eq(tenantAddons.status, 'active'))).all() : [],
      events: canManage ? app.db.select().from(subscriptionEvents).where(eq(subscriptionEvents.companyId, ctx.companyId)).orderBy(desc(subscriptionEvents.createdAt)).limit(30).all() : [],
      canManage,
    };
  });

  app.post('/api/subscription/change', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    saasOnly();
    const ctx = ctxOf(req);
    const input = parse(z.object({ planCode: z.string().min(2).max(40), interval: z.enum(['monthly', 'yearly']).default('monthly') }), req.body);
    const r = changePlan(app.db, ctx.companyId, input.planCode, input.interval, { userId: ctx.userId, source: 'app' });
    writeAudit(app.db, ctx, { action: 'subscription.change', entityType: 'subscription', entityId: r.subscription.id, after: { ...input, effective: r.effective } });
    return r;
  });

  /** Kündigung: Zugriff und Datenexport bleiben bis zum Vertragsende. Bestätigung per E-Mail an die Admins. */
  app.post('/api/subscription/cancel', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    saasOnly();
    const ctx = ctxOf(req);
    const input = parse(z.object({ confirm: z.literal(true), reason: zOptionalText(1000) }), req.body);
    const sub = cancelSubscription(app.db, ctx.companyId, input.reason ?? null, { userId: ctx.userId, source: 'app' });
    const provider = app.payments.get(sub.paymentProvider);
    if (provider) await provider.cancelSubscription({ externalSubscriptionId: sub.externalSubscriptionId, atPeriodEnd: true });
    writeAudit(app.db, ctx, { action: 'subscription.cancel', entityType: 'subscription', entityId: sub.id, after: { effective: sub.cancellationDate } });
    const company = app.db.select({ name: companies.name, email: companies.email }).from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const end = sub.cancellationDate ? new Date(sub.cancellationDate).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : 'sofort';
    const me = app.db.select().from(users).where(eq(users.id, ctx.userId)).get();
    if (me && app.mail.canSendAccountMail(ctx.companyId)) {
      await app.mail.sendAccountMail(ctx.companyId, { to: me.email, subject: 'Bestätigung Ihrer Kündigung', text: `Guten Tag ${me.firstName},\n\nwir bestätigen die Kündigung des Abonnements für ${company.name}, eingegangen am ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}.\n\nVertragsende: ${end}\n\nBis dahin können Sie wie gewohnt arbeiten und Ihre Daten jederzeit unter Einstellungen → Datenschutz → Datenexport vollständig herunterladen. Nach dem Vertragsende sind die Daten noch für die vereinbarte Frist lesbar und exportierbar und werden danach gelöscht.\n\nSie können die Kündigung bis zum Vertragsende unter Einstellungen → Vertrag & Abo zurücknehmen.`, refType: 'subscription_cancel' });
    }
    return { ok: true, cancellationDate: sub.cancellationDate };
  });

  app.post('/api/subscription/reactivate', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    saasOnly();
    const ctx = ctxOf(req);
    const sub = reactivateSubscription(app.db, ctx.companyId, { userId: ctx.userId, source: 'app' });
    writeAudit(app.db, ctx, { action: 'subscription.reactivate', entityType: 'subscription', entityId: sub.id });
    return { ok: true, status: sub.status };
  });

  app.post('/api/subscription/discount', { preHandler: app.requireAuth('subscription:manage'), config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    saasOnly();
    const ctx = ctxOf(req);
    const { code } = parse(z.object({ code: z.string().trim().min(3).max(40) }), req.body);
    const sub = redeemDiscount(app.db, ctx.companyId, code, { userId: ctx.userId, source: 'app' });
    writeAudit(app.db, ctx, { action: 'subscription.discount', entityType: 'subscription', entityId: sub.id, after: { code: code.toUpperCase() } });
    return { ok: true, discountPercent: sub.discountPercent, discountAmountCents: sub.discountAmountCents, discountUntil: sub.discountUntil };
  });

  /** Online-Zahlung starten, falls der Anbieter das unterstützt; sonst Hinweis auf Rechnung/Überweisung. */
  app.post('/api/subscription/checkout', { preHandler: app.requireAuth('subscription:manage') }, async (req) => {
    saasOnly();
    const ctx = ctxOf(req);
    const input = parse(z.object({ planCode: z.string().min(2).max(40), interval: z.enum(['monthly', 'yearly']).default('monthly') }), req.body);
    const sub = subscriptionOf(app.db, ctx.companyId);
    const provider = app.payments.get(sub?.paymentProvider ?? 'manual') ?? app.payments.get('manual')!;
    const base = app.config.publicUrl.replace(/\/$/, '');
    const checkout = await provider.createCheckout({ companyId: ctx.companyId, planCode: input.planCode, interval: input.interval, successUrl: `${base}/einstellungen/vertrag?zahlung=ok`, cancelUrl: `${base}/einstellungen/vertrag?zahlung=abgebrochen` });
    return checkout ? { url: checkout.url } : { url: null, message: 'Die Abrechnung erfolgt per Rechnung. Der Betreiber schaltet den Tarif nach Zahlungseingang frei.' };
  });
}
