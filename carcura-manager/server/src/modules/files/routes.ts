import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import { and, asc, eq } from 'drizzle-orm';
import { files, companies } from '../../db/schema.js';
import { parse, zOptionalText } from '../../core/validation.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nowIso } from '../../core/ids.js';
import { ctxOf } from '../../plugins/auth.js';
import { FILE_CATEGORIES } from '../../integrations/storage.js';

const metaSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  protocolId: z.string().uuid().nullable().optional(),
  category: z.enum(FILE_CATEGORIES).default('other'),
  caption: zOptionalText(300),
});

export default async function fileRoutes(app: FastifyInstance) {
  /** Upload (multipart/form-data): Feld `file` plus optionale Metadaten-Felder. */
  app.post('/api/files', { preHandler: app.requireAuth('documents:write') }, async (req) => {
    const ctx = ctxOf(req);
    const parts = req.parts();
    const fields: Record<string, string> = {};
    const stored = [];
    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        // Metadaten können vor oder nach der Datei kommen – deshalb erst sammeln
        stored.push({ buffer, filename: part.filename, mimetype: part.mimetype });
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
    if (stored.length === 0) throw badRequest('Keine Datei übermittelt.');
    const meta = parse(metaSchema, { ...fields, customerId: fields.customerId || null, vehicleId: fields.vehicleId || null, orderId: fields.orderId || null, protocolId: fields.protocolId || null, caption: fields.caption || null });
    const results = [];
    for (const s of stored) {
      const row = await app.storage.store({ companyId: ctx.companyId, buffer: s.buffer, originalName: s.filename, mimeType: s.mimetype, ...meta, uploadedByUserId: ctx.userId });
      writeAudit(app.db, ctx, { action: 'file.upload', entityType: 'file', entityId: row.id, after: { name: row.originalName, size: row.sizeBytes, category: row.category } });
      results.push(row);
    }
    return { items: results };
  });

  app.get('/api/files', { preHandler: app.requireAuth('documents:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ customerId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional(), orderId: z.string().uuid().optional(), protocolId: z.string().uuid().optional(), kind: z.string().optional() }), req.query);
    const conds = [eq(files.companyId, ctx.companyId)];
    if (q.customerId) conds.push(eq(files.customerId, q.customerId));
    if (q.vehicleId) conds.push(eq(files.vehicleId, q.vehicleId));
    if (q.orderId) conds.push(eq(files.orderId, q.orderId));
    if (q.protocolId) conds.push(eq(files.protocolId, q.protocolId));
    if (q.kind) conds.push(eq(files.kind, q.kind));
    if (!q.customerId && !q.vehicleId && !q.orderId && !q.protocolId) throw badRequest('Bitte Kunde, Fahrzeug, Auftrag oder Protokoll angeben.');
    return { items: app.db.select().from(files).where(and(...conds)).orderBy(asc(files.sortOrder), asc(files.createdAt)).all() };
  });

  app.patch('/api/files/:id', { preHandler: app.requireAuth('documents:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(z.object({ caption: zOptionalText(300), category: z.enum(FILE_CATEGORIES).optional(), sortOrder: z.number().int().optional() }), req.body);
    const row = app.storage.get(ctx.companyId, id);
    if (!row) throw notFound('Datei');
    app.db.update(files).set(input).where(eq(files.id, id)).run();
    return app.storage.get(ctx.companyId, id);
  });

  app.delete('/api/files/:id', { preHandler: app.requireAuth('documents:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const row = app.storage.get(ctx.companyId, id);
    if (!row) throw notFound('Datei');
    app.storage.remove(ctx.companyId, id);
    writeAudit(app.db, ctx, { action: 'file.delete', entityType: 'file', entityId: id, before: { name: row.originalName } });
    return { ok: true };
  });

  /** Auslieferung – nur mit Session und nur für den eigenen Mandanten. */
  app.get('/files/:id', { preHandler: app.requireAuth('documents:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { variant, download } = parse(z.object({ variant: z.enum(['thumb', 'display', 'original']).default('original'), download: z.coerce.boolean().default(false) }), req.query);
    const row = app.storage.get(ctx.companyId, id);
    if (!row) throw notFound('Datei');
    const rel = variant === 'thumb' && row.thumbPath ? row.thumbPath : variant === 'display' && row.displayPath ? row.displayPath : row.storagePath;
    const abs = app.storage.absolute(rel);
    if (!fs.existsSync(abs)) throw notFound('Datei auf der Festplatte');
    reply.header('Content-Type', rel === row.storagePath ? row.mimeType : 'image/jpeg');
    reply.header('Cache-Control', 'private, max-age=86400');
    if (download) reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(row.originalName)}"`);
    return reply.send(fs.createReadStream(abs));
  });

  /** Firmenlogo für Oberfläche und PDFs. */
  app.post('/api/company/logo', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const part = await req.file();
    if (!part) throw badRequest('Keine Datei übermittelt.');
    if (!part.mimetype.startsWith('image/')) throw badRequest('Das Logo muss ein Bild (PNG, JPG, WebP) sein.');
    const buffer = await part.toBuffer();
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    if (company.logoFileId) app.storage.remove(ctx.companyId, company.logoFileId);
    const row = await app.storage.store({ companyId: ctx.companyId, buffer, originalName: part.filename, mimeType: part.mimetype, kind: 'logo', category: 'other', uploadedByUserId: ctx.userId });
    app.db.update(companies).set({ logoFileId: row.id, updatedAt: nowIso() }).where(eq(companies.id, ctx.companyId)).run();
    writeAudit(app.db, ctx, { action: 'company.logo', entityType: 'company', entityId: ctx.companyId, after: { fileId: row.id } });
    return { ok: true, fileId: row.id };
  });

  app.delete('/api/company/logo', { preHandler: app.requireAuth('settings:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    if (company.logoFileId) app.storage.remove(ctx.companyId, company.logoFileId);
    app.db.update(companies).set({ logoFileId: null, updatedAt: nowIso() }).where(eq(companies.id, ctx.companyId)).run();
    return { ok: true };
  });

  app.get('/api/company/logo', { preHandler: app.requireAuth() }, async (req, reply) => {
    const ctx = ctxOf(req);
    const company = app.db.select({ logoFileId: companies.logoFileId }).from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const row = company.logoFileId ? app.storage.get(ctx.companyId, company.logoFileId) : null;
    if (!row) throw notFound('Logo');
    reply.header('Content-Type', row.mimeType);
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(fs.createReadStream(app.storage.absolute(row.storagePath)));
  });
}
