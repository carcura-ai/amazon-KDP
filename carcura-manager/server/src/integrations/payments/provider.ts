import crypto from 'node:crypto';

/**
 * Schnittstelle zu Zahlungsanbietern (z. B. Stripe, Mollie, Paddle). Es wird kein Anbieter fest
 * verdrahtet. Zahlungsdaten (Karten, IBAN) verarbeitet ausschließlich der Anbieter; das System
 * speichert nur dessen Kunden- und Abo-IDs.
 *
 * Neuen Anbieter anbinden: Klasse mit diesem Interface schreiben (API-Aufrufe über fetch mit
 * Secret aus der Umgebung), in `createPaymentProviders` registrieren, Webhook-URL beim Anbieter
 * hinterlegen: https://<server>/api/webhooks/payments/<id>.
 */
export type WebhookEventType =
  | 'subscription.activated' | 'subscription.updated' | 'subscription.paused'
  | 'subscription.cancelled' | 'subscription.expired' | 'invoice.paid' | 'invoice.payment_failed';

export interface NormalizedWebhookEvent {
  id: string;
  type: WebhookEventType;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
  planCode?: string | null;
  interval?: 'monthly' | 'yearly' | null;
  periodEnd?: string | null;
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** true, wenn Kunden online (Checkout) bezahlen können; sonst Rechnung/Überweisung. */
  readonly supportsCheckout: boolean;
  createCustomer(input: { companyId: string; name: string; email: string | null }): Promise<{ externalCustomerId: string | null }>;
  createSubscription(input: { externalCustomerId: string | null; planCode: string; interval: 'monthly' | 'yearly' }): Promise<{ externalSubscriptionId: string | null }>;
  changeSubscription(input: { externalSubscriptionId: string | null; planCode: string; interval: 'monthly' | 'yearly' }): Promise<void>;
  cancelSubscription(input: { externalSubscriptionId: string | null; atPeriodEnd: boolean }): Promise<void>;
  getSubscription(externalSubscriptionId: string): Promise<{ status: string; periodEnd: string | null } | null>;
  createCheckout(input: { companyId: string; planCode: string; interval: 'monthly' | 'yearly'; successUrl: string; cancelUrl: string }): Promise<{ url: string } | null>;
  /** Prüft Signatur und Zeitstempel und liefert das normalisierte Ereignis. Wirft bei ungültiger Signatur. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedWebhookEvent;
}

export class WebhookSignatureError extends Error {}

/** Abrechnung per Rechnung/Überweisung durch den Betreiber. Keine externen Aufrufe, keine Webhooks. */
export class ManualProvider implements PaymentProvider {
  readonly id: string = 'manual';
  readonly label: string = 'Rechnung / Überweisung';
  readonly supportsCheckout: boolean = false;
  async createCustomer() { return { externalCustomerId: null }; }
  async createSubscription() { return { externalSubscriptionId: null }; }
  async changeSubscription() { /* Betreiber stellt die nächste Rechnung mit neuem Tarif aus */ }
  async cancelSubscription() { /* keine externe Abbuchung vorhanden */ }
  async getSubscription() { return null; }
  async createCheckout() { return null; }
  verifyWebhook(_rawBody: Buffer, _headers: Record<string, string | string[] | undefined>): NormalizedWebhookEvent { throw new WebhookSignatureError('Der manuelle Anbieter empfängt keine Webhooks.'); }
}

/**
 * Generischer, signierter Webhook-Empfang (HMAC-SHA256) für eigene Abrechnungssysteme oder als
 * Vorlage. Header: `x-carcura-signature: t=<unix>,v1=<hex(hmac(secret, t + "." + body))>`.
 * Zeitfenster 5 Minuten gegen Wiederholungsangriffe; Vergleich in konstanter Zeit.
 */
export class SignedWebhookProvider extends ManualProvider {
  override readonly id: string = 'signed';
  override readonly label: string = 'Signierte Webhooks';
  constructor(private readonly secret: string, private readonly toleranceSeconds = 300, private readonly now = () => Date.now()) { super(); }
  static sign(secret: string, body: Buffer | string, t = Math.floor(Date.now() / 1000)): string {
    const mac = crypto.createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex');
    return `t=${t},v1=${mac}`;
  }
  override verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedWebhookEvent {
    const header = String(headers['x-carcura-signature'] ?? '');
    const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')).filter((p) => p.length === 2)) as Record<string, string>;
    const t = Number(parts.t);
    if (!t || !parts.v1) throw new WebhookSignatureError('Signatur fehlt.');
    if (Math.abs(this.now() / 1000 - t) > this.toleranceSeconds) throw new WebhookSignatureError('Zeitstempel außerhalb des erlaubten Fensters.');
    const expected = crypto.createHmac('sha256', this.secret).update(`${t}.`).update(rawBody).digest();
    const given = Buffer.from(parts.v1, 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new WebhookSignatureError('Signatur ungültig.');
    const j = JSON.parse(rawBody.toString('utf8')) as Partial<NormalizedWebhookEvent>;
    if (!j.id || !j.type) throw new WebhookSignatureError('Ereignis unvollständig.');
    return { id: String(j.id), type: j.type, externalSubscriptionId: j.externalSubscriptionId ?? null, externalCustomerId: j.externalCustomerId ?? null, planCode: j.planCode ?? null, interval: j.interval ?? null, periodEnd: j.periodEnd ?? null };
  }
}

export function createPaymentProviders(env: NodeJS.ProcessEnv = process.env): Map<string, PaymentProvider> {
  const map = new Map<string, PaymentProvider>();
  map.set('manual', new ManualProvider());
  if (env.PAYMENT_WEBHOOK_SECRET && env.PAYMENT_WEBHOOK_SECRET.length >= 32) map.set('signed', new SignedWebhookProvider(env.PAYMENT_WEBHOOK_SECRET));
  return map;
}
