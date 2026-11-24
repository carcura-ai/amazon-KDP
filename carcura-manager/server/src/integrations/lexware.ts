import { z } from 'zod';

export class LexwareHttpError extends Error {
  constructor(readonly status: number) { super(`Lexware HTTP ${status}`); }
}

const remoteId = z.string().uuid();
const voucher = z.object({
  id: remoteId,
  type: z.string(),
  voucherNumber: z.string(),
  voucherStatus: z.string(),
  totalGrossAmount: z.number(),
  files: z.array(remoteId).optional(),
});
const listedInvoice = z.object({ id: remoteId, voucherNumber: z.string(), voucherStatus: z.string(), totalAmount: z.number() });
const receiptId = z.object({ id: remoteId });

export class Lexware {
  constructor(private readonly fetchFn: typeof fetch, private readonly apiKey: string) {}

  private async call(path: string, init?: RequestInit): Promise<unknown> {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Accept', 'application/json');
    const response = await this.fetchFn(`https://api.lexware.io/v1${path}`, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new LexwareHttpError(response.status);
    return response.json();
  }

  async profile() {
    return z.object({ organizationId: remoteId, smallBusiness: z.boolean() }).parse(await this.call('/profile'));
  }

  async vouchers(number: string) {
    const page = z.object({ content: z.array(voucher), totalPages: z.number().optional() })
      .parse(await this.call(`/vouchers?voucherNumber=${encodeURIComponent(number)}`));
    if ((page.totalPages ?? 0) > 1) throw new Error('Mehrere Lexware-Trefferseiten');
    return page.content.filter((row) => row.voucherNumber === number && row.type === 'salesinvoice');
  }

  async invoices(number: string) {
    const params = new URLSearchParams({ voucherType: 'invoice', voucherStatus: 'any', voucherNumber: number });
    const page = z.object({ content: z.array(listedInvoice), totalPages: z.number().optional() })
      .parse(await this.call(`/voucherlist?${params}`));
    if ((page.totalPages ?? 0) > 1) throw new Error('Mehrere Lexware-Trefferseiten');
    return page.content.filter((row) => row.voucherNumber === number);
  }

  async create(input: { number: string; date: string; cents: number; service: string; categoryId: string; orderNumber: string }) {
    const amount = input.cents / 100;
    return receiptId.parse(await this.call('/vouchers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'salesinvoice', voucherStatus: 'unchecked', voucherNumber: input.number, voucherDate: input.date,
        taxType: 'gross', useCollectiveContact: true, totalGrossAmount: amount, totalTaxAmount: 0,
        remark: `Flatpay Kartenzahlung · ${input.orderNumber} · ${input.service}`,
        voucherItems: [{ amount, taxAmount: 0, taxRatePercent: 0, categoryId: input.categoryId }],
      }),
    })).id;
  }

  async attach(id: string, bytes: Buffer, mimeType: string, filename: string) {
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
    // Lexware dedupliziert wiederholte Uploads zum selben Beleg per Prüfsumme.
    return receiptId.parse(await this.call(`/vouchers/${id}/files`, { method: 'POST', body })).id;
  }
}
