/**
 * Einheitliches Rechnungsmodell für den Belegimport – gleich, ob die Daten aus einer E-Rechnung
 * (ZUGFeRD/Factur-X/XRechnung, exakt) oder aus der KI-Erkennung eines Fotos/PDFs (geprüft) stammen.
 * Beträge in Cent, Steuersätze in Basispunkten (19 % = 1900), Datumswerte als YYYY-MM-DD.
 */
export interface InvoiceParty {
  /** Firmenname bzw. vollständiger Personenname, wie auf dem Beleg */
  name: string | null;
  /** Gesetzt, wenn es sich erkennbar um ein Unternehmen handelt */
  companyName: string | null;
  /** Ansprechpartner bzw. Person (bei Privatkunden) */
  personName: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  vatId: string | null;
  taxNumber: string | null;
  /** Kundennummer bzw. Lieferantennummer aus dem Beleg */
  partyNumber: string | null;
}

export interface InvoiceLine {
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitNetCents: number | null;
  netCents: number;
  vatBp: number | null;
}

export interface VatLine { vatBp: number; netCents: number; vatCents: number }

export type DocumentKind = 'invoice' | 'credit_note' | 'correction' | 'receipt';

export interface NormalizedInvoice {
  kind: DocumentKind;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  serviceDate: string | null;
  currency: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  vat: VatLine[];
  netCents: number | null;
  vatCents: number | null;
  grossCents: number | null;
  prepaidCents: number | null;
  dueCents: number | null;
  paymentTerms: string | null;
  /** Hinweis auf bereits erfolgte Zahlung (z. B. „bezahlt per Karte“); null = unbekannt */
  paid: boolean | null;
  notes: string | null;
  /** Nur KI: vorgeschlagene Ausgabenkategorie */
  suggestedCategory: string | null;
  /** Bei Gutschrift/Storno: Nummer der Rechnung, auf die sich der Beleg bezieht */
  referencedNumber?: string | null;
}

export const emptyParty = (): InvoiceParty => ({ name: null, companyName: null, personName: null, street: null, zip: null, city: null, country: null, email: null, phone: null, vatId: null, taxNumber: null, partyNumber: null });

/**
 * Dezimalbetrag (Punkt oder Komma) → Cent, kaufmännisch gerundet, ohne Gleitkommafehler.
 * Akzeptiert „1234.5“, „-12,99“, „1.234,56“ (deutsch) und „1,234.56“ (englisch).
 */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.sign(value) * Math.round(Number(Math.abs(value * 100).toFixed(6))) : null;
  let s = value.trim().replace(/\s|€|EUR/gi, '');
  if (!s) return null;
  const neg = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/^[-+(]|\)$/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  const padded = (frac + '000').slice(0, 3);
  let cents = Number(int) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1;
  return neg ? -cents : cents;
}

/** Steuersatz in Prozent (z. B. „19.00“) → Basispunkte. */
export function toBp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Datum in ISO (YYYY-MM-DD) aus CII-Format 102 (YYYYMMDD), ISO-Zeitstempeln oder deutschem Format. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return valid(`${m[1]}-${m[2]}-${m[3]}`);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return valid(`${m[1]}-${m[2]}-${m[3]}`);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(v);
  if (m) { const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!; return valid(`${y}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`); }
  return null;
}
function valid(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

export function kindFromTypeCode(code: string | null): DocumentKind {
  if (code === '381' || code === '261' || code === '396' || code === '532') return 'credit_note';
  if (code === '384') return 'correction';
  return 'invoice';
}
