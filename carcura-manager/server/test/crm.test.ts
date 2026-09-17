import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, setupCompany, login, as, type Session } from './helpers.js';

let app: FastifyInstance;
let admin: Session;
let token: string;
beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  token = (await app.inject(as(admin, { url: '/api/company/website-lead-token' }))).json().token;
});
afterAll(async () => app.close());

const websitePayload = {
  name: 'Max Mustermann',
  email: 'Max@Example.de',
  phone: '0171 1234567',
  vehicle: 'BMW 3er Touring',
  service: 'Innenreinigung Intensiv, Lackpolitur einstufig',
  message: 'Gewählte Leistungen:\n• Innenreinigung Intensiv\nWunschtermin: nächste Woche',
  customer_type: 'privat',
  source: 'anfrage_formular',
  channel: 'web',
  gclid: 'Cj0KCQ-test',
  website: '',
};

describe('Website-Lead-Eingang', () => {
  it('lehnt fehlendes/falsches Token ab, akzeptiert gültiges Token, erkennt Google-Ads-Quelle', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/public/leads/website', payload: websitePayload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/public/leads/website', payload: websitePayload, headers: { 'x-lead-token': 'falsch' } })).statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/public/leads/website', payload: websitePayload, headers: { 'x-lead-token': token } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().ok).toBe(true);
    const detail = await app.inject(as(admin, { url: `/api/leads/${ok.json().id}` }));
    const lead = detail.json().lead;
    expect(lead.firstName).toBe('Max');
    expect(lead.lastName).toBe('Mustermann');
    expect(lead.email).toBe('max@example.de');
    expect(lead.source).toBe('google_ads');
    expect(lead.gclid).toBe('Cj0KCQ-test');
    expect(lead.vehicleText).toBe('BMW 3er Touring');
    expect(detail.json().activities.some((a: { type: string }) => a.type === 'message')).toBe(true);
  });

  it('legt identische Anfragen innerhalb von 24h nicht doppelt an und ignoriert Honeypot-Treffer', async () => {
    const again = await app.inject({ method: 'POST', url: '/api/public/leads/website', payload: websitePayload, headers: { 'x-lead-token': token } });
    expect(again.json().duplicate).toBe(true);
    const bot = await app.inject({ method: 'POST', url: '/api/public/leads/website', payload: { ...websitePayload, name: 'Bot', website: 'http://spam' }, headers: { 'x-lead-token': token } });
    expect(bot.json()).toEqual({ ok: true });
    const list = (await app.inject(as(admin, { url: '/api/leads' }))).json();
    expect(list.total).toBe(1);
  });
});

describe('Leads, Kunden, Fahrzeuge', () => {
  let leadId: string;
  let customerId: string;

  it('erstellt Lead manuell, meldet Duplikat über Telefonnummer, ändert Status mit Historie', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/leads', payload: { firstName: 'Maxi', lastName: 'Muster', phone: '+49 171 1234567', source: 'phone', requestedService: 'Keramik' } }));
    expect(res.statusCode).toBe(200);
    leadId = res.json().lead.id;
    expect(res.json().duplicates.some((d: { kind: string; matchedOn: string[] }) => d.kind === 'lead' && d.matchedOn.includes('phone'))).toBe(true);
    const empty = await app.inject(as(admin, { method: 'POST', url: '/api/leads', payload: {} }));
    expect(empty.statusCode).toBe(400);
    const upd = await app.inject(as(admin, { method: 'PATCH', url: `/api/leads/${leadId}`, payload: { status: 'contacted' } }));
    expect(upd.json().status).toBe('contacted');
    expect(upd.json().firstName).toBe('Maxi'); // Teil-Update darf andere Felder nicht zurücksetzen
    const detail = (await app.inject(as(admin, { url: `/api/leads/${leadId}` }))).json();
    expect(detail.activities.some((a: { type: string; subject: string }) => a.type === 'status' && a.subject.includes('Kontakt hergestellt'))).toBe(true);
    const stats = (await app.inject(as(admin, { url: '/api/leads/stats' }))).json();
    expect(stats.byStatus.contacted).toBe(1);
  });

  it('wandelt Lead in Kunden um (Kundennummer, Historie übernommen), zweite Umwandlung scheitert', async () => {
    const conv = await app.inject(as(admin, { method: 'POST', url: `/api/leads/${leadId}/convert`, payload: {} }));
    expect(conv.statusCode).toBe(200);
    customerId = conv.json().customer.id;
    expect(conv.json().customer.customerNumber).toBe('KD-000001');
    expect(conv.json().lead.status).toBe('won');
    const again = await app.inject(as(admin, { method: 'POST', url: `/api/leads/${leadId}/convert`, payload: {} }));
    expect(again.statusCode).toBe(409);
    const profile = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json();
    expect(profile.leads[0].id).toBe(leadId);
    expect(profile.activities.length).toBeGreaterThanOrEqual(3);
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/leads/${leadId}` }))).statusCode).toBe(409);
  });

  it('legt Fahrzeug an, erkennt Kennzeichen-Duplikate, sucht Kunden und Fahrzeuge', async () => {
    const v = await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId, licensePlate: 'K-AB 1234', make: 'BMW', model: '320d Touring', year: 2019, mileage: 85000, vehicleType: 'Kombi' } }));
    expect(v.statusCode).toBe(200);
    expect(v.json().vehicle.normalizedPlate).toBe('KAB1234');
    const dup = (await app.inject(as(admin, { url: '/api/crm/duplicates?plate=k-ab1234' }))).json();
    expect(dup.hits[0].kind).toBe('vehicle');
    const wrongOwner = await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId: '00000000-0000-0000-0000-000000000000', licensePlate: 'X-Y 1' } }));
    expect(wrongOwner.statusCode).toBe(404);
    const search = (await app.inject(as(admin, { url: '/api/customers?q=Muster' }))).json();
    expect(search.total).toBe(1);
    const vlist = (await app.inject(as(admin, { url: '/api/vehicles?q=320d' }))).json();
    expect(vlist.items[0].customer.customerNumber).toBe('KD-000001');
  });

  it('Kommunikationshistorie: Anruf protokollieren, Export liefert alles, harte Löschung entfernt Daten', async () => {
    const act = await app.inject(as(admin, { method: 'POST', url: `/api/customers/${customerId}/activities`, payload: { type: 'call', direction: 'out', subject: 'Rückruf', content: 'Termin besprochen' } }));
    expect(act.statusCode).toBe(200);
    const exp = await app.inject(as(admin, { url: `/api/customers/${customerId}/export` }));
    expect(exp.headers['content-disposition']).toContain('kunde-KD-000001.json');
    expect(exp.json().vehicles).toHaveLength(1);
    const second = await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Erika', lastName: 'Beispiel', email: 'erika@example.de', tags: ['Stammkunde'] } }));
    expect(second.json().customer.customerNumber).toBe('KD-000002');
    expect(JSON.parse(second.json().customer.tagsJson)).toEqual(['Stammkunde']);
    const del = await app.inject(as(admin, { method: 'DELETE', url: `/api/customers/${second.json().customer.id}?hard=true` }));
    expect(del.json().deleted).toBe(true);
    expect((await app.inject(as(admin, { url: `/api/customers/${second.json().customer.id}` }))).statusCode).toBe(404);
  });

  it('Leistungskatalog wurde beim Setup angelegt und ist pflegbar', async () => {
    const list = (await app.inject(as(admin, { url: '/api/services' }))).json();
    expect(list.items.length).toBeGreaterThan(5);
    const upd = await app.inject(as(admin, { method: 'PATCH', url: `/api/services/${list.items[0].id}`, payload: { priceCents: 14900 } }));
    expect(upd.json().priceCents).toBe(14900);
  });
});

describe('Mandantentrennung', () => {
  it('Mandant B sieht keine Daten von Mandant A, Token von A funktioniert nur für A', async () => {
    const created = await app.inject(as(admin, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'XY Fahrzeugpflege' }, admin: { email: 'chef@xy.test', password: 'XyPasswort123', firstName: 'Xaver', lastName: 'Ypsilon' } } }));
    expect(created.statusCode).toBe(200);
    const b = await login(app, 'chef@xy.test', 'XyPasswort123');
    expect((await app.inject(as(b, { url: '/api/customers' }))).json().total).toBe(0);
    expect((await app.inject(as(b, { url: '/api/leads' }))).json().total).toBe(0);
    const aCustomers = (await app.inject(as(admin, { url: '/api/customers' }))).json();
    const foreign = await app.inject(as(b, { url: `/api/customers/${aCustomers.items[0].id}` }));
    expect(foreign.statusCode).toBe(404);
    const foreignPatch = await app.inject(as(b, { method: 'PATCH', url: `/api/customers/${aCustomers.items[0].id}`, payload: { lastName: 'Hacked' } }));
    expect(foreignPatch.statusCode).toBe(404);
    expect((await app.inject(as(b, { url: '/api/platform/companies' }))).statusCode).toBe(403);
    const own = await app.inject(as(b, { method: 'POST', url: '/api/customers', payload: { firstName: 'B', lastName: 'Kunde' } }));
    expect(own.json().customer.customerNumber).toBe('KD-000001');
    const me = (await app.inject(as(b, { url: '/api/auth/me' }))).json();
    expect(me.company.name).toBe('XY Fahrzeugpflege');
  });
});
