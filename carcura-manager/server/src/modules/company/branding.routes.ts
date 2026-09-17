import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { companies } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { notFound } from '../../core/errors.js';

/**
 * Öffentliches Branding für Login-/Einrichtungsseite (White-Label): Name, Produktname,
 * Farben und Logo des Mandanten – ohne Anmeldung, aber ohne weitere Daten.
 * Auswahl per ?slug=…; ohne Slug der erste aktive Mandant (Einzelinstallation).
 */
export default async function brandingRoutes(app: FastifyInstance) {
  const pick = (slug?: string) => {
    if (slug) return app.db.select().from(companies).where(eq(companies.slug, slug)).get() ?? null;
    return app.db.select().from(companies).where(eq(companies.isActive, true)).orderBy(asc(companies.createdAt)).limit(1).get() ?? null;
  };
  app.get('/api/branding', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().max(120).optional() }), req.query);
    const c = pick(slug);
    if (!c) return { name: 'Manager', productName: 'Manager', primaryColor: '#E8F320', secondaryColor: '#0B0B0C', hasLogo: false, slug: null, poweredBy: null };
    return { name: c.name, productName: c.productName, primaryColor: c.primaryColor, secondaryColor: c.secondaryColor, hasLogo: Boolean(c.logoFileId), slug: c.slug, poweredBy: c.poweredBy };
  });
  app.get('/api/branding/logo', async (req, reply) => {
    const { slug } = parse(z.object({ slug: z.string().max(120).optional() }), req.query);
    const c = pick(slug);
    const row = c?.logoFileId ? app.storage.get(c.id, c.logoFileId) : null;
    if (!row) throw notFound('Logo');
    reply.header('Content-Type', row.mimeType); reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(fs.createReadStream(app.storage.absolute(row.storagePath)));
  });
}
