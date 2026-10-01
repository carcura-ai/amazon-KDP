/**
 * Oberflächentest Belegimport: Ersteinrichtung, Ausgangsrechnungen (ZUGFeRD-PDF) hochladen,
 * Kunde automatisch angelegt, Eingangsrechnung (XRechnung) als Ausgabe, Foto → manuelle Prüfung,
 * Desktop- und Smartphone-Ansicht ohne horizontales Scrollen.
 * Aufruf: SHOTS=<ordner> FIXTURES=<ordner> node e2e/ui-belegimport.mjs (Server auf 127.0.0.1:4800)
 */
import { chromium } from 'playwright';
const S = process.env.SHOTS;
const F = process.env.FIXTURES;
const base = process.env.BASE ?? 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = [];
const consoleErrors = [];
const check = (cond, msg) => { if (!cond) issues.push(msg); };
async function overflow(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (r.sw > r.cw + 1) issues.push(`${label}: horizontaler Overflow ${r.sw} > ${r.cw}`);
}
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(base);
await page.waitForSelector('text=Ersteinrichtung');
await page.fill('input[placeholder="z. B. Carcura"]', 'Carcura GbR');
await page.locator('label:has-text("Vorname *") + input').fill('Alex');
await page.locator('label:has-text("Nachname *") + input').fill('Fuchs');
await page.locator('label:has-text("E-Mail (Anmeldename) *") + input').fill('admin@carcura.info');
await page.locator('label:has-text("Passwort *") + input').first().fill('Carcura-2026x');
await page.locator('label:has-text("Passwort wiederholen *") + input').fill('Carcura-2026x');
await page.click('button:has-text("Einrichtung abschließen")');
await page.waitForSelector('text=Guten Tag, Alex', { timeout: 15000 });

// Navigation → Belege importieren
await page.click('a:has-text("Belege importieren")');
await page.waitForSelector('h1:has-text("Belege importieren")');
await shot(page, 'b01-leer');
// Ausgangsrechnungen hochladen (zwei Dateien gleichzeitig)
await page.setInputFiles('input[type=file][multiple]', [`${F}/RE0042.pdf`, `${F}/RE0043.pdf`]);
await page.waitForSelector('tr:has-text("RE0042") >> text=Übernommen >> visible=true', { timeout: 20000 });
await page.waitForSelector('tr:has-text("RE0043") >> text=Übernommen >> visible=true', { timeout: 20000 });
await overflow(page, 'belege-desktop');
await shot(page, 'b02-ausgang-uebernommen');
// Detail öffnen → Kunde neu angelegt, Links vorhanden
await page.click('tr:has-text("RE0043")');
await page.waitForSelector('.modal >> text=Übernommen am');
check(await page.locator('.modal >> text=Autohaus Becker GmbH').count() > 0, 'Detail: Kunde Autohaus Becker fehlt');
check(await page.locator('.modal >> text=neu angelegt').count() > 0, 'Detail: Hinweis „neu angelegt“ fehlt');
await shot(page, 'b03-detail');
await page.click('.modal a:has-text("Autohaus Becker GmbH")');
await page.waitForSelector('text=Autohaus Becker GmbH');
await page.waitForTimeout(800);
check(await page.locator('text=Hachenburg').count() > 0, 'Kundenprofil: Ort fehlt');
await shot(page, 'b04-kundenprofil');
// Rechnungsliste enthält beide
await page.click('a:has-text("Rechnungen")');
await page.waitForSelector('text=RE0042');
check(await page.locator('text=RE0043').count() > 0, 'Rechnungsliste: RE0043 fehlt');
await page.click('text=RE0042');
await page.waitForSelector('text=Importierte Rechnung');
await shot(page, 'b05-rechnung');

// Eingangsrechnungen
await page.click('a:has-text("Belege importieren")');
await page.click('button[role=tab]:has-text("Eingangsrechnungen")');
await page.setInputFiles('input[type=file][multiple]', [`${F}/LS-2026-0815.xml`, `${F}/kassenbon.jpg`]);
await page.waitForSelector('tr:has-text("LS-2026-0815") >> text=Übernommen >> visible=true', { timeout: 20000 });
await page.waitForSelector('tr:has-text("kassenbon.jpg") >> text=Prüfen >> visible=true', { timeout: 20000 });
await shot(page, 'b06-eingang');
// Foto manuell erfassen und übernehmen
await page.click('tr:has-text("kassenbon.jpg")');
await page.waitForSelector('.modal >> text=Prüfen und übernehmen');
await page.locator('.modal label:has-text("Lieferant *") + input').fill('Baumarkt Weber');
await page.locator('.modal label:has-text("Rechnungs-/Belegnummer") + input').fill('Q-1');
await page.locator('.modal label:has-text("Rechnungsdatum *") + input').fill('2026-09-25');
await page.locator('.modal label:has-text("MwSt.-Satz") + select').selectOption('19');
const gross = page.locator('.modal label:has-text("Brutto (€) *") + input');
await gross.fill('23,80'); await gross.blur();
// Netto und MwSt. werden aus Brutto und Steuersatz berechnet
await page.waitForTimeout(200);
check(await page.locator('.modal label:has-text("Netto (€)") + input').inputValue() === '20,00', 'Prüfen: Netto nicht automatisch berechnet');
check(await page.locator('.modal label:has-text("MwSt. (€)") + input').inputValue() === '3,80', 'Prüfen: MwSt. nicht automatisch berechnet');
await shot(page, 'b07-pruefen');
await page.click('.modal button:has-text("Prüfen und übernehmen")');
await page.waitForSelector('tr:has-text("Q-1") >> text=Übernommen >> visible=true', { timeout: 10000 });
// Finanzen zeigen die Ausgaben mit Beleg
await page.click('a:has-text("Finanzen")');
await page.click('button[role=tab]:has-text("Ausgaben")');
await page.fill('input[type=date] >> nth=0', '2026-09-01');
await page.waitForSelector('text=PflegeProfi Handels GmbH');
check(await page.locator('text=Baumarkt Weber').count() > 0, 'Finanzen: Ausgabe Baumarkt fehlt');
check(await page.locator('a:has-text("Beleg öffnen")').count() >= 2, 'Finanzen: Beleg-Links fehlen');
await shot(page, 'b08-finanzen');

// Smartphone-Ansicht
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', storageState: await ctx.storageState() });
const mp = await m.newPage();
mp.on('pageerror', (e) => consoleErrors.push('mobile pageerror: ' + e.message));
await mp.goto(`${base}/belege`);
await mp.waitForSelector('h1:has-text("Belege importieren")');
check(await mp.locator('button:has-text("Foto aufnehmen")').isVisible(), 'Mobil: „Foto aufnehmen“ nicht sichtbar');
await overflow(mp, 'belege-mobil');
await mp.screenshot({ path: `${S}/b09-mobil.png`, fullPage: true });
await mp.click('tr:has-text("RE0042")');
await mp.waitForSelector('.modal >> text=Übernommen am');
await overflow(mp, 'belege-mobil-detail');
await mp.screenshot({ path: `${S}/b10-mobil-detail.png`, fullPage: false });

await browser.close();
console.log(JSON.stringify({ issues, consoleErrors }, null, 2));
process.exit(issues.length || consoleErrors.length ? 1 : 0);
