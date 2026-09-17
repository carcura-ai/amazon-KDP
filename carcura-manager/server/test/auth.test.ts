import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, setupCompany, login, as, ADMIN } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await testApp();
});
afterAll(async () => app.close());

describe('Ersteinrichtung und Anmeldung', () => {
  it('meldet Setup-Bedarf, führt Setup aus und verweigert ein zweites Setup', async () => {
    expect((await app.inject({ url: '/api/setup/status' })).json()).toEqual({ needsSetup: true });
    const weak = await app.inject({ method: 'POST', url: '/api/setup', payload: { company: { name: 'X Y' }, admin: { ...ADMIN, password: 'kurz' } } });
    expect(weak.statusCode).toBe(400);
    const session = await setupCompany(app);
    expect(session.companyId).toBeTruthy();
    expect((await app.inject({ url: '/api/setup/status' })).json()).toEqual({ needsSetup: false });
    const again = await app.inject({ method: 'POST', url: '/api/setup', payload: { company: { name: 'Zweite' }, admin: ADMIN } });
    expect(again.statusCode).toBe(409);
  });

  it('liefert /me nur mit Session, Login mit falschem Passwort scheitert, Logout beendet Session', async () => {
    expect((await app.inject({ url: '/api/auth/me' })).statusCode).toBe(401);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'falsch' } });
    expect(bad.statusCode).toBe(401);
    const cookie = await login(app, ADMIN.email, ADMIN.password);
    const me = await app.inject(as(cookie, { url: '/api/auth/me' }));
    expect(me.statusCode).toBe(200);
    expect(me.json().user.role).toBe('admin');
    expect(me.json().permissions).toContain('users:manage');
    expect(me.json().company.name).toBe('Carcura');
    expect(me.json().company.websiteLeadToken).toBeUndefined();
    await app.inject(as(cookie, { method: 'POST', url: '/api/auth/logout' }));
    expect((await app.inject(as(cookie, { url: '/api/auth/me' }))).statusCode).toBe(401);
  });

  it('sperrt das Konto nach fünf Fehlversuchen', async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'falsch' } });
    }
    const locked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    expect(locked.statusCode).toBe(423);
  });

  it('lehnt manipulierte Cookies ab', async () => {
    const res = await app.inject({ url: '/api/auth/me', headers: { cookie: 'cm_sid=abc.def' } });
    expect(res.statusCode).toBe(401);
  });
});
