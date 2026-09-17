import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { companies, rolePermissions, auditLog } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed, zPagination } from '../../core/validation.js';
import { newId, nowIso, randomToken } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import { PERMISSIONS, ROLES, DEFAULT_ROLE_PERMISSIONS } from '../../core/permissions.js';
import { ctxOf } from '../../plugins/auth.js';
import { publicCompany } from '../auth/routes.js';
import { badRequest } from '../../core/errors.js';
import { desc, sql } from 'drizzle-orm';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Farbe als Hex-Wert, z. B. #E8F320.');
const updateSchema = z.object({
  name: zTrimmed(120).min(2).optional(),
  legalName: zOptionalText(200),
  email: zOptionalText(200),
  phone: zOptionalText(60),
  website: zOptionalText(200),
  street: zOptionalText(200),
  zip: zOptionalText(20),
  city: zOptionalText(120),
  country: zTrimmed(2).optional(),
  taxNumber: zOptionalText(60),
  vatId: zOptionalText(60),
  bankName: zOptionalText(120),
  iban: zOptionalText(40),
  bic: zOptionalText(20),
  primaryColor: hex.optional(),
  secondaryColor: hex.optional(),
  invoicePrefix: zTrimmed(10).min(1).optional(),
  offerPrefix: zTrimmed(10).min(1).optional(),
  customerPrefix: zTrimmed(10).min(1).optional(),
  defaultVatBp: z.number().int().min(0).max(10000).optional(),
  smallBusiness: z.boolean().optional(),
  invoiceFooter: zOptionalText(2000),
  paymentTermsDays: z.number().int().min(0).max(120).optional(),
  reminderDaysBefore: z.number().int().min(0).max(30).optional(),
  settingsJson: z.record(z.string(), z.unknown()).optional(),
  productName: zTrimmed(60).min(1).optional(),
  poweredBy: zOptionalText(120),
});

export default async function companyRoutes(app: FastifyInstance) {
  app.get('/api/company', { preHandler: app.requireAuth() }, async (req) => {
    const ctx = ctxOf(req);
    return publicCompany(app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!);
  });

  app.patch('/api/company', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(updateSchema, req.body);
    const before = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const { settingsJson, ...rest } = input;
    app.db
      .update(companies)
      .set({ ...rest, ...(settingsJson ? { settingsJson: JSON.stringify(settingsJson) } : {}), updatedAt: nowIso() })
      .where(eq(companies.id, ctx.companyId))
      .run();
    const after = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    writeAudit(app.db, ctx, { action: 'company.update', entityType: 'company', entityId: ctx.companyId, before: publicCompany(before), after: publicCompany(after) });
    return publicCompany(after);
  });

  /** Token für den Website-Lead-Eingang (nur Admin sieht ihn, kann ihn neu erzeugen). */
  app.get('/api/company/website-lead-token', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const c = app.db.select({ t: companies.websiteLeadToken }).from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    return { token: c.t, endpoint: `${app.config.publicUrl}/api/public/leads/website` };
  });
  app.post('/api/company/website-lead-token/rotate', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const token = randomToken(24);
    app.db.update(companies).set({ websiteLeadToken: token, updatedAt: nowIso() }).where(eq(companies.id, ctx.companyId)).run();
    writeAudit(app.db, ctx, { action: 'company.lead_token_rotated', entityType: 'company', entityId: ctx.companyId });
    return { token };
  });

  app.get('/api/company/role-permissions', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select().from(rolePermissions).where(eq(rolePermissions.companyId, ctx.companyId)).all();
    const byRole: Record<string, string[]> = {};
    for (const role of ROLES) byRole[role] = [];
    for (const r of rows) (byRole[r.role] ??= []).push(r.permission);
    return { roles: [...ROLES], permissions: [...PERMISSIONS], defaults: DEFAULT_ROLE_PERMISSIONS, byRole };
  });

  app.put('/api/company/role-permissions/:role', { preHandler: app.requireAuth('users:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { role } = req.params as { role: string };
    if (!(ROLES as readonly string[]).includes(role)) throw badRequest('Unbekannte Rolle.');
    if (role === 'admin') throw badRequest('Die Administrator-Rolle behält immer alle Rechte.');
    const { permissions } = parse(z.object({ permissions: z.array(z.enum(PERMISSIONS)) }), req.body);
    app.db.transaction((tx) => {
      tx.delete(rolePermissions).where(and(eq(rolePermissions.companyId, ctx.companyId), eq(rolePermissions.role, role))).run();
      for (const p of new Set(permissions)) tx.insert(rolePermissions).values({ id: newId(), companyId: ctx.companyId, role, permission: p }).run();
    });
    writeAudit(app.db, ctx, { action: 'company.role_permissions', entityType: 'role', entityId: role, after: permissions });
    return { ok: true };
  });

  app.get('/api/audit', { preHandler: app.requireAuth('audit:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { page, pageSize } = parse(zPagination, req.query);
    const items = app.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.companyId, ctx.companyId))
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    const total = app.db.select({ n: sql<number>`count(*)` }).from(auditLog).where(eq(auditLog.companyId, ctx.companyId)).get()?.n ?? 0;
    return { items, total, page, pageSize };
  });
}
