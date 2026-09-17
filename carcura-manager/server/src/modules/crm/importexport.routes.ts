import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { customers, leads, vehicles, invoices, expenses, companies, activities, appointments, orders, orderItems, offers, offerItems, invoiceItems, payments, inventoryItems, inventoryMovements, services, recurringExpenses, protocols, tasks } from '../../db/schema.js';
import { parse } from '../../core/validation.js';
import { toCsv, euro, parseCsv } from '../../core/csv.js';
import { newId, nowIso } from '../../core/ids.js';
import { badRequest } from '../../core/errors.js';
import { writeAudit } from '../../core/audit.js';
import { normalizeEmail, normalizePhone, normalizePlate } from '../../core/normalize.js';
import type { SQLiteTable, AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { nextNumber } from '../../core/numbering.js';
import { ctxOf } from '../../plugins/auth.js';
import { logActivity } from './activities.js';
import { LEAD_SOURCES } from './leads.routes.js';

/** Spaltenzuordnung für den Import: deutsche und englische Überschriften werden erkannt. */
const ALIASES: Record<string, string[]> = {
  firstName: ['vorname', 'firstname', 'first_name', 'first name'],
  lastName: ['nachname', 'name', 'lastname', 'last_name', 'last name', 'familienname'],
  companyName: ['firma', 'unternehmen', 'company', 'companyname', 'company_name', 'firmenname'],
  email: ['e-mail', 'email', 'mail', 'e-mail-adresse'],
  phone: ['telefon', 'phone', 'tel', 'mobil', 'handy', 'telefonnummer', 'mobile'],
  phone2: ['telefon 2', 'phone2', 'telefon2', 'festnetz'],
  street: ['straße', 'strasse', 'street', 'adresse', 'anschrift'],
  houseNumber: ['hausnummer', 'nr', 'housenumber', 'house_number'],
  zip: ['plz', 'zip', 'postleitzahl', 'postcode'],
  city: ['ort', 'stadt', 'city'],
  notes: ['notizen', 'notiz', 'notes', 'bemerkung', 'anmerkung'],
  type: ['typ', 'type', 'kundentyp'],
  source: ['quelle', 'source', 'herkunft'],
  salutation: ['anrede', 'salutation'],
  licensePlate: ['kennzeichen', 'kfz-kennzeichen', 'plate', 'license_plate', 'nummernschild'],
  make: ['marke', 'hersteller', 'make', 'brand'],
  model: ['modell', 'model'],
  requestedService: ['leistung', 'gewünschte leistung', 'service', 'anfrage'],
  message: ['nachricht', 'message'],
};
function mapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const key = h.trim().toLowerCase();
    const found = Object.entries(ALIASES).find(([field, names]) => names.includes(key) || field.toLowerCase() === key);
    if (found && !map[found[0]]) map[found[0]] = h;
  }
  return map;
}
const SOURCE_ALIASES: Record<string, string> = { google: 'google_ads', 'google ads': 'google_ads', meta: 'meta_ads', facebook: 'meta_ads', instagram: 'meta_ads', website: 'website', web: 'website', telefon: 'phone', phone: 'phone', empfehlung: 'referral', referral: 'referral', manuell: 'manual', manual: 'manual', 'google business': 'google_business', 'google unternehmensprofil': 'google_business' };

export default async function importExportRoutes(app: FastifyInstance) {
  const send = (reply: { header: (k: string, v: string) => unknown }, name: string, csv: string) => {
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return csv;
  };

  app.get('/api/export/customers.csv', { preHandler: app.requireAuth('customers:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const rows = app.db.select().from(customers).where(eq(customers.companyId, ctx.companyId)).orderBy(asc(customers.customerNumber)).all();
    writeAudit(app.db, ctx, { action: 'customers.export_csv', entityType: 'customer', after: { count: rows.length } });
    return send(reply, 'kunden', toCsv(rows, [
      { key: 'customerNumber', label: 'Kundennummer', get: (r) => r.customerNumber }, { key: 'type', label: 'Typ', get: (r) => (r.type === 'business' ? 'Geschäftskunde' : 'Privatkunde') },
      { key: 'salutation', label: 'Anrede', get: (r) => r.salutation }, { key: 'firstName', label: 'Vorname', get: (r) => r.firstName }, { key: 'lastName', label: 'Nachname', get: (r) => r.lastName },
      { key: 'companyName', label: 'Firma', get: (r) => r.companyName }, { key: 'street', label: 'Straße', get: (r) => r.street }, { key: 'houseNumber', label: 'Hausnummer', get: (r) => r.houseNumber },
      { key: 'zip', label: 'PLZ', get: (r) => r.zip }, { key: 'city', label: 'Ort', get: (r) => r.city }, { key: 'country', label: 'Land', get: (r) => r.country },
      { key: 'email', label: 'E-Mail', get: (r) => r.email }, { key: 'phone', label: 'Telefon', get: (r) => r.phone }, { key: 'phone2', label: 'Telefon 2', get: (r) => r.phone2 },
      { key: 'source', label: 'Quelle', get: (r) => r.source }, { key: 'tags', label: 'Tags', get: (r) => JSON.parse(r.tagsJson || '[]') }, { key: 'notes', label: 'Notizen', get: (r) => r.notes },
      { key: 'isActive', label: 'Aktiv', get: (r) => r.isActive }, { key: 'createdAt', label: 'Angelegt am', get: (r) => r.createdAt.slice(0, 10) },
    ]));
  });

  app.get('/api/export/leads.csv', { preHandler: app.requireAuth('leads:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const rows = app.db.select().from(leads).where(eq(leads.companyId, ctx.companyId)).orderBy(desc(leads.createdAt)).all();
    writeAudit(app.db, ctx, { action: 'leads.export_csv', entityType: 'lead', after: { count: rows.length } });
    return send(reply, 'leads', toCsv(rows, [
      { key: 'createdAt', label: 'Eingang', get: (r) => r.createdAt.slice(0, 16).replace('T', ' ') }, { key: 'status', label: 'Status', get: (r) => r.status }, { key: 'source', label: 'Quelle', get: (r) => r.source },
      { key: 'sourceDetail', label: 'Quelle Detail', get: (r) => r.sourceDetail }, { key: 'campaign', label: 'Kampagne', get: (r) => r.campaign },
      { key: 'firstName', label: 'Vorname', get: (r) => r.firstName }, { key: 'lastName', label: 'Nachname', get: (r) => r.lastName }, { key: 'companyName', label: 'Firma', get: (r) => r.companyName },
      { key: 'email', label: 'E-Mail', get: (r) => r.email }, { key: 'phone', label: 'Telefon', get: (r) => r.phone }, { key: 'zip', label: 'PLZ', get: (r) => r.zip }, { key: 'city', label: 'Ort', get: (r) => r.city },
      { key: 'requestedService', label: 'Leistung', get: (r) => r.requestedService }, { key: 'vehicleText', label: 'Fahrzeug', get: (r) => r.vehicleText }, { key: 'message', label: 'Nachricht', get: (r) => r.message },
      { key: 'estimatedValue', label: 'Geschätzter Wert (EUR)', get: (r) => euro(r.estimatedValueCents) }, { key: 'lostReason', label: 'Verlustgrund', get: (r) => r.lostReason }, { key: 'notes', label: 'Notizen', get: (r) => r.notes },
    ]));
  });

  app.get('/api/export/vehicles.csv', { preHandler: app.requireAuth('vehicles:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const rows = app.db.select({ v: vehicles, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }).from(vehicles).leftJoin(customers, eq(customers.id, vehicles.customerId)).where(eq(vehicles.companyId, ctx.companyId)).orderBy(asc(vehicles.licensePlate)).all();
    return send(reply, 'fahrzeuge', toCsv(rows, [
      { key: 'plate', label: 'Kennzeichen', get: (r) => r.v.licensePlate }, { key: 'make', label: 'Marke', get: (r) => r.v.make }, { key: 'model', label: 'Modell', get: (r) => r.v.model }, { key: 'year', label: 'Baujahr', get: (r) => r.v.year },
      { key: 'type', label: 'Fahrzeugtyp', get: (r) => r.v.vehicleType }, { key: 'color', label: 'Farbe', get: (r) => r.v.color }, { key: 'mileage', label: 'Kilometerstand', get: (r) => r.v.mileage }, { key: 'vin', label: 'FIN', get: (r) => r.v.vin },
      { key: 'customerNumber', label: 'Kundennummer', get: (r) => r.customerNumber }, { key: 'customer', label: 'Kunde', get: (r) => r.companyName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() }, { key: 'notes', label: 'Notizen', get: (r) => r.v.notes },
    ]));
  });

  app.get('/api/export/invoices.csv', { preHandler: app.requireAuth('invoices:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ from: z.string().optional(), to: z.string().optional() }), req.query);
    const rows = app.db.select({ i: invoices, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }).from(invoices).leftJoin(customers, eq(customers.id, invoices.customerId)).where(eq(invoices.companyId, ctx.companyId)).orderBy(asc(invoices.invoiceNumber)).all()
      .filter((r) => r.i.status !== 'draft' && (!q.from || (r.i.issueDate ?? '') >= q.from) && (!q.to || (r.i.issueDate ?? '') <= q.to));
    writeAudit(app.db, ctx, { action: 'invoices.export_csv', entityType: 'invoice', after: { count: rows.length, from: q.from, to: q.to } });
    return send(reply, 'rechnungen', toCsv(rows, [
      { key: 'number', label: 'Rechnungsnummer', get: (r) => r.i.invoiceNumber }, { key: 'issueDate', label: 'Rechnungsdatum', get: (r) => r.i.issueDate }, { key: 'serviceDate', label: 'Leistungsdatum', get: (r) => r.i.serviceDate }, { key: 'dueDate', label: 'Fällig am', get: (r) => r.i.dueDate },
      { key: 'status', label: 'Status', get: (r) => r.i.status }, { key: 'customerNumber', label: 'Kundennummer', get: (r) => r.customerNumber }, { key: 'customer', label: 'Kunde', get: (r) => r.companyName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() },
      { key: 'net', label: 'Netto (EUR)', get: (r) => euro(r.i.subtotalCents) }, { key: 'vat', label: 'USt (EUR)', get: (r) => euro(r.i.vatCents) }, { key: 'gross', label: 'Brutto (EUR)', get: (r) => euro(r.i.totalCents) }, { key: 'paid', label: 'Bezahlt (EUR)', get: (r) => euro(r.i.paidCents) },
      { key: 'paidAt', label: 'Bezahlt am', get: (r) => r.i.paidAt?.slice(0, 10) }, { key: 'title', label: 'Betreff', get: (r) => r.i.title }, { key: 'cancels', label: 'Storniert Rechnung', get: (r) => r.i.cancelsInvoiceId ? 'ja' : '' },
    ]));
  });

  app.get('/api/export/expenses.csv', { preHandler: app.requireAuth('finance:read') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const q = parse(z.object({ from: z.string().optional(), to: z.string().optional() }), req.query);
    const rows = app.db.select().from(expenses).where(eq(expenses.companyId, ctx.companyId)).orderBy(asc(expenses.date)).all().filter((r) => (!q.from || r.date >= q.from) && (!q.to || r.date <= q.to));
    writeAudit(app.db, ctx, { action: 'expenses.export_csv', entityType: 'expense', after: { count: rows.length, from: q.from, to: q.to } });
    return send(reply, 'ausgaben', toCsv(rows, [
      { key: 'date', label: 'Datum', get: (r) => r.date }, { key: 'category', label: 'Kategorie', get: (r) => r.category }, { key: 'description', label: 'Beschreibung', get: (r) => r.description }, { key: 'vendor', label: 'Lieferant', get: (r) => r.vendor },
      { key: 'net', label: 'Netto (EUR)', get: (r) => euro(r.netCents) }, { key: 'vatRate', label: 'USt-Satz (%)', get: (r) => r.vatBp / 100 }, { key: 'vat', label: 'USt (EUR)', get: (r) => euro(r.vatCents) }, { key: 'gross', label: 'Brutto (EUR)', get: (r) => euro(r.grossCents) },
      { key: 'paymentMethod', label: 'Zahlungsart', get: (r) => r.paymentMethod }, { key: 'isPaid', label: 'Bezahlt', get: (r) => r.isPaid }, { key: 'paidAt', label: 'Bezahlt am', get: (r) => r.paidAt?.slice(0, 10) }, { key: 'receipt', label: 'Beleg vorhanden', get: (r) => Boolean(r.receiptFileId) }, { key: 'notes', label: 'Notizen', get: (r) => r.notes },
    ]));
  });

  /** Vollständiger Datenexport des Mandanten (JSON) – Datenportabilität, Mandantenwechsel, Archiv. */
  app.get('/api/export/company.json', { preHandler: app.requireAuth('settings:manage') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const by = (table: SQLiteTable & { companyId: AnySQLiteColumn }) => app.db.select().from(table).where(eq(table.companyId, ctx.companyId)).all();
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const { websiteLeadToken: _t, ...publicCompany } = company;
    const data = {
      exportedAt: nowIso(), version: app.appVersion, company: publicCompany,
      services: by(services), customers: by(customers), vehicles: by(vehicles), leads: by(leads), activities: by(activities), appointments: by(appointments),
      orders: by(orders), orderItems: by(orderItems), offers: by(offers), offerItems: by(offerItems), invoices: by(invoices), invoiceItems: by(invoiceItems), payments: by(payments),
      expenses: by(expenses), recurringExpenses: by(recurringExpenses), inventoryItems: by(inventoryItems), inventoryMovements: by(inventoryMovements), protocols: by(protocols), tasks: by(tasks),
    };
    writeAudit(app.db, ctx, { action: 'company.export_json', entityType: 'company', entityId: ctx.companyId });
    reply.header('Content-Disposition', `attachment; filename="export-${company.slug}-${new Date().toISOString().slice(0, 10)}.json"`);
    return data;
  });

  /** CSV-Import von Kunden oder Leads mit Duplikatprüfung (E-Mail/Telefon) – dryRun liefert nur die Vorschau. */
  app.post('/api/import/:kind', { preHandler: app.requireAuth('customers:write') }, async (req) => {
    const ctx = ctxOf(req);
    const { kind } = req.params as { kind: string };
    if (kind !== 'customers' && kind !== 'leads') throw badRequest('Import nur für customers oder leads.');
    const { csv, dryRun } = parse(z.object({ csv: z.string().min(1).max(20_000_000), dryRun: z.boolean().default(false) }), req.body);
    const { headers, rows } = parseCsv(csv);
    const map = mapHeaders(headers);
    if (!map.lastName && !map.companyName && !map.email && !map.phone) throw badRequest(`Keine bekannte Spalte gefunden. Erkannt: ${headers.join(', ') || 'keine'}. Erwartet z. B. Vorname, Nachname, Firma, E-Mail, Telefon, Straße, PLZ, Ort.`);
    const get = (r: Record<string, string>, f: string) => (map[f] ? (r[map[f]!] ?? '').trim() : '');
    const company = app.db.select().from(companies).where(eq(companies.id, ctx.companyId)).get()!;
    const existingEmails = new Set<string>(); const existingPhones = new Set<string>();
    const table = kind === 'customers' ? customers : leads;
    for (const r of app.db.select({ e: table.normalizedEmail, p: table.normalizedPhone }).from(table).where(eq(table.companyId, ctx.companyId)).all()) { if (r.e) existingEmails.add(r.e); if (r.p) existingPhones.add(r.p); }
    const result = { total: rows.length, created: 0, skipped: [] as Array<{ row: number; name: string; reason: string }>, columns: map, dryRun };
    const inserts: Array<() => void> = [];
    rows.forEach((r, i) => {
      const firstName = get(r, 'firstName'); let lastName = get(r, 'lastName'); const companyName = get(r, 'companyName');
      if (!firstName && !lastName && !companyName && map.lastName === undefined && get(r, 'email')) lastName = get(r, 'email');
      const email = get(r, 'email') || null; const phone = get(r, 'phone') || null;
      const name = companyName || `${firstName} ${lastName}`.trim() || email || phone || `Zeile ${i + 2}`;
      if (!firstName && !lastName && !companyName) { result.skipped.push({ row: i + 2, name, reason: 'Kein Name und keine Firma' }); return; }
      const ne = normalizeEmail(email); const np = normalizePhone(phone);
      if (email && ne && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { result.skipped.push({ row: i + 2, name, reason: `Ungültige E-Mail: ${email}` }); return; }
      if (ne && existingEmails.has(ne)) { result.skipped.push({ row: i + 2, name, reason: `E-Mail bereits vorhanden (${email})` }); return; }
      if (np && existingPhones.has(np)) { result.skipped.push({ row: i + 2, name, reason: `Telefon bereits vorhanden (${phone})` }); return; }
      if (ne) existingEmails.add(ne); if (np) existingPhones.add(np);
      const typeRaw = get(r, 'type').toLowerCase(); const type = companyName || /gesch|business|firma|b2b/.test(typeRaw) ? 'business' : 'private';
      const sourceRaw = get(r, 'source').toLowerCase(); const source = SOURCE_ALIASES[sourceRaw] ?? ((LEAD_SOURCES as readonly string[]).includes(sourceRaw) ? sourceRaw : null);
      const base = { firstName, lastName, companyName: companyName || null, email: email ? email.toLowerCase() : null, phone, street: get(r, 'street') || null, zip: get(r, 'zip') || null, city: get(r, 'city') || null, notes: get(r, 'notes') || null, normalizedEmail: ne, normalizedPhone: np };
      result.created++;
      inserts.push(() => {
        const id = newId();
        if (kind === 'customers') {
          app.db.insert(customers).values({ id, companyId: ctx.companyId, customerNumber: nextNumber(app.db, ctx.companyId, 'customer', company.customerPrefix, false), type, salutation: get(r, 'salutation') || null, houseNumber: get(r, 'houseNumber') || null, phone2: get(r, 'phone2') || null, country: 'DE', source: source ?? 'import', tagsJson: JSON.stringify(['Import']), ...base }).run();
          const plate = get(r, 'licensePlate');
          if (plate) app.db.insert(vehicles).values({ id: newId(), companyId: ctx.companyId, customerId: id, licensePlate: plate, normalizedPlate: normalizePlate(plate), make: get(r, 'make') || null, model: get(r, 'model') || null }).run();
          logActivity(app.db, ctx.companyId, { customerId: id, userId: ctx.userId, type: 'system', subject: 'Kunde per CSV-Import angelegt' });
        } else {
          app.db.insert(leads).values({ id, companyId: ctx.companyId, customerType: type, source: (source ?? 'other') as typeof LEAD_SOURCES[number], sourceDetail: 'CSV-Import', status: 'new', requestedService: get(r, 'requestedService') || null, message: get(r, 'message') || null, vehicleText: [get(r, 'make'), get(r, 'model'), get(r, 'licensePlate')].filter(Boolean).join(' ') || null, ...base }).run();
        }
      });
    });
    if (!dryRun) {
      app.db.transaction(() => { for (const fn of inserts) fn(); });
      writeAudit(app.db, ctx, { action: `${kind}.import_csv`, entityType: kind === 'customers' ? 'customer' : 'lead', after: { created: result.created, skipped: result.skipped.length } });
    }
    return result;
  });
}
