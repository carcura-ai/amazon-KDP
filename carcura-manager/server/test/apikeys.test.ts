import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { testApp, setupCompany, as, type Session } from './helpers.js';
import { createApiKey } from '../src/core/apikeys.js';
import { apiKeys } from '../src/db/schema.js';

let app: FastifyInstance;
let admin: Session;
let key: string;
let keyId: string;
const bearer = (k: string) => ({ authorization: `Bearer ${k}` });

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  const k = createApiKey(app.db, { companyId: admin.companyId, name: 'Claude', createdByUserId: admin.userId });
  key = k.key; keyId = k.id;
});
afterAll(async () => app.close());

describe('API-Schlüssel', () => {
  it('legt Kunde, Fahrzeug und Auftrag mit Betrag an und liest sie wieder', async () => {
    const c = await app.inject({ method: 'POST', url: '/api/customers', headers: bearer(key), payload: { type: 'business', companyName: 'Autohaus Test', phone: '0171 1111111' } });
    expect(c.statusCode, c.body).toBe(200);
    const customerId = c.json().customer.id;
    const v = await app.inject({ method: 'POST', url: '/api/vehicles', headers: bearer(key), payload: { customerId, make: 'Opel', model: 'Insignia' } });
    expect(v.statusCode, v.body).toBe(200);
    const o = await app.inject({ method: 'POST', url: '/api/orders', headers: bearer(key), payload: { customerId, vehicleId: v.json().vehicle.id, title: 'Händleraufbereitung', items: [{ name: 'Innen, außen, Politur', unitPriceCents: 14000, vatBp: 0 }] } });
    expect(o.statusCode, o.body).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/orders', headers: bearer(key) });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain('Händleraufbereitung');
    // Der Administrator sieht denselben Auftrag in der normalen Oberfläche
    const viaUi = await app.inject(as(admin, { method: 'GET', url: `/api/orders/${o.json().order?.id ?? o.json().id}` }));
    expect(viaUi.statusCode).toBe(200);
  });

  it('verweigert Löschen, Rechnungen, Verwaltung und unbekannte Schlüssel', async () => {
    const c = await app.inject({ method: 'POST', url: '/api/customers', headers: bearer(key), payload: { firstName: 'Lena', lastName: 'Probe' } });
    expect((await app.inject({ method: 'DELETE', url: `/api/customers/${c.json().customer.id}`, headers: bearer(key) })).statusCode).toBe(403);
    expect([401, 403]).toContain((await app.inject({ method: 'GET', url: '/api/invoices', headers: bearer(key) })).statusCode);
    expect([401, 403]).toContain((await app.inject({ method: 'GET', url: '/api/users', headers: bearer(key) })).statusCode);
    expect((await app.inject({ method: 'GET', url: '/api/customers', headers: bearer('cm_00000000_falsch-falsch-falsch-falsch') })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/customers', headers: bearer('kein-schluessel') })).statusCode).toBe(401);
  });

  it('gesperrter Schlüssel wird abgewiesen, Nutzung wird protokolliert', async () => {
    const row = app.db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).get()!;
    expect(row.lastUsedAt).toBeTruthy();
    expect(row.keyHash).not.toContain(key.slice(12));
    app.db.update(apiKeys).set({ revokedAt: new Date().toISOString() }).where(eq(apiKeys.id, keyId)).run();
    expect((await app.inject({ method: 'GET', url: '/api/customers', headers: bearer(key) })).statusCode).toBe(401);
  });
});
