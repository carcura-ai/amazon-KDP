import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import { and, asc, desc, eq } from 'drizzle-orm';
import { protocols, protocolDamages, customers, vehicles, orders, files, companies, users } from '../../db/schema.js';
import { parse, zOptionalText } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { nextNumber } from '../../core/numbering.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from '../crm/activities.js';
import { documentShell, documentFooter, protocolBody, dateDe, PROTOCOL_LABELS } from '../../integrations/pdf-templates.js';

const AREAS = ['front', 'rear', 'left', 'right', 'roof', 'interior', 'wheels', 'glass', 'other'] as const;
const TYPES = ['scratch', 'dent', 'paint', 'stone_chip', 'crack', 'stain', 'tear', 'wear', 'other'] as const;
const damageSchema = z.object({
  id: z.string().uuid().optional(),
  area: z.enum(AREAS),
  type: z.enum(TYPES),
  severity: z.enum(['minor', 'medium', 'major']).default('minor'),
  description: zOptionalText(500),
  posX: z.number().int().min(0).max(1000).nullable().optional(),
  posY: z.number().int().min(0).max(1000).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
});
const fields = {
  type: z.enum(['intake', 'handover']),
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  orderId: z.string().uuid().nullable(),
  mileage: z.number().int().min(0).nullable(),
  fuelLevel: z.number().int().min(0).max(100).nullable(),
  exteriorCondition: zOptionalText(120),
  interiorCondition: zOptionalText(120),
  checklist: z.record(z.string(), z.boolean()),
  notes: zOptionalText(5000),
  damages: z.array(damageSchema).max(200),
};
const createSchema = z.object({ ...fields, type: fields.type.default('intake'), orderId: fields.orderId.default(null), mileage: fields.mileage.default(null), fuelLevel: fields.fuelLevel.default(null), checklist: fields.checklist.default({}), damages: fields.damages.default([]) });
const updateSchema = z.object(fields).partial();

export default async function protocolRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(protocols).where(and(eq(protocols.id, id), eq(protocols.companyId, companyId))).get();
    if (!row) throw notFound('Protokoll');
    return row;
  };
  const damagesOf = (id: string) => app.db.select().from(protocolDamages).where(eq(protocolDamages.protocolId, id)).orderBy(asc(protocolDamages.sortOrder)).all();
  const detail = (companyId: string, id: string) => {
    const p = getOne(companyId, id);
    return {
      protocol: p,
      damages: damagesOf(id),
      customer: app.db.select().from(customers).where(eq(customers.id, p.customerId)).get() ?? null,
      vehicle: app.db.select().from(vehicles).where(eq(vehicles.id, p.vehicleId)).get() ?? null,
      order: p.orderId ? app.db.select().from(orders).where(eq(orders.id, p.orderId)).get() ?? null : null,
      files: app.db.select().from(files).where(and(eq(files.protocolId, id), eq(files.kind, 'image'))).orderBy(asc(files.sortOrder), asc(files.createdAt)).all(),
      labels: PROTOCOL_LABELS,
    };
  };
  const writeDamages = (companyId: string, id: string, list: z.infer<typeof damageSchema>[]) => {
    app.db.delete(protocolDamages).where(eq(protocolDamages.protocolId, id)).run();
    list.forEach((d, i) => app.db.insert(protocolDamages).values({ id: d.id ?? newId(), companyId, protocolId: id, area: d.area, type: d.type, severity: d.severity, description: d.description ?? null, posX: d.posX ?? null, posY: d.posY ?? null, fileId: d.fileId ?? null, sortOrder: i }).run());
  };
  const assertDraft = (p: typeof protocols.$inferSelect) => {
    if (p.status === 'final') throw conflict('Ein abgeschlossenes Protokoll kann nicht mehr geändert werden.');
  };

  app.get('/api/protocols', { preHandler: app.requireAuth('protocols:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ customerId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional(), orderId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    const conds = [eq(protocols.companyId, ctx.companyId)];
    if (q.customerId) conds.push(eq(protocols.customerId, q.customerId));
    if (q.vehicleId) conds.push(eq(protocols.vehicleId, q.vehicleId));
    if (q.orderId) conds.push(eq(protocols.orderId, q.orderId));
    const rows = app.db
      .select({ protocol: protocols, customer: { id: customers.id, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }, vehicle: { id: vehicles.id, licensePlate: vehicles.licensePlate, make: vehicles.make, model: vehicles.model } })
      .from(protocols)
      .innerJoin(customers, eq(customers.id, protocols.customerId))
      .innerJoin(vehicles, eq(vehicles.id, protocols.vehicleId))
      .where(and(...conds))
      .orderBy(desc(protocols.createdAt))
      .limit(q.limit)
      .all();
    return { items: rows };
  });

  app.get('/api/protocols/:id', { preHandler: app.requireAuth('protocols:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    return detail(ctx.companyId, id);
  });

  app.post('/api/protocols', { preHandler: app.requireAuth('protocols:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { damages, checklist, ...input } = parse(createSchema, req.body);
    const vehicle = app.db.select().from(vehicles).where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.companyId, ctx.companyId))).get();
    if (!vehicle) throw notFound('Fahrzeug');
    if (vehicle.customerId !== input.customerId) throw badRequest('Das Fahrzeug gehört nicht zu diesem Kunden.');
    if (input.orderId && !app.db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, input.orderId), eq(orders.companyId, ctx.companyId))).get()) throw notFound('Auftrag');
    const id = newId();
    const protocolNumber = nextNumber(app.db, ctx.companyId, 'protocol', 'PR', true);
    app.db.insert(protocols).values({ id, companyId: ctx.companyId, protocolNumber, ...input, checklistJson: JSON.stringify(checklist), createdByUserId: ctx.userId }).run();
    writeDamages(ctx.companyId, id, damages);
    if (input.mileage !== null) app.db.update(vehicles).set({ mileage: input.mileage, updatedAt: nowIso() }).where(eq(vehicles.id, input.vehicleId)).run();
    logActivity(app.db, ctx.companyId, { customerId: input.customerId, vehicleId: input.vehicleId, userId: ctx.userId, type: 'system', subject: `${input.type === 'intake' ? 'Annahmeprotokoll' : 'Übergabeprotokoll'} ${protocolNumber} angelegt`, refType: 'protocol', refId: id });
    writeAudit(app.db, ctx, { action: 'protocol.create', entityType: 'protocol', entityId: id, after: { protocolNumber, damages: damages.length } });
    return detail(ctx.companyId, id);
  });

  app.patch('/api/protocols/:id', { preHandler: app.requireAuth('protocols:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { damages, checklist, ...input } = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    assertDraft(before);
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    if (checklist) patch.checklistJson = JSON.stringify(checklist);
    delete patch.customerId; delete patch.vehicleId; // Kunde/Fahrzeug sind nach Anlage fest
    app.db.update(protocols).set(patch).where(eq(protocols.id, id)).run();
    if (damages) writeDamages(ctx.companyId, id, damages);
    if (input.mileage !== undefined && input.mileage !== null) app.db.update(vehicles).set({ mileage: input.mileage, updatedAt: nowIso() }).where(eq(vehicles.id, before.vehicleId)).run();
    writeAudit(app.db, ctx, { action: 'protocol.update', entityType: 'protocol', entityId: id });
    return detail(ctx.companyId, id);
  });

  /** Unterschrift (PNG-Data-URL vom Signaturfeld) für Kunde oder Mitarbeiter. */
  app.post('/api/protocols/:id/sign', { preHandler: app.requireAuth('protocols:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { role, dataUrl, name } = parse(z.object({ role: z.enum(['customer', 'employee']), dataUrl: z.string().startsWith('data:image/png;base64,').max(2_000_000), name: zOptionalText(120) }), req.body);
    const p = getOne(ctx.companyId, id);
    assertDraft(p);
    const buffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    const row = await app.storage.store({ companyId: ctx.companyId, buffer, originalName: `unterschrift-${role}.png`, mimeType: 'image/png', kind: 'signature', category: 'protocol', protocolId: id, customerId: p.customerId, uploadedByUserId: ctx.userId });
    const prevId = role === 'customer' ? p.customerSignatureFileId : p.employeeSignatureFileId;
    if (prevId) app.storage.remove(ctx.companyId, prevId);
    app.db
      .update(protocols)
      .set(role === 'customer' ? { customerSignatureFileId: row.id, signedByName: name ?? p.signedByName, signedAt: nowIso(), updatedAt: nowIso() } : { employeeSignatureFileId: row.id, updatedAt: nowIso() })
      .where(eq(protocols.id, id))
      .run();
    writeAudit(app.db, ctx, { action: 'protocol.sign', entityType: 'protocol', entityId: id, after: { role, name } });
    return detail(ctx.companyId, id);
  });

  const renderPdf = async (companyId: string, id: string): Promise<Buffer> => {
    const d = detail(companyId, id);
    if (!d.customer || !d.vehicle) throw notFound('Kunde oder Fahrzeug');
    const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
    const logo = company.logoFileId ? app.storage.get(companyId, company.logoFileId) : null;
    const photos = d.files.map((f) => ({ file: f, dataUrl: app.storage.dataUrl(f, 'display') }));
    const sigOf = (fid: string | null) => { const f = fid ? app.storage.get(companyId, fid) : null; return f ? app.storage.dataUrl(f, 'original') : null; };
    const employee = d.protocol.createdByUserId ? app.db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, d.protocol.createdByUserId)).get() : null;
    const html = documentShell({
      company,
      logoDataUrl: logo ? app.storage.dataUrl(logo, 'original') : null,
      title: d.protocol.type === 'intake' ? 'Annahmeprotokoll' : 'Übergabeprotokoll',
      docNumber: d.protocol.protocolNumber,
      docDate: dateDe(d.protocol.createdAt),
      subtitle: d.order ? `Zu Auftrag ${d.order.orderNumber}` : undefined,
      body: protocolBody(d.protocol, d.customer, d.vehicle, d.damages, photos, { customer: sigOf(d.protocol.customerSignatureFileId), employee: sigOf(d.protocol.employeeSignatureFileId) }, employee ? `${employee.firstName} ${employee.lastName}` : null),
    });
    return app.pdf.render(html, { footerHtml: documentFooter(company, `Protokoll ${d.protocol.protocolNumber}`) });
  };

  app.get('/api/protocols/:id/pdf', { preHandler: app.requireAuth('protocols:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const p = getOne(ctx.companyId, id);
    if (p.status === 'final' && p.pdfFileId) {
      const f = app.storage.get(ctx.companyId, p.pdfFileId);
      if (f) { reply.header('Content-Type', 'application/pdf'); reply.header('Content-Disposition', `inline; filename="${p.protocolNumber}.pdf"`); return reply.send(fs.createReadStream(app.storage.absolute(f.storagePath))); }
    }
    const pdf = await renderPdf(ctx.companyId, id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${p.protocolNumber}${p.status === 'final' ? '' : '-entwurf'}.pdf"`);
    return reply.send(pdf);
  });

  /** Abschluss: PDF erzeugen, als Dokument in der Kundenakte ablegen, Protokoll einfrieren. */
  app.post('/api/protocols/:id/finalize', { preHandler: app.requireAuth('protocols:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const p = getOne(ctx.companyId, id);
    assertDraft(p);
    const pdf = await renderPdf(ctx.companyId, id);
    const row = await app.storage.store({ companyId: ctx.companyId, buffer: pdf, originalName: `${p.protocolNumber}.pdf`, mimeType: 'application/pdf', kind: 'pdf', category: 'protocol', customerId: p.customerId, vehicleId: p.vehicleId, orderId: p.orderId, protocolId: id, uploadedByUserId: ctx.userId });
    app.db.update(protocols).set({ status: 'final', pdfFileId: row.id, finalizedAt: nowIso(), updatedAt: nowIso() }).where(eq(protocols.id, id)).run();
    logActivity(app.db, ctx.companyId, { customerId: p.customerId, vehicleId: p.vehicleId, userId: ctx.userId, type: 'system', subject: `Protokoll ${p.protocolNumber} abgeschlossen`, refType: 'protocol', refId: id });
    writeAudit(app.db, ctx, { action: 'protocol.finalize', entityType: 'protocol', entityId: id, after: { pdfFileId: row.id } });
    return detail(ctx.companyId, id);
  });

  app.delete('/api/protocols/:id', { preHandler: app.requireAuth('protocols:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const p = getOne(ctx.companyId, id);
    assertDraft(p);
    for (const f of app.db.select().from(files).where(eq(files.protocolId, id)).all()) app.storage.remove(ctx.companyId, f.id);
    app.db.delete(protocolDamages).where(eq(protocolDamages.protocolId, id)).run();
    app.db.delete(protocols).where(eq(protocols.id, id)).run();
    writeAudit(app.db, ctx, { action: 'protocol.delete', entityType: 'protocol', entityId: id, before: { protocolNumber: p.protocolNumber } });
    return { ok: true };
  });
}
