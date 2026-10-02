import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { companies, customers, documentImports, expenses, invoiceItems, invoices, payments, files, aiUsageLog } from '../../db/schema.js';
import { newId, nowIso } from '../../core/ids.js';
import { nextNumber } from '../../core/numbering.js';
import { normalizeEmail, normalizeName, normalizePhone } from '../../core/normalize.js';
import { writeAudit } from '../../core/audit.js';
import { logActivity } from '../crm/activities.js';
import { privacySettings } from '../privacy/settings.js';
import { EXPENSE_CATEGORIES } from '../finance/routes.js';
import { parseEInvoice } from '../../integrations/einvoice/parse.js';
import { embeddedInvoiceXml } from '../../integrations/einvoice/pdf.js';
import { emptyParty, type InvoiceParty, type NormalizedInvoice } from '../../integrations/einvoice/model.js';
import { recognizeDocument, normalizeExtraction, DocumentRecognitionError, type Extraction } from '../../integrations/ai/documents.js';
import type { AssistantConfig } from '../../integrations/ai/assistant.js';

export type ImportDirection = 'outgoing' | 'incoming';
export type ImportStatus = 'queued' | 'processing' | 'needs_review' | 'completed' | 'failed' | 'duplicate' | 'discarded' | 'undone';
export interface ImportOptions { markPaid?: boolean }
type ImportRow = typeof documentImports.$inferSelect;
type Company = typeof companies.$inferSelect;

/* ------------------------------------------------------------------ Validierung des Datenmodells (für manuelle Korrektur) */
const zParty = z.object({
  name: z.string().trim().max(200).nullable(), companyName: z.string().trim().max(200).nullable(), personName: z.string().trim().max(200).nullable(),
  street: z.string().trim().max(200).nullable(), zip: z.string().trim().max(20).nullable(), city: z.string().trim().max(120).nullable(), country: z.string().trim().max(60).nullable(),
  email: z.string().trim().max(200).nullable(), phone: z.string().trim().max(60).nullable(), vatId: z.string().trim().max(40).nullable(), taxNumber: z.string().trim().max(40).nullable(), partyNumber: z.string().trim().max(60).nullable(),
});
const cents = z.number().int().min(-1_000_000_000).max(1_000_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
export const normalizedInvoiceSchema = z.object({
  kind: z.enum(['invoice', 'credit_note', 'correction', 'receipt']),
  number: z.string().trim().max(80).nullable(),
  issueDate: isoDate, dueDate: isoDate, serviceDate: isoDate,
  currency: z.string().trim().length(3),
  seller: zParty, buyer: zParty,
  lines: z.array(z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(1000).nullable(), quantity: z.number().min(-100000).max(100000), unit: z.string().trim().max(20).nullable(), unitNetCents: cents.nullable(), netCents: cents, vatBp: z.number().int().min(0).max(10000).nullable() })).max(300),
  vat: z.array(z.object({ vatBp: z.number().int().min(0).max(10000), netCents: cents, vatCents: cents })).max(20),
  netCents: cents.nullable(), vatCents: cents.nullable(), grossCents: cents.nullable(), prepaidCents: cents.nullable(), dueCents: cents.nullable(),
  paymentTerms: z.string().trim().max(1000).nullable(), paid: z.boolean().nullable(), notes: z.string().trim().max(5000).nullable(), suggestedCategory: z.string().trim().max(80).nullable(),
  referencedNumber: z.string().trim().max(80).nullable().optional(),
});

/* ------------------------------------------------------------------ Hilfen: Namen, Anschrift, eigene Firma */
/** Rechtsformen – werden für den Firmenvergleich entfernt (alle Vorkommen). */
const LEGAL_FORMS = /(^|\s)(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|ug(\s*\(haftungsbeschränkt\))?|ag|kg|ohg|gbr|e\.\s?k\.?|e\.\s?v\.?|ltd\.?|inc\.?|se|kgaa|partg)(?=\s|$|[.,])/gi;
/** Hinweise auf ein Unternehmen (nur zur Erkennung, nicht zum Entfernen). */
const COMPANY_HINT = /\b(gmbh|mbh|ug|ag|kg|ohg|gbr|e\.\s?k|e\.\s?v|ltd|inc|kgaa|partg|autohaus|autohandel|werkstatt|kfz|service|handel|logistik|holding|gruppe|stiftung|verein|stadt|gemeinde|versicherung|leasing)\b/i;
const companyKey = (name: string | null | undefined) => normalizeName((name ?? '').replace(LEGAL_FORMS, ' '));

export function isCompanyParty(p: InvoiceParty): boolean {
  if (p.companyName) return true;
  if (!p.name) return false;
  if (COMPANY_HINT.test(p.name)) return true;
  // Firma mit zusätzlichem Ansprechpartner
  return Boolean(p.personName && normalizeName(p.personName) !== normalizeName(p.name));
}

export function splitPersonName(full: string | null): { salutation: string | null; firstName: string; lastName: string } {
  let v = (full ?? '').replace(/\s+/g, ' ').trim();
  let salutation: string | null = null;
  const m = /^(Herrn?|Frau|Familie|Fam\.)\s+/i.exec(v);
  if (m) { salutation = /^frau/i.test(m[1]!) ? 'Frau' : /^fam/i.test(m[1]!) ? 'Familie' : 'Herr'; v = v.slice(m[0].length); }
  v = v.replace(/^(Dr\.|Prof\.)\s+/i, '');
  if (v.includes(',')) { const [last, first] = v.split(',', 2).map((x) => x.trim()); return { salutation, firstName: first ?? '', lastName: last ?? '' }; }
  const parts = v.split(' ').filter(Boolean);
  if (parts.length <= 1) return { salutation, firstName: '', lastName: parts[0] ?? '' };
  return { salutation, firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

export function splitStreet(line: string | null): { street: string | null; houseNumber: string | null } {
  if (!line) return { street: null, houseNumber: null };
  const first = line.split(',')[0]!.trim();
  const m = /^(.*?\D)\s*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/.exec(first);
  return m ? { street: m[1]!.trim().replace(/,$/, ''), houseNumber: m[2]!.replace(/\s+/g, '') } : { street: first, houseNumber: null };
}

function isOwnCompany(p: InvoiceParty, company: Company): boolean {
  if (p.vatId && company.vatId && p.vatId.replace(/\s/g, '').toUpperCase() === company.vatId.replace(/\s/g, '').toUpperCase()) return true;
  const n = normalizeName(p.name);
  const own = normalizeName(company.legalName ?? company.name);
  const short = normalizeName(company.name);
  return Boolean(n && ((own.length >= 4 && n.includes(own)) || (short.length >= 4 && n.includes(short))));
}

/* ------------------------------------------------------------------ Steueraufteilung */
/** Deutsche Sätze inkl. der befristeten Sätze 16 %/5 % (Juli–Dezember 2020) für ältere Belege */
const STANDARD_RATES = [1900, 700, 0, 1600, 500];
/** Steuersatz aus Netto/MwSt. – nur wenn er einem üblichen deutschen Satz entspricht (sonst null). */
export function standardRate(net: number | null, vat: number | null): number | null {
  if (net === null || vat === null) return null;
  if (net === 0) return vat === 0 ? 0 : null;
  for (const bp of STANDARD_RATES) if (Math.abs(Math.round((Math.abs(net) * bp) / 10000) - Math.abs(vat)) <= 2) return bp;
  return null;
}
export interface VatGroup { vatBp: number; net: number; vat: number }
/** Aufteilung je Steuersatz, abgeglichen mit den Gesamtbeträgen. problem ≠ null → nicht automatisch buchen. */
export function vatGroups(inv: NormalizedInvoice): { groups: VatGroup[]; problem: string | null } {
  const net = inv.netCents ?? (inv.grossCents !== null ? inv.grossCents - (inv.vatCents ?? 0) : null);
  const vat = inv.vatCents ?? (inv.vat.length ? inv.vat.reduce((s, v) => s + v.vatCents, 0) : net !== null && inv.grossCents !== null ? inv.grossCents - net : 0);
  if (inv.vat.length) {
    const tol = 2 * inv.vat.length;
    const sNet = inv.vat.reduce((s, v) => s + v.netCents, 0);
    const sVat = inv.vat.reduce((s, v) => s + v.vatCents, 0);
    if ((net === null || Math.abs(sNet - net) <= tol) && Math.abs(sVat - vat) <= tol) return { groups: inv.vat.filter((v) => v.netCents !== 0 || v.vatCents !== 0).map((v) => ({ vatBp: v.vatBp, net: v.netCents, vat: v.vatCents })), problem: null };
    if (inv.vat.length > 1) return { groups: [], problem: 'Die Aufteilung nach Steuersätzen passt nicht zu den Gesamtbeträgen – bitte prüfen.' };
  }
  const bp = standardRate(net, vat);
  if (net === null || bp === null) return { groups: [], problem: 'Steuersatz nicht eindeutig (kein deutscher Satz von 19 %, 7 % oder 0 %) – bitte Steuersatz wählen bzw. bei mehreren Sätzen die Aufteilung erfassen.' };
  return { groups: [{ vatBp: bp, net, vat }], problem: null };
}

/* ------------------------------------------------------------------ Plausibilitätsprüfung */
export interface Check { blocking: string[]; warnings: string[] }

export function checkInvoice(inv: NormalizedInvoice, direction: ImportDirection, company: Company): Check {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const counterparty = direction === 'outgoing' ? inv.buyer : inv.seller;
  if (!inv.issueDate) blocking.push('Rechnungsdatum fehlt.');
  if (inv.grossCents === null) blocking.push('Rechnungsbetrag (brutto) fehlt.');
  if (direction === 'outgoing' && !inv.number) blocking.push('Rechnungsnummer fehlt.');
  if (direction === 'incoming' && !inv.number) warnings.push('Keine Rechnungs-/Belegnummer erkannt (Dublettenprüfung nur über Betrag und Datum).');
  if (!counterparty.name) blocking.push(direction === 'outgoing' ? 'Kunde (Rechnungsempfänger) nicht erkannt.' : 'Lieferant (Rechnungssteller) nicht erkannt.');
  if (inv.currency !== 'EUR') blocking.push(`Währung ${inv.currency} wird nicht automatisch übernommen (nur EUR).`);
  if (direction === 'outgoing' && isOwnCompany(inv.buyer, company) && !isOwnCompany(inv.seller, company)) blocking.push('Diese Rechnung ist an Ihr Unternehmen gerichtet – vermutlich eine Eingangsrechnung. Bitte im Bereich „Eingangsrechnungen“ hochladen.');
  if (direction === 'incoming' && isOwnCompany(inv.seller, company)) blocking.push('Diese Rechnung wurde von Ihrem Unternehmen ausgestellt – vermutlich eine Ausgangsrechnung. Bitte im Bereich „Ausgangsrechnungen“ hochladen.');
  if (direction === 'outgoing' && inv.seller.name && !isOwnCompany(inv.seller, company) && !isOwnCompany(inv.buyer, company)) warnings.push(`Rechnungssteller „${inv.seller.name}“ entspricht nicht Ihren Firmendaten – bitte prüfen, ob es Ihre Rechnung ist.`);
  // Rechnerische Prüfung: Netto + MwSt. = Brutto, Summe der Positionen = Netto
  if (inv.netCents !== null && inv.vatCents !== null && inv.grossCents !== null && Math.abs(inv.netCents + inv.vatCents - inv.grossCents) > 2) blocking.push(`Summen passen nicht zusammen: netto ${eur(inv.netCents)} + MwSt. ${eur(inv.vatCents)} ≠ brutto ${eur(inv.grossCents)}.`);
  if (inv.lines.length) {
    const sumLines = inv.lines.reduce((s, l) => s + l.netCents, 0);
    const tolerance = Math.max(2, inv.lines.length);
    // Rabatte/Zuschläge auf Belegebene können die Positionssumme vom Netto abweichen lassen
    if (inv.netCents !== null && Math.abs(sumLines - inv.netCents) > tolerance) warnings.push(`Summe der Positionen (${eur(sumLines)}) weicht vom Nettobetrag (${eur(inv.netCents)}) ab – Rabatte/Zuschläge? Übernommen wird der Rechnungsbetrag.`);
  } else warnings.push('Keine Einzelpositionen erkannt – es wird eine Sammelposition angelegt.');
  const vg = vatGroups(inv);
  if (vg.problem && inv.grossCents !== null) blocking.push(vg.problem);
  if (vg.groups.length > 1 && direction === 'incoming') warnings.push('Mehrere Steuersätze – die Ausgabe wird je Steuersatz aufgeteilt.');
  if (inv.kind === 'credit_note') warnings.push('Gutschrift erkannt – Beträge werden negativ gebucht.');
  if (inv.kind === 'correction') blocking.push('Rechnungskorrektur erkannt – ersetzt sie eine frühere Rechnung, diese bitte zuerst stornieren bzw. als storniert kennzeichnen. Danach übernehmen.');
  if (inv.issueDate && inv.issueDate > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) blocking.push('Rechnungsdatum liegt in der Zukunft – bitte prüfen.');
  return { blocking, warnings };
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`;

/* ------------------------------------------------------------------ Kundenabgleich */
export interface CustomerCandidate { id: string; customerNumber: string; label: string; score: number; reasons: string[] }
/**
 * matched = eindeutig und durch ein starkes Merkmal gestützt (E-Mail, Telefon oder Name/Firma plus Anschrift);
 * uncertain = wahrscheinlich, aber nur über den Namen → Vorschlag, Prüfung durch den Nutzer;
 * ambiguous = mehrere gleich gute Treffer; new = kein passender Kunde.
 */
export interface CustomerMatch { decision: 'matched' | 'uncertain' | 'ambiguous' | 'new'; customerId: string | null; suggestedId: string | null; candidates: CustomerCandidate[] }

export function matchCustomer(app: FastifyInstance, companyId: string, buyer: InvoiceParty): CustomerMatch {
  const email = normalizeEmail(buyer.email);
  const phone = normalizePhone(buyer.phone);
  const business = isCompanyParty(buyer);
  // Bei Firmen zählt die Firma – der Ansprechpartner allein ordnet nie einem (Privat-)Kunden zu
  const person = splitPersonName(business ? null : buyer.personName ?? buyer.name);
  const cKey = business ? companyKey(buyer.companyName ?? buyer.name) : '';
  const first = normalizeName(person.firstName);
  const last = normalizeName(person.lastName);
  const zip = buyer.zip?.trim() || null;
  const street = normalizeName(splitStreet(buyer.street).street);
  const conds = [];
  if (email) conds.push(eq(customers.normalizedEmail, email));
  if (phone) conds.push(eq(customers.normalizedPhone, phone));
  if (last.length >= 2) conds.push(sql`lower(${customers.lastName}) = ${person.lastName.toLowerCase()}`);
  if (cKey.length >= 3) conds.push(sql`${customers.companyName} is not null`);
  const none: CustomerMatch = { decision: 'new', customerId: null, suggestedId: null, candidates: [] };
  if (conds.length === 0) return none;
  const rows = app.db.select().from(customers).where(and(eq(customers.companyId, companyId), sql`${customers.anonymizedAt} is null`, sql`(${sql.join(conds, sql` or `)})`)).limit(500).all();
  const scored: Array<CustomerCandidate & { strong: boolean }> = [];
  for (const c of rows) {
    let score = 0;
    const reasons: string[] = [];
    let strong = false;
    if (email && c.normalizedEmail === email) { score += 100; reasons.push('E-Mail'); strong = true; }
    if (phone && c.normalizedPhone === phone) { score += 60; reasons.push('Telefon'); strong = true; }
    const nameHit = business
      ? Boolean(cKey.length >= 3 && c.companyName && companyKey(c.companyName) === cKey)
      : Boolean(last && first && normalizeName(c.lastName) === last && normalizeName(c.firstName) === first && !c.companyName);
    if (nameHit) { score += business ? 50 : 40; reasons.push(business ? 'Firmenname' : 'Name'); }
    if (score === 0) continue;
    if (zip && c.zip) { if (c.zip.trim() === zip) { score += 20; reasons.push('PLZ'); if (nameHit) strong = true; } else score -= 45; }
    if (street && c.street && normalizeName(c.street) === street) { score += 15; reasons.push('Straße'); if (nameHit) strong = true; }
    scored.push({ id: c.id, customerNumber: c.customerNumber, label: `${c.customerNumber} · ${c.companyName ? `${c.companyName} · ` : ''}${`${c.firstName} ${c.lastName}`.trim()}${c.city ? ` · ${c.zip ?? ''} ${c.city}` : ''}`.trim(), score, reasons, strong });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((c) => c.score >= 25).slice(0, 5);
  const candidates = top.map(({ strong: _s, ...c }) => c);
  const best = top[0];
  if (!best || best.score < 40) return { ...none, candidates };
  const second = top[1];
  if (second && second.score >= best.score - 20) return { decision: 'ambiguous', customerId: null, suggestedId: null, candidates };
  if (!best.strong) return { decision: 'uncertain', customerId: null, suggestedId: best.id, candidates };
  return { decision: 'matched', customerId: best.id, suggestedId: best.id, candidates };
}

/* ------------------------------------------------------------------ Anwenden: Ausgangsrechnung → Kunde + Rechnung */
export interface ApplyChoice { customerId?: string | null; createCustomer?: boolean; category?: string | null; markPaid?: boolean; allowDuplicate?: boolean }
export interface ApplyResult { status: 'completed' | 'duplicate' | 'needs_review'; message?: string; invoiceId?: string; customerId?: string; customerCreated?: boolean; expenseIds?: string[]; warnings?: string[] }

const sign = (inv: NormalizedInvoice) => (inv.kind === 'credit_note' ? -1 : 1);
/** Gutschriften werden negativ gebucht; Belege, die ihre Beträge bereits negativ ausweisen, bleiben negativ. */
const signed = (inv: NormalizedInvoice, v: number) => (sign(inv) < 0 && v > 0 ? -v : v);

function itemRowsFrom(inv: NormalizedInvoice, companyId: string, invoiceId: string) {
  const fallbackBp = vatGroups(inv).groups[0]?.vatBp ?? null;
  const lines = inv.lines.length ? inv.lines : [{ name: inv.kind === 'credit_note' ? 'Gutschrift' : 'Rechnungsbetrag', description: null, quantity: 1, unit: null, unitNetCents: inv.netCents, netCents: inv.netCents ?? (inv.grossCents ?? 0) - (inv.vatCents ?? 0), vatBp: fallbackBp }];
  return lines.map((l, i) => {
    const net = signed(inv, l.netCents);
    // Mengen sind in der Software ganzzahlig; Bruchmengen (z. B. 1,5 Std.) werden als 1 × Zeilensumme mit Angabe übernommen
    const intQty = Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 1000 && l.unitNetCents !== null && Math.abs(l.quantity * l.unitNetCents - Math.abs(l.netCents)) <= 1;
    const qtyNote = !intQty && l.quantity !== 1 ? `${String(l.quantity).replace('.', ',')}${l.unit ? ` ${unitLabel(l.unit)}` : ''} × ${l.unitNetCents !== null ? eur(l.unitNetCents) : '–'}` : null;
    return {
      id: newId(), companyId, invoiceId, serviceId: null, name: l.name.slice(0, 200),
      description: [l.description, qtyNote].filter(Boolean).join('\n').slice(0, 1000) || null,
      quantity: intQty ? l.quantity : 1, unitPriceCents: intQty ? signed(inv, l.unitNetCents!) : net, vatBp: l.vatBp ?? fallbackBp ?? 0, totalCents: net, sortOrder: i,
    };
  });
}

const UNITS: Record<string, string> = { HUR: 'Std.', H87: 'Stk.', C62: 'Stk.', XPP: 'Stk.', MTR: 'm', MTK: 'm²', LTR: 'l', KGM: 'kg', DAY: 'Tage', MIN: 'Min.', LS: 'pauschal' };
const unitLabel = (u: string) => UNITS[u] ?? u;

function fillCustomerGaps(app: FastifyInstance, companyId: string, customerId: string, buyer: InvoiceParty): string[] {
  const c = app.db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get()!;
  const patch: Partial<typeof customers.$inferInsert> = {};
  const filled: string[] = [];
  if (!c.email && buyer.email && /.+@.+\..+/.test(buyer.email)) { patch.email = buyer.email.trim(); patch.normalizedEmail = normalizeEmail(buyer.email); filled.push('E-Mail'); }
  if (!c.phone && buyer.phone) { patch.phone = buyer.phone.trim(); patch.normalizedPhone = normalizePhone(buyer.phone); filled.push('Telefon'); }
  if (!c.street && !c.zip && !c.city && (buyer.street || buyer.zip || buyer.city)) {
    const s = splitStreet(buyer.street);
    Object.assign(patch, { street: s.street, houseNumber: s.houseNumber, zip: buyer.zip, city: buyer.city });
    filled.push('Anschrift');
  }
  if (filled.length) app.db.update(customers).set({ ...patch, updatedAt: nowIso() }).where(eq(customers.id, customerId)).run();
  return filled;
}

function createCustomerFrom(app: FastifyInstance, company: Company, buyer: InvoiceParty, userId: string): string {
  const business = isCompanyParty(buyer);
  const person = splitPersonName(business ? buyer.personName : buyer.personName ?? buyer.name);
  const s = splitStreet(buyer.street);
  const id = newId();
  const country = buyer.country && /^[A-Z]{2}$/i.test(buyer.country) ? buyer.country.toUpperCase() : 'DE';
  app.db.insert(customers).values({
    id, companyId: company.id, customerNumber: nextNumber(app.db, company.id, 'customer', company.customerPrefix, false),
    type: business ? 'business' : 'private', salutation: person.salutation,
    firstName: person.firstName.slice(0, 80), lastName: (person.lastName || (business ? '' : buyer.name ?? '')).slice(0, 80),
    companyName: business ? (buyer.companyName ?? buyer.name)!.slice(0, 160) : null,
    street: s.street, houseNumber: s.houseNumber, zip: buyer.zip, city: buyer.city, country,
    email: buyer.email && /.+@.+\..+/.test(buyer.email) ? buyer.email.trim() : null, phone: buyer.phone?.trim() || null,
    normalizedEmail: normalizeEmail(buyer.email), normalizedPhone: normalizePhone(buyer.phone),
    source: 'import', isActive: true, tagsJson: '[]',
  }).run();
  logActivity(app.db, company.id, { customerId: id, userId, type: 'system', subject: 'Kunde aus importierter Rechnung angelegt' });
  return id;
}

/**
 * Zu welcher Rechnung gehört eine importierte Gutschrift/Stornorechnung?
 * - Mit Bezugsnummer: diese Rechnung, wenn Kunde und voller Betrag übereinstimmen (sonst Hinweis, z. B. Teilgutschrift).
 * - Ohne Bezugsnummer: nur die eine bereits als storniert gekennzeichnete, noch nicht verknüpfte Rechnung desselben
 *   Kunden über denselben Betrag (verhindert, dass der Umsatz doppelt gemindert wird). Sonst keine Verknüpfung.
 */
function creditNoteTarget(app: FastifyInstance, companyId: string, customerId: string, referencedNumber: string | null, gross: number, issueDate: string): { original: typeof invoices.$inferSelect | undefined; warning: string | null } {
  const unlinked = [eq(invoices.companyId, companyId), sql`${invoices.cancelledByInvoiceId} is null`, sql`${invoices.cancelsInvoiceId} is null`, sql`${invoices.status} != 'draft'`];
  if (referencedNumber) {
    const ref = app.db.select().from(invoices).where(and(...unlinked, eq(invoices.invoiceNumber, referencedNumber))).get();
    if (ref && ref.customerId === customerId && ref.totalCents > 0 && ref.totalCents === Math.abs(gross)) return { original: ref, warning: null };
    if (ref) return { original: undefined, warning: `Bezieht sich auf Rechnung ${referencedNumber}, wurde aber nicht als Storno verknüpft (${ref.customerId !== customerId ? 'anderer Kunde' : 'Betrag weicht ab, z. B. Teilgutschrift'}). Offenen Betrag der Rechnung bei Bedarf anpassen.` };
    return { original: undefined, warning: `Bezieht sich auf Rechnung ${referencedNumber}, die hier nicht vorhanden ist (oder bereits verknüpft) – nicht verknüpft.` };
  }
  const cancelled = app.db.select().from(invoices).where(and(...unlinked, eq(invoices.customerId, customerId), eq(invoices.status, 'cancelled'), eq(invoices.totalCents, Math.abs(gross)), sql`${invoices.issueDate} <= ${issueDate}`)).all();
  if (cancelled.length === 1) return { original: cancelled[0], warning: null };
  return { original: undefined, warning: 'Gutschrift ohne Bezug auf eine Rechnungsnummer – nicht mit einer Rechnung verknüpft. Storniert sie eine Rechnung vollständig, die Rechnung unter „Rechnungen“ als storniert kennzeichnen (wird dann automatisch verknüpft).' };
}

function applyOutgoing(app: FastifyInstance, row: ImportRow, inv: NormalizedInvoice, choice: ApplyChoice, company: Company): ApplyResult {
  const companyId = row.companyId;
  // Dublette: gleiche Rechnungsnummer bereits vorhanden
  const existing = app.db.select({ id: invoices.id, source: invoices.source }).from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.invoiceNumber, inv.number!))).get();
  if (existing?.source === 'import') return { status: 'duplicate', message: `Rechnung ${inv.number} wurde bereits importiert.`, invoiceId: existing.id };
  if (existing) return { status: 'needs_review', message: `Die Rechnungsnummer ${inv.number} ist bereits für eine in dieser Software erstellte Rechnung vergeben. Bitte prüfen.` };

  let customerId = choice.customerId ?? null;
  let customerCreated = false;
  const warnings: string[] = [];
  if (customerId) {
    const ok = app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId))).get();
    if (!ok) return { status: 'needs_review', message: 'Der gewählte Kunde existiert nicht.' };
  } else if (!choice.createCustomer) {
    const match = matchCustomer(app, companyId, inv.buyer);
    if (match.decision === 'ambiguous') return { status: 'needs_review', message: 'Mehrere passende Kunden gefunden – bitte den richtigen Kunden auswählen.' };
    if (match.decision === 'uncertain') return { status: 'needs_review', message: `Wahrscheinlich bestehender Kunde (${match.candidates[0]?.label ?? ''}), aber nur über den Namen erkannt – bitte bestätigen oder neuen Kunden anlegen.` };
    customerId = match.customerId;
  }
  const result = app.db.transaction(() => {
    if (!customerId) { customerId = createCustomerFrom(app, company, inv.buyer, row.createdByUserId); customerCreated = true; }
    const filled = customerCreated ? [] : fillCustomerGaps(app, companyId, customerId, inv.buyer);
    const invoiceId = newId();
    const gross = signed(inv, inv.grossCents!);
    const vat = signed(inv, inv.vatCents ?? inv.vat.reduce((s, v) => s + v.vatCents, 0));
    const net = signed(inv, inv.netCents ?? (inv.grossCents! - (inv.vatCents ?? 0)));
    const prepaid = inv.prepaidCents ? signed(inv, inv.prepaidCents) : 0;
    const markPaid = choice.markPaid === true || inv.paid === true || (inv.dueCents !== null && inv.dueCents === 0 && gross !== 0);
    const paidCents = markPaid ? gross : prepaid;
    const status = markPaid || gross <= 0 ? 'paid' : inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : 'open';
    // Vollständige Stornorechnung/Gutschrift zu einer vorhandenen Rechnung: verknüpfen (beide zählen dann nicht zum Umsatz)
    const link = inv.kind === 'credit_note' ? creditNoteTarget(app, companyId, customerId!, inv.referencedNumber ?? null, gross, inv.issueDate!) : { original: undefined, warning: null };
    const original = link.original;
    const linksOriginal = Boolean(original);
    app.db.insert(invoices).values({
      id: invoiceId, companyId, invoiceNumber: inv.number, customerId, status,
      title: `${inv.kind === 'credit_note' ? 'Gutschrift' : inv.kind === 'correction' ? 'Rechnungskorrektur' : 'Rechnung'} ${inv.number} (importiert)`,
      notes: [inv.paymentTerms, inv.notes].filter(Boolean).join('\n').slice(0, 3000) || null,
      issueDate: inv.issueDate, serviceDate: inv.serviceDate ?? inv.issueDate, dueDate: inv.dueDate ?? inv.issueDate,
      subtotalCents: net, vatCents: vat, totalCents: gross, paidCents, paidAt: markPaid ? `${inv.issueDate}T00:00:00.000Z` : null,
      issuedAt: `${inv.issueDate}T00:00:00.000Z`, pdfFileId: row.fileId, source: 'import', importId: row.id, createdByUserId: row.createdByUserId,
      cancelsInvoiceId: linksOriginal ? original!.id : null,
    }).run();
    if (linksOriginal) {
      app.db.update(invoices).set({ status: 'cancelled', cancelledByInvoiceId: invoiceId, updatedAt: nowIso() }).where(eq(invoices.id, original!.id)).run();
      // vorherigen Status merken, damit „Rückgängig“ die Rechnung exakt wiederherstellen kann
      const opts = JSON.parse(app.db.select({ o: documentImports.optionsJson }).from(documentImports).where(eq(documentImports.id, row.id)).get()?.o || '{}') as Record<string, unknown>;
      app.db.update(documentImports).set({ optionsJson: JSON.stringify({ ...opts, linkedOriginal: { id: original!.id, prevStatus: original!.status } }) }).where(eq(documentImports.id, row.id)).run();
    }
    for (const it of itemRowsFrom(inv, companyId, invoiceId)) app.db.insert(invoiceItems).values(it).run();
    if (paidCents > 0) app.db.insert(payments).values({ id: newId(), companyId, invoiceId, amountCents: paidCents, paidAt: inv.issueDate!, method: 'other', note: markPaid ? 'Beim Import als bezahlt übernommen' : 'Anzahlung laut Rechnung', createdByUserId: row.createdByUserId }).run();
    if (row.fileId) app.db.update(files).set({ customerId, category: 'invoice', caption: `Rechnung ${inv.number} (importiert)` }).where(and(eq(files.id, row.fileId), eq(files.companyId, companyId))).run();
    logActivity(app.db, companyId, { customerId, userId: row.createdByUserId, type: 'invoice', subject: `Rechnung ${inv.number} importiert`, content: `${eur(gross)}${filled.length ? ` · ergänzt: ${filled.join(', ')}` : ''}`, refType: 'invoice', refId: invoiceId });
    return { invoiceId, filled, markPaid, linked: linksOriginal ? original!.invoiceNumber : null, linkWarning: link.warning };
  });
  if (result.filled.length) warnings.push(`Kundendaten ergänzt: ${result.filled.join(', ')}.`);
  if (result.markPaid) warnings.push('Als bezahlt übernommen; Zahlungsdatum = Rechnungsdatum (bei Bedarf in der Rechnung anpassen).');
  if (result.linked) warnings.push(`Storniert Rechnung ${result.linked} (verknüpft).`);
  if (result.linkWarning) warnings.push(result.linkWarning);
  writeAudit(app.db, { companyId, userId: row.createdByUserId }, { action: 'import.invoice', entityType: 'invoice', entityId: result.invoiceId, after: { number: inv.number, customerId, customerCreated, importId: row.id } });
  return { status: 'completed', invoiceId: result.invoiceId, customerId: customerId!, customerCreated, warnings };
}

/* ------------------------------------------------------------------ Anwenden: Eingangsrechnung → Ausgabe(n) */
const CATEGORY_RULES: Array<[RegExp, (typeof EXPENSE_CATEGORIES)[number]]> = [
  [/politur|polish|pad|mikrofaser|reiniger|shampoo|wachs|versiegelung|keramik|chemie|tuch|schwamm|koch.?chemie|sonax|meguiar|gyeon|carpro|menzerna|rupes|material/i, 'Material'],
  [/miete|pacht|halle|stellplatz/i, 'Miete'],
  [/software|lizenz|abo(nnement)?|cloud|hosting|domain|lexware|microsoft|google workspace|adobe/i, 'Software'],
  [/versicherung|haftpflicht|police/i, 'Versicherung'],
  [/telekom|vodafone|o2|telefon|internet|mobilfunk|dsl/i, 'Telefon/Internet'],
  [/strom|wasser|gas|energie|stadtwerke/i, 'Strom/Wasser'],
  [/leasing|tank|kraftstoff|diesel|benzin|kfz.?steuer|werkstatt|reifen/i, 'Leasing/Fahrzeug'],
  [/werbung|anzeige|google ads|meta|facebook|instagram|flyer|druck|marketing/i, 'Marketing'],
  [/maschine|poliermaschine|sauger|dampf|kompressor|werkzeug|lampe|ausstattung/i, 'Werkzeug/Ausstattung'],
  [/reparatur|wartung|instandhaltung/i, 'Reparatur/Wartung'],
  [/schulung|seminar|kurs|fortbildung|zertifizierung/i, 'Fortbildung'],
];

export function categoryFor(inv: NormalizedInvoice, choice?: string | null): string {
  const valid = (c: string | null | undefined) => (c && (EXPENSE_CATEGORIES as readonly string[]).includes(c) ? c : null);
  const explicit = valid(choice) ?? valid(inv.suggestedCategory);
  if (explicit) return explicit;
  const textAll = [inv.seller.name, ...inv.lines.map((l) => l.name)].filter(Boolean).join(' ');
  for (const [re, cat] of CATEGORY_RULES) if (re.test(textAll)) return cat;
  return 'Sonstiges';
}

function applyIncoming(app: FastifyInstance, row: ImportRow, inv: NormalizedInvoice, choice: ApplyChoice): ApplyResult {
  const companyId = row.companyId;
  const vendor = (inv.seller.name ?? 'Unbekannter Lieferant').slice(0, 160);
  const vendorKey = normalizeName(vendor);
  const gross = signed(inv, inv.grossCents!);
  // Dublette: gleiche Belegnummer beim gleichen Lieferanten, ohne Nummer: gleicher Lieferant + Datum + Betrag
  const candidates = app.db.select({ id: expenses.id, vendor: expenses.vendor, documentNumber: expenses.documentNumber, date: expenses.date, grossCents: expenses.grossCents, importId: expenses.importId }).from(expenses)
    .where(and(eq(expenses.companyId, companyId), inv.number ? eq(expenses.documentNumber, inv.number) : and(eq(expenses.date, inv.issueDate!), eq(expenses.grossCents, gross)))).all();
  const dup = candidates.find((c) => normalizeName(c.vendor) === vendorKey && c.importId !== row.id);
  // Belege ohne Nummer (z. B. zwei gleiche Kassenbons am selben Tag) dürfen nach Bestätigung trotzdem erfasst werden
  if (dup && !(choice.allowDuplicate && !inv.number)) return { status: 'duplicate', message: inv.number ? `Rechnung ${inv.number} von ${vendor} ist bereits erfasst.` : `Ein Beleg von ${vendor} über ${eur(gross)} am ${inv.issueDate} ist bereits erfasst.` };

  const category = categoryFor(inv, choice.category);
  const items = inv.lines.slice(0, 3).map((l) => l.name).join(', ');
  const baseDesc = `${inv.kind === 'credit_note' ? 'Gutschrift' : 'Rechnung'}${inv.number ? ` ${inv.number}` : ''}${items ? `: ${items}${inv.lines.length > 3 ? ' …' : ''}` : ''}`;
  const markPaid = choice.markPaid === true || inv.paid === true;
  // Je Steuersatz eine Ausgabe (Vorsteuer korrekt getrennt); ohne Aufteilung eine Ausgabe aus den Summen
  const vg = vatGroups(inv);
  if (vg.problem) return { status: 'needs_review', message: vg.problem };
  const groups = vg.groups;
  const ids = app.db.transaction(() => groups.map((g) => {
    const id = newId();
    app.db.insert(expenses).values({
      id, companyId, date: inv.issueDate!, category, vendor,
      description: `${baseDesc}${groups.length > 1 ? ` (${g.vatBp / 100} % MwSt.)` : ''}`.slice(0, 300),
      netCents: signed(inv, g.net), vatBp: g.vatBp, vatCents: signed(inv, g.vat), grossCents: signed(inv, g.net + g.vat),
      paymentMethod: 'transfer', isPaid: markPaid, paidAt: markPaid ? inv.issueDate : null, dueDate: markPaid ? null : inv.dueDate,
      receiptFileId: row.fileId, documentNumber: inv.number, importId: row.id, createdByUserId: row.createdByUserId,
      notes: inv.paymentTerms ? inv.paymentTerms.slice(0, 2000) : null,
    }).run();
    return id;
  }));
  if (row.fileId) app.db.update(files).set({ category: 'invoice', caption: `Eingangsrechnung ${vendor}${inv.number ? ` ${inv.number}` : ''}` }).where(and(eq(files.id, row.fileId), eq(files.companyId, companyId))).run();
  writeAudit(app.db, { companyId, userId: row.createdByUserId }, { action: 'import.expense', entityType: 'expense', entityId: ids[0]!, after: { vendor, number: inv.number, grossCents: gross, expenses: ids.length, importId: row.id } });
  return { status: 'completed', expenseIds: ids, warnings: [] };
}

export function applyImport(app: FastifyInstance, row: ImportRow, inv: NormalizedInvoice, choice: ApplyChoice): ApplyResult {
  const company = app.db.select().from(companies).where(eq(companies.id, row.companyId)).get()!;
  return row.direction === 'outgoing' ? applyOutgoing(app, row, inv, choice, company) : applyIncoming(app, row, inv, choice);
}

/* ------------------------------------------------------------------ Rückgängig machen */
const IMPORT_PAYMENT_NOTES = ['Beim Import als bezahlt übernommen', 'Anzahlung laut Rechnung'];
const IMPORT_ACTIVITY_SUBJECTS = ['Kunde aus importierter Rechnung angelegt'];

/** Grund, warum eine Übernahme nicht mehr zurückgenommen werden darf (null = möglich). */
export function undoBlocker(app: FastifyInstance, row: ImportRow): string | null {
  if (!row.invoiceId) return null;
  const inv = app.db.select().from(invoices).where(and(eq(invoices.id, row.invoiceId), eq(invoices.companyId, row.companyId))).get();
  if (!inv) return null;
  if (inv.sentAt) return 'Die Rechnung wurde bereits aus dieser Software versendet.';
  if (inv.cancelledByInvoiceId) {
    const credit = app.db.select({ number: invoices.invoiceNumber, source: invoices.source }).from(invoices).where(eq(invoices.id, inv.cancelledByInvoiceId)).get();
    return credit?.source === 'import' ? `Die Rechnung ist durch die Gutschrift ${credit.number} storniert – zuerst deren Übernahme rückgängig machen.` : 'Die Rechnung ist storniert.';
  }
  if (inv.status === 'cancelled') return 'Die Rechnung ist als storniert gekennzeichnet.';
  // Importierte Gutschrift, die eine Rechnung storniert: rückgängig möglich (Rechnung wird wiederhergestellt)
  if (inv.cancelsInvoiceId && inv.source !== 'import') return 'Die Rechnung ist mit einem Storno verknüpft.';
  const manual = app.db.select({ note: payments.note }).from(payments).where(eq(payments.invoiceId, inv.id)).all().filter((p) => !IMPORT_PAYMENT_NOTES.includes(p.note ?? ''));
  if (manual.length) return 'Zu dieser Rechnung wurden bereits Zahlungen erfasst – bitte zuerst entfernen.';
  return null;
}

export function undoImport(app: FastifyInstance, row: ImportRow, userId: string): { invoiceRemoved: boolean; customerRemoved: boolean; expensesRemoved: number } {
  const companyId = row.companyId;
  let invoiceRemoved = false; let customerRemoved = false; let expensesRemoved = 0;
  app.db.transaction(() => {
    if (row.invoiceId) {
      const inv = app.db.select().from(invoices).where(and(eq(invoices.id, row.invoiceId), eq(invoices.companyId, companyId), eq(invoices.source, 'import'), eq(invoices.importId, row.id))).get();
      if (inv) {
        if (inv.cancelsInvoiceId) {
          // Verknüpfte Rechnung wieder in den Zustand vor der Gutschrift versetzen
          const linked = (JSON.parse(row.optionsJson || '{}') as { linkedOriginal?: { id: string; prevStatus: string } }).linkedOriginal;
          const orig = app.db.select().from(invoices).where(and(eq(invoices.id, inv.cancelsInvoiceId), eq(invoices.companyId, companyId))).get();
          if (orig && orig.cancelledByInvoiceId === inv.id) {
            const prev = linked?.id === orig.id ? linked.prevStatus : 'cancelled'; // ohne Merker: nachträglich zugeordnet → war bereits storniert gekennzeichnet
            app.db.update(invoices).set({ status: prev, cancelledByInvoiceId: null, updatedAt: nowIso() }).where(eq(invoices.id, orig.id)).run();
            logActivity(app.db, companyId, { customerId: orig.customerId, userId, type: 'invoice', subject: `Storno-Verknüpfung von Rechnung ${orig.invoiceNumber} aufgehoben (Gutschrift ${inv.invoiceNumber} entfernt)`, refType: 'invoice', refId: orig.id });
          }
        }
        app.db.delete(payments).where(and(eq(payments.invoiceId, inv.id), inArray(payments.note, IMPORT_PAYMENT_NOTES))).run();
        app.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id)).run();
        app.db.run(sql`delete from activities where company_id = ${companyId} and ref_type = 'invoice' and ref_id = ${inv.id}`);
        app.db.delete(invoices).where(eq(invoices.id, inv.id)).run();
        invoiceRemoved = true;
      }
    }
    if (row.customerCreated && row.customerId) {
      const cid = row.customerId;
      // Kunde nur entfernen, wenn es außer dieser Übernahme nichts zu ihm gibt
      const used = app.db.get<{ n: number }>(sql`select
        (select count(*) from invoices where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from offers where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from orders where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from vehicles where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from appointments where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from tasks where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from leads where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from protocols where company_id = ${companyId} and customer_id = ${cid})
      + (select count(*) from files where company_id = ${companyId} and customer_id = ${cid} and id != ${row.fileId ?? ''})
      + (select count(*) from document_imports where company_id = ${companyId} and customer_id = ${cid} and id != ${row.id})
      + (select count(*) from activities where company_id = ${companyId} and customer_id = ${cid} and coalesce(subject, '') not in (${sql.join(IMPORT_ACTIVITY_SUBJECTS.map((x) => sql`${x}`), sql`, `)}))
      as n`)?.n ?? 0;
      if (used === 0) {
        app.db.run(sql`delete from activities where company_id = ${companyId} and customer_id = ${cid}`);
        app.db.delete(customers).where(and(eq(customers.id, cid), eq(customers.companyId, companyId))).run();
        customerRemoved = true;
      }
    }
    const expIds = JSON.parse(row.expenseIdsJson || '[]') as string[];
    if (expIds.length) expensesRemoved = app.db.delete(expenses).where(and(eq(expenses.companyId, companyId), inArray(expenses.id, expIds), eq(expenses.importId, row.id))).run().changes;
    if (row.fileId) app.db.update(files).set({ customerId: null }).where(and(eq(files.id, row.fileId), eq(files.companyId, companyId))).run();
    // Zurück in die Prüfung: Daten bleiben erhalten, erneute Übernahme oder Verwerfen möglich
    const { linkedOriginal: _l, ...restOpts } = JSON.parse(row.optionsJson || '{}') as Record<string, unknown>;
    app.db.update(documentImports).set({ optionsJson: JSON.stringify(restOpts), status: 'needs_review', error: 'Übernahme zurückgenommen – Daten prüfen und erneut übernehmen oder verwerfen.', invoiceId: null, customerId: null, customerCreated: false, expenseIdsJson: '[]', appliedAt: null, updatedAt: nowIso() }).where(eq(documentImports.id, row.id)).run();
  });
  writeAudit(app.db, { companyId, userId }, { action: 'import.undo', entityType: 'document_import', entityId: row.id, after: { invoiceRemoved, customerRemoved, expensesRemoved } });
  return { invoiceRemoved, customerRemoved, expensesRemoved };
}

/* ------------------------------------------------------------------ Auslesen (E-Rechnung exakt, sonst KI) */
export interface ReadResult { method: 'einvoice_cii' | 'einvoice_ubl' | 'ai'; invoice: NormalizedInvoice; aiModel?: string; aiIssues?: string[]; aiConfidence?: Extraction['confidence']; notInvoice?: boolean }

export class ManualEntryRequired extends Error {}

export async function readDocument(app: FastifyInstance, row: ImportRow): Promise<ReadResult> {
  const file = row.fileId ? app.storage.get(row.companyId, row.fileId) : null;
  if (!file) throw new Error('Die hochgeladene Datei ist nicht mehr vorhanden.');
  const buffer = fs.readFileSync(app.storage.absolute(file.storagePath));
  const xml = file.mimeType === 'application/xml' ? buffer.toString('utf8') : file.mimeType === 'application/pdf' ? embeddedInvoiceXml(buffer) : null;
  if (xml) {
    const parsed = parseEInvoice(xml);
    if (parsed) return { method: parsed.syntax === 'cii' ? 'einvoice_cii' : 'einvoice_ubl', invoice: parsed.invoice };
    if (file.mimeType === 'application/xml') throw new Error('Die XML-Datei ist keine unterstützte E-Rechnung (ZUGFeRD/Factur-X/XRechnung).');
  }
  const company = app.db.select().from(companies).where(eq(companies.id, row.companyId)).get()!;
  const cfg = app.integrations.get<AssistantConfig>(row.companyId, 'claude');
  if (!privacySettings(company).aiDocumentRecognition) throw new ManualEntryRequired('Keine E-Rechnungsdaten im Beleg. Die automatische Texterkennung (KI) ist ausgeschaltet – bitte einschalten oder die Daten manuell erfassen.');
  if (!cfg) throw new ManualEntryRequired('Keine E-Rechnungsdaten im Beleg. Für die automatische Texterkennung bitte unter Einstellungen → Integrationen den Anthropic-API-Key hinterlegen – oder die Daten manuell erfassen.');
  try {
    const r = await recognizeDocument({ apiKey: cfg.config.apiKey, fetchFn: app.fetchFn, buffer, mimeType: file.mimeType, context: { direction: row.direction as ImportDirection, ownCompany: { name: company.legalName ?? company.name, vatId: company.vatId, taxNumber: company.taxNumber, street: company.street, zip: company.zip, city: company.city }, categories: EXPENSE_CATEGORIES } });
    app.db.insert(aiUsageLog).values({ id: newId(), companyId: row.companyId, userId: row.createdByUserId, model: r.model, toolsJson: JSON.stringify(['document_recognition']), personalData: true, inputTokens: r.inputTokens, outputTokens: r.outputTokens }).run();
    return { method: 'ai', invoice: normalizeExtraction(r.extraction), aiModel: r.model, aiIssues: r.extraction.issues, aiConfidence: r.extraction.confidence, notInvoice: r.extraction.document_type === 'not_an_invoice' };
  } catch (err) {
    if (err instanceof DocumentRecognitionError) throw new ManualEntryRequired(err.message);
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 0;
    if (status === 400 || status === 413 || status === 422) throw new ManualEntryRequired('Die KI konnte diesen Beleg nicht verarbeiten (z. B. verschlüsselte, beschädigte oder sehr umfangreiche Datei). Bitte die Daten manuell erfassen.');
    throw err;
  }
}

/** Leeres Datenmodell für die manuelle Erfassung. */
export function emptyInvoice(): NormalizedInvoice {
  return { kind: 'invoice', number: null, issueDate: null, dueDate: null, serviceDate: null, currency: 'EUR', seller: emptyParty(), buyer: emptyParty(), lines: [], vat: [], netCents: null, vatCents: null, grossCents: null, prepaidCents: null, dueCents: null, paymentTerms: null, paid: null, notes: null, suggestedCategory: null, referencedNumber: null };
}

/* ------------------------------------------------------------------ Verarbeitung eines Imports (Warteschlange) */
export async function processImport(app: FastifyInstance, id: string): Promise<void> {
  const row = app.db.select().from(documentImports).where(eq(documentImports.id, id)).get();
  if (!row || (row.status !== 'queued' && row.status !== 'processing')) return;
  const set = (patch: Partial<typeof documentImports.$inferInsert>) => app.db.update(documentImports).set({ ...patch, updatedAt: nowIso() }).where(eq(documentImports.id, id)).run();
  try {
    set({ status: 'processing' });
    await processRow(app, row, set);
  } catch (err) {
    // Kein Beleg darf in „wird gelesen“ hängen bleiben
    app.log.error({ importId: id, err }, 'Belegimport: unerwarteter Fehler');
    set({ status: 'failed', error: `Verarbeitung fehlgeschlagen: ${describeError(err)}`, processedAt: nowIso() });
  }
  // Abbruchzähler (Neustart während der Verarbeitung) nach einem regulären Durchlauf zurücksetzen
  const after = app.db.select({ optionsJson: documentImports.optionsJson }).from(documentImports).where(eq(documentImports.id, id)).get();
  const opts = JSON.parse(after?.optionsJson || '{}') as { interrupted?: number };
  if (opts.interrupted) { delete opts.interrupted; app.db.update(documentImports).set({ optionsJson: JSON.stringify(opts) }).where(eq(documentImports.id, id)).run(); }
}

async function processRow(app: FastifyInstance, row: ImportRow, set: (patch: Partial<typeof documentImports.$inferInsert>) => unknown): Promise<void> {
  const id = row.id;
  const options = JSON.parse(row.optionsJson || '{}') as ImportOptions;
  let read: ReadResult;
  try {
    read = await readDocument(app, row);
  } catch (err) {
    if (err instanceof ManualEntryRequired) { set({ status: 'needs_review', method: 'manual', dataJson: JSON.stringify(emptyInvoice()), error: err.message, processedAt: nowIso() }); return; }
    app.log.warn({ importId: id, err: err instanceof Error ? err.message : String(err) }, 'Belegimport: Auslesen fehlgeschlagen');
    set({ status: 'failed', error: describeError(err), processedAt: nowIso() });
    return;
  }
  const company = app.db.select().from(companies).where(eq(companies.id, row.companyId)).get()!;
  const direction = row.direction as ImportDirection;
  if (read.method === 'ai' && direction === 'outgoing') read.invoice.paid = null; // Zahlstatus eigener Rechnungen nie aus der Texterkennung ableiten
  const check = checkInvoice(read.invoice, direction, company);
  if (read.notInvoice) check.blocking.unshift('Der Beleg scheint keine Rechnung zu sein.');
  if (read.method === 'ai') {
    if (read.aiConfidence === 'low') check.blocking.push('Der Beleg war nur teilweise lesbar – bitte die Werte prüfen.');
    // Eigene Rechnungen (Kunde + Umsatz) aus der Texterkennung nur bei sicherer Erkennung automatisch buchen
    if (read.aiConfidence === 'medium' && direction === 'outgoing') check.blocking.push('Texterkennung nicht ganz sicher – bitte die Werte kurz prüfen.');
    for (const issue of read.aiIssues ?? []) check.warnings.push(`Erkennung: ${issue}`);
  }
  const base = { method: read.method, dataJson: JSON.stringify(read.invoice), aiModel: read.aiModel ?? null, processedAt: nowIso() } as const;
  if (check.blocking.length) { set({ ...base, status: 'needs_review', warningsJson: JSON.stringify([...check.blocking, ...check.warnings]), error: check.blocking[0]! }); return; }
  const fresh = app.db.select().from(documentImports).where(eq(documentImports.id, id)).get()!;
  let result: ApplyResult;
  try {
    result = applyImport(app, fresh, read.invoice, { markPaid: options.markPaid });
  } catch (err) {
    app.log.error({ importId: id, err }, 'Belegimport: Übernahme fehlgeschlagen');
    set({ ...base, status: 'needs_review', warningsJson: JSON.stringify(check.warnings), error: `Übernahme fehlgeschlagen: ${describeError(err)}` });
    return;
  }
  finishWith(app, id, base, result, check.warnings);
}

export function finishWith(app: FastifyInstance, id: string, base: Partial<typeof documentImports.$inferInsert>, result: ApplyResult, warnings: string[]): void {
  const all = [...warnings, ...(result.warnings ?? [])];
  app.db.update(documentImports).set({
    ...base,
    status: result.status,
    error: result.status === 'completed' ? null : result.message ?? null,
    warningsJson: JSON.stringify(all),
    invoiceId: result.invoiceId ?? null,
    customerId: result.customerId ?? null,
    customerCreated: result.customerCreated ?? false,
    expenseIdsJson: JSON.stringify(result.expenseIds ?? []),
    appliedAt: result.status === 'completed' ? nowIso() : null,
    updatedAt: nowIso(),
  }).where(eq(documentImports.id, id)).run();
}

function describeError(err: unknown): string {
  const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : undefined;
  if (status === 401) return 'KI: API-Key ungültig (Einstellungen → Integrationen prüfen).';
  if (status === 429) return 'KI: Anfragelimit oder Guthaben erschöpft – später erneut versuchen.';
  if (status === 529 || status === 503) return 'KI derzeit überlastet – später erneut versuchen.';
  if (status && status >= 500) return `KI-Dienst nicht erreichbar (${status}) – später erneut versuchen.`;
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(msg)) return 'Keine Verbindung zur KI (Internet prüfen) – später erneut versuchen.';
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

/* ------------------------------------------------------------------ Warteschlange (nacheinander, übersteht Neustarts) */
export class ImportQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  constructor(private readonly app: FastifyInstance) {}
  enqueue(id: string): void {
    this.pending++;
    this.chain = this.chain.then(() => processImport(this.app, id)).catch((err) => { this.app.log.error({ err, importId: id }, 'Belegimport fehlgeschlagen'); }).finally(() => { this.pending--; });
  }
  /**
   * Beim Start: Wartende fortsetzen. War ein Beleg mitten in der Verarbeitung (Absturz/Neustart), wird er
   * einmal erneut versucht; beim zweiten Abbruch als Fehler markiert (verhindert Endlosschleifen nach Abstürzen).
   */
  resume(): number {
    const rows = this.app.db.select().from(documentImports).where(inArray(documentImports.status, ['queued', 'processing'])).all();
    let n = 0;
    for (const r of rows) {
      const opts = JSON.parse(r.optionsJson || '{}') as ImportOptions & { interrupted?: number };
      if (r.status === 'processing') {
        const interrupted = (opts.interrupted ?? 0) + 1;
        if (interrupted >= 2) {
          this.app.db.update(documentImports).set({ status: 'failed', error: 'Die Verarbeitung wurde wiederholt abgebrochen. Bitte „Erneut auslesen“ oder manuell erfassen.', updatedAt: nowIso() }).where(eq(documentImports.id, r.id)).run();
          continue;
        }
        this.app.db.update(documentImports).set({ status: 'queued', optionsJson: JSON.stringify({ ...opts, interrupted }), updatedAt: nowIso() }).where(eq(documentImports.id, r.id)).run();
      }
      this.enqueue(r.id);
      n++;
    }
    return n;
  }
  get size(): number { return this.pending; }
  /** Wartet, bis alle eingereihten Belege verarbeitet sind – optional mit Zeitlimit (Herunterfahren). */
  async idle(timeoutMs?: number): Promise<void> {
    const until = timeoutMs ? Date.now() + timeoutMs : Infinity;
    while (this.pending > 0 && Date.now() < until) {
      await (timeoutMs ? Promise.race([this.chain, new Promise((r) => setTimeout(r, Math.max(0, until - Date.now())))]) : this.chain);
    }
  }
}

/** Zusammenfassung für Listen (ohne vollständige Rohdaten). */
export function summarize(row: ImportRow) {
  let data: NormalizedInvoice | null = null;
  try { data = row.dataJson ? (JSON.parse(row.dataJson) as NormalizedInvoice) : null; } catch { data = null; }
  const party = data ? (row.direction === 'outgoing' ? data.buyer : data.seller) : null;
  return {
    id: row.id, direction: row.direction, status: row.status, fileName: row.fileName, fileId: row.fileId, method: row.method,
    number: data?.number ?? null, issueDate: data?.issueDate ?? null, grossCents: data?.grossCents ?? null, kind: data?.kind ?? null,
    partyName: party?.name ?? null, error: row.error, warnings: JSON.parse(row.warningsJson || '[]') as string[],
    invoiceId: row.invoiceId, customerId: row.customerId, customerCreated: row.customerCreated, expenseIds: JSON.parse(row.expenseIdsJson || '[]') as string[],
    createdAt: row.createdAt, processedAt: row.processedAt, appliedAt: row.appliedAt,
  };
}

