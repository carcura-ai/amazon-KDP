import Fastify, { type FastifyInstance } from 'fastify';
import cookie, { type CookieSerializeOptions } from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import type { Db, DbHandle } from './db/index.js';
import { AppError } from './core/errors.js';
import authPlugin from './plugins/auth.js';
import setupRoutes from './modules/setup/routes.js';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import companyRoutes from './modules/company/routes.js';
import serviceRoutes from './modules/crm/services.routes.js';
import leadRoutes from './modules/crm/leads.routes.js';
import customerRoutes from './modules/crm/customers.routes.js';
import vehicleRoutes from './modules/crm/vehicles.routes.js';
import publicLeadRoutes from './modules/crm/public.routes.js';
import platformRoutes from './modules/platform/routes.js';
import dashboardRoutes from './modules/dashboard/routes.js';
import searchRoutes from './modules/search/routes.js';
import { createRequire } from 'node:module';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dbHandle: DbHandle;
    config: AppConfig;
    cookieOptions: CookieSerializeOptions;
    appVersion: string;
  }
}

export interface BuildOptions {
  config: AppConfig;
  dbHandle: DbHandle;
  logger?: boolean | object;
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? { level: opts.config.logLevel, transport: opts.config.isProduction ? undefined : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    trustProxy: false,
    bodyLimit: 25 * 1024 * 1024,
  });

  app.decorate('db', opts.dbHandle.db);
  app.decorate('dbHandle', opts.dbHandle);
  app.decorate('config', opts.config);
  app.decorate('appVersion', (createRequire(import.meta.url)('../package.json') as { version: string }).version);
  app.decorate('cookieOptions', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.config.publicUrl.startsWith('https://'),
    signed: true,
    maxAge: opts.config.sessionMaxDays * 86_400,
  } satisfies CookieSerializeOptions);

  await app.register(cookie, { secret: opts.config.appSecret });
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'same-origin');
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message, details: err.details ?? null });
    }
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'bad_request', message: 'Eingabe ungültig.', details: err.issues });
    }
    const anyErr = err as { statusCode?: number; validation?: unknown; message?: string; code?: string };
    if (anyErr.statusCode === 429) return reply.status(429).send({ error: 'rate_limited', message: 'Zu viele Anfragen. Bitte kurz warten.' });
    if (anyErr.statusCode && anyErr.statusCode < 500) {
      return reply.status(anyErr.statusCode).send({ error: anyErr.code ?? 'bad_request', message: anyErr.message ?? 'Fehlerhafte Anfrage.' });
    }
    const errorId = Math.random().toString(36).slice(2, 10);
    req.log.error({ err, errorId }, 'Unbehandelter Fehler');
    return reply.status(500).send({ error: 'internal', message: `Interner Fehler (ID ${errorId}).` });
  });

  app.get('/api/health', async () => ({ ok: true, version: app.appVersion, time: new Date().toISOString() }));

  await app.register(setupRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(companyRoutes);
  await app.register(serviceRoutes);
  await app.register(leadRoutes);
  await app.register(customerRoutes);
  await app.register(vehicleRoutes);
  await app.register(publicLeadRoutes);
  await app.register(platformRoutes);
  await app.register(dashboardRoutes);
  await app.register(searchRoutes);

  // Web-App (Vite-Build) ausliefern, wenn vorhanden
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false, index: false });
    app.get('/', (_req, reply) => reply.sendFile('index.html'));
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/files/')) {
        return reply.status(404).send({ error: 'not_found', message: 'Route nicht gefunden.' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'not_found', message: 'Route nicht gefunden.' }));
  }

  app.addHook('onClose', async () => opts.dbHandle.close());
  return app;
}
