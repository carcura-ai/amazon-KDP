import type { FastifyInstance, InjectOptions } from 'fastify';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE } from '../src/plugins/auth.js';

export async function testApp(extra: { exitFn?: (code: number, reason: string) => void; dbPath?: string } = {}): Promise<FastifyInstance> {
  const dataDir = `/tmp/cm-test/${process.pid}-${Math.random().toString(36).slice(2)}`;
  const config = loadConfig({ dbPath: extra.dbPath ?? ':memory:', appSecret: 'test-secret-test-secret-test-secret-1234', dataDir, filesDir: `${dataDir}/files`, backupsDir: `${dataDir}/backups`, logLevel: 'silent', chromiumPath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  const dbHandle = openDatabase(extra.dbPath ?? ':memory:');
  return buildApp({ config, dbHandle, logger: false, exitFn: extra.exitFn ?? (() => undefined) });
}

export interface Session {
  cookie: string;
  companyId: string;
  userId: string;
}

export function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }): string {
  const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
  if (!c) throw new Error('Kein Session-Cookie gesetzt');
  return `${SESSION_COOKIE}=${c.value}`;
}

export const ADMIN = { email: 'admin@carcura.test', password: 'Sicher-Passwort1', firstName: 'Alex', lastName: 'Fuchs' };

export async function setupCompany(app: FastifyInstance, name = 'Carcura'): Promise<Session> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/setup',
    payload: { company: { name, email: 'info@carcura.test', city: 'Köln' }, admin: ADMIN, seedDefaultServices: true },
  });
  if (res.statusCode !== 200) throw new Error(`Setup fehlgeschlagen: ${res.body}`);
  const body = res.json();
  return { cookie: cookieFrom(res), companyId: body.companyId, userId: body.userId };
}

export async function login(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`Login fehlgeschlagen: ${res.body}`);
  return cookieFrom(res);
}

export function as(session: Session | string, opts: InjectOptions): InjectOptions {
  const cookie = typeof session === 'string' ? session : session.cookie;
  return { ...opts, headers: { ...(opts.headers ?? {}), cookie } };
}
