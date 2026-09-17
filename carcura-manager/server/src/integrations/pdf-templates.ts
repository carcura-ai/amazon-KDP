import type { companies, customers, vehicles, protocols, protocolDamages, files, orders, orderItems } from '../db/schema.js';

type Company = typeof companies.$inferSelect;
type Customer = typeof customers.$inferSelect;
type Vehicle = typeof vehicles.$inferSelect;
type Protocol = typeof protocols.$inferSelect;
type Damage = typeof protocolDamages.$inferSelect;
type FileRow = typeof files.$inferSelect;

export const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const dateDe = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(iso)) : '–');
export const dateTimeDe = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso)) : '–');
export const personName = (p: { firstName?: string | null; lastName?: string | null; companyName?: string | null; salutation?: string | null }) => {
  const n = [p.salutation, p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return p.companyName ? (n ? `${p.companyName}\n${n}` : p.companyName) : n || '–';
};
export const vehicleLabel = (v?: Vehicle | null) => (v ? [v.make, v.model].filter(Boolean).join(' ') || 'Fahrzeug' : '–');

export interface ShellOptions {
  company: Company;
  logoDataUrl?: string | null;
  title: string;
  subtitle?: string;
  docNumber?: string;
  docDate?: string;
  body: string;
  footerExtra?: string;
}

/** Gemeinsamer Rahmen aller PDFs: Kopf mit Logo/Firma, Fuß mit Kontakt-, Bank- und Steuerdaten. */
/** Fußzeile für Chromiums Footer-Template (wird in den Seitenrand gerendert, keine Layout-Nebenwirkungen). */
export function documentFooter(company: Company, extra?: string): string {
  const c = company;
  const legal = [c.legalName ?? c.name, c.taxNumber ? `St.-Nr. ${c.taxNumber}` : null, c.vatId ? `USt-IdNr. ${c.vatId}` : null].filter(Boolean).join(' · ');
  const bank = [c.bankName, c.iban ? `IBAN ${c.iban}` : null, c.bic ? `BIC ${c.bic}` : null].filter(Boolean).join(' · ');
  return `<div style="width:100%;margin:0 16mm;font-family:Arial,Helvetica,sans-serif;font-size:7.5px;color:#777;border-top:1px solid #ddd;padding-top:4px;display:flex;justify-content:space-between;gap:12px"><span>${esc(legal)}</span><span>${esc(bank)}</span><span>${extra ? esc(extra) + ' · ' : ''}Seite <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;
}

export function documentShell(o: ShellOptions): string {
  const c = o.company;
  const primary = c.primaryColor || '#E8F320';
  const address = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const contact = [c.phone ? `Tel. ${c.phone}` : null, c.email, c.website].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; margin: 0; line-height: 1.45; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${primary}; padding-bottom: 10px; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { max-height: 46px; max-width: 180px; }
  .brand .name { font-size: 18pt; font-weight: 700; letter-spacing: -0.01em; }
  .brand .sub { font-size: 8.5pt; color: #666; }
  .meta { text-align: right; font-size: 9pt; color: #444; }
  .meta b { display: block; font-size: 15pt; color: #111; margin-bottom: 2px; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  h2 { font-size: 11.5pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #ddd; text-transform: uppercase; letter-spacing: 0.05em; color: #333; }
  .subtitle { color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 6px 8px; border-bottom: 1.5px solid #333; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .kv { display: grid; grid-template-columns: 120px 1fr; gap: 3px 10px; font-size: 10pt; }
  .kv div:nth-child(odd) { color: #666; }
  .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .muted { color: #666; } .small { font-size: 9pt; }
  .totals { margin-left: auto; width: 62%; margin-top: 10px; }
  .totals td { border: 0; padding: 3px 8px; }
  .totals tr.total td { border-top: 2px solid #333; font-weight: 700; font-size: 12pt; padding-top: 6px; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 8.5pt; background: #eee; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .photos figure { margin: 0; break-inside: avoid; }
  .photos img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
  .photos figcaption { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 22px; }
  .sig .line { border-top: 1px solid #333; padding-top: 4px; font-size: 9pt; color: #555; margin-top: 60px; }
  .sig img { max-height: 70px; display: block; margin-bottom: -4px; }
  .pre { white-space: pre-wrap; }
  .avoid { break-inside: avoid; }
</style></head><body>
<div class="head">
  <div class="brand">${o.logoDataUrl ? `<img src="${o.logoDataUrl}" alt="">` : `<div style="width:40px;height:40px;border-radius:9px;background:${primary};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16pt;color:${c.secondaryColor || '#0B0B0C'}">${esc(c.name.slice(0, 2).toUpperCase())}</div>`}
    <div><div class="name">${esc(c.name)}</div><div class="sub">${esc(address)}${contact ? `<br>${esc(contact)}` : ''}</div></div></div>
  <div class="meta"><b>${esc(o.title)}</b>${o.docNumber ? `Nr. ${esc(o.docNumber)}<br>` : ''}${o.docDate ? `Datum ${esc(o.docDate)}` : ''}</div>
</div>
${o.subtitle ? `<div class="subtitle">${esc(o.subtitle)}</div>` : ''}
${o.body}
</body></html>`;
}

const AREA_LABEL: Record<string, string> = { front: 'Front', rear: 'Heck', left: 'Fahrerseite', right: 'Beifahrerseite', roof: 'Dach', interior: 'Innenraum', wheels: 'Räder/Felgen', glass: 'Glas', other: 'Sonstiges' };
const TYPE_LABEL: Record<string, string> = { scratch: 'Kratzer', dent: 'Delle', paint: 'Lackschaden', stone_chip: 'Steinschlag', crack: 'Riss', stain: 'Fleck', tear: 'Riss/Loch', wear: 'Abnutzung', other: 'Sonstiges' };
const SEV_LABEL: Record<string, string> = { minor: 'leicht', medium: 'mittel', major: 'stark' };
export const PROTOCOL_LABELS = { AREA_LABEL, TYPE_LABEL, SEV_LABEL };

/** Fahrzeugskizze (Draufsicht) mit nummerierten Schadensmarkern. Koordinaten in Promille. */
export function vehicleSketchSvg(damages: Array<{ posX: number | null; posY: number | null }>, width = 420): string {
  const h = Math.round(width * 0.5);
  const marks = damages
    .map((d, i) => (d.posX === null || d.posY === null ? '' : `<g><circle cx="${(d.posX / 1000) * width}" cy="${(d.posY / 1000) * h}" r="11" fill="#e53935" stroke="#fff" stroke-width="2"/><text x="${(d.posX / 1000) * width}" y="${(d.posY / 1000) * h + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${i + 1}</text></g>`))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" style="display:block">
  <rect x="0" y="0" width="${width}" height="${h}" fill="#f7f7f7" rx="8"/>
  <g fill="#fff" stroke="#333" stroke-width="2">
    <rect x="${width * 0.08}" y="${h * 0.22}" width="${width * 0.84}" height="${h * 0.56}" rx="${h * 0.22}"/>
    <rect x="${width * 0.3}" y="${h * 0.28}" width="${width * 0.4}" height="${h * 0.44}" rx="${h * 0.1}" fill="#eef2f7"/>
    <line x1="${width * 0.3}" y1="${h * 0.5}" x2="${width * 0.7}" y2="${h * 0.5}" stroke="#bbb" stroke-dasharray="4 4"/>
  </g>
  <g fill="#333"><rect x="${width * 0.16}" y="${h * 0.14}" width="${width * 0.11}" height="${h * 0.1}" rx="3"/><rect x="${width * 0.73}" y="${h * 0.14}" width="${width * 0.11}" height="${h * 0.1}" rx="3"/><rect x="${width * 0.16}" y="${h * 0.76}" width="${width * 0.11}" height="${h * 0.1}" rx="3"/><rect x="${width * 0.73}" y="${h * 0.76}" width="${width * 0.11}" height="${h * 0.1}" rx="3"/></g>
  <text x="${width * 0.04}" y="${h * 0.53}" font-size="10" fill="#777">Front</text><text x="${width * 0.92}" y="${h * 0.53}" font-size="10" fill="#777">Heck</text>
  <text x="${width * 0.47}" y="${h * 0.1}" font-size="10" fill="#777">Fahrerseite</text><text x="${width * 0.45}" y="${h * 0.97}" font-size="10" fill="#777">Beifahrerseite</text>
  ${marks}</svg>`;
}

export function protocolBody(p: Protocol, customer: Customer, vehicle: Vehicle, damages: Damage[], photos: Array<{ file: FileRow; dataUrl: string | null }>, signatures: { customer: string | null; employee: string | null }, employeeName: string | null): string {
  const checklist = JSON.parse(p.checklistJson || '{}') as Record<string, boolean>;
  const CHECK: Record<string, string> = { warndreieck: 'Warndreieck', verbandskasten: 'Verbandskasten', warnweste: 'Warnweste', bordwerkzeug: 'Bordwerkzeug', ersatzrad: 'Ersatzrad/Pannenset', fussmatten: 'Fußmatten', ladekabel: 'Ladekabel', schluessel2: 'Zweitschlüssel', kindersitz: 'Kindersitz', sonstiges: 'Sonstiges Zubehör' };
  const damageMap = new Map(photos.map((ph) => [ph.file.id, ph]));
  const rows = damages.length
    ? damages.map((d, i) => `<tr><td class="num">${i + 1}</td><td>${esc(AREA_LABEL[d.area] ?? d.area)}</td><td>${esc(TYPE_LABEL[d.type] ?? d.type)}</td><td>${esc(SEV_LABEL[d.severity] ?? d.severity)}</td><td>${esc(d.description ?? '')}</td><td>${d.fileId && damageMap.has(d.fileId) ? 'Foto ' + (photos.findIndex((x) => x.file.id === d.fileId) + 1) : '–'}</td></tr>`).join('')
    : '<tr><td colspan="6" class="muted">Keine Vorschäden festgestellt.</td></tr>';
  return `
<div class="grid2">
  <div class="box"><h2 style="margin-top:0">Kunde</h2><div class="pre">${esc(personName(customer))}</div><div class="small muted">${esc([customer.street, [customer.zip, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}<br>${esc([customer.phone, customer.email].filter(Boolean).join(' · '))}</div></div>
  <div class="box"><h2 style="margin-top:0">Fahrzeug</h2><div class="kv"><div>Fahrzeug</div><div>${esc(vehicleLabel(vehicle))}</div><div>Kennzeichen</div><div>${esc(vehicle.licensePlate ?? '–')}</div><div>Farbe</div><div>${esc(vehicle.color ?? '–')}</div><div>VIN</div><div>${esc(vehicle.vin ?? '–')}</div><div>Kilometerstand</div><div>${p.mileage !== null ? new Intl.NumberFormat('de-DE').format(p.mileage) + ' km' : '–'}</div><div>Tankfüllung</div><div>${p.fuelLevel !== null ? p.fuelLevel + ' %' : '–'}</div></div></div>
</div>
<h2>Zustand bei ${p.type === 'intake' ? 'Annahme' : 'Übergabe'}</h2>
<div class="kv"><div>Außen</div><div>${esc(p.exteriorCondition ?? '–')}</div><div>Innen</div><div>${esc(p.interiorCondition ?? '–')}</div><div>Zubehör im Fahrzeug</div><div>${Object.entries(CHECK).filter(([k]) => checklist[k]).map(([, v]) => v).join(', ') || '–'}</div></div>
<h2>Vorhandene Schäden und Auffälligkeiten</h2>
<div class="grid2 avoid"><div>${vehicleSketchSvg(damages, 330)}</div><div class="small muted">Die Nummern in der Skizze verweisen auf die Tabelle. Dokumentiert werden Schäden, die bereits vor der Aufbereitung vorhanden waren.</div></div>
<table style="margin-top:8px"><thead><tr><th>#</th><th>Bereich</th><th>Art</th><th>Grad</th><th>Beschreibung</th><th>Foto</th></tr></thead><tbody>${rows}</tbody></table>
${p.notes ? `<h2>Bemerkungen</h2><div class="pre">${esc(p.notes)}</div>` : ''}
${photos.length ? `<h2>Fotos</h2><div class="photos">${photos.map((ph, i) => (ph.dataUrl ? `<figure><img src="${ph.dataUrl}" alt=""><figcaption>Foto ${i + 1}${ph.file.caption ? ' · ' + esc(ph.file.caption) : ''}</figcaption></figure>` : '')).join('')}</div>` : ''}
<div class="sig avoid">
  <div>${signatures.customer ? `<img src="${signatures.customer}" alt="">` : ''}<div class="line">Kunde${p.signedByName ? ': ' + esc(p.signedByName) : ''}${p.signedAt ? ' · ' + dateTimeDe(p.signedAt) : ''}</div></div>
  <div>${signatures.employee ? `<img src="${signatures.employee}" alt="">` : ''}<div class="line">Für das Unternehmen${employeeName ? ': ' + esc(employeeName) : ''}</div></div>
</div>
<p class="small muted" style="margin-top:14px">Der Kunde bestätigt mit seiner Unterschrift die Richtigkeit des dokumentierten Fahrzeugzustands. Für Schäden, die hier nicht aufgeführt sind, wird eine Begutachtung bei der Übergabe vorgenommen.</p>`;
}

const ORDER_LABEL: Record<string, string> = { planned: 'Geplant', accepted: 'Angenommen', in_progress: 'In Bearbeitung', quality_check: 'Qualitätskontrolle', finished: 'Fertig', picked_up: 'Abgeholt', completed: 'Abgeschlossen', cancelled: 'Storniert' };
const ACTIVITY_LABEL: Record<string, string> = { call: 'Telefonat', email: 'E-Mail', message: 'Nachricht', whatsapp: 'WhatsApp', note: 'Notiz', appointment: 'Termin', offer: 'Angebot', invoice: 'Rechnung', reminder: 'Erinnerung', system: 'System', status: 'Status' };

export function customerProfileBody(customer: Customer, vehicleRows: Vehicle[], activities: Array<{ occurredAt: string; type: string; subject: string | null; content: string | null }>, orderRows: Array<typeof orders.$inferSelect>): string {
  return `
<div class="grid2">
  <div class="box"><h2 style="margin-top:0">Stammdaten</h2><div class="kv"><div>Kundennummer</div><div>${esc(customer.customerNumber)}</div><div>Name</div><div class="pre">${esc(personName(customer))}</div><div>Adresse</div><div>${esc([[customer.street, customer.houseNumber].filter(Boolean).join(' '), [customer.zip, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–')}</div><div>Telefon</div><div>${esc([customer.phone, customer.phone2].filter(Boolean).join(' · ') || '–')}</div><div>E-Mail</div><div>${esc(customer.email ?? '–')}</div><div>Kunde seit</div><div>${dateDe(customer.createdAt)}</div></div></div>
  <div class="box"><h2 style="margin-top:0">Fahrzeuge</h2>${vehicleRows.length ? vehicleRows.map((v) => `<div style="margin-bottom:6px"><b>${esc(vehicleLabel(v))}</b> <span class="muted">${esc(v.licensePlate ?? '')}${v.year ? ' · ' + v.year : ''}${v.mileage ? ' · ' + new Intl.NumberFormat('de-DE').format(v.mileage) + ' km' : ''}</span></div>`).join('') : '<span class="muted">Keine Fahrzeuge</span>'}</div>
</div>
${customer.notes ? `<h2>Notizen</h2><div class="pre">${esc(customer.notes)}</div>` : ''}
<h2>Aufträge</h2>
<table><thead><tr><th>Nummer</th><th>Datum</th><th>Bezeichnung</th><th>Status</th><th class="num">Summe</th></tr></thead><tbody>${orderRows.length ? orderRows.map((o) => `<tr><td>${esc(o.orderNumber)}</td><td>${dateDe(o.createdAt)}</td><td>${esc(o.title ?? '')}</td><td>${esc(ORDER_LABEL[o.status] ?? o.status)}</td><td class="num">${money(o.totalCents)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Keine Aufträge</td></tr>'}</tbody></table>
<h2>Historie</h2>
<table><thead><tr><th>Zeitpunkt</th><th>Art</th><th>Betreff / Inhalt</th></tr></thead><tbody>${activities.slice(0, 60).map((a) => `<tr><td class="small">${dateTimeDe(a.occurredAt)}</td><td class="small">${esc(ACTIVITY_LABEL[a.type] ?? a.type)}</td><td><b>${esc(a.subject ?? '')}</b>${a.content ? `<div class="small muted pre">${esc(a.content)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Keine Einträge</td></tr>'}</tbody></table>`;
}

export function orderBody(o: typeof orders.$inferSelect, items: Array<typeof orderItems.$inferSelect>, customer: Customer, vehicle: Vehicle | null, totals: { subtotalCents: number; vatCents: number; totalCents: number; vatBreakdown: Array<{ vatBp: number; netCents: number; vatCents: number }> }, smallBusiness: boolean): string {
  return `
<div class="grid2">
  <div class="box"><h2 style="margin-top:0">Kunde</h2><div class="pre">${esc(personName(customer))}</div><div class="small muted">${esc([customer.street, [customer.zip, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</div></div>
  <div class="box"><h2 style="margin-top:0">Fahrzeug</h2>${vehicle ? `<b>${esc(vehicleLabel(vehicle))}</b><div class="small muted">${esc(vehicle.licensePlate ?? '')}${o.mileageIn ? ' · ' + new Intl.NumberFormat('de-DE').format(o.mileageIn) + ' km bei Annahme' : ''}</div>` : '<span class="muted">–</span>'}</div>
</div>
${o.title ? `<h1 style="margin-top:16px">${esc(o.title)}</h1>` : ''}
<table style="margin-top:10px"><thead><tr><th>Pos.</th><th>Leistung</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>
${items.map((it, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(it.name)}</b>${it.description ? `<div class="small muted">${esc(it.description)}</div>` : ''}</td><td class="num">${it.quantity}</td><td class="num">${money(it.unitPriceCents)}</td><td class="num">${money(it.totalCents)}</td></tr>`).join('')}
</tbody></table>
<table class="totals"><tr><td>Netto</td><td class="num">${money(totals.subtotalCents)}</td></tr>${smallBusiness ? '<tr><td class="small muted" colspan="2">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</td></tr>' : totals.vatBreakdown.map((v) => `<tr><td>zzgl. ${v.vatBp / 100} % MwSt.</td><td class="num">${money(v.vatCents)}</td></tr>`).join('')}<tr class="total"><td>Gesamt</td><td class="num">${money(totals.totalCents)}</td></tr></table>
${o.notes ? `<h2>Hinweise</h2><div class="pre">${esc(o.notes)}</div>` : ''}`;
}

/* ------------------------------------------------------------------ Angebot / Rechnung */
import type { offers, offerItems, invoices, invoiceItems } from '../db/schema.js';
type LineItem = typeof offerItems.$inferSelect | typeof invoiceItems.$inferSelect;
type TotalsT = { subtotalCents: number; vatCents: number; totalCents: number; vatBreakdown: Array<{ vatBp: number; netCents: number; vatCents: number }> };

function addressBlock(company: Company, customer: Customer): string {
  const sender = [company.legalName ?? company.name, company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const lines = [customer.companyName, [customer.salutation, customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || null, [customer.street, customer.houseNumber].filter(Boolean).join(' ') || null, [customer.zip, customer.city].filter(Boolean).join(' ') || null].filter(Boolean);
  return `<div style="margin:6px 0 18px;min-height:34mm"><div style="font-size:7.5pt;color:#777;border-bottom:1px solid #ddd;display:inline-block;padding-bottom:2px;margin-bottom:8px">${esc(sender)}</div><div style="font-size:11pt;line-height:1.5">${lines.map((l) => esc(l)).join('<br>')}</div></div>`;
}

function itemsTable(items: LineItem[], totals: TotalsT, smallBusiness: boolean): string {
  return `<table><thead><tr><th>Pos.</th><th>Leistung</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>
${items.map((it, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(it.name)}</b>${it.description ? `<div class="small muted">${esc(it.description)}</div>` : ''}</td><td class="num">${it.quantity}</td><td class="num">${money(it.unitPriceCents)}</td><td class="num">${money(it.totalCents)}</td></tr>`).join('')}
</tbody></table>
<table class="totals"><tr><td>Nettobetrag</td><td class="num">${money(totals.subtotalCents)}</td></tr>${smallBusiness ? '' : totals.vatBreakdown.map((v) => `<tr><td>zzgl. ${v.vatBp / 100} % MwSt. auf ${money(v.netCents)}</td><td class="num">${money(v.vatCents)}</td></tr>`).join('')}<tr class="total"><td>Gesamtbetrag</td><td class="num">${money(totals.totalCents)}</td></tr></table>
${smallBusiness ? '<p class="small muted" style="margin-top:8px">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>' : ''}`;
}

export function offerBody(o: typeof offers.$inferSelect, items: LineItem[], company: Company, customer: Customer, vehicle: Vehicle | null, totals: TotalsT): string {
  return `${addressBlock(company, customer)}
<div class="grid2" style="margin-bottom:12px"><div><h1>Angebot ${esc(o.offerNumber)}</h1>${o.title ? `<div class="subtitle">${esc(o.title)}</div>` : ''}</div>
<div class="kv" style="grid-template-columns:110px 1fr"><div>Datum</div><div>${dateDe(o.issueDate)}</div><div>Gültig bis</div><div>${o.validUntil ? dateDe(o.validUntil) : '–'}</div><div>Kundennummer</div><div>${esc(customer.customerNumber)}</div>${vehicle ? `<div>Fahrzeug</div><div>${esc(vehicleLabel(vehicle))}${vehicle.licensePlate ? ', ' + esc(vehicle.licensePlate) : ''}</div>` : ''}</div></div>
${o.introText ? `<p class="pre" style="margin-bottom:12px">${esc(o.introText)}</p>` : `<p style="margin-bottom:12px">vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:</p>`}
${itemsTable(items, totals, company.smallBusiness)}
${o.notes ? `<p class="pre" style="margin-top:14px">${esc(o.notes)}</p>` : ''}
<p style="margin-top:14px">Wir freuen uns auf Ihren Auftrag.${o.validUntil ? ` Dieses Angebot ist gültig bis ${dateDe(o.validUntil)}.` : ''}</p>
${company.invoiceFooter ? `<p class="small muted pre" style="margin-top:14px">${esc(company.invoiceFooter)}</p>` : ''}`;
}

export function invoiceBody(inv: typeof invoices.$inferSelect, items: LineItem[], company: Company, customer: Customer, vehicle: Vehicle | null, totals: TotalsT, cancelsNumber?: string | null): string {
  const isStorno = Boolean(inv.cancelsInvoiceId);
  const title = isStorno ? `Stornorechnung ${esc(inv.invoiceNumber ?? '')}` : inv.invoiceNumber ? `Rechnung ${esc(inv.invoiceNumber)}` : 'Rechnungsentwurf';
  const bank = [company.bankName ? `Bank: ${company.bankName}` : null, company.iban ? `IBAN: ${company.iban}` : null, company.bic ? `BIC: ${company.bic}` : null].filter(Boolean).join(' · ');
  const payText = isStorno
    ? `Diese Stornorechnung hebt die Rechnung ${esc(cancelsNumber ?? '')} auf.`
    : inv.paidCents >= inv.totalCents && inv.totalCents > 0
      ? `Der Betrag wurde bereits vollständig beglichen. Vielen Dank.`
      : `Bitte überweisen Sie den Gesamtbetrag${inv.dueDate ? ` bis zum <b>${dateDe(inv.dueDate)}</b>` : ''} unter Angabe der Rechnungsnummer${inv.paidCents > 0 ? ` (bereits erhalten: ${money(inv.paidCents)}, offen: ${money(inv.totalCents - inv.paidCents)})` : ''}.${bank ? `<br>${esc(bank)}` : ''}`;
  return `${addressBlock(company, customer)}
<div class="grid2" style="margin-bottom:12px"><div><h1>${title}</h1>${inv.title ? `<div class="subtitle">${esc(inv.title)}</div>` : ''}</div>
<div class="kv" style="grid-template-columns:120px 1fr"><div>Rechnungsdatum</div><div>${dateDe(inv.issueDate)}</div><div>Leistungsdatum</div><div>${inv.serviceDate ? dateDe(inv.serviceDate) : dateDe(inv.issueDate)}</div>${inv.dueDate && !isStorno ? `<div>Fällig am</div><div>${dateDe(inv.dueDate)}</div>` : ''}<div>Kundennummer</div><div>${esc(customer.customerNumber)}</div>${vehicle ? `<div>Fahrzeug</div><div>${esc(vehicleLabel(vehicle))}${vehicle.licensePlate ? ', ' + esc(vehicle.licensePlate) : ''}</div>` : ''}</div></div>
${inv.introText ? `<p class="pre" style="margin-bottom:12px">${esc(inv.introText)}</p>` : ''}
${itemsTable(items, totals, company.smallBusiness)}
<p style="margin-top:14px">${payText}</p>
${inv.notes ? `<p class="pre" style="margin-top:10px">${esc(inv.notes)}</p>` : ''}
${company.invoiceFooter ? `<p class="small muted pre" style="margin-top:14px">${esc(company.invoiceFooter)}</p>` : ''}`;
}
