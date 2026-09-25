import type { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { paymentWebhookEvents, tenantSubscriptions, plans } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { sha256 } from '../../core/crypto.js';
import { logEvent } from '../../core/subscriptions.js';
import { WebhookSignatureError, type NormalizedWebhookEvent } from '../../integrations/payments/provider.js';

/**
 * Eingehende Zahlungs-Webhooks: POST /api/webhooks/payments/:provider
 * - Rohdaten werden für die Signaturprüfung unverändert gelesen.
 * - Idempotenz: jedes Ereignis (Anbieter + Ereignis-ID) wird genau einmal verarbeitet.
 * - Gespeichert werden nur Metadaten und ein Hash der Nutzlast, keine Zahlungsdaten.
 */
export default async function paymentWebhookRoutes(app: FastifyInstance) {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  app.post('/api/webhooks/payments/:provider', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { provider: providerId } = req.params as { provider: string };
    const provider = app.payments.get(providerId);
    if (!provider) return reply.status(404).send({ error: 'unknown_provider' });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    let event: NormalizedWebhookEvent;
    try { event = provider.verifyWebhook(raw, req.headers); }
    catch (err) {
      req.log.warn({ provider: providerId, reason: err instanceof Error ? err.message : String(err) }, 'Webhook abgewiesen');
      return reply.status(err instanceof WebhookSignatureError ? 401 : 400).send({ error: 'invalid_signature' });
    }
    const existing = app.db.select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.externalEventId, event.id)).all().find((e) => e.provider === providerId);
    if (existing) return { ok: true, duplicate: true, status: existing.status };

    const rowId = newId();
    app.db.insert(paymentWebhookEvents).values({ id: rowId, provider: providerId, externalEventId: event.id, type: event.type, payloadSha256: sha256(raw.toString('utf8')) }).run();
    const conds = [event.externalSubscriptionId ? eq(tenantSubscriptions.externalSubscriptionId, event.externalSubscriptionId) : undefined, event.externalCustomerId ? eq(tenantSubscriptions.externalCustomerId, event.externalCustomerId) : undefined].filter(Boolean);
    const sub = conds.length ? app.db.select().from(tenantSubscriptions).where(or(...conds)).get() : undefined;
    if (!sub || sub.paymentProvider !== providerId) {
      app.db.update(paymentWebhookEvents).set({ status: 'ignored', processedAt: nowIso(), error: 'Kein passendes Abonnement' }).where(eq(paymentWebhookEvents.id, rowId)).run();
      return { ok: true, ignored: true };
    }
    const patch: Partial<typeof tenantSubscriptions.$inferInsert> = { updatedAt: nowIso() };
    switch (event.type) {
      case 'subscription.activated': patch.status = 'active'; patch.currentPeriodStart = nowIso(); break;
      case 'invoice.paid': if (sub.status === 'past_due' || sub.status === 'trial') patch.status = 'active'; break;
      case 'invoice.payment_failed': if (sub.status === 'active') patch.status = 'past_due'; break;
      case 'subscription.paused': patch.status = 'paused'; break;
      case 'subscription.cancelled': patch.status = 'cancelled'; patch.cancelledAt = patch.cancelledAt ?? nowIso(); patch.cancellationDate = event.periodEnd ?? sub.nextBillingDate ?? nowIso(); break;
      case 'subscription.expired': patch.status = 'expired'; break;
      case 'subscription.updated': break;
    }
    if (event.periodEnd) patch.nextBillingDate = event.periodEnd;
    if (event.interval) patch.billingInterval = event.interval;
    if (event.planCode) {
      const plan = app.db.select().from(plans).where(eq(plans.code, event.planCode.toUpperCase())).get();
      if (plan) patch.planId = plan.id;
    }
    app.db.transaction((tx) => {
      tx.update(tenantSubscriptions).set(patch).where(eq(tenantSubscriptions.id, sub.id)).run();
      tx.update(paymentWebhookEvents).set({ status: 'processed', processedAt: nowIso(), companyId: sub.companyId }).where(eq(paymentWebhookEvents.id, rowId)).run();
    });
    logEvent(app.db, sub.companyId, sub.id, `webhook:${event.type}`, { eventId: event.id, status: patch.status ?? sub.status }, { userId: null, source: 'webhook' });
    return { ok: true };
  });
}
