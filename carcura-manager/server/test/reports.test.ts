import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { setupCompany, as, type Session } from './helpers.js';

const today = new Date().toISOString().slice(0, 10);
let assistantCalls = 0;
const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('places.googleapis.com')) {
    const body = JSON.parse(String(init?.body));
    expect(body.textQuery).toContain('Fahrzeugaufbereitung');
    return json({ places: [{ id: 'pl-1', displayName: { text: 'Glanz & Gloria Detailing' }, formattedAddress: 'Musterstr. 1, Köln', websiteUri: 'https://glanz.example', rating: 4.7, userRatingCount: 88, businessStatus: 'OPERATIONAL' }, { id: 'pl-own', displayName: { text: 'Carcura' }, formattedAddress: 'Werkstr. 1, Köln', rating: 5, userRatingCount: 12, businessStatus: 'OPERATIONAL' }] });
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    assistantCalls++;
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('claude-opus-5');
    expect(body.tools.some((t: { name: string }) => t.name === 'get_overview')).toBe(true);
    const last = body.messages[body.messages.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') {
      return json({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 'tu_1', name: 'get_overview', input: { days: 30 } }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 500, output_tokens: 40 } });
    }
    const toolResult = JSON.parse(last.content[0].content);
    expect(toolResult.current.revenueNet).toBe('200.00 EUR');
    return json({ id: 'msg_2', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: `Fakt: Umsatz (netto) der letzten 30 Tage: ${toolResult.current.revenueNet}.` }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 800, output_tokens: 60 } });
  }
  return json({ error: 'unbekannt' }, 404);
};

let app: FastifyInstance;
let admin: Session;
beforeAll(async () => {
  const dataDir = `/tmp/cm-test/rp-${process.pid}`;
  const config = loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', chromiumPath: '/opt/pw-browsers/chromium' });
  app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false, fetchFn: fakeFetch });
  admin = await setupCompany(app);
  const c = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Rita', lastName: 'Report', email: 'rita@example.de' } }))).json().customer;
  const svc = (await app.inject(as(admin, { url: '/api/services' }))).json().items[0];
  await app.inject(as(admin, { method: 'PATCH', url: `/api/services/${svc.id}`, payload: { priceCents: 20000, materialCostCents: 3000, durationMinutes: 120 } }));
  const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId: c.id, items: [{ serviceId: svc.id, name: svc.name, quantity: 1, unitPriceCents: 20000, vatBp: 1900 }] } }))).json();
  await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.invoice.id}/issue`, payload: {} }));
  await app.inject(as(admin, { method: 'POST', url: '/api/expenses', payload: { date: today, category: 'Material', description: 'Politur', netCents: 5000, vatBp: 1900 } }));
});
afterAll(async () => app.close());

describe('Preisanalyse', () => {
  it('berechnet Marge, Stundenertrag und Hinweise je Leistung', async () => {
    const r = (await app.inject(as(admin, { url: '/api/analysis/pricing?days=90' }))).json();
    const top = r.items[0];
    expect(top.bookings90).toBe(1);
    expect(top.revenue90Cents).toBe(20000);
    expect(top.marginPct).toBe(85);
    expect(top.hourlyYieldCents).toBe(8500);
    expect(r.items.some((i: { hints: string[] }) => i.hints.some((h) => h.includes('Kein Preis')))).toBe(true);
  });
});

describe('Berichte', () => {
  it('erzeugt Wochen-, Monats- und Jahresbericht mit Fakten, Veränderungen, Empfehlungen und PDF', async () => {
    const r = await app.inject(as(admin, { method: 'POST', url: '/api/reports/generate', payload: { type: 'monthly', current: true } }));
    expect(r.statusCode).toBe(200);
    const c = r.json().content;
    expect(c.sections.map((s: { title: string }) => s.title)).toContain('Umsatz, Kosten, Gewinn');
    const fin = c.sections[0];
    expect(fin.metrics.find((m: { label: string }) => m.label === 'Umsatz netto').value).toBe(20000);
    expect(fin.metrics.find((m: { label: string }) => m.label === 'Gewinn netto').value).toBe(15000);
    expect(c.summary).toContain('200,00');
    expect(r.json().pdfFileId).toBeTruthy();
    const pdf = await app.inject(as(admin, { url: `/api/reports/${r.json().id}/pdf` }));
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    const y = await app.inject(as(admin, { method: 'POST', url: '/api/reports/generate', payload: { type: 'yearly', current: true } }));
    expect(y.json().content.months).toHaveLength(12);
    const w = await app.inject(as(admin, { method: 'POST', url: '/api/reports/generate', payload: { type: 'weekly' } }));
    expect(w.statusCode).toBe(200);
    const list = (await app.inject(as(admin, { url: '/api/reports' }))).json();
    expect(list.items).toHaveLength(3);
    // erneute Erzeugung ersetzt den Bericht desselben Zeitraums
    await app.inject(as(admin, { method: 'POST', url: '/api/reports/generate', payload: { type: 'weekly' } }));
    expect((await app.inject(as(admin, { url: '/api/reports?type=weekly' }))).json().items).toHaveLength(1);
  }, 90000);
});

describe('Wettbewerber', () => {
  it('scannt über Google Places, erkennt eigenen Eintrag, speichert Snapshots, manuelle Einträge möglich', async () => {
    const put = await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/google_places', payload: { apiKey: 'places-test-key-1234567890', queries: ['Fahrzeugaufbereitung Köln'], ownPlaceId: 'pl-own' } }));
    expect(put.statusCode).toBe(200);
    const scan = await app.inject(as(admin, { method: 'POST', url: '/api/competitors/scan' }));
    expect(scan.statusCode).toBe(200);
    expect(scan.json().newCount).toBe(2);
    const again = await app.inject(as(admin, { method: 'POST', url: '/api/competitors/scan' }));
    expect(again.json().newCount).toBe(0);
    const list = (await app.inject(as(admin, { url: '/api/competitors' }))).json();
    expect(list.total).toBe(1);
    expect(list.own.name).toBe('Carcura');
    expect(list.items[0].latest.rating).toBe(4.7);
    expect(list.items[0].isNew).toBe(true);
    expect(list.avgRating).toBe(4.7);
    const manual = await app.inject(as(admin, { method: 'POST', url: '/api/competitors', payload: { name: 'Autopflege Müller', rating: 4.2, ratingCount: 30 } }));
    expect(manual.statusCode).toBe(200);
    expect((await app.inject(as(admin, { url: '/api/competitors' }))).json().total).toBe(2);
  });
});

describe('KI-Assistent', () => {
  it('ohne API-Key klare Fehlermeldung; mit Key Werkzeugschleife über echte Daten', async () => {
    const no = await app.inject(as(admin, { method: 'POST', url: '/api/assistant/chat', payload: { question: 'Wie war der Monat?' } }));
    expect(no.statusCode).toBe(400);
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/claude', payload: { apiKey: 'sk-ant-test-key-1234567890', model: 'claude-opus-5' } }));
    const r = await app.inject(as(admin, { method: 'POST', url: '/api/assistant/chat', payload: { question: 'Wie war der Umsatz der letzten 30 Tage?' } }));
    expect(r.statusCode).toBe(200);
    expect(r.json().answer).toContain('200.00 EUR');
    expect(r.json().toolsUsed).toEqual(['get_overview']);
    expect(assistantCalls).toBe(2);
    const conv = (await app.inject(as(admin, { url: `/api/assistant/conversations/${r.json().conversationId}` }))).json();
    expect(conv.items).toHaveLength(2);
    const status = (await app.inject(as(admin, { url: '/api/integrations/claude' }))).json();
    expect(status.configured).toBe(true);
    expect(status.status).toBe('ok');
  });
});
