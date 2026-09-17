import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import { and, desc, eq } from 'drizzle-orm';
import { reports } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { generateAndStoreReport, periodFor, type ReportType } from './generator.js';

export default async function reportRoutes(app: FastifyInstance) {
  app.get('/api/reports', { preHandler: app.requireAuth('reports:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { type } = parse(z.object({ type: z.enum(['weekly', 'monthly', 'yearly']).optional() }), req.query);
    const rows = app.db.select({ id: reports.id, type: reports.type, periodStart: reports.periodStart, periodEnd: reports.periodEnd, title: reports.title, summary: reports.summary, pdfFileId: reports.pdfFileId, sentTo: reports.sentTo, generatedAt: reports.generatedAt }).from(reports).where(and(eq(reports.companyId, ctx.companyId), type ? eq(reports.type, type) : undefined)).orderBy(desc(reports.periodStart), desc(reports.generatedAt)).limit(100).all();
    return { items: rows };
  });

  app.get('/api/reports/:id', { preHandler: app.requireAuth('reports:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const r = app.db.select().from(reports).where(and(eq(reports.id, id), eq(reports.companyId, ctx.companyId))).get();
    if (!r) throw notFound('Bericht');
    return { ...r, content: JSON.parse(r.contentJson) };
  });

  app.get('/api/reports/:id/pdf', { preHandler: app.requireAuth('reports:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const r = app.db.select().from(reports).where(and(eq(reports.id, id), eq(reports.companyId, ctx.companyId))).get();
    if (!r?.pdfFileId) throw notFound('PDF');
    const f = app.storage.get(ctx.companyId, r.pdfFileId);
    if (!f) throw notFound('PDF');
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${f.originalName}"`);
    return reply.send(fs.createReadStream(app.storage.absolute(f.storagePath)));
  });

  /** Bericht (neu) erzeugen – Standard: letzte abgeschlossene Periode; optional aktueller Zeitraum bis heute. */
  app.post('/api/reports/generate', { preHandler: app.requireAuth('reports:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { type, current, email } = parse(z.object({ type: z.enum(['weekly', 'monthly', 'yearly']), current: z.boolean().default(false), email: z.boolean().default(false) }), req.body);
    let period = periodFor(type as ReportType);
    if (current) {
      const today = new Date().toISOString().slice(0, 10);
      if (type === 'weekly') { const d = new Date(); const dow = (d.getUTCDay() + 6) % 7; const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow); const from = mon.toISOString().slice(0, 10); const pf = new Date(mon); pf.setUTCDate(mon.getUTCDate() - 7); const pt = new Date(mon); pt.setUTCDate(mon.getUTCDate() - 1); period = { from, to: today, label: `Laufende Woche ab ${from}`, prevFrom: pf.toISOString().slice(0, 10), prevTo: pt.toISOString().slice(0, 10) }; }
      else if (type === 'monthly') { const from = today.slice(0, 8) + '01'; const p = new Date(from); const pf = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() - 1, 1)).toISOString().slice(0, 10); const pt = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 0)).toISOString().slice(0, 10); period = { from, to: today, label: `Laufender Monat ${new Date(from).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`, prevFrom: pf, prevTo: pt }; }
      else { const y = today.slice(0, 4); period = { from: `${y}-01-01`, to: today, label: `Laufendes Jahr ${y}`, prevFrom: `${Number(y) - 1}-01-01`, prevTo: `${Number(y) - 1}-12-31` }; }
    }
    const r = await generateAndStoreReport(app, ctx.companyId, type as ReportType, period, { email });
    writeAudit(app.db, ctx, { action: 'report.generate', entityType: 'report', entityId: r.id, after: { type, period } });
    return { id: r.id, content: r.content, pdfFileId: r.pdfFileId, sentTo: r.sentTo };
  });
}
