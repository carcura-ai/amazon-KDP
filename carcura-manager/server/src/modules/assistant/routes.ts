import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { assistantMessages, companies } from '../../db/schema.js';
import { parse, zTrimmed } from '../../core/validation.js';
import { badRequest } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { newId } from '../../core/ids.js';
import { ctxOf } from '../../plugins/auth.js';
import { runAssistant, type AssistantConfig, DEFAULT_MODEL } from '../../integrations/ai/assistant.js';

/** Übersetzt Fehler der Anthropic-API in verständliche Hinweise (ohne Rohdaten/Schlüssel). */
function describeAiError(err: unknown): string {
  const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : undefined;
  if (status === 401) return 'API-Key ungültig oder abgelaufen (Einstellungen → Integrationen prüfen).';
  if (status === 403) return 'Zugriff verweigert: Der API-Key hat keine Berechtigung für dieses Modell.';
  if (status === 404) return 'Modell nicht gefunden – bitte ein anderes Modell in den Einstellungen wählen.';
  if (status === 429) return 'Anfragelimit oder Guthaben der Anthropic-API erschöpft. Bitte später erneut versuchen.';
  if (status === 529 || status === 503) return 'Die KI ist derzeit überlastet. Bitte in wenigen Minuten erneut versuchen.';
  if (status && status >= 500) return `Serverfehler der Anthropic-API (${status}).`;
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(msg)) return 'Keine Verbindung zur Anthropic-API (Internet/Proxy prüfen).';
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}

export const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;

export default async function assistantRoutes(app: FastifyInstance) {
  app.get('/api/integrations/claude', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const f = app.integrations.get<AssistantConfig>(ctx.companyId, 'claude');
    return { configured: Boolean(f), model: f?.config.model ?? DEFAULT_MODEL, models: MODELS, status: f?.row.status ?? null, lastError: f?.row.lastError ?? null };
  });
  app.put('/api/integrations/claude', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    const input = parse(z.object({ apiKey: z.string().trim().optional(), model: z.enum(MODELS).default(DEFAULT_MODEL) }), req.body);
    const existing = app.integrations.get<AssistantConfig>(ctx.companyId, 'claude');
    const apiKey = input.apiKey || existing?.config.apiKey;
    if (!apiKey || apiKey.length < 20) throw badRequest('Bitte einen gültigen Anthropic-API-Key eingeben.');
    app.integrations.save(ctx.companyId, 'claude', { apiKey, model: input.model }, { model: input.model }, 'KI-Assistent (Claude)');
    writeAudit(app.db, ctx, { action: 'integration.claude_saved', entityType: 'integration', entityId: 'claude', after: { model: input.model } });
    return { ok: true };
  });
  app.delete('/api/integrations/claude', { preHandler: app.requireAuth('integrations:manage') }, async (req) => {
    const ctx = ctxOf(req);
    app.integrations.remove(ctx.companyId, 'claude');
    return { ok: true };
  });

  app.get('/api/assistant/status', { preHandler: app.requireAuth('assistant:use') }, async (req) => {
    const ctx = ctxOf(req);
    const f = app.integrations.get<AssistantConfig>(ctx.companyId, 'claude');
    return { configured: Boolean(f), model: f?.config.model ?? DEFAULT_MODEL };
  });

  app.get('/api/assistant/conversations/:id', { preHandler: app.requireAuth('assistant:use') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    return { items: app.db.select().from(assistantMessages).where(and(eq(assistantMessages.companyId, ctx.companyId), eq(assistantMessages.conversationId, id), eq(assistantMessages.userId, ctx.userId))).orderBy(asc(assistantMessages.createdAt)).all() };
  });

  app.get('/api/assistant/conversations', { preHandler: app.requireAuth('assistant:use') }, async (req) => {
    const ctx = ctxOf(req);
    const rows = app.db.select({ conversationId: assistantMessages.conversationId, first: assistantMessages.content, createdAt: assistantMessages.createdAt }).from(assistantMessages).where(and(eq(assistantMessages.companyId, ctx.companyId), eq(assistantMessages.userId, ctx.userId), eq(assistantMessages.role, 'user'))).orderBy(desc(assistantMessages.createdAt)).limit(200).all();
    const seen = new Map<string, { conversationId: string; title: string; createdAt: string }>();
    for (const r of rows) if (!seen.has(r.conversationId)) seen.set(r.conversationId, { conversationId: r.conversationId, title: r.first.slice(0, 80), createdAt: r.createdAt });
    return { items: [...seen.values()].slice(0, 30) };
  });

  app.post('/api/assistant/chat', { preHandler: app.requireAuth('assistant:use'), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const ctx = ctxOf(req);
    const { conversationId, question } = parse(z.object({ conversationId: z.string().uuid().optional(), question: zTrimmed(4000).min(2) }), req.body);
    const f = app.integrations.get<AssistantConfig>(ctx.companyId, 'claude');
    if (!f) throw badRequest('KI-Assistent nicht eingerichtet. Unter Einstellungen → Integrationen den Anthropic-API-Key hinterlegen.');
    const convId = conversationId ?? newId();
    const history = app.db.select({ role: assistantMessages.role, content: assistantMessages.content }).from(assistantMessages).where(and(eq(assistantMessages.companyId, ctx.companyId), eq(assistantMessages.conversationId, convId), eq(assistantMessages.userId, ctx.userId))).orderBy(asc(assistantMessages.createdAt)).all() as Array<{ role: 'user' | 'assistant'; content: string }>;
    const company = app.db.select({ name: companies.name }).from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    let result;
    try {
      result = await runAssistant(app, ctx.companyId, company.name, f.config, history, question, app.fetchFn);
      app.integrations.setStatus(ctx.companyId, 'claude', 'ok', null, true);
    } catch (err) {
      const message = describeAiError(err);
      app.integrations.setStatus(ctx.companyId, 'claude', 'error', message);
      throw badRequest(`KI-Anfrage fehlgeschlagen: ${message}`);
    }
    app.db.insert(assistantMessages).values({ id: newId(), companyId: ctx.companyId, userId: ctx.userId, conversationId: convId, role: 'user', content: question }).run();
    app.db.insert(assistantMessages).values({ id: newId(), companyId: ctx.companyId, userId: ctx.userId, conversationId: convId, role: 'assistant', content: result.answer, toolsUsedJson: JSON.stringify(result.toolsUsed), inputTokens: result.inputTokens, outputTokens: result.outputTokens }).run();
    return { conversationId: convId, answer: result.answer, toolsUsed: result.toolsUsed, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } };
  });
}
