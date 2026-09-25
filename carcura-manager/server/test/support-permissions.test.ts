import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { testApp, setupCompany, login, as, cookieFrom, type Session } from './helpers.js';
import { rolePermissions, systemSettings, supportSessions, auditLog } from '../src/db/schema.js';
import { syncNewPermissions } from '../src/core/session.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let sys: Session; // System-Admin (Betreiber) mit eigenem Mandanten
let bAdmin: string;
let bCompanyId: string;
let bCustomerId: string;

beforeAll(async () => {
  app = await testApp();
  sys = await setupCompany(app, 'Carcura Betrieb');
  const created = await app.inject(as(sys, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'Glanzwerk GmbH' }, admin: { email: 'admin@glanzwerk.test', password: 'Glanzwerk-2026', firstName: 'Gina', lastName: 'Glanz' } } }));
  bCompanyId = created.json().companyId;
  bAdmin = await login(app, 'admin@glanzwerk.test', 'Glanzwerk-2026');
  bCustomerId = (await app.inject(as(bAdmin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Klaus', lastName: 'Kunde', email: 'klaus@example.de' } }))).json().customer.id;
});
afterAll(async () => app.close());

describe('Rechte', () => {
  it('Stornieren braucht invoices:cancel; Mitarbeiter hat es nicht, Buchhaltung schon', async () => {
    await app.inject(as(bAdmin, { method: 'POST', url: '/api/users', payload: { email: 'mitarbeiter@glanzwerk.test', password: 'Mitarbeit3r-Pass', firstName: 'Max', lastName: 'M', role: 'employee' } }));
    await app.inject(as(bAdmin, { method: 'POST', url: '/api/users', payload: { email: 'buchhaltung@glanzwerk.test', password: 'Buchhalt3r-Pass', firstName: 'Bea', lastName: 'B', role: 'accounting' } }));
    const emp = await login(app, 'mitarbeiter@glanzwerk.test', 'Mitarbeit3r-Pass');
    const acc = await login(app, 'buchhaltung@glanzwerk.test', 'Buchhalt3r-Pass');
    const inv = (await app.inject(as(bAdmin, { method: 'POST', url: '/api/invoices', payload: { customerId: bCustomerId, items: [{ name: 'Politur', quantity: 1, unitPriceCents: 20000, vatBp: 1900 }] } }))).json().invoice;
    await app.inject(as(bAdmin, { method: 'POST', url: `/api/invoices/${inv.id}/issue`, payload: {} }));
    expect((await app.inject(as(emp, { method: 'POST', url: `/api/invoices/${inv.id}/cancel`, payload: {} }))).statusCode).toBe(403);
    expect((await app.inject(as(emp, { url: '/api/export/invoices.csv' }))).statusCode).toBe(403);
    expect((await app.inject(as(acc, { url: '/api/export/invoices.csv' }))).statusCode).toBe(200);
    expect((await app.inject(as(acc, { method: 'POST', url: `/api/invoices/${inv.id}/cancel`, payload: {} }))).statusCode).toBe(200);
    expect((await app.inject(as(emp, { method: 'PUT', url: '/api/privacy/settings', payload: {} }))).statusCode).toBe(403);
  });

  it('Admin behält immer alle Rechte, auch wenn gespeicherte Rollenrechte fehlen', async () => {
    app.db.delete(rolePermissions).where(and(eq(rolePermissions.companyId, bCompanyId), eq(rolePermissions.role, 'admin'))).run();
    const me = (await app.inject(as(bAdmin, { url: '/api/auth/me' }))).json();
    expect(me.permissions).toContain('support:grant');
    expect(me.permissions).toContain('invoices:cancel');
  });

  it('neue Standardrechte werden bei Updates ergänzt, eigene Einschränkungen bleiben', async () => {
    // Stand „alte Version“ simulieren: neue Rechte fehlen, Manager wurde bewusst offers:write entzogen
    app.db.delete(rolePermissions).where(and(eq(rolePermissions.companyId, bCompanyId), eq(rolePermissions.role, 'manager'))).run();
    for (const p of ['dashboard:read', 'invoices:read', 'invoices:write']) app.db.insert(rolePermissions).values({ id: crypto.randomUUID(), companyId: bCompanyId, role: 'manager', permission: p }).run();
    app.db.update(systemSettings).set({ value: '1' }).where(eq(systemSettings.key, 'permissions_version')).run();
    const added = syncNewPermissions(app.db);
    expect(added).toBeGreaterThan(0);
    const perms = app.db.select().from(rolePermissions).where(and(eq(rolePermissions.companyId, bCompanyId), eq(rolePermissions.role, 'manager'))).all().map((r) => r.permission);
    expect(perms).toContain('invoices:cancel');
    expect(perms).toContain('time:manage');
    expect(perms).not.toContain('offers:write');
    expect(perms).not.toContain('users:manage');
    expect(syncNewPermissions(app.db)).toBe(0);
  });
});

describe('System-Admin und Supportzugriff', () => {
  it('Betreiber-Übersicht enthält keine Umsätze; System-Admin sieht keine Kundendaten anderer Mandanten', async () => {
    const list = (await app.inject(as(sys, { url: '/api/platform/companies' }))).json();
    expect(list.items.length).toBe(2);
    expect(list.items[0]).not.toHaveProperty('invoiceTotalCents');
    const customers = (await app.inject(as(sys, { url: '/api/customers' }))).json();
    expect(customers.items.every((c: { lastName: string }) => c.lastName !== 'Kunde')).toBe(true);
    expect((await app.inject(as(sys, { url: `/api/customers/${bCustomerId}` }))).statusCode).toBe(404);
  });

  it('Anfrage → Freigabe → befristeter, lesender Zugriff mit Protokoll → Widerruf', async () => {
    const reqRes = await app.inject(as(sys, { method: 'POST', url: '/api/platform/support-sessions', payload: { companyId: bCompanyId, reason: 'Kunde meldet fehlerhafte Rechnung', mode: 'read', durationMinutes: 30 } }));
    expect(reqRes.statusCode).toBe(200);
    const sid = reqRes.json().id;
    expect(reqRes.json().status).toBe('requested');
    // Ohne Freigabe kein Zutritt
    expect((await app.inject(as(sys, { method: 'POST', url: `/api/platform/support-sessions/${sid}/enter` }))).statusCode).toBe(409);
    // Mandant sieht die Anfrage und gibt frei
    const pending = (await app.inject(as(bAdmin, { url: '/api/support-sessions' }))).json().items;
    expect(pending.find((p: { id: string }) => p.id === sid).status).toBe('requested');
    expect((await app.inject(as(bAdmin, { method: 'POST', url: `/api/support-sessions/${sid}/approve`, payload: {} }))).statusCode).toBe(200);
    // Betreten
    const enter = await app.inject(as(sys, { method: 'POST', url: `/api/platform/support-sessions/${sid}/enter` }));
    expect(enter.statusCode).toBe(200);
    const supportCookie = cookieFrom(enter);
    const home = enter.cookies.find((c) => c.name === 'cm_sid_home')!;
    const me = (await app.inject({ url: '/api/auth/me', headers: { cookie: supportCookie } })).json();
    expect(me.company.id).toBe(bCompanyId);
    expect(me.support.mode).toBe('read');
    expect(me.user.role).toBe('support');
    // Lesen erlaubt, Schreiben nicht, Verwaltung nicht
    expect((await app.inject({ url: `/api/customers/${bCustomerId}`, headers: { cookie: supportCookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/api/customers/${bCustomerId}`, payload: { lastName: 'Geändert' }, headers: { cookie: supportCookie } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/users', headers: { cookie: supportCookie } })).json().items[0]).not.toHaveProperty('email');
    expect((await app.inject({ url: '/api/platform/companies', headers: { cookie: supportCookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/support-sessions/grant', payload: { reason: 'selbst freigeben' }, headers: { cookie: supportCookie } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/integrations/smtp', headers: { cookie: supportCookie } })).statusCode).toBe(403);
    // Jede Anfrage steht im Audit-Log des Mandanten
    const logged = app.db.select().from(auditLog).where(and(eq(auditLog.companyId, bCompanyId), eq(auditLog.action, 'support.request'))).all();
    expect(logged.length).toBeGreaterThanOrEqual(5);
    expect(logged.every((l) => l.supportSessionId === sid)).toBe(true);
    expect(logged.some((l) => l.afterJson?.includes(`/api/customers/${bCustomerId}`))).toBe(true);
    // Mandant widerruft → Sitzung sofort ungültig
    expect((await app.inject(as(bAdmin, { method: 'POST', url: `/api/support-sessions/${sid}/revoke` }))).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/customers', headers: { cookie: supportCookie } })).statusCode).toBe(401);
    expect(home.value).toBeTruthy();
  });

  it('Schreibmodus erlaubt fachliche Änderungen, aber keine Verwaltung; Verlassen stellt eigene Sitzung wieder her', async () => {
    const granted = (await app.inject(as(bAdmin, { method: 'POST', url: '/api/support-sessions/grant', payload: { reason: 'Hilfe beim Rechnungsentwurf', mode: 'write', durationMinutes: 15 } }))).json();
    const enter = await app.inject(as(sys, { method: 'POST', url: `/api/platform/support-sessions/${granted.id}/enter` }));
    expect(enter.statusCode).toBe(200);
    const cookies = enter.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect((await app.inject({ method: 'PATCH', url: `/api/customers/${bCustomerId}`, payload: { notes: 'Rückruf erledigt' }, headers: { cookie: cookies } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/users', payload: { email: 'x@y.test', password: 'Passwort-12345', firstName: 'X', lastName: 'Y' }, headers: { cookie: cookies } })).statusCode).toBe(403);
    const leave = await app.inject({ method: 'POST', url: '/api/support/leave', headers: { cookie: cookies } });
    expect(leave.statusCode).toBe(200);
    const back = cookieFrom(leave);
    const me = (await app.inject({ url: '/api/auth/me', headers: { cookie: back } })).json();
    expect(me.company.id).toBe(sys.companyId);
    expect(me.support).toBeNull();
    expect(app.db.select().from(supportSessions).where(eq(supportSessions.id, granted.id)).get()!.status).toBe('ended');
  });

  it('Break-Glass gilt sofort, wird beim Mandanten protokolliert und läuft ab', async () => {
    const bg = (await app.inject(as(sys, { method: 'POST', url: '/api/platform/support-sessions', payload: { companyId: bCompanyId, reason: 'Datenbankfehler blockiert Rechnungsversand', breakGlass: true, durationMinutes: 15 } }))).json();
    expect(bg.status).toBe('approved');
    expect(app.db.select().from(auditLog).where(and(eq(auditLog.companyId, bCompanyId), eq(auditLog.action, 'support.break_glass'))).all().length).toBe(1);
    const enter = await app.inject(as(sys, { method: 'POST', url: `/api/platform/support-sessions/${bg.id}/enter` }));
    const c = cookieFrom(enter);
    expect((await app.inject({ url: '/api/customers', headers: { cookie: c } })).statusCode).toBe(200);
    app.db.update(supportSessions).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(supportSessions.id, bg.id)).run();
    expect((await app.inject({ url: '/api/customers', headers: { cookie: c } })).statusCode).toBe(401);
  });

  it('Mandanten-Admin ohne Betreiberstatus kann keinen Supportzugriff öffnen', async () => {
    expect((await app.inject(as(bAdmin, { method: 'POST', url: '/api/platform/support-sessions', payload: { companyId: sys.companyId, reason: 'Ich will rein schauen', breakGlass: true } }))).statusCode).toBe(403);
  });
});

describe('SaaS-Modus', () => {
  it('System-Admin braucht Zwei-Faktor-Anmeldung für Betreiberfunktionen', async () => {
    const dataDir = `/tmp/cm-test/saas-${process.pid}`;
    const config = loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', deploymentMode: 'saas' });
    const saas = await buildApp({ config, dbHandle: openDatabase(':memory:'), logger: false, exitFn: () => undefined });
    const s = await setupCompany(saas, 'Carcura SaaS');
    const me = (await saas.inject(as(s, { url: '/api/auth/me' }))).json();
    expect(me.mustSetup2fa).toBe(true);
    expect(me.deploymentMode).toBe('saas');
    expect((await saas.inject(as(s, { url: '/api/platform/companies' }))).statusCode).toBe(403);
    await saas.close();
  });
});
