import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import nodemailer from 'nodemailer';
import extract from 'extract-zip';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { testApp, setupCompany, login, as, multipart, type Session } from './helpers.js';
import { customers, deletionLog, companies } from '../src/db/schema.js';
import { runRetention } from '../src/modules/privacy/retention.js';
import { appendLedger, readLedger, reapplyDeletionLedger } from '../src/modules/platform/tenant-lifecycle.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let admin: Session;
const sent: Array<{ to: string; subject: string; text: string }> = [];

async function unzip(buf: Buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-zip-'));
  fs.writeFileSync(path.join(dir, 'a.zip'), buf);
  await extract(path.join(dir, 'a.zip'), { dir: path.join(dir, 'x') });
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
  return { dir: path.join(dir, 'x'), files: walk(path.join(dir, 'x')) };
}
const newCustomer = async (last: string, extra: Record<string, unknown> = {}) => (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Petra', lastName: last, email: `${last.toLowerCase()}@example.de`, ...extra } }))).json().customer;

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  const t = nodemailer.createTransport({ jsonTransport: true });
  const orig = t.sendMail.bind(t);
  t.sendMail = (async (m: { to: string; subject: string; text: string }) => { sent.push({ to: String(m.to), subject: m.subject, text: m.text }); return orig(m as never); }) as never;
  app.mail.transportOverride = t;
});
afterAll(async () => app.close());

describe('Einschränkung der Verarbeitung (Art. 18)', () => {
  it('sperrt Änderungen und Versand, bleibt gespeichert, lässt sich aufheben', async () => {
    const c = await newCustomer('Eingeschraenkt');
    const start = new Date(Date.now() + 86_400_000);
    const appt = (await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { customerId: c.id, title: 'Politur', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString() } }))).json().appointment;
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/customers/${c.id}/restrict`, payload: { reason: 'Widerspruch des Kunden' } }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'PATCH', url: `/api/customers/${c.id}`, payload: { notes: 'neu' } }))).statusCode).toBe(423);
    const conf = await app.inject(as(admin, { method: 'POST', url: `/api/appointments/${appt.id}/send-confirmation` }));
    expect(conf.body).toContain('eingeschränkt');
    expect(sent.find((m) => m.to === c.email)).toBeUndefined();
    expect((await app.inject(as(admin, { url: `/api/customers/${c.id}` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/customers/${c.id}/restrict` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'PATCH', url: `/api/customers/${c.id}`, payload: { notes: 'neu' } }))).statusCode).toBe(200);
    const log = app.db.select().from(deletionLog).all().map((l) => l.action);
    expect(log).toEqual(expect.arrayContaining(['restricted', 'unrestricted']));
  });
});

describe('Löschung mit Aufbewahrungspflicht', () => {
  it('Suche zeigt Abhängigkeiten und Frist; Anonymisierung mit Begründung; endgültige Löschung nach Fristende', async () => {
    const c = await newCustomer('Rechnungskunde', { phone: '0170 5556667' });
    await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId: c.id, licensePlate: 'AK-RK 55', make: 'Audi', model: 'A4' } }));
    const inv = (await app.inject(as(admin, { method: 'POST', url: '/api/invoices', payload: { customerId: c.id, items: [{ name: 'Innenreinigung', quantity: 1, unitPriceCents: 9000, vatBp: 0 }] } }))).json().invoice;
    await app.inject(as(admin, { method: 'POST', url: `/api/invoices/${inv.id}/issue`, payload: {} }));
    const found = (await app.inject(as(admin, { url: '/api/privacy/subjects?q=AK-RK' }))).json();
    expect(found.customers).toHaveLength(1);
    expect(found.customers[0].dependencies.invoicesIssued).toBe(1);
    expect(found.customers[0].dependencies.vehicles).toBe(1);
    expect(found.customers[0].retention.reason).toContain('§ 147 AO');
    const year = new Date().getUTCFullYear();
    const r = (await app.inject(as(admin, { method: 'POST', url: `/api/customers/${c.id}/anonymize` }))).json();
    expect(r.mode).toBe('anonymized');
    expect(r.retentionUntil).toBe(new Date(Date.UTC(year + 11, 0, 1)).toISOString());
    const row = app.db.select().from(customers).where(eq(customers.id, c.id)).get()!;
    expect(row.email).toBeNull();
    expect(row.retentionReason).toContain('10 Jahre');
    const log = app.db.select().from(deletionLog).all().find((l) => l.subjectRef === c.customerNumber && l.action === 'anonymized')!;
    expect(log.reason).toContain('Nicht sofort vollständig gelöscht');
    expect(log.detailsJson).not.toContain('rechnungskunde@example.de');
    expect(readLedger(app).some((e) => e.customerId === c.id)).toBe(true);
    // Fristablauf simulieren
    app.db.update(customers).set({ retentionUntil: '2000-01-01T00:00:00.000Z' }).where(eq(customers.id, c.id)).run();
    expect(runRetention(app)).toContain('endgültig gelöscht');
    expect(app.db.select().from(customers).where(eq(customers.id, c.id)).get()).toBeUndefined();
    expect((await app.inject(as(admin, { url: `/api/invoices/${inv.id}` }))).statusCode).toBe(404);
    expect(app.db.select().from(deletionLog).all().some((l) => l.action === 'purged' && l.subjectRef === c.customerNumber)).toBe(true);
  });

  it('ohne Belege wird vollständig gelöscht', async () => {
    const c = await newCustomer('OhneBeleg');
    const r = (await app.inject(as(admin, { method: 'POST', url: `/api/customers/${c.id}/anonymize` }))).json();
    expect(r.mode).toBe('deleted');
    expect(app.db.select().from(customers).where(eq(customers.id, c.id)).get()).toBeUndefined();
  });

  it('nach einer Wiederherstellung werden spätere Löschungen erneut angewendet', async () => {
    const c = await newCustomer('Wiederhergestellt');
    appendLedger(app, { kind: 'customer', companyId: admin.companyId, customerId: c.id, at: new Date().toISOString() });
    const n = await reapplyDeletionLedger(app, new Date(Date.now() - 60_000).toISOString());
    expect(n).toBe(1);
    expect(app.db.select().from(customers).where(eq(customers.id, c.id)).get()).toBeUndefined();
  });
});

describe('Betroffenenanfragen und Exporte', () => {
  it('Anfrage erhält Monatsfrist und Status', async () => {
    const r = (await app.inject(as(admin, { method: 'POST', url: '/api/privacy/requests', payload: { type: 'access', subjectName: 'Max Muster', receivedAt: '2026-03-10T10:00:00.000Z' } }))).json();
    expect(r.dueAt.slice(0, 10)).toBe('2026-04-10');
    const done = (await app.inject(as(admin, { method: 'PATCH', url: `/api/privacy/requests/${r.id}`, payload: { status: 'completed', result: 'Auskunft per E-Mail versandt' } }))).json();
    expect(done.completedAt).toBeTruthy();
  });

  it('Export einer Person (Art. 20) enthält Daten und eigene Dateien', async () => {
    const c = await newCustomer('Export');
    const img = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } }).jpeg().toBuffer();
    const up = multipart({ customerId: c.id }, { name: 'vorher.jpg', type: 'image/jpeg', data: img });
    await app.inject(as(admin, { method: 'POST', url: '/api/files', payload: up.payload, headers: up.headers }));
    const res = await app.inject(as(admin, { url: `/api/customers/${c.id}/export.zip` }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    const z = await unzip(res.rawPayload);
    const data = JSON.parse(fs.readFileSync(z.files.find((f) => f.endsWith('daten.json'))!, 'utf8'));
    expect(data.customer.lastName).toBe('Export');
    expect(z.files.some((f) => f.includes('dateien') && f.endsWith('vorher.jpg'))).toBe(true);
  });

  it('Mandantenexport: vollständig, ohne Geheimnisse, versioniert, protokolliert', async () => {
    await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/smtp', payload: { host: 'smtp.example.de', port: 587, secure: false, user: 'x', pass: 'SehrGeheimesPasswort', fromName: 'C', fromEmail: 'c@example.de' } }));
    const e = (await app.inject(as(admin, { method: 'POST', url: '/api/tenant-export', payload: {} }))).json();
    expect(e.status).toBe('ready');
    expect(e.sha256).toMatch(/^[a-f0-9]{64}$/);
    const dl = await app.inject(as(admin, { url: `/api/tenant-export/${e.id}/download` }));
    const z = await unzip(dl.rawPayload);
    const manifest = JSON.parse(fs.readFileSync(z.files.find((f) => f.endsWith('manifest.json'))!, 'utf8'));
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.tables.customers).toBeGreaterThan(0);
    expect(manifest.tables.invoices).toBeGreaterThanOrEqual(0);
    const all = z.files.map((f) => fs.readFileSync(f).toString('latin1')).join('\n');
    expect(all).not.toContain('SehrGeheimesPasswort');
    expect(all).not.toContain('scrypt$');
    const integ = JSON.parse(fs.readFileSync(z.files.find((f) => f.endsWith('json/integrations.json'))!, 'utf8')) as Array<Record<string, unknown>>;
    expect(integ[0]).not.toHaveProperty('config_encrypted');
    const usersJson = JSON.parse(fs.readFileSync(z.files.find((f) => f.endsWith('json/users.json'))!, 'utf8')) as Array<Record<string, unknown>>;
    expect(usersJson[0]).not.toHaveProperty('password_hash');
    expect(z.files.some((f) => f.endsWith('LIESMICH.txt'))).toBe(true);
    const list = (await app.inject(as(admin, { url: '/api/tenant-export' }))).json().items;
    expect(list[0].downloadedAt).toBeTruthy();
  });

  it('Übersicht liefert echte Zahlen', async () => {
    const d = (await app.inject(as(admin, { url: '/api/privacy/dashboard' }))).json();
    expect(d.customers.active).toBeGreaterThan(0);
    expect(d.requests.open).toBe(0);
    expect(d.retention.documentRetentionYears).toBe(10);
    expect(d.integrations.map((i: { type: string }) => i.type)).toContain('smtp');
  });
});

describe('Subprozessoren, Rechtsdokumente, Vorfälle, Mandantenlöschung', () => {
  it('Subprozessor-Register ohne vorgetäuschte Vertragsstände', async () => {
    const list = (await app.inject(as(admin, { url: '/api/privacy/subprocessors' }))).json().items;
    expect(list.length).toBeGreaterThan(4);
    expect(list.every((s: { dpaStatus: string }) => s.dpaStatus === 'to_review')).toBe(true);
    expect(list.find((s: { key: string }) => s.key === 'smtp').usedByTenant).toBe(true);
    expect(list.find((s: { key: string }) => s.key === 'anthropic').usedByTenant).toBe(false);
  });

  it('versionierte Rechtsdokumente mit Zustimmungsnachweis', async () => {
    const pub = await app.inject(as(admin, { method: 'POST', url: '/api/platform/legal-documents', payload: { type: 'avv', version: '2026-10', contentMarkdown: '# AVV\nEntwurf', requiresAcceptance: true } }));
    expect(pub.statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/platform/legal-documents', payload: { type: 'avv', version: '2026-10', contentMarkdown: 'anders' } }))).statusCode).toBe(409);
    const cur = (await app.inject({ url: '/api/legal/current' })).json().items;
    expect(cur[0].type).toBe('avv');
    expect((await app.inject(as(admin, { url: '/api/legal/pending' }))).json().items).toHaveLength(1);
    await app.inject(as(admin, { method: 'POST', url: '/api/legal/accept', payload: { documentIds: [pub.json().id] } }));
    expect((await app.inject(as(admin, { url: '/api/legal/pending' }))).json().items).toHaveLength(0);
    const acc = (await app.inject(as(admin, { url: '/api/legal/acceptances' }))).json().items[0];
    expect(acc.documentVersion).toBe('2026-10');
    expect(acc.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(acc.acceptedAt).toBeTruthy();
  });

  it('Vorfall des Betreibers: betroffener Mandant sieht ihn und wird informiert, andere nicht', async () => {
    const created = await app.inject(as(admin, { method: 'POST', url: '/api/platform/companies', payload: { company: { name: 'Betroffen GmbH' }, admin: { email: 'chef@betroffen.test', password: 'Betroffen-2026', firstName: 'B', lastName: 'T' } } }));
    const bId = created.json().companyId;
    const b = await login(app, 'chef@betroffen.test', 'Betroffen-2026');
    const inc = (await app.inject(as(admin, { method: 'POST', url: '/api/platform/incidents', payload: { title: 'Fehlkonfiguration Proxy', type: 'outage', severity: 'high', affectedTenants: [bId] } }))).json();
    sent.length = 0;
    await app.inject(as(admin, { method: 'PATCH', url: `/api/platform/incidents/${inc.id}`, payload: { status: 'resolved', measures: 'Konfiguration korrigiert', notifyTenants: true } }));
    expect(sent.some((m) => m.to === 'chef@betroffen.test' && m.text.includes('Art. 33'))).toBe(true);
    const seen = (await app.inject(as(b, { url: '/api/privacy/incidents' }))).json().items;
    expect(seen).toHaveLength(1);
    expect(seen[0].affectedTenantsJson).toBe('[]');
    expect((await app.inject(as(admin, { url: '/api/privacy/incidents' }))).json().items).toHaveLength(0);

    // Mandantenlöschung (Self-Hosted: erst deaktivieren, Name bestätigen)
    await app.inject(as(b, { method: 'POST', url: '/api/customers', payload: { firstName: 'Kunde', lastName: 'VonB' } }));
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/platform/companies/${bId}/delete`, payload: { confirmName: 'Betroffen GmbH', reason: 'Vertragsende Test' } }))).statusCode).toBe(409);
    await app.inject(as(admin, { method: 'PATCH', url: `/api/platform/companies/${bId}`, payload: { isActive: false } }));
    expect((await app.inject(as(admin, { method: 'POST', url: `/api/platform/companies/${bId}/delete`, payload: { confirmName: 'falsch', reason: 'Vertragsende Test' } }))).statusCode).toBe(400);
    const del = await app.inject(as(admin, { method: 'POST', url: `/api/platform/companies/${bId}/delete`, payload: { confirmName: 'Betroffen GmbH', reason: 'Vertragsende Test' } }));
    expect(del.statusCode).toBe(200);
    expect(del.json().counts.customers).toBe(1);
    const row = app.db.select().from(companies).where(eq(companies.id, bId)).get()!;
    expect(row.name).toBe('Gelöschter Mandant');
    expect(row.deletedAt).toBeTruthy();
    expect(app.db.select().from(customers).where(eq(customers.companyId, bId)).all()).toHaveLength(0);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'chef@betroffen.test', password: 'Betroffen-2026' } })).statusCode).toBe(401);
    expect(readLedger(app).some((e) => e.kind === 'tenant' && e.companyId === bId)).toBe(true);
  });
});

describe('Registrierung (SaaS)', () => {
  it('verlangt Pflichtdokumente, nur B2B, legt Testphase an und bestätigt die E-Mail', async () => {
    const dataDir = `/tmp/cm-test/signup-${process.pid}`;
    const saas = await buildApp({ config: loadConfig({ dbPath: ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', deploymentMode: 'saas' }), dbHandle: openDatabase(':memory:'), logger: false, exitFn: () => undefined });
    const mails: string[] = [];
    const t = nodemailer.createTransport({ jsonTransport: true });
    const orig = t.sendMail.bind(t);
    t.sendMail = (async (m: { text: string }) => { mails.push(m.text); return orig(m as never); }) as never;
    saas.mail.transportOverride = t;
    const op = await setupCompany(saas, 'Carcura Betrieb');
    saas.dbHandle.sqlite.exec(`update users set totp_enabled_at = '2026-01-01T00:00:00Z', totp_secret_enc = 'x' where id = '${op.userId}'`);
    const agb = (await saas.inject(as(op, { method: 'POST', url: '/api/platform/legal-documents', payload: { type: 'agb', version: '1.0', contentMarkdown: 'AGB', requiresAcceptance: true } }))).json();
    const docId = agb.id as string;
    expect(docId).toBeTruthy();
    const body = { company: { name: 'Glanz & Co' }, admin: { email: 'neu@glanz.test', password: 'Glanz-und-Co-2026', firstName: 'Nina', lastName: 'Neu' }, planCode: 'START' };
    if (docId) {
      expect((await saas.inject({ method: 'POST', url: '/api/signup', payload: body })).statusCode).toBe(400);
    }
    expect((await saas.inject({ method: 'POST', url: '/api/signup', payload: { ...body, company: { ...body.company, customerType: 'consumer' }, acceptedDocumentIds: docId ? [docId] : [] } })).statusCode).toBe(400);
    const ok = await saas.inject({ method: 'POST', url: '/api/signup', payload: { ...body, acceptedDocumentIds: docId ? [docId] : [] } });
    expect(ok.statusCode).toBe(200);
    const cookie = ok.cookies.find((c) => c.name === 'cm_sid')!;
    const sub = (await saas.inject({ url: '/api/subscription', headers: { cookie: `cm_sid=${cookie.value}` } })).json();
    expect(sub.plan.code).toBe('START');
    expect(sub.status).toBe('trial');
    const token = decodeURIComponent(/token=([A-Za-z0-9_\-%]+)/.exec(mails.find((m) => m.includes('email-bestaetigen'))!)![1]!);
    expect((await saas.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(200);
    expect((await saas.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(400);
    expect((await saas.inject({ method: 'POST', url: '/api/signup', payload: { ...body, acceptedDocumentIds: docId ? [docId] : [] } })).statusCode).toBe(409);
    await saas.close();
  });

  it('im Self-Hosted-Betrieb gibt es keine Registrierung', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/signup', payload: {} })).statusCode).toBe(404);
  });
});
