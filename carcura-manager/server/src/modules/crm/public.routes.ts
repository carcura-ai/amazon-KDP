import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, gt } from 'drizzle-orm';
import { companies, leads } from '../../db/schema.js';
import { newId } from '../../core/ids.js';
import { normalizeEmail, normalizePhone } from '../../core/normalize.js';
import { sha256 } from '../../core/crypto.js';
import { logActivity } from './activities.js';
import { writeAudit } from '../../core/audit.js';

/**
 * Lead-Eingang für die Website. Payload ist 1:1 kompatibel zum Formular auf carcura.info
 * (Vertrag des Revenue-Plugins: POST /wp-json/ccrr/v1/lead). Absicherung über Mandanten-Token.
 */
const websiteLeadSchema = z.object({
  name: z.string().trim().max(160).default(''),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(60).default(''),
  vehicle: z.string().trim().max(200).default(''),
  service: z.string().trim().max(1000).default(''),
  message: z.string().trim().max(10000).default(''),
  customer_type: z.string().trim().max(20).default('privat'),
  source: z.string().trim().max(60).default('website'),
  channel: z.string().trim().max(60).default('web'),
  gclid: z.string().trim().max(200).default(''),
  fbclid: z.string().trim().max(200).default(''),
  campaign: z.string().trim().max(200).default(''),
  website: z.string().max(500).default(''), // Honeypot
  external_id: z.string().trim().max(120).default(''),
});

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0]! };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

export default async function publicLeadRoutes(app: FastifyInstance) {
  app.post('/api/public/leads/website', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const token = (req.headers['x-lead-token'] as string | undefined) ?? (req.query as { token?: string }).token;
    if (!token) return reply.status(401).send({ ok: false, error: 'token_missing' });
    const company = app.db.select().from(companies).where(and(eq(companies.websiteLeadToken, token), eq(companies.isActive, true))).get();
    if (!company) return reply.status(401).send({ ok: false, error: 'token_invalid' });

    const parsed = websiteLeadSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    const p = parsed.data;
    if (p.website) return { ok: true }; // Honeypot: Bots bekommen Erfolg, es entsteht nichts
    if (!p.email && !p.phone && !p.name) return reply.status(400).send({ ok: false, error: 'contact_missing' });

    const email = normalizeEmail(p.email);
    const phone = normalizePhone(p.phone);
    // Duplikatschutz: identische Anfrage (Kontakt + Nachricht) innerhalb von 24 h wird nicht doppelt angelegt
    const externalId = p.external_id || `web:${sha256(`${company.id}|${email ?? ''}|${phone ?? ''}|${p.service}|${p.message}`).slice(0, 32)}`;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const existing = app.db.select({ id: leads.id }).from(leads).where(and(eq(leads.companyId, company.id), eq(leads.externalId, externalId), gt(leads.createdAt, since))).get();
    if (existing) return { ok: true, duplicate: true, id: existing.id };

    const { firstName, lastName } = splitName(p.name);
    const source = p.gclid ? 'google_ads' : p.fbclid ? 'meta_ads' : 'website';
    const id = newId();
    app.db
      .insert(leads)
      .values({
        id,
        companyId: company.id,
        firstName,
        lastName,
        customerType: p.customer_type === 'firma' ? 'business' : 'private',
        email: email,
        phone: p.phone || null,
        source,
        sourceDetail: [p.channel, p.source].filter(Boolean).join(':'),
        gclid: p.gclid || null,
        fbclid: p.fbclid || null,
        campaign: p.campaign || null,
        requestedService: p.service || null,
        vehicleText: p.vehicle || null,
        message: p.message || null,
        externalId,
        normalizedEmail: email,
        normalizedPhone: phone,
      })
      .run();
    logActivity(app.db, company.id, { leadId: id, type: 'message', direction: 'in', subject: 'Anfrage über Website', content: p.message || p.service || null });
    writeAudit(app.db, { companyId: company.id, ip: req.ip }, { action: 'lead.website_intake', entityType: 'lead', entityId: id, after: { source, service: p.service } });
    return { ok: true, id };
  });
}
