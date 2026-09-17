import { z } from 'zod';
import { zTrimmed, zOptionalText, zMoneyCents } from './validation.js';

export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  name: zTrimmed(200).min(1),
  description: zOptionalText(1000),
  quantity: z.number().int().min(1).max(1000).default(1),
  unitPriceCents: zMoneyCents.default(0),
  vatBp: z.number().int().min(0).max(10000).default(1900),
});
export type LineItemInput = z.infer<typeof lineItemSchema>;

export interface Totals { subtotalCents: number; vatCents: number; totalCents: number; vatBreakdown: Array<{ vatBp: number; netCents: number; vatCents: number }> }

/** Netto-Positionen, MwSt. je Steuersatz gerundet; Kleinunternehmer (§ 19 UStG): 0 % MwSt. */
export function computeTotals(items: Array<{ quantity: number; unitPriceCents: number; vatBp: number }>, smallBusiness: boolean): Totals {
  const byVat = new Map<number, number>();
  let subtotal = 0;
  for (const it of items) {
    const net = it.quantity * it.unitPriceCents;
    subtotal += net;
    const bp = smallBusiness ? 0 : it.vatBp;
    byVat.set(bp, (byVat.get(bp) ?? 0) + net);
  }
  const vatBreakdown = [...byVat.entries()].map(([vatBp, netCents]) => ({ vatBp, netCents, vatCents: Math.round((netCents * vatBp) / 10000) })).sort((a, b) => b.vatBp - a.vatBp);
  const vat = vatBreakdown.reduce((s, v) => s + v.vatCents, 0);
  return { subtotalCents: subtotal, vatCents: vat, totalCents: subtotal + vat, vatBreakdown };
}
