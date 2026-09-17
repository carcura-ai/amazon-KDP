const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const moneyFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const fmtDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '–');
export const fmtDateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '–');
export const fmtMoney = (cents?: number | null) => (cents === null || cents === undefined ? '–' : moneyFmt.format(cents / 100));
export const fmtNumber = (n?: number | null) => (n === null || n === undefined ? '–' : new Intl.NumberFormat('de-DE').format(n));
export const fmtRelative = (iso?: string | null) => {
  if (!iso) return '–';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 14) return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
  return fmtDate(iso);
};
export const initials = (first?: string | null, last?: string | null) => `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || '?';
export const personName = (p: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) => {
  const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  if (p.companyName) return n ? `${p.companyName} · ${n}` : p.companyName;
  return n || '–';
};
export const centsFromInput = (v: string): number => Math.round(Number(v.replace(',', '.')) * 100) || 0;
export const inputFromCents = (c?: number | null): string => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

export const LEAD_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: 'Neu', tone: 'brand' },
  contact_attempt: { label: 'Kontaktversuch', tone: 'info' },
  contacted: { label: 'Kontakt hergestellt', tone: 'info' },
  offer_created: { label: 'Angebot erstellt', tone: 'info' },
  offer_sent: { label: 'Angebot versendet', tone: 'warn' },
  appointment: { label: 'Termin vereinbart', tone: 'warn' },
  order: { label: 'Auftrag', tone: 'ok' },
  won: { label: 'Abgeschlossen', tone: 'ok' },
  lost: { label: 'Verloren', tone: 'danger' },
};
export const LEAD_SOURCE: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', website: 'Website', manual: 'Manuell', phone: 'Telefon', referral: 'Empfehlung', google_business: 'Google Unternehmensprofil', other: 'Sonstige',
};
export const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', manager: 'Manager', employee: 'Mitarbeiter', accounting: 'Buchhaltung', readonly: 'Nur Lesen' };
export const ACTIVITY_LABEL: Record<string, string> = { call: 'Telefonat', email: 'E-Mail', message: 'Nachricht', whatsapp: 'WhatsApp', note: 'Notiz', appointment: 'Termin', offer: 'Angebot', invoice: 'Rechnung', reminder: 'Erinnerung', system: 'System', status: 'Statuswechsel' };
export const VEHICLE_TYPES = ['Kleinwagen', 'Kompaktklasse', 'Limousine', 'Kombi', 'SUV', 'Van', 'Transporter', 'Cabrio', 'Sportwagen', 'Wohnmobil', 'Motorrad', 'Sonstiges'];
