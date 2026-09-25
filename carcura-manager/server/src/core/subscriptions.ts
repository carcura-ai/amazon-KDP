import { and, eq, lt, sql, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { plans, tenantSubscriptions, subscriptionEvents, discountCodes, users, addons, tenantAddons } from '../db/schema.js';
import { newId, nowIso } from './ids.js';
import { badRequest, conflict, notFound } from './errors.js';

export type Interval = 'monthly' | 'yearly';
export type Actor = { userId: string | null; source: 'app' | 'admin' | 'webhook' | 'job' };

const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const periodMonths = (i: Interval) => (i === 'yearly' ? 12 : 1);

export function logEvent(db: Db, companyId: string, subscriptionId: string | null, type: string, data: unknown, actor: Actor): void {
  db.insert(subscriptionEvents).values({ id: newId(), companyId, subscriptionId, type, dataJson: JSON.stringify(data ?? {}), actorUserId: actor.userId, source: actor.source }).run();
}

export function planByCode(db: Db, code: string) {
  const p = db.select().from(plans).where(eq(plans.code, code.toUpperCase())).get();
  if (!p || !p.isActive) throw notFound('Tarif');
  return p;
}

export function subscriptionOf(db: Db, companyId: string) {
  return db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.companyId, companyId)).get() ?? null;
}

/** Neues Abo, standardmäßig als Testphase gemäß Tarif. */
export function startSubscription(db: Db, companyId: string, planCode: string, opts: { interval?: Interval; trial?: boolean; provider?: string }, actor: Actor) {
  if (subscriptionOf(db, companyId)) throw conflict('Für diesen Mandanten besteht bereits ein Abonnement.');
  const plan = planByCode(db, planCode);
  const now = new Date();
  const interval = opts.interval ?? 'monthly';
  const trial = opts.trial !== false && plan.trialDays > 0;
  const id = newId();
  db.insert(tenantSubscriptions).values({
    id, companyId, planId: plan.id, status: trial ? 'trial' : 'active', billingInterval: interval, startDate: now.toISOString(),
    trialStart: trial ? now.toISOString() : null, trialEnd: trial ? addDays(now, plan.trialDays).toISOString() : null,
    currentPeriodStart: trial ? null : now.toISOString(), nextBillingDate: trial ? addDays(now, plan.trialDays).toISOString() : addMonths(now, periodMonths(interval)).toISOString(),
    setupFeeCents: plan.setupFeeCents, currency: plan.currency, paymentProvider: opts.provider ?? 'manual',
  }).run();
  logEvent(db, companyId, id, trial ? 'trial_started' : 'activated', { plan: plan.code, interval }, actor);
  return subscriptionOf(db, companyId)!;
}

const monthlyEquivalent = (p: typeof plans.$inferSelect, interval: Interval) => (interval === 'yearly' ? (p.yearlyPriceCents ?? (p.monthlyPriceCents ?? 0) * 12) / 12 : p.monthlyPriceCents ?? 0);

/** Tarifwechsel: Upgrade sofort, Downgrade zum Ende des Abrechnungszeitraums. Limits werden geprüft. */
export function changePlan(db: Db, companyId: string, planCode: string, interval: Interval, actor: Actor) {
  const sub = subscriptionOf(db, companyId);
  if (!sub) throw notFound('Abonnement');
  const target = planByCode(db, planCode);
  const current = db.select().from(plans).where(eq(plans.id, sub.planId)).get()!;
  if (target.id === current.id && interval === sub.billingInterval) throw badRequest('Dieser Tarif ist bereits gebucht.');
  if (target.maxUsers !== null) {
    const active = db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.companyId, companyId), eq(users.isActive, true))).get()!.n;
    const extra = db.select({ e: addons.extraUsers, q: tenantAddons.quantity }).from(tenantAddons).innerJoin(addons, eq(addons.id, tenantAddons.addonId)).where(and(eq(tenantAddons.companyId, companyId), eq(tenantAddons.status, 'active'))).all().reduce((s, r) => s + r.e * r.q, 0);
    if (active > target.maxUsers + extra) throw badRequest(`Im Tarif ${target.name} sind höchstens ${target.maxUsers + extra} aktive Benutzer möglich; aktuell sind es ${active}. Bitte vorher Benutzer deaktivieren.`);
  }
  const upgrade = monthlyEquivalent(target, interval) >= monthlyEquivalent(current, sub.billingInterval as Interval);
  if (upgrade || sub.status === 'trial') {
    db.update(tenantSubscriptions).set({ planId: target.id, billingInterval: interval, pendingPlanId: null, updatedAt: nowIso() }).where(eq(tenantSubscriptions.id, sub.id)).run();
    logEvent(db, companyId, sub.id, 'plan_changed', { from: current.code, to: target.code, interval, effective: 'sofort' }, actor);
    return { effective: 'now' as const, subscription: subscriptionOf(db, companyId)! };
  }
  db.update(tenantSubscriptions).set({ pendingPlanId: target.id, updatedAt: nowIso() }).where(eq(tenantSubscriptions.id, sub.id)).run();
  logEvent(db, companyId, sub.id, 'plan_change_scheduled', { from: current.code, to: target.code, interval, effective: sub.nextBillingDate }, actor);
  return { effective: 'period_end' as const, subscription: subscriptionOf(db, companyId)! };
}

/** Kündigung zum Ende des laufenden Zeitraums (bzw. der Testphase). Zugriff und Export bleiben bis dahin. */
export function cancelSubscription(db: Db, companyId: string, reason: string | null, actor: Actor) {
  const sub = subscriptionOf(db, companyId);
  if (!sub) throw notFound('Abonnement');
  if (sub.status === 'cancelled' || sub.status === 'expired') throw conflict('Das Abonnement ist bereits gekündigt.');
  const end = sub.status === 'trial' ? sub.trialEnd : sub.nextBillingDate;
  const now = nowIso();
  db.update(tenantSubscriptions).set({ status: 'cancelled', cancelAtPeriodEnd: true, cancelledAt: now, cancellationDate: end ?? now, cancellationReason: reason, pendingPlanId: null, updatedAt: now }).where(eq(tenantSubscriptions.id, sub.id)).run();
  logEvent(db, companyId, sub.id, 'cancelled', { effective: end, reason }, actor);
  return subscriptionOf(db, companyId)!;
}

/** Kündigung zurücknehmen, solange das Vertragsende nicht erreicht ist. */
export function reactivateSubscription(db: Db, companyId: string, actor: Actor) {
  const sub = subscriptionOf(db, companyId);
  if (!sub) throw notFound('Abonnement');
  if (sub.status !== 'cancelled' || (sub.cancellationDate && new Date(sub.cancellationDate) <= new Date())) throw conflict('Nur eine laufende Kündigung kann zurückgenommen werden. Nach Vertragsende bitte neu buchen.');
  const inTrial = sub.trialEnd && new Date(sub.trialEnd) > new Date() && !sub.currentPeriodStart;
  db.update(tenantSubscriptions).set({ status: inTrial ? 'trial' : 'active', cancelAtPeriodEnd: false, cancelledAt: null, cancellationDate: null, cancellationReason: null, updatedAt: nowIso() }).where(eq(tenantSubscriptions.id, sub.id)).run();
  logEvent(db, companyId, sub.id, 'reactivated', {}, actor);
  return subscriptionOf(db, companyId)!;
}

export function redeemDiscount(db: Db, companyId: string, code: string, actor: Actor) {
  const sub = subscriptionOf(db, companyId);
  if (!sub) throw notFound('Abonnement');
  const d = db.select().from(discountCodes).where(eq(discountCodes.code, code.trim().toUpperCase())).get();
  const invalid = () => badRequest('Der Rabattcode ist ungültig oder abgelaufen.');
  if (!d || !d.isActive) throw invalid();
  if (d.validUntil && new Date(d.validUntil) < new Date()) throw invalid();
  if (d.maxRedemptions !== null && d.redemptions >= d.maxRedemptions) throw invalid();
  if (sub.discountCodeId) throw conflict('Es ist bereits ein Rabatt hinterlegt.');
  const until = d.durationMonths ? addMonths(new Date(), d.durationMonths).toISOString() : null;
  db.transaction((tx) => {
    tx.update(tenantSubscriptions).set({ discountCodeId: d.id, discountPercent: d.percentOff, discountAmountCents: d.amountOffCents, discountUntil: until, updatedAt: nowIso() }).where(eq(tenantSubscriptions.id, sub.id)).run();
    tx.update(discountCodes).set({ redemptions: d.redemptions + 1 }).where(eq(discountCodes.id, d.id)).run();
  });
  logEvent(db, companyId, sub.id, 'discount_applied', { code: d.code, percentOff: d.percentOff, amountOffCents: d.amountOffCents, until }, actor);
  return subscriptionOf(db, companyId)!;
}

/** Monatlicher Betrag (Cent) eines Abos inkl. Add-ons und Rabatt – Grundlage für MRR. Testphasen zählen nicht. */
export function monthlyRevenueCents(db: Db, sub: typeof tenantSubscriptions.$inferSelect, now = new Date()): number {
  const plan = db.select().from(plans).where(eq(plans.id, sub.planId)).get();
  if (!plan) return 0;
  let cents = monthlyEquivalent(plan, sub.billingInterval as Interval);
  for (const a of db.select({ a: addons, q: tenantAddons.quantity }).from(tenantAddons).innerJoin(addons, eq(addons.id, tenantAddons.addonId)).where(and(eq(tenantAddons.companyId, sub.companyId), eq(tenantAddons.status, 'active'))).all()) {
    cents += (sub.billingInterval === 'yearly' ? (a.a.yearlyPriceCents ?? (a.a.monthlyPriceCents ?? 0) * 12) / 12 : a.a.monthlyPriceCents ?? 0) * a.q;
  }
  const discountActive = !sub.discountUntil || new Date(sub.discountUntil) > now;
  if (discountActive && sub.discountPercent) cents *= 1 - sub.discountPercent / 100;
  if (discountActive && sub.discountAmountCents) cents = Math.max(0, cents - sub.discountAmountCents);
  return Math.round(cents);
}

/**
 * Täglicher Lauf: Testphase ohne Freischaltung → abgelaufen; Kündigung nach Vertragsende → abgelaufen;
 * vorgemerkter Downgrade zum Zeitraumwechsel; Abrechnungszeitraum fortschreiben (manueller Anbieter).
 */
export function runSubscriptionLifecycle(db: Db, now = new Date()): string {
  const iso = now.toISOString();
  let expired = 0; let downgraded = 0; let rolled = 0;
  for (const s of db.select().from(tenantSubscriptions).where(and(eq(tenantSubscriptions.status, 'trial'), lt(tenantSubscriptions.trialEnd, iso))).all()) {
    db.update(tenantSubscriptions).set({ status: 'expired', updatedAt: iso }).where(eq(tenantSubscriptions.id, s.id)).run();
    logEvent(db, s.companyId, s.id, 'expired', { reason: 'Testphase beendet' }, { userId: null, source: 'job' }); expired++;
  }
  for (const s of db.select().from(tenantSubscriptions).where(and(eq(tenantSubscriptions.status, 'cancelled'), lt(tenantSubscriptions.cancellationDate, iso))).all()) {
    db.update(tenantSubscriptions).set({ status: 'expired', updatedAt: iso }).where(eq(tenantSubscriptions.id, s.id)).run();
    logEvent(db, s.companyId, s.id, 'expired', { reason: 'Vertragsende nach Kündigung' }, { userId: null, source: 'job' }); expired++;
  }
  for (const s of db.select().from(tenantSubscriptions).where(and(inArray(tenantSubscriptions.status, ['active', 'past_due']), lt(tenantSubscriptions.nextBillingDate, iso))).all()) {
    const next = addMonths(new Date(s.nextBillingDate!), periodMonths(s.billingInterval as Interval)).toISOString();
    const patch: Partial<typeof tenantSubscriptions.$inferInsert> = { currentPeriodStart: s.nextBillingDate, updatedAt: iso };
    if (s.paymentProvider === 'manual') { patch.nextBillingDate = next; rolled++; }
    if (s.pendingPlanId) { patch.planId = s.pendingPlanId; patch.pendingPlanId = null; downgraded++; logEvent(db, s.companyId, s.id, 'plan_changed', { to: s.pendingPlanId, effective: 'Zeitraumwechsel' }, { userId: null, source: 'job' }); }
    db.update(tenantSubscriptions).set(patch).where(eq(tenantSubscriptions.id, s.id)).run();
  }
  return `${expired} abgelaufen, ${downgraded} Tarifwechsel, ${rolled} Zeiträume fortgeschrieben`;
}
