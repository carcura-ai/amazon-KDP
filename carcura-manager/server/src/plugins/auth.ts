import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Ctx } from '../core/context.js';
import type { Permission } from '../core/permissions.js';
import { forbidden, unauthorized } from '../core/errors.js';
import { resolveSession } from '../core/session.js';

export const SESSION_COOKIE = 'cm_sid';

declare module 'fastify' {
  interface FastifyRequest {
    auth: Ctx | null;
    sessionId: string | null;
  }
  interface FastifyInstance {
    requireAuth: (...permissions: Permission[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePlatformAdmin: () => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  app.decorateRequest('auth', null);
  app.decorateRequest('sessionId', null);

  app.addHook('onRequest', async (req) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const info = resolveSession(app.db, app.config, unsigned.value, req.ip);
    if (!info) return;
    req.auth = info.ctx;
    req.sessionId = info.sessionId;
  });

  app.decorate('requireAuth', (...permissions: Permission[]) => {
    return async (req: FastifyRequest) => {
      if (!req.auth) throw unauthorized();
      for (const p of permissions) {
        if (!req.auth.permissions.has(p)) throw forbidden(`Berechtigung fehlt: ${p}`);
      }
    };
  });

  app.decorate('requirePlatformAdmin', () => {
    return async (req: FastifyRequest) => {
      if (!req.auth) throw unauthorized();
      if (!req.auth.isPlatformAdmin) throw forbidden('Nur für den Softwarebetreiber.');
    };
  });
});

/** Liefert den Kontext oder wirft 401 – für Handler, die requireAuth als preHandler nutzen. */
export function ctxOf(req: FastifyRequest): Ctx {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
