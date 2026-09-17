import { chromium } from 'playwright';
const S = process.env.SHOTS;
const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = [];
const errors = [];
async function checkOverflow(page, label) { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) issues.push(`${label}: Overflow ${r.sw} > ${r.cw}`); }
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });

// Kalender: Termin über Wochenansicht anlegen
await page.goto(base + '/kalender');
await page.waitForSelector('h1:has-text("Kalender")');
await page.click('button:has-text("Termin")');
await page.fill('.modal input[placeholder^="Kunde suchen"]', 'Muster');
await page.waitForSelector('.modal .search-hit .title');
await page.click('.modal .search-hit >> nth=0');
await page.waitForSelector('.modal select >> nth=0');
await page.selectOption('.modal select >> nth=0', { index: 1 }); // Fahrzeug
await page.selectOption('.modal select >> nth=1', { index: 1 }); // Mitarbeiter
await page.fill('.modal label:has-text("Titel *") + input', 'Komplettaufbereitung Audi');
const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
const p = (n) => String(n).padStart(2, '0');
const local = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
await page.fill('.modal label:has-text("Beginn") + input', local);
await page.click('.modal button:has-text("Anlegen")');
await page.waitForSelector('text=Termin angelegt');
await page.waitForSelector('.evt:has-text("Komplettaufbereitung Audi")');
await checkOverflow(page, 'kalender-woche');
await shot(page, '20-kalender-woche');
await page.click('.seg button:has-text("Monat")');
await page.waitForSelector('.month-grid');
await shot(page, '21-kalender-monat');
await page.click('.seg button:has-text("Liste")');
await page.waitForSelector('.list-evt');
await shot(page, '22-kalender-liste');

// Termin öffnen -> Auftrag anlegen
await page.click('.list-evt >> nth=0');
await page.waitForSelector('.modal h2:has-text("Termin")');
await shot(page, '23-termin-modal');
await page.click('.modal button:has-text("Auftrag anlegen")');
await page.waitForSelector('h1:has-text("Neuer Auftrag")');
await page.click('button:has-text("Innenreinigung Intensiv")');
await page.click('button:has-text("Lackpolitur einstufig")');
const prices = page.locator('.items-editor input[inputmode="decimal"]');
await prices.nth(0).fill('189');
await prices.nth(1).fill('349,50');
await checkOverflow(page, 'auftrag-formular');
await shot(page, '24-auftrag-formular');
await page.click('button:has-text("Auftrag anlegen")');
await page.waitForSelector('text=AU-');
await page.waitForSelector('.flow .step.current');
await checkOverflow(page, 'auftrag-detail');
await shot(page, '25-auftrag-detail');
const total = await page.locator('.totals .l.total span >> nth=1').textContent();
if (!total.includes('640,82')) issues.push('Auftragssumme falsch: ' + total); // (189+349,50)*1,19 = 640,815
await page.click('button:has-text("Angenommen")');
await page.waitForSelector('text=Status aktualisiert');
await page.click('button:has-text("In Bearbeitung")');
await page.waitForSelector('.step.current:has-text("In Bearbeitung")');
await page.goto(base + '/auftraege');
await page.waitForSelector('td.mono:has-text("AU-")');
await shot(page, '26-auftraege');

// Dashboard mit Terminen/Aufträgen
await page.goto(base + '/');
await page.waitForSelector('text=Kommende Termine');
await page.waitForSelector('text=Komplettaufbereitung Audi');
await checkOverflow(page, 'dashboard');
await shot(page, '27-dashboard');

// SMTP-Einstellungen
await page.goto(base + '/einstellungen/email');
await page.waitForSelector('h2:has-text("SMTP-Zugangsdaten")');
await shot(page, '28-smtp');

// Kundenakte mit Terminen/Aufträgen
await page.goto(base + '/kunden');
await page.click('text=Max Mustermann');
await page.waitForSelector('text=AU-');
await shot(page, '29-kunde-mit-auftrag');

// Mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies());
const mp = await mctx.newPage();
mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
for (const [path, name, wait] of [['/kalender', 'm-kalender', '.list-evt'], ['/auftraege', 'm-auftraege', 'td.mono'], ['/', 'm-dashboard2', 'text=Kommende Termine']]) {
  await mp.goto(base + path); await mp.waitForSelector(wait); await checkOverflow(mp, name); await shot(mp, name);
}
await mp.goto(base + '/kalender'); await mp.waitForSelector('.list-evt'); await mp.click('.list-evt >> nth=0');
await mp.waitForSelector('.modal');
await checkOverflow(mp, 'm-termin-modal');
await shot(mp, 'm-termin-modal');
await mp.goto(base + '/auftraege'); await mp.click('td.mono >> nth=0'); await mp.waitForSelector('.flow'); await checkOverflow(mp, 'm-auftrag'); await shot(mp, 'm-auftrag');
await mp.goto(base + '/kalender'); await mp.click('.seg button:has-text("Woche")'); await mp.waitForTimeout(500); await checkOverflow(mp, 'm-kalender-woche'); await shot(mp, 'm-kalender-woche');
console.log('ISSUES', JSON.stringify(issues));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
