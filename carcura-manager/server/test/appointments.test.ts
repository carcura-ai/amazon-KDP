import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { testApp, setupCompany, as, type Session } from './helpers.js';
import { runReminders } from '../src/jobs/reminders.js';

let app: FastifyInstance;
let admin: Session;
let customerId: string;
let vehicleId: string;
const sentMails: Array<{ to: string; subject: string; text: string }> = [];

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  // Test-Transport: E-Mails werden gesammelt statt gesendet
  const t = nodemailer.createTransport({ jsonTransport: true });
  const orig = t.sendMail.bind(t);
  t.sendMail = (async (opts: { to: string; subject: string; text: string }) => { sentMails.push({ to: opts.to, subject: opts.subject, text: opts.text }); return orig(opts); }) as typeof t.sendMail;
  app.mail.transportOverride = t;
  const c = await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { salutation: 'Herr', firstName: 'Max', lastName: 'Mustermann', email: 'max@example.de', phone: '0171 1234567' } }));
  customerId = c.json().customer.id;
  const v = await app.inject(as(admin, { method: 'POST', url: '/api/vehicles', payload: { customerId, licensePlate: 'K-AB 1', make: 'BMW', model: '320d' } }));
  vehicleId = v.json().vehicle.id;
});
afterAll(async () => app.close());

const iso = (offsetHours: number, durationH = 2) => {
  const s = new Date(Date.now() + offsetHours * 3600_000);
  const e = new Date(s.getTime() + durationH * 3600_000);
  return { startsAt: s.toISOString(), endsAt: e.toISOString() };
};

describe('Termine', () => {
  let apptId: string;
  it('legt Termin an, sendet Bestätigung, meldet Überschneidungen', async () => {
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { customerId, vehicleId, userId: admin.userId, type: 'service', title: 'Komplettaufbereitung', ...iso(30), sendConfirmation: true } }));
    expect(res.statusCode).toBe(200);
    apptId = res.json().appointment.id;
    expect(res.json().confirmation.ok).toBe(true);
    expect(sentMails.at(-1)?.subject).toContain('Terminbestätigung');
    expect(sentMails.at(-1)?.text).toContain('Sehr geehrter Herr Mustermann');
    const overlap = await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { userId: admin.userId, title: 'Beratung', type: 'consultation', ...iso(31, 1) } }));
    expect(overlap.json().conflicts).toHaveLength(1);
    const bad = await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { title: 'x', startsAt: iso(1).endsAt, endsAt: iso(1).startsAt } }));
    expect(bad.statusCode).toBe(400);
    const wrongVehicle = await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { title: 'x', vehicleId, ...iso(50) } }));
    expect(wrongVehicle.statusCode).toBe(200); // Fahrzeug ohne Kunde ist erlaubt
  });

  it('Kalenderabfrage liefert Termine im Zeitraum mit Kunden- und Fahrzeugdaten', async () => {
    const from = new Date(Date.now() + 24 * 3600_000).toISOString();
    const to = new Date(Date.now() + 40 * 3600_000).toISOString();
    const list = (await app.inject(as(admin, { url: `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` }))).json();
    expect(list.items.length).toBe(2);
    const a = list.items.find((x: { id: string }) => x.id === apptId);
    expect(a.customer.lastName).toBe('Mustermann');
    expect(a.vehicle.licensePlate).toBe('K-AB 1');
    expect(a.user.firstName).toBe('Alex');
  });

  it('Erinnerungsjob sendet nur im Fenster (2 Tage) und nur einmal; Verschieben setzt zurück', async () => {
    const before = sentMails.length;
    const summary = await runReminders(app.db, app.mail);
    expect(summary).toContain('1 gesendet');
    expect(sentMails.length).toBe(before + 1);
    expect(sentMails.at(-1)?.subject).toContain('Terminerinnerung');
    await runReminders(app.db, app.mail);
    expect(sentMails.length).toBe(before + 1);
    const detail = (await app.inject(as(admin, { url: `/api/appointments/${apptId}` }))).json();
    expect(detail.appointment.reminderSentAt).toBeTruthy();
    expect(detail.whatsappUrl).toContain('wa.me/491711234567');
    const moved = await app.inject(as(admin, { method: 'PATCH', url: `/api/appointments/${apptId}`, payload: { ...iso(40) } }));
    expect(moved.json().appointment.reminderSentAt).toBeNull();
    const hist = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json();
    expect(hist.activities.some((x: { type: string }) => x.type === 'reminder')).toBe(true);
    expect(hist.activities.some((x: { subject: string }) => x.subject?.startsWith('Termin verschoben'))).toBe(true);
  });

  it('Erinnerung ohne E-Mail-Adresse liefert verständlichen Fehler', async () => {
    const c2 = (await app.inject(as(admin, { method: 'POST', url: '/api/customers', payload: { firstName: 'Ohne', lastName: 'Mail' } }))).json().customer;
    const a2 = (await app.inject(as(admin, { method: 'POST', url: '/api/appointments', payload: { customerId: c2.id, title: 'Test', ...iso(20) } }))).json().appointment;
    const r = await app.inject(as(admin, { method: 'POST', url: `/api/appointments/${a2.id}/send-reminder` }));
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toContain('keine E-Mail-Adresse');
  });
});

describe('Aufträge', () => {
  let orderId: string;
  it('legt Auftrag mit Positionen an, berechnet Summen und Nummer', async () => {
    const svc = (await app.inject(as(admin, { url: '/api/services' }))).json().items[0];
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/orders', payload: { customerId, vehicleId, userId: admin.userId, title: 'Komplettaufbereitung', items: [{ serviceId: svc.id, name: svc.name, quantity: 1, unitPriceCents: 29900, vatBp: 1900 }, { name: 'Felgenreinigung', quantity: 4, unitPriceCents: 1500, vatBp: 1900 }] } }));
    expect(res.statusCode).toBe(200);
    orderId = res.json().order.id;
    expect(res.json().order.orderNumber).toMatch(/^AU-\d{4}-0001$/);
    expect(res.json().totals.subtotalCents).toBe(35900);
    expect(res.json().totals.vatCents).toBe(6821);
    expect(res.json().totals.totalCents).toBe(42721);
    expect(res.json().items).toHaveLength(2);
  });

  it('Statuswechsel setzen Zeitstempel und schreiben Historie; abgeschlossen ist final', async () => {
    const started = (await app.inject(as(admin, { method: 'PATCH', url: `/api/orders/${orderId}`, payload: { status: 'in_progress' } }))).json();
    expect(started.order.startedAt).toBeTruthy();
    const done = (await app.inject(as(admin, { method: 'PATCH', url: `/api/orders/${orderId}`, payload: { status: 'completed' } }))).json();
    expect(done.order.finishedAt).toBeTruthy();
    expect(done.order.completedAt).toBeTruthy();
    const reopen = await app.inject(as(admin, { method: 'PATCH', url: `/api/orders/${orderId}`, payload: { status: 'in_progress' } }));
    expect(reopen.statusCode).toBe(409);
    const del = await app.inject(as(admin, { method: 'DELETE', url: `/api/orders/${orderId}` }));
    expect(del.statusCode).toBe(400);
    const hist = (await app.inject(as(admin, { url: `/api/customers/${customerId}` }))).json();
    expect(hist.activities.some((x: { subject: string }) => x.subject?.includes('In Bearbeitung'))).toBe(true);
    const stats = (await app.inject(as(admin, { url: '/api/orders/stats' }))).json();
    expect(stats.byStatus.completed.totalCents).toBe(42721);
  });

  it('Kleinunternehmer: keine MwSt.', async () => {
    await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { smallBusiness: true } }));
    const res = await app.inject(as(admin, { method: 'POST', url: '/api/orders', payload: { customerId, items: [{ name: 'Politur', quantity: 1, unitPriceCents: 10000, vatBp: 1900 }] } }));
    expect(res.json().totals.vatCents).toBe(0);
    expect(res.json().totals.totalCents).toBe(10000);
    await app.inject(as(admin, { method: 'PATCH', url: '/api/company', payload: { smallBusiness: false } }));
  });
});

describe('SMTP-Einstellungen', () => {
  it('speichert Zugangsdaten verschlüsselt, gibt Passwort nie zurück, Testmail nutzt Transport', async () => {
    const put = await app.inject(as(admin, { method: 'PUT', url: '/api/integrations/smtp', payload: { host: 'smtp.example.de', port: 587, secure: false, user: 'info@example.de', pass: 'geheim123', fromName: 'Carcura', fromEmail: 'info@example.de' } }));
    expect(put.statusCode).toBe(200);
    const get = (await app.inject(as(admin, { url: '/api/integrations/smtp' }))).json();
    expect(get.configured).toBe(true);
    expect(get.config.pass).toBeUndefined();
    expect(get.config.hasPassword).toBe(true);
    const rows = app.db.all<{ config_encrypted: string }>(`select config_encrypted from integrations` as never);
    expect(JSON.stringify(rows)).not.toContain('geheim123');
    const test = await app.inject(as(admin, { method: 'POST', url: '/api/integrations/smtp/test' }));
    expect(test.statusCode).toBe(200);
    expect(sentMails.at(-1)?.to).toBe('admin@carcura.test');
    const log = (await app.inject(as(admin, { url: '/api/integrations/email-log' }))).json();
    expect(log.items[0].status).toBe('sent');
  });
});
