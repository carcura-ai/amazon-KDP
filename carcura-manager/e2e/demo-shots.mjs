// Erstellt Demo-Bildschirmfotos (Desktop + Smartphone) der befüllten Installation.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
const base = 'http://127.0.0.1:4800'; const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
async function save(page, name, { full = true, maxH = 2400 } = {}) {
  await page.waitForTimeout(700);
  const png = await page.screenshot({ fullPage: full });
  const img = sharp(png); const meta = await img.metadata();
  const h = Math.min(meta.height, maxH);
  await img.extract({ left: 0, top: 0, width: meta.width, height: h }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  console.log(name, meta.width, h);
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message));
// Login-Seite (abgemeldet)
await page.goto(base + '/login'); await page.waitForSelector('text=Carcura · Manager'); await save(page, 'd-login', { full: false });
await page.fill('input[type="email"]', 'alex@carcura.info'); await page.fill('input[type="password"]', 'Demo-Passwort-2026'); await page.click('button[type="submit"]'); await page.waitForSelector('text=Guten Tag');
const get = async (u) => (await (await page.request.get(base + u)).json());
const customers = (await get('/api/customers?pageSize=50')).items; const cust = (l) => customers.find((c) => c.lastName === l);
const leads = (await get('/api/leads?pageSize=50')).items; const orders = (await get('/api/orders?pageSize=50')).items; const invoices = (await get('/api/invoices?pageSize=50')).items;
const offers = (await get('/api/offers?pageSize=50')).items; const vehicles = (await get('/api/vehicles?pageSize=50')).items; const reports = (await get('/api/reports')).items; const protocols = (await get('/api/protocols?pageSize=10')).items ?? [];
const roth = cust('Roth'); const hart = cust('Hartmann');
const rothOrder = orders.find((o) => (o.order ?? o).customerId === roth.id); const oid = (rothOrder.order ?? rothOrder).id;
const paid = invoices.find((i) => (i.invoice ?? i).status === 'paid'); const invId = (paid.invoice ?? paid).id;
const shots = [
  ['/', 'd-dashboard', 'text=Guten Tag'], ['/leads', 'd-leads', 'text=Seidel'], [`/leads/${leads.find((l) => l.lastName === 'Seidel').id}`, 'd-lead-detail', 'text=Seidel'],
  ['/kunden', 'd-kunden', 'text=Hartmann'], [`/kunden/${hart.id}`, 'd-kunde-detail', 'text=Stammdaten'],
  [`/fahrzeuge/${vehicles.find((v) => (v.vehicle ?? v).licensePlate === 'N-MH 2021').vehicle?.id ?? vehicles.find((v) => (v.vehicle ?? v).licensePlate === 'N-MH 2021').id}`, 'd-fahrzeug', 'text=N-MH 2021'],
  ['/kalender', 'd-kalender', 'h1:has-text("Kalender")'], ['/auftraege', 'd-auftraege', 'h1:has-text("Aufträge")'], [`/auftraege/${oid}`, 'd-auftrag-detail', 'text=Keramikversiegelung 911'],
  ['/angebote', 'd-angebote', 'h1:has-text("Angebote")'], [`/angebote/${(offers[0].offer ?? offers[0]).id}`, 'd-angebot-detail', 'h1'],
  ['/rechnungen', 'd-rechnungen', 'h1:has-text("Rechnungen")'], [`/rechnungen/${invId}`, 'd-rechnung-detail', 'h1'],
  ['/lager', 'd-lager', 'h1:has-text("Lager")'], ['/finanzen', 'd-finanzen', 'h1:has-text("Finanzen")'], ['/marketing', 'd-marketing', 'h1:has-text("Marketing")'],
  ['/wettbewerber', 'd-wettbewerber', 'text=Glanzwerk'], ['/berichte', 'd-berichte', 'h1:has-text("Berichte")'], ['/assistent', 'd-assistent', 'h1:has-text("Business-Assistent")'],
  ['/aufgaben', 'd-aufgaben', 'h1:has-text("Aufgaben")'], ['/einstellungen', 'd-einstellungen', 'text=Branding'], ['/einstellungen/benutzer', 'd-benutzer', 'text=Berechtigungen'],
  ['/einstellungen/integrationen', 'd-integrationen', 'text=Windsor.ai'], ['/einstellungen/system', 'd-system', 'text=Letzte Sicherung'], ['/einstellungen/audit', 'd-audit', 'text=Audit-Log'], ['/betreiber', 'd-betreiber', 'h1:has-text("Mandanten")'],
];
for (const [path, name, sel] of shots) {
  await page.goto(base + path); await page.waitForSelector(sel, { timeout: 20000 });
  if (name === 'd-berichte') { await page.locator('.doc-row').first().click(); await page.waitForSelector('text=Kurzfassung:'); }
  if (name === 'd-marketing') await page.waitForTimeout(1200);
  await save(page, name);
}
// Kundenakte: Dokumente-Tab, Protokoll, Finanzen-Tabs
await page.goto(base + `/kunden/${hart.id}`); await page.waitForSelector('text=Stammdaten'); await page.locator('.tab:has-text("Dokumente")').click(); await page.waitForSelector('img', { timeout: 10000 }).catch(() => {}); await save(page, 'd-kunde-dokumente');
if (protocols.length) { const p = protocols[0].protocol ?? protocols[0]; await page.goto(base + `/protokolle/${p.id}`); await page.waitForSelector('text=Schäden', { timeout: 15000 }).catch(() => page.waitForSelector('h1')); await save(page, 'd-protokoll'); }
await page.goto(base + '/finanzen'); await page.waitForSelector('h1:has-text("Finanzen")'); await page.locator('.tab:has-text("Ausgaben")').click(); await page.waitForSelector('text=Ausgabe erfassen'); await save(page, 'd-ausgaben');
await page.locator('.tab:has-text("Preisanalyse")').click(); await page.waitForSelector('text=Stundenertrag'); await save(page, 'd-preisanalyse');
await page.goto(base + '/kalender'); await page.waitForSelector('h1:has-text("Kalender")'); const evt = page.locator('.cal-evt, .list-evt, .evt').first(); if (await evt.count()) { await evt.click(); await page.waitForTimeout(500); await save(page, 'd-termin-modal', { full: false }); }
// PDFs speichern (für Poppler-Rendering)
for (const [u, n] of [[`/api/invoices/${invId}/pdf`, 'rechnung'], [`/api/reports/${(reports[0]).id}/pdf`, 'bericht'], ...(protocols.length ? [[`/api/protocols/${(protocols[0].protocol ?? protocols[0]).id}/pdf`, 'protokoll']] : [])]) { const r = await page.request.get(base + u); if (r.ok()) fs.writeFileSync(`${OUT}/${n}.pdf`, await r.body()); else console.log('pdf', u, r.status()); }
// Smartphone
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
await mctx.addCookies(await ctx.cookies()); const mp = await mctx.newPage(); mp.on('pageerror', (e) => errors.push('m:' + e.message));
for (const [path, name, sel] of [['/', 'm-dashboard', 'text=Guten Tag'], ['/leads', 'm-leads', 'text=Seidel'], [`/leads/${leads.find((l) => l.lastName === 'Seidel').id}`, 'm-lead-detail', 'text=Seidel'], ['/kalender', 'm-kalender', 'h1:has-text("Kalender")'], ['/auftraege', 'm-auftraege', 'h1:has-text("Aufträge")'], [`/auftraege/${oid}`, 'm-auftrag-detail', 'text=Keramikversiegelung 911'], ['/rechnungen', 'm-rechnungen', 'h1:has-text("Rechnungen")'], ['/aufgaben', 'm-aufgaben', 'h1:has-text("Aufgaben")'], ['/marketing', 'm-marketing', 'h1:has-text("Marketing")'], ['/berichte', 'm-berichte', 'h1:has-text("Berichte")'], ['/lager', 'm-lager', 'h1:has-text("Lager")']]) {
  await mp.goto(base + path); await mp.waitForSelector(sel, { timeout: 20000 }); if (name === 'm-berichte') { await mp.locator('.doc-row').first().click(); await mp.waitForSelector('text=Kurzfassung:'); } if (name === 'm-marketing') await mp.waitForTimeout(1200); await save(mp, name, { maxH: 2600 });
}
await mp.goto(base + '/'); await mp.waitForSelector('text=Guten Tag'); await mp.locator('.menu-btn').click(); await mp.waitForTimeout(400); await save(mp, 'm-menu', { full: false });
await mctx.clearCookies(); await mp.goto(base + '/login'); await mp.waitForSelector('text=Carcura · Manager'); await save(mp, 'm-login', { full: false });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
