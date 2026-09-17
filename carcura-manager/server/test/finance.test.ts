import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, setupCompany, as, type Session } from './helpers.js';
import { runRecurringExpenses } from '../src/jobs/recurring.js';

let app: FastifyInstance;
let admin: Session;
let customerId: string;
beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  customerId = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Finn', lastName: 'Finanz' } }))).json().customer.id;
});
afterAll(async () => app.close());

const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 8) + '01';

describe('Lager', () => {
  let itemId: string;
  it('legt Artikel mit Anfangsbestand an, bucht Entnahmen, warnt bei Mindestbestand', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/inventory', payload: { name: 'Keramikversiegelung 50ml', category: 'Versiegelung', unit: 'Stück', quantity: 5, minQuantity: 3, purchasePriceCents: 4500, supplier: 'Detailing Shop' } }));
    expect(res.statusCode).toBe(200);
    itemId = res.json().id;
    expect(res.json().isLow).toBe(false);
    const out = await app.inject(as(admin, { method: 'POST', url: `/api/inventory/${itemId}/movements`, payload: { type: 'out', quantity: 3, reason: 'Auftrag' } }));
    expect(out.json().item.quantity).toBe(2);
    expect(out.json().item.isLow).toBe(true);
    const tooMuch = await app.inject(as(admin, { method: 'POST', url: `/api/inventory/${itemId}/movements`, payload: { type: 'out', quantity: 10 } }));
    expect(tooMuch.statusCode).toBe(400);
    const list = (await app.inject(as(admin, { url: '/api/inventory?low=true' }))).json();
    expect(list.items).toHaveLength(1);
    expect(list.lowCount).toBe(1);
    expect(list.stockValueCents).toBe(9000);
    const detail = (await app.inject(as(admin, { url: `/api/inventory/${itemId}` }))).json();
    expect(detail.movements).toHaveLength(2);
    expect(detail.consumption30).toBe(3);
    const adj = await app.inject(as(admin, { method: 'POST', url: `/api/inventory/${itemId}/movements`, payload: { type: 'adjust', quantity: 8, reason: 'Inventur' } }));
    expect(adj.json().item.quantity).toBe(8);
    expect(adj.json().item.isLow).toBe(false);
  });
});

describe('Ausgaben und wiederkehrende Kosten', () => {
  it('erfasst Ausgabe mit MwSt.-Berechnung aus Brutto', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/expenses', payload: { date: today, category: 'Material', description: 'Poliermittel', vendor: 'Shop', grossCents: 11900, vatBp: 1900 } }));
    expect(res.statusCode).toBe(200);
    expect(res.json().netCents).toBe(10000);
    expect(res.json().vatCents).toBe(1900);
    const bad = await app.inject(as(admin, { method: 'POST', url: '/api/expenses', payload: { date: today, description: 'x' } }));
    expect(bad.statusCode).toBe(400);
  });

  it('wiederkehrende Ausgabe erzeugt Buchungen per Job, nicht doppelt', async () => {
    const rec = await app.inject(as(admin, { method: 'POST', url: '/api/recurring-expenses', payload: { name: 'Miete Halle', category: 'Miete', netCents: 80000, vatBp: 1900, interval: 'monthly', startDate: monthStart } }));
    expect(rec.statusCode).toBe(200);
    // Beim Anlegen wird die fällige Periode sofort gebucht, nextDate steht danach in der Zukunft
    expect(rec.json().nextDate > monthStart).toBe(true);
    const s1 = await runRecurringExpenses(app.db);
    expect(s1).toContain('0 Buchung');
    const list = (await app.inject(as(admin, { url: `/api/expenses?from=${monthStart}` }))).json();
    const booked = list.items.find((e: { recurringExpenseId: string | null }) => e.recurringExpenseId === rec.json().id);
    expect(booked).toBeTruthy();
    expect(booked.grossCents).toBe(95200);
    const after = (await app.inject(as(admin, { url: `/api/recurring-expenses` }))).json();
    expect(after.items[0].nextDate > monthStart).toBe(true);
    expect(after.items[0].nextDate.slice(8)).toBe('01');
  });
});

describe('Finanzübersicht', () => {
  it('berechnet Umsatz, Kosten, Gewinn, Marge und Hinweise', async () => {
    const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId, items: [{ name: 'Aufbereitung', quantity: 1, unitPriceCents: 200000, vatBp: 1900 }] } }))).json();
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.invoice.id}/issue`, payload: {} }));
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.invoice.id}/payments`, payload: { amountCents: 100000 } }));
    const ov = (await app.inject(as(admin, { url: `/api/finance/overview?period=month&date=${today}` }))).json();
    expect(ov.revenueNetCents).toBe(200000);
    expect(ov.revenueGrossCents).toBe(238000);
    expect(ov.expensesNetCents).toBe(90000);
    expect(ov.profitNetCents).toBe(110000);
    expect(ov.marginPct).toBe(55);
    expect(ov.paymentsInCents).toBe(100000);
    expect(ov.openReceivablesCents).toBe(138000);
    expect(ov.vatBalanceCents).toBe(38000 - 1900 - 15200);
    expect(ov.byCategory.find((c: { category: string }) => c.category === 'Miete').netCents).toBe(80000);
    expect(ov.series.length).toBeGreaterThan(0);
    expect(ov.hints.every((h: { kind: string }) => ['fact', 'calc', 'estimate', 'advice'].includes(h.kind))).toBe(true);
    expect(ov.hints.some((h: { kind: string }) => h.kind === 'estimate')).toBe(true);
    const year = (await app.inject(as(admin, { url: `/api/finance/overview?period=year&date=${today}` }))).json();
    expect(year.series).toHaveLength(12);
  }, 60000);
});
