import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { sha256 } from '../src/core/crypto.js';
import { testApp, setupCompany, login, as, ADMIN, type Session } from './helpers.js';

let app: FastifyInstance;
let admin: Session;
const sent: Array<{ to: string; text: string }> = [];

beforeAll(async () => {
  app = await testApp();
  admin = await setupCompany(app);
  const t = nodemailer.createTransport({ jsonTransport: true });
  const orig = t.sendMail.bind(t);
  t.sendMail = (async (m: { to: string; text: string }) => { sent.push({ to: String(m.to), text: String(m.text) }); return orig(m as never); }) as never;
  app.mail.transportOverride = t;
});
afterAll(async () => app.close());

const tokenFrom = (text: string) => /token=([A-Za-z0-9_\-%]+)/.exec(text)![1]!;

describe('Passwort vergessen', () => {
  it('liefert für unbekannte Adressen dieselbe Antwort und verschickt nichts', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: 'niemand@example.de' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    expect(sent.length).toBe(0);
  });

  it('setzt das Passwort per Einmal-Link, beendet Sitzungen, Link ist danach ungültig', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: ADMIN.email } });
    expect(r.statusCode).toBe(200);
    expect(sent.length).toBe(1);
    expect(sent[0]!.to).toBe(ADMIN.email);
    const token = decodeURIComponent(tokenFrom(sent[0]!.text));
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token, password: 'kurz' } })).statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token, password: 'Neues-Passwort-2026' } });
    expect(ok.statusCode).toBe(200);
    // alte Sitzung beendet
    expect((await app.inject(as(admin, { url: '/api/auth/me' }))).statusCode).toBe(401);
    // neues Passwort funktioniert, altes nicht
    await login(app, ADMIN.email, 'Neues-Passwort-2026');
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } })).statusCode).toBe(401);
    // Link nur einmal verwendbar
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token, password: 'Nochmal-Anders-2026' } })).statusCode).toBe(400);
  });

  it('neue Anforderung entwertet den alten Link; Tokens werden nur gehasht gespeichert', async () => {
    sent.length = 0;
    await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: ADMIN.email } });
    await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: ADMIN.email } });
    const [first, second] = sent.map((m) => decodeURIComponent(tokenFrom(m.text)));
    const raw = JSON.stringify(app.dbHandle.sqlite.prepare('select * from user_tokens').all());
    expect(raw).not.toContain(second);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token: first, password: 'Drittes-Passwort-2026' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token: second, password: 'Drittes-Passwort-2026' } })).statusCode).toBe(200);
  });

  it('höchstens drei Anforderungen pro Stunde; abgelaufene Links werden abgewiesen', async () => {
    sent.length = 0;
    await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: ADMIN.email } });
    expect(sent.length).toBe(0); // bereits drei in dieser Stunde
    // Abgelaufenes Token direkt anlegen (weitere Anforderungen blockiert das IP-Rate-Limit)
    const token = 'abgelaufenes-token-abgelaufenes-token-123';
    const userId = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'Drittes-Passwort-2026' } })).json().user.id;
    app.dbHandle.sqlite.prepare(`insert into user_tokens (id, user_id, purpose, token_hash, expires_at) values (?, ?, 'password_reset', ?, '2000-01-01T00:00:00.000Z')`).run(crypto.randomUUID(), userId, sha256(token));
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/confirm', payload: { token, password: 'Viertes-Passwort-2026' } })).statusCode).toBe(400);
    const limited = await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: ADMIN.email } });
    expect(limited.statusCode).toBe(429);
  });
});
