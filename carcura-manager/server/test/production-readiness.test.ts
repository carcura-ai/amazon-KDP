import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { openDatabase, pendingMigrationCount } from '../src/db/index.js';
import { CompatDatabase } from '../src/db/sqlite.js';
import { buildApp } from '../src/app.js';
import { leads } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { ADMIN, testApp, setupCompany, as } from './helpers.js';

const apps: FastifyInstance[] = [];
afterAll(async () => { for (const a of apps) await a.close(); });

function cfg(extra: Parameters<typeof loadConfig>[0] = {}) {
  const dataDir = `/tmp/cm-test/pr-${process.pid}-${Math.random().toString(36).slice(2)}`;
  return loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', ...extra });
}

const setupPayload = { company: { name: 'Carcura' }, admin: ADMIN, seedDefaultServices: false };

describe('Ersteinrichtung auf einem öffentlich erreichbaren Server', () => {
  it('verlangt den Einrichtungscode, wenn SETUP_TOKEN gesetzt ist', async () => {
    const app = await buildApp({ config: cfg({ setupToken: 'ABCD-EFGH-JKLM' }), dbHandle: openDatabase(':memory:'), logger: false });
    apps.push(app);
    expect((await app.inject({ url: '/api/setup/status' })).json()).toEqual({ needsSetup: true, setupCodeRequired: true });
    expect((await app.inject({ method: 'POST', url: '/api/setup', payload: setupPayload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/setup', payload: { ...setupPayload, setupToken: 'ABCD-EFGH-XXXX' } })).statusCode).toBe(400);
    // Groß-/Kleinschreibung und Bindestriche spielen beim Abtippen keine Rolle
    const ok = await app.inject({ method: 'POST', url: '/api/setup', payload: { ...setupPayload, setupToken: 'abcdefghjklm' } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/setup/status' })).json()).toEqual({ needsSetup: false, setupCodeRequired: false });
  });

  it('erzeugt in Produktion ohne SETUP_TOKEN einen Code, wenn der Server nicht nur lokal lauscht', async () => {
    const config = { ...cfg({ host: '0.0.0.0' }), isProduction: true };
    const app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false });
    apps.push(app);
    expect((await app.inject({ url: '/api/setup/status' })).json().setupCodeRequired).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/api/setup', payload: setupPayload })).statusCode).toBe(400);
  });

  it('Laptop-Betrieb (nur localhost) bleibt ohne Code', async () => {
    const config = { ...cfg({ host: '127.0.0.1' }), isProduction: true };
    const app = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false });
    apps.push(app);
    expect((await app.inject({ url: '/api/setup/status' })).json().setupCodeRequired).toBe(false);
    expect((await app.inject({ method: 'POST', url: '/api/setup', payload: setupPayload })).statusCode).toBe(200);
  });
});

describe('Neustart/Wiederherstellung im Docker-Betrieb', () => {
  it('erlaubt Neustart mit Supervisor (Docker) und meldet das im Systemstatus', async () => {
    const exits: number[] = [];
    const app = await buildApp({ config: cfg({ supervised: true }), dbHandle: openDatabase(':memory:'), logger: false, exitFn: (code) => exits.push(code) });
    apps.push(app);
    const admin = await setupCompany(app);
    const st = (await app.inject(as(admin, { url: '/api/system/status' }))).json();
    expect(st.canRestart).toBe(true);
    expect(st.container).toBe(true);
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/system/restart' }))).statusCode).toBe(200);
    expect(exits).toEqual([75]);
    // Update per Oberfläche bleibt dem Startskript vorbehalten (im Container: docker compose up -d --build)
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/system/update' }))).statusCode).toBe(400);
  });

  it('ohne Supervisor kein Neustart per Oberfläche', async () => {
    const app = await testApp();
    apps.push(app);
    const admin = await setupCompany(app);
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/system/restart' }))).statusCode).toBe(400);
  });
});

describe('Sicherung vor Datenbank-Änderungen', () => {
  it('erkennt ausstehende Migrationen einer bestehenden Datenbank', () => {
    const dir = `/tmp/cm-test/mig-${process.pid}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(dir, { recursive: true });
    const dbPath = `${dir}/app.db`;
    expect(pendingMigrationCount(dbPath)).toBe(0); // neue Installation: nichts zu sichern
    openDatabase(dbPath).close();
    expect(pendingMigrationCount(dbPath)).toBe(0);
    const raw = new CompatDatabase(dbPath);
    raw.exec('delete from __drizzle_migrations where created_at = (select max(created_at) from __drizzle_migrations)');
    raw.close();
    expect(pendingMigrationCount(dbPath)).toBe(1);
  });
});

describe('Website-Leads: wiederholte Anfrage nach mehr als 24 Stunden', () => {
  it('legt einen neuen Lead an statt mit Fehler 500 abzubrechen; eigene external_id bleibt idempotent', async () => {
    const app = await testApp();
    apps.push(app);
    const admin = await setupCompany(app);
    const token = (await app.inject(as(admin, { url: '/api/company/website-lead-token' }))).json().token as string;
    const payload = { name: 'Erika Beispiel', email: 'erika@example.de', service: 'Innenreinigung', message: 'Bitte Rückruf' };
    const post = (p: object) => app.inject({ method: 'POST', url: '/api/public/leads/website', payload: p, headers: { 'x-lead-token': token } });
    const first = await post(payload);
    expect(first.statusCode).toBe(200);
    // Anfrage liegt 2 Tage zurück
    app.db.update(leads).set({ createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }).where(eq(leads.id, first.json().id)).run();
    const later = await post(payload);
    expect(later.statusCode).toBe(200);
    expect(later.json().duplicate).toBeUndefined();
    expect(later.json().id).not.toBe(first.json().id);
    // Absender-ID: dauerhaft idempotent, auch nach 24 h kein Fehler
    const a = await post({ ...payload, external_id: 'wp-4711' });
    app.db.update(leads).set({ createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() }).where(eq(leads.id, a.json().id)).run();
    const b = await post({ ...payload, external_id: 'wp-4711' });
    expect(b.statusCode).toBe(200);
    expect(b.json()).toMatchObject({ duplicate: true, id: a.json().id });
  });
});

describe('Sicherheit vor dem Internetbetrieb', () => {
  it('Rate-Limit lässt sich nicht mit wechselnden (gefälschten) Cookies umgehen', async () => {
    const app = await testApp();
    apps.push(app);
    await setupCompany(app);
    const codes: number[] = [];
    for (let i = 0; i < 13; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'niemand@example.org', password: 'falsch' }, headers: { cookie: `cm_sid=fake${i}`, authorization: `Bearer x${i}` } });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429, 429]);
  });

  it('zweiter Faktor: Fehlversuche sperren das Konto; neue Passwort-Anmeldung setzt den Zähler nicht zurück', async () => {
    const { totpCode } = await import('../src/core/totp.js');
    const app = await testApp();
    apps.push(app);
    const admin = await setupCompany(app);
    const setup = (await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/setup', payload: {} }))).json();
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/enable', payload: { code: totpCode(setup.secret) } }))).statusCode).toBe(200);
    const challenge = async () => (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } })).json().challenge as string;
    const verify = async (c: string, code: string) => app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: c, code } });
    const c1 = await challenge();
    for (let i = 0; i < 3; i++) expect((await verify(c1, '000000')).statusCode).toBe(401);
    const c2 = await challenge(); // neue Challenge darf den Zähler nicht zurücksetzen
    expect((await verify(c2, '000000')).statusCode).toBe(401);
    expect((await verify(c2, '000000')).statusCode).toBe(401);
    // gesperrt – auch mit richtigem Code
    expect((await verify(c2, totpCode(setup.secret))).statusCode).toBe(423);
  });

  it('Benutzerverwaltung ohne Admin-Rolle kann Administratoren und den Betreiber nicht übernehmen', async () => {
    const app = await testApp();
    apps.push(app);
    const admin = await setupCompany(app);
    const { login } = await import('./helpers.js');
    // Betriebsleiter erhält zusätzlich „Benutzer verwalten“
    const perms = (await app.inject(as(admin, { url: '/api/company/role-permissions' }))).json().byRole.manager as string[];
    expect((await app.inject(as(admin, { method: 'PUT', url: '/api/company/role-permissions/manager', payload: { permissions: [...perms, 'users:manage'] } }))).statusCode).toBe(200);
    const m = (await app.inject(as(admin, { method: 'POST', url: '/api/users', payload: { email: 'leiter@carcura.test', password: 'Leiter-Passwort1', firstName: 'Lea', lastName: 'Leiter', role: 'manager' } }))).json();
    const cookie = await login(app, 'leiter@carcura.test', 'Leiter-Passwort1');
    const mgr = { cookie, companyId: admin.companyId, userId: m.id };
    expect((await app.inject(as(mgr, { method: 'POST', url: `/api/users/${admin.userId}/reset-password`, payload: { password: 'Uebernahme-Passwort1' } }))).statusCode).toBe(403);
    expect((await app.inject(as(mgr, { method: 'PATCH', url: `/api/users/${admin.userId}`, payload: { isActive: false } }))).statusCode).toBe(403);
    expect((await app.inject(as(mgr, { method: 'POST', url: `/api/users/${admin.userId}/2fa/reset` }))).statusCode).toBe(403);
    expect((await app.inject(as(mgr, { method: 'PATCH', url: `/api/users/${m.id}`, payload: { role: 'admin' } }))).statusCode).toBe(403);
    expect((await app.inject(as(mgr, { method: 'POST', url: '/api/users', payload: { email: 'neu-admin@carcura.test', password: 'NeuAdmin-Passwort1', firstName: 'N', lastName: 'A', role: 'admin' } }))).statusCode).toBe(403);
    // Mitarbeiterkonten verwalten bleibt möglich
    const e = (await app.inject(as(mgr, { method: 'POST', url: '/api/users', payload: { email: 'ma@carcura.test', password: 'Mitarbeit3rIn', firstName: 'M', lastName: 'A', role: 'employee' } })));
    expect(e.statusCode).toBe(200);
    expect((await app.inject(as(mgr, { method: 'POST', url: `/api/users/${e.json().id}/reset-password`, payload: { password: 'Neues-Passwort1' } }))).statusCode).toBe(200);
  });

  it('gleichzeitige Ersteinrichtungen: nur eine gelingt', async () => {
    const app = await testApp();
    apps.push(app);
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/setup', payload: setupPayload }),
      app.inject({ method: 'POST', url: '/api/setup', payload: { ...setupPayload, admin: { ...ADMIN, email: 'zweiter@carcura.test' } } }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });
});
