import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { companies, customers, vehicles, services } from '../../db/schema.js';
import { newId } from '../../core/ids.js';
import { notFound } from '../../core/errors.js';
import { computeTotals, type LineItemInput } from '../../core/lineItems.js';
import { documentShell, documentFooter } from '../../integrations/pdf-templates.js';

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (isoDate: string, days: number) => { const d = new Date(isoDate); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

export function companyOf(app: FastifyInstance, companyId: string) {
  return app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
}
export function customerOf(app: FastifyInstance, companyId: string, id: string) {
  const c = app.db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, companyId))).get();
  if (!c) throw notFound('Kunde');
  return c;
}
export function vehicleOf(app: FastifyInstance, companyId: string, id: string | null) {
  if (!id) return null;
  const v = app.db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId))).get();
  if (!v) throw notFound('Fahrzeug');
  return v;
}
export function assertServices(app: FastifyInstance, companyId: string, items: LineItemInput[]) {
  for (const it of items) if (it.serviceId && !app.db.select({ id: services.id }).from(services).where(and(eq(services.id, it.serviceId), eq(services.companyId, companyId))).get()) throw notFound('Leistung');
}
export interface ItemRowBase { id: string; companyId: string; serviceId: string | null; name: string; description: string | null; quantity: number; unitPriceCents: number; vatBp: number; totalCents: number; sortOrder: number }
export function itemRows<K extends string>(companyId: string, fk: Record<K, string>, items: LineItemInput[]): Array<ItemRowBase & Record<K, string>> {
  return items.map((it, i) => ({ id: it.id ?? newId(), companyId, ...fk, serviceId: it.serviceId ?? null, name: it.name, description: it.description ?? null, quantity: it.quantity, unitPriceCents: it.unitPriceCents, vatBp: it.vatBp, totalCents: it.quantity * it.unitPriceCents, sortOrder: i }));
}
export function totalsFor(app: FastifyInstance, companyId: string, items: Array<{ quantity: number; unitPriceCents: number; vatBp: number }>) {
  return computeTotals(items, companyOf(app, companyId).smallBusiness);
}
export async function renderDocument(app: FastifyInstance, companyId: string, opts: { title: string; docNumber?: string; docDate: string; body: string; footerExtra: string }): Promise<Buffer> {
  const company = companyOf(app, companyId);
  const logo = company.logoFileId ? app.storage.get(companyId, company.logoFileId) : null;
  const html = documentShell({ company, logoDataUrl: logo ? app.storage.dataUrl(logo, 'original') : null, title: opts.title, docNumber: opts.docNumber, docDate: opts.docDate, body: opts.body });
  return app.pdf.render(html, { footerHtml: documentFooter(company, opts.footerExtra) });
}
