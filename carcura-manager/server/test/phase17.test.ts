import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { testApp, setupCompany, as, type Session } from './helpers.js';
import { parseCsv, toCsv } from '../src/core/csv.js';
import { applyPendingRestore, BackupService } from '../src/integrations/backup.js';
import { openDatabase } from '../src/db/index.js';

let app: FastifyInstance;
let admin: Session;
const exits: Array<{ code: number; reason: string }> = [];
beforeAll(async () => {
  app = await testApp({ exitFn: (code, reason) => exits.push({ code, reason }) });
  admin = await setupCompany(app);
});
afterAll(async () => app.close());

describe('Aufgaben', () => {
  let id: string;
  it('legt Aufgaben an, sortiert nach Fälligkeit und liefert Kennzahlen', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const today = new Date(); today.setHours(15, 0, 0, 0);
    const a = await app.inject(as(admin, { method: 'POST', url: '/api/tasks', payload: { title: 'Kunde zurückrufen', dueAt: today.toISOString(), priority: 'high' } }));
    expect(a.statusCode).toBe(201);
    id = a.json().id;
    expect(a.json().assignedName).toContain('Alex');
    const b = await app.inject(as(admin, { method: 'POST', url: '/api/tasks', payload: { title: 'Angebot nachfassen', dueAt: yesterday } }));
    expect(b.statusCode).toBe(201);
    const c = await app.inject(as(admin, { method: 'POST', url: '/api/tasks', payload: { title: 'Ohne Termin' } }));
    expect(c.statusCode).toBe(201);
    const list = (await app.inject(as(admin, { method: 'GET', url: '/api/tasks?view=open' }))).json();
    expect(list.items.map((t: { title: string }) => t.title)).toEqual(['Angebot nachfassen', 'Kunde zurückrufen', 'Ohne Termin']);
    expect(list.stats).toEqual({ open: 3, dueToday: 1, overdue: 1 });
    const overdue = (await app.inject(as(admin, { method: 'GET', url: '/api/tasks?view=overdue' }))).json();
    expect(overdue.items).toHaveLength(1);
  });
  it('erledigt Aufgaben, zeigt sie im Dashboard und entfernt sie', async () => {
    const dash = (await app.inject(as(admin, { method: 'GET', url: '/api/dashboard' }))).json();
    expect(dash.tasks.overdue).toBe(1);
    expect(dash.tasks.items.length).toBe(2);
    const done = await app.inject(as(admin, { method: 'PATCH', url: `/api/tasks/${id}`, payload: { status: 'done' } }));
    expect(done.json().completedAt).toBeTruthy();
    const stats = (await app.inject(as(admin, { method: 'GET', url: '/api/tasks/stats' }))).json();
    expect(stats.open).toBe(2);
    const reopened = await app.inject(as(admin, { method: 'PATCH', url: `/api/tasks/${id}`, payload: { status: 'open' } }));
    expect(reopened.json().completedAt).toBeNull();
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/tasks/${id}` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'GET', url: `/api/tasks/${id}` }))).statusCode).toBe(404);
  });
});

describe('CSV', () => {
  it('parst Semikolon-, Komma- und Anführungszeichen-Formate', () => {
    const a = parseCsv('﻿Vorname;Nachname;E-Mail\r\nMax;"Muster; Jr.";max@example.de\r\n');
    expect(a.headers).toEqual(['Vorname', 'Nachname', 'E-Mail']);
    expect(a.rows[0]).toEqual({ Vorname: 'Max', Nachname: 'Muster; Jr.', 'E-Mail': 'max@example.de' });
    const b = parseCsv('first_name,last_name,phone\nAnna,"Beispiel ""Test""",0171 1234567\n\n');
    expect(b.rows[0]!.last_name).toBe('Beispiel "Test"');
    const csv = toCsv([{ n: 'A;B', v: 12.5 }], [{ key: 'n', label: 'Name', get: (r) => r.n }, { key: 'v', label: 'Wert', get: (r) => r.v }]);
    expect(csv).toBe('﻿Name;Wert\r\n"A;B";12,5\r\n');
  });
});

describe('Import und Export', () => {
  it('importiert Kunden mit Duplikatprüfung (Vorschau und echt) und exportiert CSV', async () => {
    const csv = 'Vorname;Nachname;Firma;E-Mail;Telefon;PLZ;Ort;Kennzeichen;Marke\nMax;Muster;;max@example.de;0171 111111;90402;Nürnberg;N-AB 123;BMW\nErika;Beispiel;Beispiel GmbH;erika@example.de;;;;;\n;;;;;;;;\nMax;Muster;;MAX@example.de;;;;;\nOhne;Mail;;;0171111111;;;;\n';
    const dry = await app.inject(as(admin, { method: 'POST', url: '/api/import/customers', payload: { csv, dryRun: true } }));
    expect(dry.statusCode).toBe(200);
    expect(dry.json().created).toBe(2);
    expect(dry.json().skipped).toHaveLength(2); // Leerzeile wird still übersprungen
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/customers' }))).json().total).toBe(0);
    const real = await app.inject(as(admin, { method: 'POST', url: '/api/import/customers', payload: { csv } }));
    expect(real.json().created).toBe(2);
    const list = (await app.inject(as(admin, { method: 'GET', url: '/api/customers' }))).json();
    expect(list.total).toBe(2);
    const erika = list.items.find((c: { lastName: string }) => c.lastName === 'Beispiel');
    expect(erika.type).toBe('business');
    const again = await app.inject(as(admin, { method: 'POST', url: '/api/import/customers', payload: { csv } }));
    expect(again.json().created).toBe(0);
    const vehicles = (await app.inject(as(admin, { method: 'GET', url: '/api/vehicles' }))).json();
    expect(vehicles.total).toBe(1);
    const exp = await app.inject(as(admin, { method: 'GET', url: '/api/export/customers.csv' }));
    expect(exp.statusCode).toBe(200);
    expect(exp.headers['content-type']).toContain('text/csv');
    expect(exp.body).toContain('Kundennummer;Typ');
    expect(exp.body).toContain('max@example.de');
    const bad = await app.inject(as(admin, { method: 'POST', url: '/api/import/customers', payload: { csv: 'a;b\n1;2\n' } }));
    expect(bad.statusCode).toBe(400);
  });
  it('importiert Leads und exportiert Leads, Fahrzeuge, Rechnungen, Ausgaben und Gesamtexport', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/import/leads', payload: { csv: 'Name,E-Mail,Quelle,Leistung\nLisa Lead,lisa@example.de,Google,Keramikversiegelung\n' } }));
    expect(res.json().created).toBe(1);
    const leads = (await app.inject(as(admin, { method: 'GET', url: '/api/leads' }))).json();
    expect(leads.items[0].source).toBe('google_ads');
    expect(leads.items[0].status).toBe('new');
    for (const u of ['/api/export/leads.csv', '/api/export/vehicles.csv', '/api/export/invoices.csv', '/api/export/expenses.csv']) {
      const r = await app.inject(as(admin, { method: 'GET', url: u }));
      expect(r.statusCode, u).toBe(200);
      expect(r.body.startsWith('﻿'), u).toBe(true);
    }
    const all = await app.inject(as(admin, { method: 'GET', url: '/api/export/company.json' }));
    expect(all.statusCode).toBe(200);
    expect(all.json().customers).toHaveLength(2);
    expect(all.json().company.websiteLeadToken).toBeUndefined();
    expect(all.json().services.length).toBeGreaterThan(5);
  });
});

describe('Branding und Mandant', () => {
  it('liefert öffentliches Branding und speichert White-Label-Felder', async () => {
    const before = (await app.inject({ method: 'GET', url: '/api/branding' })).json();
    expect(before.name).toBe('Carcura');
    expect(before.productName).toBe('Manager');
    const upd = await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { productName: 'Werkstatt-Cockpit', poweredBy: 'powered by Carcura Software', primaryColor: '#00AAFF' } }));
    expect(upd.statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: '/api/branding?slug=carcura' })).json();
    expect(after.productName).toBe('Werkstatt-Cockpit');
    expect(after.primaryColor).toBe('#00AAFF');
    expect(after.poweredBy).toBe('powered by Carcura Software');
    expect((await app.inject({ method: 'GET', url: '/api/branding/logo' })).statusCode).toBe(404);
    const me = (await app.inject(as(admin, { method: 'GET', url: '/api/auth/me' }))).json();
    expect(me.company.productName).toBe('Werkstatt-Cockpit');
  });
  it('zeigt dem Betreiber Kennzahlen je Mandant', async () => {
    const res = await app.inject(as(admin, { method: 'GET', url: '/api/platform/companies' }));
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].customerCount).toBe(2);
    expect(res.json().items[0].leadCount).toBe(1);
    expect(res.json().items[0].userCount).toBe(1);
  });
});

describe('System und Sicherungen', () => {
  it('erstellt, listet, lädt und löscht Sicherungen', async () => {
    const status = (await app.inject(as(admin, { method: 'GET', url: '/api/system/status' }))).json();
    expect(status.version).toBeTruthy();
    expect(status.backups.count).toBe(0);
    const created = await app.inject(as(admin, { method: 'POST', url: '/api/system/backups' }));
    expect(created.statusCode).toBe(200);
    expect(created.json().name).toMatch(/^backup-.*-manual\.zip$/);
    expect(created.json().sizeBytes).toBeGreaterThan(1000);
    const list = (await app.inject(as(admin, { method: 'GET', url: '/api/system/backups' }))).json();
    expect(list.items).toHaveLength(1);
    const dl = await app.inject(as(admin, { method: 'GET', url: `/api/system/backups/${created.json().name}/download` }));
    expect(dl.statusCode).toBe(200);
    expect(dl.headers['content-type']).toBe('application/zip');
    expect(dl.rawPayload.subarray(0, 2).toString()).toBe('PK');
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/system/backups/../../etc/passwd/download' }))).statusCode).toBe(404);
    const restore = await app.inject(as(admin, { method: 'POST', url: `/api/system/backups/${created.json().name}/restore` }));
    expect(restore.statusCode).toBe(200);
    expect(restore.json().staged).toBe(true);
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/system/status' }))).json().pendingRestore).toBe(true);
    expect((await app.inject(as(admin, { method: 'POST', url: '/api/system/restore/cancel' }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/system/status' }))).json().pendingRestore).toBe(false);
    expect((await app.inject(as(admin, { method: 'DELETE', url: `/api/system/backups/${created.json().name}` }))).statusCode).toBe(200);
    expect((await app.inject(as(admin, { method: 'GET', url: '/api/system/backups' }))).json().items).toHaveLength(0);
    const restart = await app.inject(as(admin, { method: 'POST', url: '/api/system/restart' }));
    expect(restart.statusCode).toBe(400); // kein Startskript in Tests
    expect(exits).toHaveLength(0);
  });
  it('stellt eine Sicherung beim Start wieder her (Datei-Ebene) und behält eine Sicherheitskopie', async () => {
    const dir = fs.mkdtempSync('/tmp/cm-restore-');
    const cfg = { dataDir: dir, dbPath: path.join(dir, 'app.db'), filesDir: path.join(dir, 'files'), backupsDir: path.join(dir, 'backups') };
    const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
    const h1 = openDatabase(cfg.dbPath);
    h1.sqlite.exec("insert into companies (id, name, slug) values ('c1', 'Alt', 'alt')");
    fs.mkdirSync(cfg.filesDir, { recursive: true }); fs.writeFileSync(path.join(cfg.filesDir, 'a.txt'), 'alt');
    const svc = new BackupService(cfg, h1.sqlite, log, '0.0.0');
    const b = await svc.create('manual');
    h1.sqlite.exec("update companies set name = 'Neu' where id = 'c1'"); fs.writeFileSync(path.join(cfg.filesDir, 'a.txt'), 'neu');
    h1.close();
    await svc.stageRestore(path.join(cfg.backupsDir, b.name));
    expect(await applyPendingRestore(cfg, log)).toBe(true);
    const h2 = openDatabase(cfg.dbPath);
    expect((h2.sqlite.prepare("select name from companies where id = 'c1'").get() as { name: string }).name).toBe('Alt');
    h2.close();
    expect(fs.readFileSync(path.join(cfg.filesDir, 'a.txt'), 'utf8')).toBe('alt');
    expect(fs.readdirSync(cfg.backupsDir).some((n) => n.startsWith('pre-restore-'))).toBe(true);
    expect(await applyPendingRestore(cfg, log)).toBe(false);
    await expect(svc.stageRestore(path.join(cfg.filesDir, 'a.txt'))).rejects.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
