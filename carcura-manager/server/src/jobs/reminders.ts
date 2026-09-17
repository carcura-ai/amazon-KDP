import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { appointments, companies, customers } from '../db/schema.js';
import { nowIso } from '../core/ids.js';
import type { MailService } from '../integrations/mail.js';
import { reminderMail } from '../integrations/templates.js';
import { logActivity } from '../modules/crm/activities.js';

/**
 * Terminerinnerungen: für jeden aktiven Mandanten alle Termine im Erinnerungsfenster
 * (jetzt … jetzt + reminderDaysBefore Tage) ohne gesendete Erinnerung per E-Mail benachrichtigen.
 */
export async function runReminders(db: Db, mail: MailService): Promise<string> {
  const now = new Date();
  let sent = 0;
  let failed = 0;
  const activeCompanies = db.select().from(companies).where(eq(companies.isActive, true)).all();
  for (const company of activeCompanies) {
    if (company.reminderDaysBefore <= 0) continue;
    const windowEnd = new Date(now.getTime() + company.reminderDaysBefore * 86_400_000);
    windowEnd.setHours(23, 59, 59, 999);
    const due = db
      .select()
      .from(appointments)
      .where(and(eq(appointments.companyId, company.id), isNull(appointments.reminderSentAt), sql`${appointments.status} in ('planned','confirmed')`, gt(appointments.startsAt, now.toISOString()), lt(appointments.startsAt, windowEnd.toISOString()), sql`${appointments.customerId} is not null`))
      .all();
    for (const a of due) {
      const result = await sendReminder(db, mail, company, a);
      if (result.ok) sent++;
      else failed++;
    }
  }
  return `${sent} gesendet, ${failed} nicht möglich`;
}

export async function sendReminder(db: Db, mail: MailService, company: typeof companies.$inferSelect, a: typeof appointments.$inferSelect, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const customer = a.customerId ? db.select().from(customers).where(eq(customers.id, a.customerId)).get() : undefined;
  const fail = (error: string) => {
    db.update(appointments).set({ reminderError: error, updatedAt: nowIso() }).where(eq(appointments.id, a.id)).run();
    return { ok: false, error };
  };
  if (!customer) return fail('Kein Kunde zugeordnet.');
  if (!customer.email) return fail('Kunde hat keine E-Mail-Adresse.');
  if (!mail.isConfigured(company.id)) return fail('Kein E-Mail-Versand (SMTP) konfiguriert.');
  const tpl = reminderMail(company, customer, a);
  const res = await mail.send(company.id, { to: customer.email, subject: tpl.subject, text: tpl.text, refType: 'appointment', refId: a.id });
  if (!res.ok) return fail(res.error);
  db.update(appointments).set({ reminderSentAt: nowIso(), reminderError: null, updatedAt: nowIso() }).where(eq(appointments.id, a.id)).run();
  logActivity(db, company.id, { customerId: customer.id, vehicleId: a.vehicleId, userId: userId ?? null, type: 'reminder', direction: 'out', subject: `Terminerinnerung per E-Mail: ${a.title}`, content: `An ${customer.email}`, refType: 'appointment', refId: a.id });
  return { ok: true };
}
