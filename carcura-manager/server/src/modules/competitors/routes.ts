import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { competitors, competitorSnapshots, companies } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed } from '../../core/validation.js';
import { badRequest, notFound } from '../../core/errors.js';
import { newId, nowIso } from '../../core/ids.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { PlacesAdapter } from './places.js';

export interface PlacesConfig { apiKey: string; queries: string[]; lat?: number | null; lng?: number | null; radiusKm?: number | null; ownPlaceId?: string | null }

/** Wöchentlicher Lauf: Wettbewerber über Google Places suchen, neue erkennen, Bewertungen als Tages-Snapshot speichern. */
export async function runCompetitorScan(app: FastifyInstance, companyId: string): Promise<{ found: number; newCount: number; snapshots: number }> {
  const f = app.integrations.get<PlacesConfig>(companyId, 'google_places');
  if (!f) return { found: 0, newCount: 0, snapshots: 0 };
  const adapter = new PlacesAdapter(f.config.apiKey, app.fetchFn);
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Map<string, Awaited<ReturnType<PlacesAdapter['searchText']>>[number]>();
  try {
    for (const q of f.config.queries) for (const p of await adapter.searchText(q, { lat: f.config.lat, lng: f.config.lng, radiusMeters: (f.config.radiusKm ?? 30) * 1000 })) seen.set(p.placeId, p);
    app.integrations.setStatus(companyId, 'google_places', 'ok', null, true);
  } catch (err) {
    app.integrations.setStatus(companyId, 'google_places', 'error', err instanceof Error ? err.message : String(err));
    throw err;
  }
  let newCount = 0; let snapshots = 0;
  for (const p of seen.values()) {
    const existing = app.db.select().from(competitors).where(and(eq(competitors.companyId, companyId), eq(competitors.placeId, p.placeId))).get();
    let id = existing?.id;
    if (!existing) {
      id = newId(); newCount++;
      app.db.insert(competitors).values({ id, companyId, placeId: p.placeId, name: p.name, address: p.address, website: p.website, phone: p.phone, lat: p.lat, lng: p.lng, source: 'google_places', isOwn: f.config.ownPlaceId === p.placeId, lastSeenAt: nowIso() }).run();
    } else {
      app.db.update(competitors).set({ name: p.name, address: p.address, website: p.website ?? existing.website, phone: p.phone ?? existing.phone, lastSeenAt: nowIso(), updatedAt: nowIso() }).where(eq(competitors.id, existing.id)).run();
    }
    app.db.insert(competitorSnapshots).values({ id: newId(), companyId, competitorId: id!, date: today, rating: p.rating, ratingCount: p.ratingCount, businessStatus: p.businessStatus, priceLevel: p.priceLevel }).onConflictDoUpdate({ target: [competitorSnapshots.competitorId, competitorSnapshots.date], set: { rating: p.rating, ratingCount: p.ratingCount, businessStatus: p.businessStatus, priceLevel: p.priceLevel } }).run();
    snapshots++;
  }
  return { found: seen.size, newCount, snapshots };
}

export async function runCompetitorScanAll(app: FastifyInstance): Promise<string> {
  const active = app.db.select({ id: companies.id }).from(companies).where(eq(companies.isActive, true)).all();
  let n = 0;
  for (const c of active) { try { const r = await runCompetitorScan(app, c.id); if (r.found) n++; } catch (err) { app.log.warn({ err, companyId: c.id }, 'Wettbewerber-Scan fehlgeschlagen'); } }
  return `${n} Mandant(en) gescannt`;
}

export default async function competitorRoutes(app: FastifyInstance) {
  app.get('/api/integrations/google_places', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const f = app.integrations.get<PlacesConfig>(ctx.companyId, 'google_places');
    if (!f) return { configured: false };
    const { apiKey: _k, ...rest } = f.config;
    return { configured: true, config: rest, status: f.row.status, lastError: f.row.lastError, lastSyncAt: f.row.lastSyncAt };
  });
  app.put('/api/integrations/google_places', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ apiKey: z.string().trim().optional(), queries: z.array(zTrimmed(120).min(3)).min(1).max(10), lat: z.number().nullable().optional(), lng: z.number().nullable().optional(), radiusKm: z.number().min(1).max(200).nullable().optional(), ownPlaceId: zOptionalText(200) }), req.body);
    const existing = app.integrations.get<PlacesConfig>(ctx.companyId, 'google_places');
    const apiKey = input.apiKey || existing?.config.apiKey;
    if (!apiKey || apiKey.length < 20) throw badRequest('Bitte einen gültigen Google-Places-API-Key eingeben.');
    const cfg: PlacesConfig = { apiKey, queries: input.queries, lat: input.lat ?? null, lng: input.lng ?? null, radiusKm: input.radiusKm ?? 30, ownPlaceId: input.ownPlaceId ?? null };
    app.integrations.save(ctx.companyId, 'google_places', cfg as unknown as Record<string, unknown>, { queries: cfg.queries, radiusKm: cfg.radiusKm }, 'Wettbewerber (Google Places)');
    writeAudit(app.db, ctx, { action: 'integration.places_saved', entityType: 'integration', entityId: 'google_places', after: { queries: cfg.queries } });
    return { ok: true };
  });
  app.delete('/api/integrations/google_places', { preHandler: app.requireAuth('integrations:manage') }, async (req) => { app.integrations.remove(ctxOf(req).companyId, 'google_places'); return { ok: true }; });

  app.post('/api/competitors/scan', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    try { const r = await runCompetitorScan(app, ctx.companyId); writeAudit(app.db, ctx, { action: 'competitors.scan', entityType: 'integration', after: r }); return r; }
    catch (err) { throw badRequest(`Scan fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`); }
  });

  app.get('/api/competitors', { preHandler: app.requireAuth('marketing:read') }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select().from(competitors).where(and(eq(competitors.companyId, ctx.companyId), eq(competitors.isActive, true))).orderBy(competitors.name).all();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const items = rows.map((c) => {
      const snaps = app.db.select().from(competitorSnapshots).where(eq(competitorSnapshots.competitorId, c.id)).orderBy(desc(competitorSnapshots.date)).limit(120).all();
      const latest = snaps[0] ?? null;
      const weekSnap = snaps.find((s) => s.date <= weekAgo) ?? null;
      const monthSnap = snaps.find((s) => s.date <= monthAgo) ?? null;
      return { ...c, latest, ratingChange30: latest && monthSnap && latest.rating !== null && monthSnap.rating !== null ? Math.round((latest.rating - monthSnap.rating) * 10) / 10 : null, reviewsChange30: latest && monthSnap && latest.ratingCount !== null && monthSnap.ratingCount !== null ? latest.ratingCount - monthSnap.ratingCount : null, reviewsChange7: latest && weekSnap && latest.ratingCount !== null && weekSnap.ratingCount !== null ? latest.ratingCount - weekSnap.ratingCount : null, isNew: c.firstSeenAt >= weekAgo, history: snaps.slice(0, 30).reverse().map((s) => ({ date: s.date, rating: s.rating, ratingCount: s.ratingCount })) };
    });
    const own = items.find((i) => i.isOwn) ?? null;
    const others = items.filter((i) => !i.isOwn);
    const rated = others.filter((o) => o.latest?.rating !== null && o.latest?.rating !== undefined);
    const avgRating = rated.length ? Math.round((rated.reduce((s, o) => s + (o.latest!.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
    const config = app.integrations.get<PlacesConfig>(ctx.companyId, 'google_places');
    return { items: others, own, avgRating, newThisWeek: others.filter((o) => o.isNew).length, configured: Boolean(config), lastScanAt: config?.row.lastSyncAt ?? null, lastError: config?.row.lastError ?? null, total: others.length };
  });

  app.post('/api/competitors', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ name: zTrimmed(160).min(1), address: zOptionalText(200), website: zOptionalText(200), phone: zOptionalText(60), notes: zOptionalText(2000), rating: z.number().min(0).max(5).nullable().optional(), ratingCount: z.number().int().min(0).nullable().optional() }), req.body);
    const id = newId();
    app.db.insert(competitors).values({ id, companyId: ctx.companyId, name: input.name, address: input.address, website: input.website, phone: input.phone, notes: input.notes, source: 'manual', lastSeenAt: nowIso() }).run();
    if (input.rating !== undefined || input.ratingCount !== undefined) app.db.insert(competitorSnapshots).values({ id: newId(), companyId: ctx.companyId, competitorId: id, date: new Date().toISOString().slice(0, 10), rating: input.rating ?? null, ratingCount: input.ratingCount ?? null }).run();
    return { id };
  });

  app.patch('/api/competitors/:id', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(z.object({ notes: zOptionalText(2000), isOwn: z.boolean().optional(), isActive: z.boolean().optional(), website: zOptionalText(200) }), req.body);
    const c = app.db.select().from(competitors).where(and(eq(competitors.id, id), eq(competitors.companyId, ctx.companyId))).get();
    if (!c) throw notFound('Wettbewerber');
    app.db.update(competitors).set({ ...input, updatedAt: nowIso() }).where(eq(competitors.id, id)).run();
    return { ok: true };
  });

  void sql;
}
