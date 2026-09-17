import type { FastifyInstance } from 'fastify';
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
});

export default async function setupRoutes(app: FastifyInstance) {
  const countCompanies = () => app.db.select({ n: sql<number>`count(*)` }).from(companies).get()?.n ?? 0;

  app.get('/api/setup/status', async () => ({ needsSetup: countCompanies() === 0 }));

  app.post('/api/setup', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (countCompanies() > 0) throw conflict('Die Ersteinrichtung wurde bereits abgeschlossen.');
    const input = parse(setupSchema, req.body);
    const pwError = validatePasswordPolicy(input.admin.password);
    if (pwError) throw badRequest(pwError, [{ path: 'admin.password', message: pwError }]);

    const companyId = newId();
    const userId = newId();
    const passwordHash = await hashPassword(input.admin.password);

    app.db.transaction((tx) => {
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
