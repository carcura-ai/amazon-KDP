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

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dbHandle: DbHandle;
    config: AppConfig;
    cookieOptions: CookieSerializeOptions;
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

  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(setupRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(companyRoutes);

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
