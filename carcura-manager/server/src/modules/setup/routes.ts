import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { companies, users } from '../../db/schema.js';
import { parse, zEmail, zTrimmed, zOptionalText } from '../../core/validation.js';
import { hashPassword, validatePasswordPolicy } from '../../core/password.js';
import { newId, randomToken } from '../../core/ids.js';
import { badRequest, conflict } from '../../core/errors.js';
import { seedRolePermissions, createSession } from '../../core/session.js';
import { slugify } from '../../core/normalize.js';
import { writeAudit } from '../../core/audit.js';
import { SESSION_COOKIE } from '../../plugins/auth.js';
import { seedDefaultServices } from '../company/defaultServices.js';

const setupSchema = z.object({
  company: z.object({
    name: zTrimmed(120).min(2, 'Firmenname fehlt.'),
    email: zOptionalText(200),
    phone: zOptionalText(60),
    website: zOptionalText(200),
    street: zOptionalText(200),
    zip: zOptionalText(20),
    city: zOptionalText(120),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  admin: z.object({
    email: zEmail,
    password: z.string(),
    firstName: zTrimmed(80).min(1, 'Vorname fehlt.'),
    lastName: zTrimmed(80).min(1, 'Nachname fehlt.'),
  }),
  seedDefaultServices: z.boolean().default(true),
  setupToken: z.string().max(100).optional(),
});

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
/** Gut abtippbarer Code ohne verwechselbare Zeichen, z. B. 7KQM-X4TD-9HWR. */
function newSetupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export default async function setupRoutes(app: FastifyInstance) {
  const countCompanies = () => app.db.select({ n: sql<number>`count(*)` }).from(companies).get()?.n ?? 0;

  // Einrichtungscode: Pflicht, wenn der Server aus dem Netz erreichbar ist (Produktion, nicht nur localhost)
  // oder SETUP_TOKEN gesetzt ist. Nach der Ersteinrichtung ohne Bedeutung.
  // Ohne Code nur, wenn der Server ausschließlich lokal erreichbar ist (Laptop): Bindung an localhost, kein Proxy davor
  // und lokale Adresse. Hinter Caddy/Nginx oder mit Bindung an alle Schnittstellen ist der Code Pflicht.
  const publicHost = (() => { try { return new URL(app.config.publicUrl).hostname; } catch { return ''; } })();
  const localOnly = LOOPBACK.has(app.config.host) && app.config.trustProxy === 0 && LOOPBACK.has(publicHost);
  const needsCode = Boolean(app.config.setupToken) || !localOnly;
  let generated: string | null = null;
  const currentCode = (): string | null => {
    if (!needsCode) return null;
    if (app.config.setupToken) return app.config.setupToken;
    if (!generated) {
      generated = newSetupCode();
      app.log.warn(`Ersteinrichtung ausstehend. Einrichtungscode: ${generated} (nur für die Ersteinrichtung; anzeigen mit: docker compose logs app | grep Einrichtungscode)`);
    }
    return generated;
  };
  if (countCompanies() === 0) currentCode();

  app.get('/api/setup/status', async () => {
    const needsSetup = countCompanies() === 0;
    return { needsSetup, setupCodeRequired: needsSetup && needsCode };
  });

  app.post('/api/setup', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (countCompanies() > 0) throw conflict('Die Ersteinrichtung wurde bereits abgeschlossen.');
    const input = parse(setupSchema, req.body);
    const setupCode = currentCode();
    if (setupCode) {
      const given = Buffer.from(normCode(input.setupToken ?? ''));
      const expected = Buffer.from(normCode(setupCode));
      if (expected.length < 8 || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        app.log.warn({ ip: req.ip }, 'Ersteinrichtung mit falschem Einrichtungscode abgewiesen');
        throw badRequest('Einrichtungscode fehlt oder ist falsch. Er steht im Server-Protokoll (docker compose logs app | grep Einrichtungscode).', [{ path: 'setupToken', message: 'Einrichtungscode falsch.' }]);
      }
    }
    const pwError = validatePasswordPolicy(input.admin.password);
    if (pwError) throw badRequest(pwError, [{ path: 'admin.password', message: pwError }]);

    const companyId = newId();
    const userId = newId();
    const passwordHash = await hashPassword(input.admin.password);

    app.db.transaction((tx) => {
      // Erneute Prüfung innerhalb der Transaktion: zwei gleichzeitige Einrichtungen dürfen nicht beide gelingen
      if ((tx.select({ n: sql<number>`count(*)` }).from(companies).get()?.n ?? 0) > 0) throw conflict('Die Ersteinrichtung wurde bereits abgeschlossen.');
      tx.insert(companies)
        .values({
          id: companyId,
          name: input.company.name,
          slug: slugify(input.company.name),
          email: input.company.email,
          phone: input.company.phone,
          website: input.company.website,
          street: input.company.street,
          zip: input.company.zip,
          city: input.company.city,
          primaryColor: input.company.primaryColor ?? '#E8F320',
          websiteLeadToken: randomToken(24),
        })
        .run();
      tx.insert(users)
        .values({
          id: userId,
          companyId,
          email: input.admin.email,
          passwordHash,
          firstName: input.admin.firstName,
          lastName: input.admin.lastName,
          role: 'admin',
          isPlatformAdmin: true,
        })
        .run();
      seedRolePermissions(tx, companyId);
      if (input.seedDefaultServices) seedDefaultServices(tx, companyId);
      writeAudit(tx, { companyId, userId, ip: req.ip }, { action: 'setup.complete', entityType: 'company', entityId: companyId, after: { name: input.company.name } });
    });

    const user = app.db.select().from(users).where(sql`${users.id} = ${userId}`).get()!;
    const sessionId = createSession(app.db, app.config, user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE, sessionId, app.cookieOptions);
    return { ok: true, companyId, userId };
  });
}
