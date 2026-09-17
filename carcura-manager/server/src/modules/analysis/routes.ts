import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../core/validation.js';
import { ctxOf } from '../../plugins/auth.js';
import { pricingAnalysis } from './pricing.js';

export default async function analysisRoutes(app: FastifyInstance) {
  app.get('/api/analysis/pricing', { preHandler: app.requireAuth('finance:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { days } = parse(z.object({ days: z.coerce.number().int().min(30).max(365).default(90) }), req.query);
    return pricingAnalysis(app.db, ctx.companyId, days);
  });
}
