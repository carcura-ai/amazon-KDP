import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Ctx } from '../core/context.js';
import type { Permission } from '../core/permissions.js';
import { forbidden, unauthorized } from '../core/errors.js';
import { resolveSession } from '../core/session.js';
import { isApiKeyToken, resolveApiKey } from '../core/apikeys.js';
import { writeAudit } from '../core/audit.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const SESSION_COOKIE = 'cm_sid';
/** Einzige Bereiche, die mit API-Schlüssel erreichbar sind. */
const API_KEY_PATHS = ['/api/customers', '/api/vehicles', '/api/orders', '/api/leads', '/api/appointments', '/api/services'];

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

  app.addHook('onRequest', async (req, reply) => {
    // API-Schlüssel (Authorization: Bearer cm_…) – nur ohne Sitzungs-Cookie, nur für /api/, nie zum Löschen.
    const authz = req.headers.authorization;
    if (!req.cookies[SESSION_COOKIE] && typeof authz === 'string' && authz.startsWith('Bearer ')) {
      const token = authz.slice(7).trim();
      if (!isApiKeyToken(token) || !API_KEY_PATHS.some((pfx) => req.url.startsWith(pfx))) return reply.status(401).send({ error: 'unauthorized', message: 'Ungültiger API-Schlüssel.' });
      const ctx = resolveApiKey(app.db, token, req.ip);
      if (!ctx) return reply.status(401).send({ error: 'unauthorized', message: 'API-Schlüssel ungültig, gesperrt oder abgelaufen.' });
      if (req.method === 'DELETE') return reply.status(403).send({ error: 'forbidden', message: 'Löschen ist mit API-Schlüsseln nicht erlaubt.' });
      req.auth = { ...ctx, requestId: req.id };
      return;
    }
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const info = resolveSession(app.db, app.config, unsigned.value, req.ip);
    if (!info) return;
    req.auth = { ...info.ctx, requestId: req.id };
    req.sessionId = info.sessionId;
  });

  // Supportzugriff: jede Anfrage wird im Audit-Log des Mandanten protokolliert (ohne Query-String und Body).
  app.addHook('onResponse', async (req, reply) => {
    const ctx = req.auth;
    if (!ctx?.supportSessionId) return;
    writeAudit(app.db, ctx, { action: 'support.request', entityType: 'http', entityId: null, after: { method: req.method, path: req.url.split('?')[0], status: reply.statusCode, requestId: req.id } });
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
      if (req.auth.supportSessionId || !req.auth.isPlatformAdmin) throw forbidden('Nur für den Softwarebetreiber.');
      // Im SaaS-Betrieb ist Zwei-Faktor-Anmeldung für System-Admins Pflicht.
      if (app.config.deploymentMode === 'saas') {
        const u = app.db.select({ totp: users.totpEnabledAt }).from(users).where(eq(users.id, req.auth.userId)).get();
        if (!u?.totp) throw forbidden('System-Admins müssen die Zwei-Faktor-Anmeldung aktivieren (Einstellungen → Konto).');
      }
    };
  });
});

/** Liefert den Kontext oder wirft 401 – für Handler, die requireAuth als preHandler nutzen. */
export function ctxOf(req: FastifyRequest): Ctx {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
