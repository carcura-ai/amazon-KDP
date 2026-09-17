import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, setupCompany, login, as } from './helpers.js';

let app: FastifyInstance;
let admin: Awaited<ReturnType<typeof setupCompany>>;
beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
});
afterAll(async () => app.close());

describe('Benutzer und Rollen', () => {
  it('Admin legt Mitarbeiter an, Mitarbeiter darf keine Benutzer verwalten', async () => {
    const created = await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'mia@carcura.test', password: 'Mitarbeit3rIn', firstName: 'Mia', lastName: 'Klein', role: 'employee' } }));
    expect(created.statusCode).toBe(200);
    const dup = await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'mia@carcura.test', password: 'Mitarbeit3rIn', firstName: 'Mia', lastName: 'Klein' } }));
    expect(dup.statusCode).toBe(409);

    const mia = await login(app, 'mia@carcura.test', 'Mitarbeit3rIn');
    const forbidden = await app.inject(as(mia, { method: 'POST', url: '/api/users', payload: { email: 'x@carcura.test', password: 'Mitarbeit3rIn', firstName: 'X', lastName: 'Y' } }));
    expect(forbidden.statusCode).toBe(403);
    const list = await app.inject(as(mia, { url: '/api/users' }));
    expect(list.statusCode).toBe(200);
    expect(list.json().items[0].email).toBeUndefined();
    const settings = await app.inject(as(mia, { method: 'PATCH', url: '/api/company', payload: { name: 'Hack' } }));
    expect(settings.statusCode).toBe(403);
  });

  it('Berechtigungen einer Rolle sind anpassbar und wirken sofort', async () => {
    const readonly = await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'ro@carcura.test', password: 'NurLesen1234', firstName: 'Ron', lastName: 'Lese', role: 'readonly' } }));
    expect(readonly.statusCode).toBe(200);
    const ro = await login(app, 'ro@carcura.test', 'NurLesen1234');
    expect((await app.inject(as(ro, { url: '/api/audit' }))).statusCode).toBe(403);
    const put = await app.inject(as(admin, { method: 'PUT', url: '/api/company/role-permissions/readonly', payload: { permissions: ['dashboard:read', 'audit:read'] } }));
    expect(put.statusCode).toBe(200);
    const audit = await app.inject(as(ro, { url: '/api/audit' }));
    expect(audit.statusCode).toBe(200);
    expect(audit.json().items.some((e: { action: string }) => e.action === 'company.role_permissions')).toBe(true);
    expect((await app.inject(as(admin, { method: 'PUT', url: '/api/company/role-permissions/admin', payload: { permissions: [] } }))).statusCode).toBe(400);
  });

  it('der letzte Administrator kann nicht deaktiviert werden, Deaktivierung beendet Sessions', async () => {
    const self = await app.inject(as(admin, { method: 'PATCH', url: `/api/users/${admin.userId}`, payload: { isActive: false } }));
    expect(self.statusCode).toBe(400);
    const list = (await app.inject(as(admin, { url: '/api/users' }))).json();
    const mia = list.items.find((u: { email: string }) => u.email === 'mia@carcura.test');
    const miaCookie = await login(app, 'mia@carcura.test', 'Mitarbeit3rIn');
    const off = await app.inject(as(admin, { method: 'PATCH', url: `/api/users/${mia.id}`, payload: { isActive: false } }));
    expect(off.statusCode).toBe(200);
    expect((await app.inject(as(miaCookie, { url: '/api/auth/me' }))).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'mia@carcura.test', password: 'Mitarbeit3rIn' } })).statusCode).toBe(401);
  });

  it('Mandanteneinstellungen: Branding und Nummernkreise, Lead-Token nur mit Recht', async () => {
    const upd = await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { primaryColor: '#FF0000', invoicePrefix: 'CC-RE', paymentTermsDays: 7 } }));
    expect(upd.statusCode).toBe(200);
    expect(upd.json().primaryColor).toBe('#FF0000');
    const badColor = await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { primaryColor: 'rot' } }));
    expect(badColor.statusCode).toBe(400);
    const token = await app.inject(as(admin, { url: '/api/company/website-lead-token' }));
    expect(token.statusCode).toBe(200);
    expect(token.json().token).toHaveLength(32);
    const rotated = await app.inject(as(admin, { method: 'POST', url: '/api/company/website-lead-token/rotate' }));
    expect(rotated.json().token).not.toBe(token.json().token);
  });
});
