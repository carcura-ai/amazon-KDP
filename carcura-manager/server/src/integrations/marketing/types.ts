export type FetchFn = typeof fetch;

export interface AdRow { source: 'google_ads' | 'meta_ads'; date: string; campaignId: string; campaignName: string; impressions: number; clicks: number; costCents: number; conversions: number; conversionValueCents: number; reach: number | null; leads: number | null; currency: string }
export interface WebRow { date: string; dimensionType: 'total' | 'channel' | 'device' | 'landing_page'; dimensionValue: string; sessions: number; users: number; pageviews: number; conversions: number }
export interface SocialRow { platform: 'instagram' | 'facebook'; date: string; followers: number | null; reach: number; impressions: number | null; views: number; likes: number; comments: number; shares: number }
export interface SeoRow { date: string; dimensionType: 'total' | 'query' | 'page'; dimensionValue: string; clicks: number; impressions: number; position: number | null }
export interface ExternalLead { externalId: string; createdAt: string; fullName: string; email: string | null; phone: string | null; campaign: string | null; campaignId: string | null; formName: string | null; adName: string | null; message: string | null }

export interface DateRange { from: string; to: string } // YYYY-MM-DD inklusive

export class IntegrationError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) { super(message); }
}

export const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const cents = (v: unknown): number => Math.round(num(v) * 100);
export const normDate = (v: unknown): string => { const s = String(v ?? ''); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.slice(0, 10); };

/** HTTP mit Retry und exponentiellem Backoff bei 429/5xx/Netzfehlern. */
export async function fetchJson<T = unknown>(fetchFn: FetchFn, url: string, init: RequestInit = {}, opts: { retries?: number; baseDelayMs?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, { ...init, signal: init.signal ?? AbortSignal.timeout(45_000) });
      const text = await res.text();
      if (res.ok) return (text ? JSON.parse(text) : {}) as T;
      const retryable = res.status === 429 || res.status >= 500;
      let message = `HTTP ${res.status}`;
      try { const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string }; message = typeof j.error === 'string' ? j.error : j.error?.message ?? j.message ?? message; } catch { /* Text belassen */ }
      const err = new IntegrationError(`${message} (${url.split('?')[0]})`, res.status, retryable);
      if (!retryable || attempt === retries) throw err;
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await new Promise((r) => setTimeout(r, retryAfter ? retryAfter * 1000 : base * 3 ** attempt));
      lastErr = err;
    } catch (err) {
      if (err instanceof IntegrationError) { if (!err.retryable || attempt === retries) throw err; lastErr = err; continue; }
      lastErr = err;
      if (attempt === retries) throw new IntegrationError(`Netzwerkfehler: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
      await new Promise((r) => setTimeout(r, base * 3 ** attempt));
    }
  }
  throw lastErr;
}
