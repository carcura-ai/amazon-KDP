import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import sharp from 'sharp';
import { emptyParty, toBp, toCents, toIsoDate, type InvoiceParty, type NormalizedInvoice } from '../einvoice/model.js';

/** Modell für die Belegerkennung (Lesen von Fotos/PDFs). */
export const DOCUMENT_MODEL = 'claude-opus-5-5';
/** PDF-Grenze für die Übertragung (Base64 vergrößert um ~33 %, Anfragegrenze 32 MB). */
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const party = z.object({
  name: z.string().nullable().describe('Firmenname bzw. vollständiger Name, genau wie auf dem Beleg'),
  is_company: z.boolean().describe('true, wenn es ein Unternehmen/eine Organisation ist (GmbH, UG, e.K., GbR, AG, Autohaus …)'),
  contact_person: z.string().nullable().describe('Ansprechpartner/Person, falls zusätzlich zum Firmennamen genannt; bei Privatpersonen der Name'),
  street: z.string().nullable().describe('Straße mit Hausnummer'),
  zip: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable().describe('ISO-Ländercode, z. B. DE'),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  vat_id: z.string().nullable().describe('USt-IdNr., z. B. DE123456789'),
  tax_number: z.string().nullable().describe('Steuernummer'),
  party_number: z.string().nullable().describe('Kunden- bzw. Lieferantennummer, die der Beleg dieser Partei zuordnet'),
});

export const EXTRACTION_SCHEMA = z.object({
  document_type: z.enum(['invoice', 'credit_note', 'correction', 'receipt', 'not_an_invoice']).describe('Art des Belegs; receipt = Kassenbon/Quittung'),
  invoice_number: z.string().nullable(),
  issue_date: z.string().nullable().describe('Rechnungsdatum als YYYY-MM-DD'),
  due_date: z.string().nullable().describe('Fälligkeitsdatum als YYYY-MM-DD, nur wenn genannt oder eindeutig aus „zahlbar innerhalb von X Tagen“ berechenbar'),
  service_date: z.string().nullable().describe('Leistungs-/Lieferdatum als YYYY-MM-DD'),
  currency: z.string().describe('ISO-Währung, meist EUR'),
  seller: party.describe('Rechnungssteller (Verkäufer/Leistungserbringer)'),
  buyer: party.describe('Rechnungsempfänger (Kunde)'),
  line_items: z.array(z.object({
    name: z.string(),
    description: z.string().nullable(),
    quantity: z.number(),
    unit: z.string().nullable(),
    unit_net_price: z.number().nullable().describe('Einzelpreis netto in Euro'),
    net_amount: z.number().describe('Zeilensumme netto in Euro (bei Bruttobelegen: herausgerechnet)'),
    vat_rate_percent: z.number().nullable().describe('Steuersatz in Prozent, z. B. 19, 7 oder 0'),
  })),
  vat_breakdown: z.array(z.object({ vat_rate_percent: z.number(), net_amount: z.number(), vat_amount: z.number() })),
  total_net: z.number().nullable(),
  total_vat: z.number().nullable(),
  total_gross: z.number().nullable(),
  amount_due: z.number().nullable().describe('Noch zu zahlender Betrag, falls abweichend vom Bruttobetrag'),
  payment_terms: z.string().nullable(),
  paid: z.boolean().nullable().describe('true nur bei klarem Hinweis auf erfolgte Zahlung (z. B. „bezahlt“, „Betrag erhalten“, Kartenzahlung auf Kassenbon); sonst null'),
  small_business_note: z.boolean().describe('true, wenn der Beleg auf § 19 UStG (Kleinunternehmer, keine Umsatzsteuer) hinweist'),
  suggested_category: z.string().nullable().describe('Passende Ausgabenkategorie aus der vorgegebenen Liste (nur bei Eingangsrechnungen)'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Wie sicher die Werte vollständig und korrekt gelesen wurden'),
  issues: z.array(z.string()).describe('Unleserliche oder fehlende Angaben, Widersprüche (deutsch, kurz)'),
});
export type Extraction = z.infer<typeof EXTRACTION_SCHEMA>;

export interface ExtractionContext {
  direction: 'outgoing' | 'incoming';
  ownCompany: { name: string; vatId?: string | null; taxNumber?: string | null; street?: string | null; zip?: string | null; city?: string | null };
  categories: readonly string[];
}

export class DocumentRecognitionError extends Error {}

function systemPrompt(ctx: ExtractionContext): string {
  const own = [ctx.ownCompany.name, [ctx.ownCompany.street, [ctx.ownCompany.zip, ctx.ownCompany.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), ctx.ownCompany.vatId ? `USt-IdNr. ${ctx.ownCompany.vatId}` : null].filter(Boolean).join(' · ');
  return `Du liest Rechnungen und Belege für die Buchhaltung eines deutschen Betriebs („${own}“) und gibst die Daten strukturiert zurück.
Regeln:
- Übernimm nur, was auf dem Beleg steht. Nichts erfinden, nichts schätzen. Unleserliches oder Fehlendes ist null und wird unter issues genannt.
- Beträge als Zahl in Euro mit Punkt als Dezimaltrennzeichen (1234.56), Datumswerte als YYYY-MM-DD.
- Rechnungssteller (seller) und Rechnungsempfänger (buyer) sorgfältig unterscheiden: Briefkopf/Absender/Bankverbindung/USt-IdNr. im Fuß gehören zum Rechnungssteller; das Anschriftenfeld zum Empfänger.
- ${ctx.direction === 'outgoing' ? `Erwartet wird eine Ausgangsrechnung: Rechnungssteller ist voraussichtlich „${ctx.ownCompany.name}“, der Empfänger ist der Kunde.` : `Erwartet wird eine Eingangsrechnung: Rechnungssteller ist ein Lieferant/Händler, Empfänger voraussichtlich „${ctx.ownCompany.name}“.`} Steht es auf dem Beleg anders, gib es so zurück, wie es dort steht.
- Positionen vollständig übernehmen. Bei Bruttopreisen (Kassenbon) die Nettobeträge mit dem ausgewiesenen Steuersatz herausrechnen und die Steueraufteilung (vat_breakdown) aus dem Beleg übernehmen.
- Kleinunternehmer (§ 19 UStG): Steuersatz 0, total_vat 0.
- suggested_category nur bei Eingangsrechnungen, genau einer dieser Werte: ${ctx.categories.join(', ')}.
- Telefonnummern und E-Mail-Adressen nur übernehmen, wenn sie eindeutig zur jeweiligen Partei gehören.`;
}

/** Bild für die Erkennung vorbereiten: Drehung nach EXIF, Größe begrenzen (Text bleibt lesbar), JPEG. */
async function prepareImage(buf: Buffer): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const out = await sharp(buf, { failOn: 'error' }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return { data: out.toString('base64'), mediaType: 'image/jpeg' };
}

export async function recognizeDocument(opts: { apiKey: string; fetchFn?: typeof fetch; buffer: Buffer; mimeType: string; context: ExtractionContext; model?: string }): Promise<{ extraction: Extraction; model: string; inputTokens: number; outputTokens: number }> {
  let source: Anthropic.Beta.Messages.BetaContentBlockParam;
  if (opts.mimeType === 'application/pdf') {
    if (opts.buffer.length > MAX_PDF_BYTES) throw new DocumentRecognitionError('Die PDF ist für die automatische Erkennung zu groß (max. 20 MB).');
    source = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.buffer.toString('base64') } };
  } else if (opts.mimeType.startsWith('image/')) {
    const img = await prepareImage(opts.buffer);
    source = { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } };
  } else {
    throw new DocumentRecognitionError('Dieser Dateityp kann nicht automatisch gelesen werden.');
  }
  const model = opts.model ?? DOCUMENT_MODEL;
  const client = new Anthropic({ apiKey: opts.apiKey, fetch: opts.fetchFn, maxRetries: 2, timeout: 180_000 });
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: systemPrompt(opts.context),
    messages: [{ role: 'user', content: [source, { type: 'text', text: 'Lies diesen Beleg vollständig aus.' }] }],
    output_config: { effort: 'high', format: zodOutputFormat(EXTRACTION_SCHEMA) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (response.stop_reason === 'refusal') throw new DocumentRecognitionError('Die automatische Erkennung hat den Beleg abgelehnt. Bitte manuell erfassen.');
  if (response.stop_reason === 'max_tokens') throw new DocumentRecognitionError('Der Beleg ist zu umfangreich für die automatische Erkennung. Bitte manuell erfassen.');
  const extraction = response.parsed_output;
  if (!extraction) throw new DocumentRecognitionError('Die Erkennung lieferte keine verwertbaren Daten.');
  return { extraction, model: response.model ?? model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

function toParty(p: Extraction['seller']): InvoiceParty {
  const out = emptyParty();
  out.name = p.name?.trim() || null;
  out.companyName = p.is_company ? out.name : null;
  out.personName = p.contact_person?.trim() || (p.is_company ? null : out.name);
  out.street = p.street; out.zip = p.zip; out.city = p.city; out.country = p.country;
  out.email = p.email; out.phone = p.phone; out.vatId = p.vat_id; out.taxNumber = p.tax_number; out.partyNumber = p.party_number;
  return out;
}

/** KI-Ergebnis in das einheitliche Rechnungsmodell überführen. */
export function normalizeExtraction(e: Extraction): NormalizedInvoice {
  const zeroVat = e.small_business_note;
  return {
    kind: e.document_type === 'credit_note' ? 'credit_note' : e.document_type === 'correction' ? 'correction' : e.document_type === 'receipt' ? 'receipt' : 'invoice',
    number: e.invoice_number?.trim() || null,
    issueDate: toIsoDate(e.issue_date),
    dueDate: toIsoDate(e.due_date),
    serviceDate: toIsoDate(e.service_date),
    currency: (e.currency || 'EUR').toUpperCase(),
    seller: toParty(e.seller),
    buyer: toParty(e.buyer),
    lines: e.line_items.map((l) => ({ name: l.name.trim() || 'Position', description: l.description, quantity: l.quantity || 1, unit: l.unit, unitNetCents: toCents(l.unit_net_price), netCents: toCents(l.net_amount) ?? 0, vatBp: zeroVat ? 0 : toBp(l.vat_rate_percent) })),
    vat: e.vat_breakdown.map((v) => ({ vatBp: zeroVat ? 0 : toBp(v.vat_rate_percent) ?? 0, netCents: toCents(v.net_amount) ?? 0, vatCents: zeroVat ? 0 : toCents(v.vat_amount) ?? 0 })),
    netCents: toCents(e.total_net),
    vatCents: zeroVat ? 0 : toCents(e.total_vat),
    grossCents: toCents(e.total_gross),
    prepaidCents: null,
    dueCents: toCents(e.amount_due),
    paymentTerms: e.payment_terms,
    paid: e.paid,
    notes: null,
    suggestedCategory: e.suggested_category,
  };
}
