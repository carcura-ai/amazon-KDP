import { chromium } from 'playwright';
const S = process.env.SHOTS; const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = []; const errors = [];
async function checkOverflow(page, label) { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) issues.push(`${label}: Overflow ${r.sw} > ${r.cw}`); }
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });

// Berichte: leer -> erstellen -> anzeigen -> PDF
await page.goto(base + '/berichte'); await page.waitForSelector('h1:has-text("Berichte")'); await page.waitForSelector('text=Noch keine Berichte');
await checkOverflow(page, 'berichte-leer'); await shot(page, '70-berichte-leer');
await page.locator('label.check:has-text("laufende Periode") input').check();
await page.locator('button:has-text("Jetzt erstellen")').click();
await page.waitForSelector('text=Kurzfassung:', { timeout: 60000 });
await page.waitForSelector('.doc-row');
await page.waitForTimeout(500); await checkOverflow(page, 'berichte-detail'); await shot(page, '71-berichte-detail');
const pdfHref = await page.locator('.doc-row a[href^="/api/reports/"]').first().getAttribute('href');
const pdf = await page.request.get(base + pdfHref); const ct = pdf.headers()['content-type'] ?? '';
if (!pdf.ok() || !ct.includes('application/pdf')) issues.push(`bericht-pdf: status ${pdf.status()} type ${ct}`);
else { const buf = await pdf.body(); if (buf.length < 5000) issues.push(`bericht-pdf: nur ${buf.length} bytes`); }
// Monatsbericht zusätzlich
await page.locator('h1:has-text("Berichte") ~ * select, .page-head select').first().selectOption('monthly').catch(() => {});
await page.locator('button:has-text("Jetzt erstellen")').click();
await page.waitForFunction(() => document.querySelectorAll('.doc-row').length >= 2, null, { timeout: 60000 });

// Assistent: nicht eingerichtet
await page.goto(base + '/assistent'); await page.waitForSelector('h1:has-text("Business-Assistent")'); await page.waitForSelector('text=Assistent noch nicht eingerichtet');
await checkOverflow(page, 'assistent-leer'); await shot(page, '72-assistent-nicht-eingerichtet');

// Einstellungen: Claude-Key hinterlegen, Places-Karte sichtbar
await page.goto(base + '/einstellungen/integrationen'); await page.waitForSelector('text=KI-Business-Assistent (Claude)'); await page.waitForSelector('text=Wettbewerber-Monitoring (Google Places API)');
await page.locator('.card:has-text("KI-Business-Assistent") button:has-text("Einrichten")').click();
await page.fill('.card:has-text("KI-Business-Assistent") input[type="password"]', 'sk-ant-test-ungueltig-0000');
await page.locator('.card:has-text("KI-Business-Assistent") button:has-text("Speichern")').click();
await page.waitForSelector('.card:has-text("KI-Business-Assistent") .badge:has-text("eingerichtet")');
await checkOverflow(page, 'integrationen-ki'); await shot(page, '73-integrationen-ki');

// Assistent: Frage stellen -> Fehler (ungültiger Key) muss sauber angezeigt werden
await page.goto(base + '/assistent'); await page.waitForSelector('text=Was möchtest du wissen?');
await page.fill('input[placeholder^="Frage stellen"]', 'Wie lief die letzte Woche?');
await page.locator('form button[type="submit"]').click();
await page.waitForSelector('.toast', { timeout: 90000 });
await page.waitForTimeout(300); await shot(page, '74-assistent-fehler');

// Wettbewerber: manuell anlegen, als eigenen markieren
await page.goto(base + '/wettbewerber'); await page.waitForSelector('h1:has-text("Wettbewerber")'); await page.waitForSelector('text=Noch keine Wettbewerber');
await page.locator('button:has-text("Manuell")').click(); await page.waitForSelector('text=Wettbewerber manuell anlegen');
await page.fill('label:has-text("Name *") + input, .modal label:has-text("Name") ~ input', 'Glanzwerk Autopflege');
await page.fill('.modal label:has-text("Adresse") ~ input', 'Musterstraße 12, 90402 Nürnberg');
await page.fill('.modal label:has-text("Website") ~ input', 'https://glanzwerk-beispiel.de');
await page.fill('.modal label:has-text("Bewertung") ~ input', '4,6');
await page.fill('.modal label:has-text("Rezensionen") ~ input', '38');
await page.locator('.modal button:has-text("Anlegen")').click();
await page.waitForSelector('td:has-text("Glanzwerk Autopflege")');
await page.locator('button:has-text("Manuell")').click(); await page.waitForSelector('text=Wettbewerber manuell anlegen');
await page.fill('.modal label:has-text("Name") ~ input', 'Carcura Fahrzeugaufbereitung');
await page.fill('.modal label:has-text("Bewertung") ~ input', '5');
await page.fill('.modal label:has-text("Rezensionen") ~ input', '12');
await page.locator('.modal button:has-text("Anlegen")').click();
await page.waitForSelector('td:has-text("Carcura Fahrzeugaufbereitung")');
await page.locator('tr:has-text("Carcura Fahrzeugaufbereitung") button:has-text("eigener")').click();
await page.waitForFunction(() => document.body.innerText.includes('12 Rezensionen'));
await page.waitForTimeout(300); await checkOverflow(page, 'wettbewerber'); await shot(page, '75-wettbewerber');

// Preisanalyse
await page.goto(base + '/finanzen'); await page.waitForSelector('h1:has-text("Finanzen")');
await page.locator('button:has-text("Preisanalyse")').click();
await page.waitForSelector('text=Nicht genügend Daten', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500); await checkOverflow(page, 'preisanalyse'); await shot(page, '76-preisanalyse');

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies()); const mp = await mctx.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
for (const [path, sel, name] of [['/berichte', 'h1:has-text("Berichte")', 'm-berichte'], ['/assistent', 'h1:has-text("Business-Assistent")', 'm-assistent'], ['/wettbewerber', 'h1:has-text("Wettbewerber")', 'm-wettbewerber']]) {
  await mp.goto(base + path); await mp.waitForSelector(sel); await mp.waitForTimeout(800); await checkOverflow(mp, name); await shot(mp, name);
}
await mp.goto(base + '/berichte'); await mp.waitForSelector('.doc-row'); await mp.locator('.doc-row').first().click(); await mp.waitForSelector('text=Kurzfassung:'); await mp.waitForTimeout(500); await checkOverflow(mp, 'm-bericht-detail'); await shot(mp, 'm-bericht-detail');
await mp.goto(base + '/finanzen'); await mp.waitForSelector('h1:has-text("Finanzen")'); await mp.locator('button:has-text("Preisanalyse")').click(); await mp.waitForTimeout(800); await checkOverflow(mp, 'm-preisanalyse'); await shot(mp, 'm-preisanalyse');
console.log('ISSUES', JSON.stringify(issues)); console.log('ERRORS', JSON.stringify(errors));
await browser.close();
