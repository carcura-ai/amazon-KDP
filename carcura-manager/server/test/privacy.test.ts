import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, setupCompany, as, cookieFrom, ADMIN, type Session } from './helpers.js';
import { totpCode, verifyTotp, generateTotpSecret, base32Decode, base32Encode } from '../src/core/totp.js';
import { runRetention } from '../src/modules/privacy/retention.js';
import { leads, auditLog } from '../src/db/schema.js';
import sharp from 'sharp';

let app: FastifyInstance;
let admin: Session;
beforeAll(async () => { app = await testApp(); admin = await setupCompany(app); });
afterAll(async () => app.close());

async function upload(fields: Record<string, string>, name: string, buffer: Buffer) {
  const boundary = '----cmtest' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/jpeg\r\n\r\n`), buffer, Buffer.from(`\r\n--${boundary}--\r\n`));
  return app.inject(as(admin, { method: 'POST', url: '/api/files', headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) }));
}

describe('Sicherheits-Header', () => {
  it('setzt CSP, nosniff, Permissions-Policy und Frame-Schutz', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['permissions-policy']).toContain('camera=(self)');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('TOTP', () => {
  it('erzeugt gültige Codes und akzeptiert Nachbar-Zeitschritte', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    const now = Date.now();
    const code = totpCode(secret, Math.floor(now / 30_000));
    expect(verifyTotp(secret, code, now)).toBe(true);
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now + 90_000)).toBe(false);
    expect(verifyTotp(secret, '000000', now)).toBe(code === '000000');
    // RFC-6238-Testvektor (SHA1, Secret "12345678901234567890", t = 59 s → 94287082)
    expect(totpCode(base32Encode(Buffer.from('12345678901234567890')), Math.floor(59 / 30))).toBe('287082');
  });
});

describe('Zwei-Faktor-Anmeldung', () => {
  let secret = '';
  let backup: string[] = [];
  it('richtet 2FA ein, verlangt danach den Code beim Login und akzeptiert Wiederherstellungscodes', async () => {
    const setup = await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/setup', payload: {} }));
    expect(setup.statusCode).toBe(200);
    secret = setup.json().secret;
    expect(setup.json().qrSvg).toContain('<svg');
    expect(setup.json().otpauthUrl).toContain('otpauth://totp/');
    const bad = await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/enable', payload: { code: '123456' } }));
    expect([400, 401]).toContain(bad.statusCode);
    const en = await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/enable', payload: { code: totpCode(secret) } }));
    expect(en.statusCode).toBe(200);
    backup = en.json().backupCodes;
    expect(backup).toHaveLength(10);
    const me = await app.inject(as(admin, { method: 'GET', url: '/api/auth/me' }));
    expect(me.json().twoFactorEnabled).toBe(true);
    // Login: nur Challenge, keine Sitzung
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    expect(login.statusCode).toBe(200);
    expect(login.json().requires2fa).toBe(true);
    expect(login.cookies.find((c) => c.name === 'cm_sid')).toBeUndefined();
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: login.json().challenge, code: '000000' } });
    expect(wrong.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: login.json().challenge, code: totpCode(secret) } });
    expect(ok.statusCode).toBe(200);
    expect(cookieFrom(ok)).toContain('cm_sid=');
    // Wiederherstellungscode: einmal gültig
    const login2 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    const b1 = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: login2.json().challenge, code: backup[0]! } });
    expect(b1.statusCode).toBe(200);
    expect(b1.json().backupCodesLeft).toBe(9);
    const login3 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    const b2 = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: login3.json().challenge, code: backup[0]! } });
    expect(b2.statusCode).toBe(401);
    // Manipulierte Challenge
    const tampered = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', payload: { challenge: 'abc' + login3.json().challenge, code: totpCode(secret) } });
    expect(tampered.statusCode).toBe(401);
  });
  it('erzwingt 2FA für Administratoren, wenn eingestellt, und lässt Deaktivierung nur mit Passwort und Code zu', async () => {
    const put = await app.inject(as(admin, { method: 'PUT', url: '/api/privacy/settings', payload: { require2faForAdmins: true, assistantPersonalData: false, leadRetentionMonths: 12, emailLogRetentionMonths: 12, auditRetentionMonths: 24, jobLogRetentionDays: 90, inactiveCustomerYears: 0 } }));
    expect(put.statusCode).toBe(200);
    const me = await app.inject(as(admin, { method: 'GET', url: '/api/auth/me' }));
    expect(me.json().mustSetup2fa).toBe(false);
    const noPw = await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/disable', payload: { password: 'falsch', code: totpCode(secret) } }));
    expect(noPw.statusCode).toBe(401);
    const dis = await app.inject(as(admin, { method: 'POST', url: '/api/auth/2fa/disable', payload: { password: ADMIN.password, code: totpCode(secret) } }));
    expect(dis.statusCode).toBe(200);
    const me2 = await app.inject(as(admin, { method: 'GET', url: '/api/auth/me' }));
    expect(me2.json().twoFactorEnabled).toBe(false);
    expect(me2.json().mustSetup2fa).toBe(true);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    expect(login.json().requires2fa).toBeUndefined();
    expect(cookieFrom(login)).toContain('cm_sid=');
  });
});

describe('Löschkonzept und Auskunft', () => {
  let withInvoice: string; let plain: string; let fileId: string;
  it('anonymisiert Kunden mit Belegen und löscht Kunden ohne Belege vollständig', async () => {
    const c1 = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Petra', lastName: 'Privat', email: 'petra@example.de', phone: '0170 1', notes: 'Geheim' } }))).json().customer;
    withInvoice = c1.id;
    const v = (await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId: withInvoice, licensePlate: 'N-PP 1', make: 'VW' } }))).json();
    const vehicleId = v.vehicle?.id ?? v.id;
    const jpg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#333' } }).jpeg().toBuffer();
    const up = await upload({ customerId: withInvoice, vehicleId, category: 'before' }, 'foto.jpg', jpg);
    expect(up.statusCode).toBe(200);
    fileId = up.json().id ?? up.json().file?.id;
    await app.inject(as(admin, { method: 'POST', url: `/api/customers/${withInvoice}/activities`, payload: { type: 'note', content: 'privat' } }));
    await app.inject(as(admin, { method: 'POST', url: '/api/tasks', payload: { title: 'Petra anrufen', customerId: withInvoice } }));
    const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId: withInvoice, items: [{ name: 'Politur', quantity: 1, unitPriceCents: 10000, vatBp: 1900 }] } }))).json();
    const invId = inv.invoice?.id ?? inv.id;
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${invId}/issue`, payload: {} }))).statusCode).toBe(200);
    const dossier = await app.inject(as(admin, { method: 'GET', url: `/api/customers/${withInvoice}/dossier` }));
    expect(dossier.statusCode).toBe(200);
    expect(dossier.json().invoices).toHaveLength(1);
    expect(dossier.json().files).toHaveLength(2); // Foto + Rechnungs-PDF
    expect(dossier.json().tasks).toHaveLength(1);
    expect(dossier.json().responsible.name).toBe('Carcura');

    const res = await app.inject(as(admin, { method: 'POST', url: `/api/customers/${withInvoice}/anonymize`, payload: {} }));
    expect(res.statusCode).toBe(200);
    expect(res.json().mode).toBe('anonymized');
    expect(res.json().filesDeleted).toBe(1);
    const after = (await app.inject(as(admin, { method: 'GET', url: `/api/customers/${withInvoice}` }))).json();
    const cust = after.customer ?? after;
    expect(cust.firstName).toBe('Gelöschter');
    expect(cust.email).toBeNull(); expect(cust.phone).toBeNull(); expect(cust.notes).toBeNull();
    expect(cust.anonymizedAt).toBeTruthy();
    expect((await app.inject(as(admin, { method: 'GET', url: `/api/files/${fileId}` }))).statusCode).toBe(404);
    const dossier2 = (await app.inject(as(admin, { method: 'GET', url: `/api/customers/${withInvoice}/dossier` }))).json();
    expect(dossier2.files).toHaveLength(1); expect(dossier2.files[0].category).toBe('invoice');
    const invAfter = await app.inject(as(admin, { method: 'GET', url: `/api/invoices/${invId}` }));
    expect(invAfter.statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/tasks?view=all' }))).json().items.find((t: { title: string }) => t.title === 'Petra anrufen')).toBeUndefined();
    const again = await app.inject(as(admin, { method: 'POST', url: `/api/customers/${withInvoice}/anonymize`, payload: {} }));
    expect(again.statusCode).toBe(400);

    const c2 = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Ohne', lastName: 'Belege' } }))).json().customer;
    plain = c2.id;
    const del = await app.inject(as(admin, { method: 'DELETE', url: `/api/customers/${plain}?hard=true` }));
    expect(del.json().deleted).toBe(true);
    expect((await app.inject(as(admin, { method: 'GET', url: `/api/customers/${plain}` }))).statusCode).toBe(404);
  });
  it('löscht alte verlorene Leads und alte Protokolle nach Aufbewahrungsfrist', async () => {
    const l = (await app.inject(as(admin, { method: 'POST', url: '/api/leads', payload: { firstName: 'Alt', lastName: 'Lead', source: 'phone' } }))).json();
    const leadId = l.lead?.id ?? l.id;
    await app.inject(as(admin, { method: 'PATCH', url: `/api/leads/${leadId}`, payload: { status: 'lost', lostReason: 'Preis' } }));
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    app.db.update(leads).set({ updatedAt: old }).run();
    app.db.update(auditLog).set({ createdAt: new Date(Date.now() - 800 * 86_400_000).toISOString() }).run();
    const summary = runRetention(app.db, app.storage);
    expect(summary).toContain('1 Leads');
    expect((await app.inject(as(admin, { method: 'GET', url: `/api/leads/${leadId}` }))).statusCode).toBe(404);
    expect(summary).toMatch(/\d+ Audit-Einträge/);
  });
});
