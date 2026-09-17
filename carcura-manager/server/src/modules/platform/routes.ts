import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { companies, users } from '../../db/schema.js';
import { parse, zEmail, zTrimmed, zOptionalText } from '../../core/validation.js';
import { hashPassword, validatePasswordPolicy } from '../../core/password.js';
import { newId, randomToken, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { seedRolePermissions } from '../../core/session.js';
import { slugify } from '../../core/normalize.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { seedDefaultServices } from '../company/defaultServices.js';
import { publicCompany } from '../auth/routes.js';

/**
 * Betreiber-Ebene: neue Mandanten anlegen, Übersicht über alle Unternehmen.
 * Nur für Benutzer mit is_platform_admin.
 */
const createSchema = z.object({
  company: z.object({ name: zTrimmed(120).min(2), email: zOptionalText(200), phone: zOptionalText(60), city: zOptionalText(120), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }),
  admin: z.object({ email: zEmail, password: z.string(), firstName: zTrimmed(80).min(1), lastName: zTrimmed(80).min(1) }),
  seedDefaultServices: z.boolean().default(true),
});

export default async function platformRoutes(app: FastifyInstance) {
  app.get('/api/platform/companies', { preHandler: app.requirePlatformAdmin() }, async () => {
    const rows = app.db
      .select({ company: companies, userCount: sql<number>`(select count(*) from users u where u.company_id = ${companies.id})` })
      .from(companies)
      .orderBy(companies.name)
      .all();
    return { items: rows.map((r) => ({ ...publicCompany(r.company), userCount: r.userCount })), version: app.appVersion };
  });

  app.post('/api/platform/companies', { preHandler: app.requirePlatformAdmin() }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(createSchema, req.body);
    const policy = validatePasswordPolicy(input.admin.password);
    if (policy) throw badRequest(policy);
    if (app.db.select({ id: users.id }).from(users).where(eq(users.email, input.admin.email)).get()) throw conflict('Diese E-Mail-Adresse wird bereits verwendet.');
    let slug = slugify(input.company.name);
    if (app.db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).get()) slug = `${slug}-${randomToken(3)}`;
    const companyId = newId();
    const userId = newId();
    const passwordHash = await hashPassword(input.admin.password);
    app.db.transaction((tx) => {
      tx.insert(companies).values({ id: companyId, name: input.company.name, slug, email: input.company.email, phone: input.company.phone, city: input.company.city, primaryColor: input.company.primaryColor ?? '#E8F320', websiteLeadToken: randomToken(24) }).run();
      tx.insert(users).values({ id: userId, companyId, email: input.admin.email, passwordHash, firstName: input.admin.firstName, lastName: input.admin.lastName, role: 'admin' }).run();
      seedRolePermissions(tx, companyId);
      if (input.seedDefaultServices) seedDefaultServices(tx, companyId);
    });
    writeAudit(app.db, ctx, { action: 'platform.company_create', entityType: 'company', entityId: companyId, after: { name: input.company.name, slug } });
    return { companyId, userId };
  });

  app.patch('/api/platform/companies/:id', { preHandler: app.requirePlatformAdmin() }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
    const before = app.db.select().from(companies).where(eq(companies.id, id)).get();
    if (!before) throw notFound('Mandant');
    if (id === ctx.companyId && !isActive) throw badRequest('Der eigene Mandant kann nicht deaktiviert werden.');
    app.db.update(companies).set({ isActive, updatedAt: nowIso() }).where(eq(companies.id, id)).run();
    writeAudit(app.db, ctx, { action: 'platform.company_status', entityType: 'company', entityId: id, after: { isActive } });
    return { ok: true };
  });
}
