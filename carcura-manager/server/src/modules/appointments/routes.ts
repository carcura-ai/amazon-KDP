import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, gte, lt, ne, or, sql } from 'drizzle-orm';
import { appointments, companies, customers, vehicles, users, orders } from '../../db/schema.js';
import { parse, zOptionalText, zTrimmed } from '../../core/validation.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest, notFound } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from '../crm/activities.js';
import { confirmationMail, reminderShortText, appointmentWhen } from '../../integrations/templates.js';
import { sendReminder } from '../../jobs/reminders.js';

export const APPOINTMENT_TYPES = ['service', 'pickup', 'handover', 'consultation', 'phone', 'other'] as const;
export const APPOINTMENT_STATUS = ['planned', 'confirmed', 'done', 'cancelled', 'no_show'] as const;
const TYPE_LABEL: Record<string, string> = { service: 'Aufbereitung', pickup: 'Abholung', handover: 'Übergabe', consultation: 'Beratung', phone: 'Telefontermin', other: 'Sonstiges' };

const fields = {
  customerId: z.string().uuid().nullable(),
  vehicleId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  type: z.enum(APPOINTMENT_TYPES),
  title: zTrimmed(160).min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean(),
  status: z.enum(APPOINTMENT_STATUS),
  location: zOptionalText(200),
  notes: zOptionalText(2000),
  priceCents: z.number().int().min(0).nullable(),
};
const createSchema = z.object({ ...fields, customerId: fields.customerId.default(null), vehicleId: fields.vehicleId.default(null), orderId: fields.orderId.default(null), userId: fields.userId.default(null), type: fields.type.default('service'), allDay: fields.allDay.default(false), status: fields.status.default('planned'), priceCents: fields.priceCents.default(null), sendConfirmation: z.boolean().default(false) });
const updateSchema = z.object(fields).partial();

export default async function appointmentRoutes(app: FastifyInstance) {
  const getOne = (companyId: string, id: string) => {
    const row = app.db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.companyId, companyId))).get();
    if (!row) throw notFound('Termin');
    return row;
  };
  const validateRefs = (companyId: string, input: { customerId?: string | null; vehicleId?: string | null; userId?: string | null; orderId?: string | null }) => {
    if (input.customerId && !app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, companyId))).get()) throw notFound('Kunde');
    if (input.vehicleId) {
      const v = app.db.select({ customerId: vehicles.customerId }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.companyId, companyId))).get();
      if (!v) throw notFound('Fahrzeug');
      if (input.customerId && v.customerId !== input.customerId) throw badRequest('Das Fahrzeug gehört nicht zu diesem Kunden.');
    }
    if (input.userId && !app.db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.companyId, companyId))).get()) throw notFound('Mitarbeiter');
    if (input.orderId && !app.db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, input.orderId), eq(orders.companyId, companyId))).get()) throw notFound('Auftrag');
  };
  const conflicts = (companyId: string, userId: string | null, startsAt: string, endsAt: string, excludeId?: string) => {
    if (!userId) return [];
    return app.db
      .select({ id: appointments.id, title: appointments.title, startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(and(eq(appointments.companyId, companyId), eq(appointments.userId, userId), sql`${appointments.status} in ('planned','confirmed')`, lt(appointments.startsAt, endsAt), sql`${appointments.endsAt} > ${startsAt}`, excludeId ? ne(appointments.id, excludeId) : undefined))
      .all();
  };
  const withRefs = (rows: Array<typeof appointments.$inferSelect>) => {
    const custIds = [...new Set(rows.map((r) => r.customerId).filter(Boolean))] as string[];
    const vehIds = [...new Set(rows.map((r) => r.vehicleId).filter(Boolean))] as string[];
    const custMap = new Map(custIds.length ? app.db.select().from(customers).where(sql`${customers.id} in ${custIds}`).all().map((c) => [c.id, c]) : []);
    const vehMap = new Map(vehIds.length ? app.db.select().from(vehicles).where(sql`${vehicles.id} in ${vehIds}`).all().map((v) => [v.id, v]) : []);
    const userMap = new Map(app.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).all().map((u) => [u.id, u]));
    return rows.map((r) => {
      const c = r.customerId ? custMap.get(r.customerId) : undefined;
      const v = r.vehicleId ? vehMap.get(r.vehicleId) : undefined;
      const u = r.userId ? userMap.get(r.userId) : undefined;
      return {
        ...r,
        typeLabel: TYPE_LABEL[r.type] ?? r.type,
        customer: c ? { id: c.id, customerNumber: c.customerNumber, firstName: c.firstName, lastName: c.lastName, companyName: c.companyName, phone: c.phone, email: c.email } : null,
        vehicle: v ? { id: v.id, licensePlate: v.licensePlate, make: v.make, model: v.model } : null,
        user: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName } : null,
      };
    });
  };

  app.get('/api/appointments', { preHandler: app.requireAuth('appointments:read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), userId: z.string().uuid().optional(), customerId: z.string().uuid().optional(), status: z.enum(APPOINTMENT_STATUS).optional(), limit: z.coerce.number().int().min(1).max(1000).default(500) }), req.query);
    const conds = [eq(appointments.companyId, ctx.companyId)];
    if (q.from) conds.push(gte(appointments.endsAt, q.from));
    if (q.to) conds.push(lt(appointments.startsAt, q.to));
    if (q.userId) conds.push(eq(appointments.userId, q.userId));
    if (q.customerId) conds.push(eq(appointments.customerId, q.customerId));
    if (q.status) conds.push(eq(appointments.status, q.status));
    const rows = app.db.select().from(appointments).where(and(...conds)).orderBy(asc(appointments.startsAt)).limit(q.limit).all();
    return { items: withRefs(rows), types: TYPE_LABEL };
  });

  app.get('/api/appointments/:id', { preHandler: app.requireAuth('appointments:read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const a = withRefs([getOne(ctx.companyId, id)])[0]!;
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const customer = a.customerId ? app.db.select().from(customers).where(eq(customers.id, a.customerId)).get() : undefined;
    const raw = getOne(ctx.companyId, id);
    return {
      appointment: a,
      reminderText: customer ? reminderShortText(company, customer, raw) : null,
      whatsappUrl: customer?.phone ? `https://wa.me/${customer.phone.replace(/[^\d]/g, '').replace(/^0/, '49')}?text=${encodeURIComponent(reminderShortText(company, customer, raw))}` : null,
      mailConfigured: app.mail.isConfigured(ctx.companyId),
    };
  });

  app.post('/api/appointments', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { sendConfirmation, ...input } = parse(createSchema, req.body);
    if (new Date(input.endsAt) <= new Date(input.startsAt)) throw badRequest('Das Ende muss nach dem Beginn liegen.');
    validateRefs(ctx.companyId, input);
    const id = newId();
    app.db.insert(appointments).values({ id, companyId: ctx.companyId, ...input }).run();
    if (input.customerId) logActivity(app.db, ctx.companyId, { customerId: input.customerId, vehicleId: input.vehicleId, userId: ctx.userId, type: 'appointment', subject: `Termin angelegt: ${input.title}`, content: appointmentWhen(getOne(ctx.companyId, id)), refType: 'appointment', refId: id });
    writeAudit(app.db, ctx, { action: 'appointment.create', entityType: 'appointment', entityId: id, after: input });
    let confirmation: { ok: boolean; error?: string } | null = null;
    if (sendConfirmation && input.customerId) confirmation = await sendConfirmationMail(ctx.companyId, id, ctx.userId);
    return { appointment: withRefs([getOne(ctx.companyId, id)])[0], conflicts: conflicts(ctx.companyId, input.userId, input.startsAt, input.endsAt, id), confirmation };
  });

  app.patch('/api/appointments/:id', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const input = parse(updateSchema, req.body);
    const before = getOne(ctx.companyId, id);
    const merged = { ...before, ...input };
    if (new Date(merged.endsAt) <= new Date(merged.startsAt)) throw badRequest('Das Ende muss nach dem Beginn liegen.');
    validateRefs(ctx.companyId, input);
    const patch: Record<string, unknown> = { ...input, updatedAt: nowIso() };
    // Bei Verschiebung Erinnerung erneut ermöglichen
    if (input.startsAt && input.startsAt !== before.startsAt) { patch.reminderSentAt = null; patch.reminderError = null; }
    app.db.update(appointments).set(patch).where(eq(appointments.id, id)).run();
    const after = getOne(ctx.companyId, id);
    if (after.customerId && (input.status && input.status !== before.status || input.startsAt && input.startsAt !== before.startsAt)) {
      const label: Record<string, string> = { planned: 'geplant', confirmed: 'bestätigt', done: 'erledigt', cancelled: 'abgesagt', no_show: 'nicht erschienen' };
      logActivity(app.db, ctx.companyId, { customerId: after.customerId, vehicleId: after.vehicleId, userId: ctx.userId, type: 'appointment', subject: input.status && input.status !== before.status ? `Termin ${label[input.status] ?? input.status}: ${after.title}` : `Termin verschoben: ${after.title}`, content: appointmentWhen(after), refType: 'appointment', refId: id });
    }
    writeAudit(app.db, ctx, { action: 'appointment.update', entityType: 'appointment', entityId: id, before, after });
    return { appointment: withRefs([after])[0], conflicts: conflicts(ctx.companyId, after.userId, after.startsAt, after.endsAt, id) };
  });

  app.delete('/api/appointments/:id', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const before = getOne(ctx.companyId, id);
    app.db.delete(appointments).where(eq(appointments.id, id)).run();
    app.db.update(orders).set({ appointmentId: null }).where(and(eq(orders.appointmentId, id), eq(orders.companyId, ctx.companyId))).run();
    writeAudit(app.db, ctx, { action: 'appointment.delete', entityType: 'appointment', entityId: id, before });
    return { ok: true };
  });

  app.post('/api/appointments/:id/send-reminder', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const a = getOne(ctx.companyId, id);
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const res = await sendReminder(app.db, app.mail, company, a, ctx.userId);
    if (!res.ok) throw badRequest(res.error ?? 'Erinnerung konnte nicht gesendet werden.');
    return { ok: true };
  });

  app.post('/api/appointments/:id/send-confirmation', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    getOne(ctx.companyId, id);
    const res = await sendConfirmationMail(ctx.companyId, id, ctx.userId);
    if (!res.ok) throw badRequest(res.error ?? 'Bestätigung konnte nicht gesendet werden.');
    return { ok: true };
  });

  /** Protokolliert einen manuell gesendeten WhatsApp-/SMS-Hinweis in der Kundenakte. */
  app.post('/api/appointments/:id/log-manual-reminder', { preHandler: app.requireAuth('appointments:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { channel } = parse(z.object({ channel: z.enum(['whatsapp', 'sms', 'call']) }), req.body);
    const a = getOne(ctx.companyId, id);
    if (!a.customerId) throw badRequest('Kein Kunde zugeordnet.');
    logActivity(app.db, ctx.companyId, { customerId: a.customerId, vehicleId: a.vehicleId, userId: ctx.userId, type: channel === 'call' ? 'call' : 'whatsapp', direction: 'out', subject: `Terminerinnerung (${channel === 'call' ? 'Telefon' : channel === 'sms' ? 'SMS' : 'WhatsApp'}): ${a.title}`, refType: 'appointment', refId: id });
    app.db.update(appointments).set({ reminderSentAt: nowIso(), reminderError: null, updatedAt: nowIso() }).where(eq(appointments.id, id)).run();
    return { ok: true };
  });

  async function sendConfirmationMail(companyId: string, id: string, userId: string): Promise<{ ok: boolean; error?: string }> {
    const a = getOne(companyId, id);
    const company = app.db.select().from(companies).where(eq(companies.id, companyId)).get()!;
    const customer = a.customerId ? app.db.select().from(customers).where(eq(customers.id, a.customerId)).get() : undefined;
    if (!customer?.email) return { ok: false, error: 'Kunde hat keine E-Mail-Adresse.' };
    if (!app.mail.isConfigured(companyId)) return { ok: false, error: 'Kein E-Mail-Versand (SMTP) konfiguriert.' };
    const tpl = confirmationMail(company, customer, a);
    const res = await app.mail.send(companyId, { to: customer.email, subject: tpl.subject, text: tpl.text, refType: 'appointment', refId: id });
    if (!res.ok) return { ok: false, error: res.error };
    app.db.update(appointments).set({ confirmationSentAt: nowIso(), updatedAt: nowIso() }).where(eq(appointments.id, id)).run();
    logActivity(app.db, companyId, { customerId: customer.id, vehicleId: a.vehicleId, userId, type: 'email', direction: 'out', subject: `Terminbestätigung: ${a.title}`, content: `An ${customer.email}`, refType: 'appointment', refId: id });
    return { ok: true };
  }
}
