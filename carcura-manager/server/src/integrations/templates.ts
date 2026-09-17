import type { companies, appointments, customers } from '../db/schema.js';

type Company = typeof companies.$inferSelect;
type Appointment = typeof appointments.$inferSelect;
type Customer = typeof customers.$inferSelect;

const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

export function salutation(c: Pick<Customer, 'salutation' | 'firstName' | 'lastName' | 'companyName'>): string {
  const name = `${c.firstName} ${c.lastName}`.trim();
  if (c.salutation === 'Herr' && c.lastName) return `Sehr geehrter Herr ${c.lastName}`;
  if (c.salutation === 'Frau' && c.lastName) return `Sehr geehrte Frau ${c.lastName}`;
  if (name) return `Guten Tag ${name}`;
  return 'Guten Tag';
}

function signature(company: Company): string {
  return [`Ihr Team von ${company.name}`, company.phone ? `Telefon: ${company.phone}` : null, company.email ? `E-Mail: ${company.email}` : null, company.website ?? null, [company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null]
    .filter(Boolean)
    .join('\n');
}

export function appointmentWhen(a: Appointment): string {
  const start = new Date(a.startsAt);
  return a.allDay ? `${dateFmt.format(start)}` : `${dateFmt.format(start)} um ${timeFmt.format(start)} Uhr`;
}

export function reminderMail(company: Company, customer: Customer, a: Appointment): { subject: string; text: string } {
  const when = appointmentWhen(a);
  return {
    subject: `Terminerinnerung: ${a.title} am ${dateFmt.format(new Date(a.startsAt))}`,
    text: `${salutation(customer)},

wir erinnern Sie an Ihren Termin bei ${company.name}:

Termin: ${a.title}
Wann: ${when}${a.location ? `\nWo: ${a.location}` : ''}${a.notes ? `\nHinweis: ${a.notes}` : ''}

Sollte Ihnen der Termin nicht passen, geben Sie uns bitte kurz Bescheid, damit wir umplanen können.

${signature(company)}`,
  };
}

export function confirmationMail(company: Company, customer: Customer, a: Appointment): { subject: string; text: string } {
  return {
    subject: `Terminbestätigung: ${a.title} am ${dateFmt.format(new Date(a.startsAt))}`,
    text: `${salutation(customer)},

vielen Dank – Ihr Termin bei ${company.name} ist eingetragen:

Termin: ${a.title}
Wann: ${appointmentWhen(a)}${a.location ? `\nWo: ${a.location}` : ''}${a.notes ? `\nHinweis: ${a.notes}` : ''}

Wir freuen uns auf Sie.

${signature(company)}`,
  };
}

/** Kurztext für WhatsApp/SMS (manueller Versand über wa.me-Link). */
export function reminderShortText(company: Company, customer: Customer, a: Appointment): string {
  return `${salutation(customer)}, wir erinnern an Ihren Termin bei ${company.name}: ${a.title}, ${appointmentWhen(a)}. Passt der Termin nicht, geben Sie uns bitte kurz Bescheid. Viele Grüße, ${company.name}`;
}
