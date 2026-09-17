import { chromium } from 'playwright';
const S = process.env.SHOTS; const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = []; const errors = [];
async function checkOverflow(page, label) { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) issues.push(`${label}: Overflow ${r.sw} > ${r.cw}`); }
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

// Login-Seite mit Branding (ohne Anmeldung)
await page.goto(base + '/login'); await page.waitForSelector('h1:has-text("Anmelden")'); await page.waitForSelector('text=Carcura · Manager');
await checkOverflow(page, 'login-branding'); await shot(page, '80-login-branding');
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });

// Aufgaben
await page.goto(base + '/aufgaben'); await page.waitForSelector('h1:has-text("Aufgaben")'); await page.waitForSelector('text=Keine Aufgaben');
await page.locator('.page-head button:has-text("Aufgabe"), button:has-text("Aufgabe")').first().click(); await page.waitForSelector('text=Neue Aufgabe');
await page.fill('.modal input[placeholder^="z. B. Kunde"]', 'Rückruf Angebot Keramikversiegelung');
await page.locator('.modal button:has-text("Heute")').click();
await page.locator('.modal select').first().selectOption('high');
await page.locator('.modal button:has-text("Anlegen")').click();
await page.waitForSelector('td:has-text("Rückruf Angebot Keramikversiegelung")');
await page.locator('button:has-text("Aufgabe")').first().click(); await page.waitForSelector('text=Neue Aufgabe');
await page.fill('.modal input[placeholder^="z. B. Kunde"]', 'Lagerbestellung Politur');
await page.locator('.modal button:has-text("In 1 Woche")').click();
await page.locator('.modal button:has-text("Anlegen")').click();
await page.waitForSelector('td:has-text("Lagerbestellung Politur")');
await page.waitForTimeout(400); await checkOverflow(page, 'aufgaben'); await shot(page, '81-aufgaben');
await page.locator('tr:has-text("Lagerbestellung Politur") button[title="Erledigt"]').click();
await page.waitForSelector('.toast:has-text("erledigt")');
await page.locator('.tab:has-text("Erledigt")').click(); await page.waitForSelector('td:has-text("Lagerbestellung Politur")');
// Dashboard zeigt heutige Aufgabe
await page.goto(base + '/'); await page.waitForSelector('text=Aufgaben heute'); await page.waitForSelector('text=Rückruf Angebot Keramikversiegelung');
await shot(page, '82-dashboard-aufgaben');
// Kundenakte: Aufgaben-Panel
await page.goto(base + '/kunden'); await page.waitForSelector('h1:has-text("Kunden")'); await page.locator('tr.row-link').first().click(); await page.waitForSelector('text=Keine offenen Aufgaben');

// Import Kunden (CSV) mit Vorschau
await page.goto(base + '/kunden'); await page.waitForSelector('h1:has-text("Kunden")');
const before = (await page.request.get(base + '/api/customers')).ok() ? (await (await page.request.get(base + '/api/customers')).json()).total : 0;
await page.locator('button:has-text("Import")').click(); await page.waitForSelector('text=Kunden aus CSV importieren');
await page.setInputFiles('.modal input[type="file"]', { name: 'kunden.csv', mimeType: 'text/csv', buffer: Buffer.from('Vorname;Nachname;Firma;E-Mail;Telefon;PLZ;Ort;Kennzeichen;Marke\nImport;Testkunde;;import@example.de;0911 123456;90402;Nürnberg;N-IM 1;Audi\nDoppelt;Eintrag;;import@example.de;;;;;\n') });
await page.locator('.modal button:has-text("Vorschau prüfen")').click();
await page.waitForSelector('.modal .badge:has-text("1 neu")'); await page.waitForSelector('.modal .badge:has-text("1 übersprungen")');
await shot(page, '83-import-vorschau');
await page.locator('.modal button:has-text("1 importieren")').click();
await page.waitForSelector('.toast:has-text("importiert")');
const after = (await (await page.request.get(base + '/api/customers')).json()).total;
if (after !== before + 1) issues.push(`import: total ${before} -> ${after}`);
const csv = await page.request.get(base + '/api/export/customers.csv');
if (!csv.ok() || !(csv.headers()['content-type'] ?? '').includes('text/csv') || !(await csv.text()).includes('import@example.de')) issues.push('export csv fehlerhaft');
for (const u of ['/api/export/leads.csv', '/api/export/vehicles.csv', '/api/export/invoices.csv', '/api/export/expenses.csv', '/api/export/company.json']) { const r = await page.request.get(base + u); if (!r.ok()) issues.push(`${u}: ${r.status()}`); }

// Einstellungen: White-Label
await page.goto(base + '/einstellungen'); await page.waitForSelector('text=Produktname (White-Label)');
await page.fill('label:has-text("Produktname") ~ input', 'Werkstatt-Cockpit');
await page.fill('label:has-text("Herstellerhinweis") ~ input', 'powered by Carcura Software');
await page.locator('button[type="submit"]:has-text("Speichern")').click(); await page.waitForSelector('.toast:has-text("gespeichert")');
await page.waitForSelector('.brand-sub:has-text("Werkstatt-Cockpit")'); await page.waitForSelector('text=powered by Carcura Software');
await checkOverflow(page, 'einstellungen-whitelabel'); await shot(page, '84-whitelabel');

// System & Sicherung
await page.goto(base + '/einstellungen/system'); await page.waitForSelector('text=Letzte Sicherung');
await page.locator('button:has-text("Jetzt sichern")').click(); await page.waitForSelector('.toast:has-text("Sicherung erstellt")', { timeout: 60000 });
await page.waitForSelector('td:has-text("manuell")'); await page.waitForTimeout(500);
await checkOverflow(page, 'system'); await shot(page, '85-system');
const bl = await (await page.request.get(base + '/api/system/backups')).json();
if (!bl.items.length) issues.push('backup fehlt in Liste');
const dl = await page.request.get(base + `/api/system/backups/${bl.items[0].name}/download`);
if (!dl.ok() || (await dl.body()).length < 1000) issues.push('backup download fehlerhaft');
await page.locator('button[title="Wiederherstellen"]').first().click(); await page.waitForSelector('text=Sicherung wiederherstellen?');
await page.locator('.modal button:has-text("Wiederherstellen")').click();
await page.waitForSelector('text=Wiederherstellung vorgemerkt', { timeout: 30000 });
await shot(page, '86-restore-vorgemerkt');
await page.locator('button:has-text("Abbrechen")').first().click(); await page.waitForSelector('.toast:has-text("abgebrochen")');

// Betreiber
await page.goto(base + '/betreiber'); await page.waitForSelector('th:has-text("Kunden")'); await page.waitForTimeout(300); await checkOverflow(page, 'betreiber'); await shot(page, '87-betreiber');

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies()); const mp = await mctx.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
for (const [path, sel, name] of [['/aufgaben', 'h1:has-text("Aufgaben")', 'm-aufgaben'], ['/einstellungen/system', 'text=Letzte Sicherung', 'm-system'], ['/betreiber', 'h1:has-text("Mandanten")', 'm-betreiber'], ['/', 'text=Aufgaben heute', 'm-dashboard-aufgaben']]) {
  await mp.goto(base + path); await mp.waitForSelector(sel); await mp.waitForTimeout(800); await checkOverflow(mp, name); await shot(mp, name);
}
await mp.context().clearCookies(); await mp.goto(base + '/login'); await mp.waitForSelector('text=Carcura · Werkstatt-Cockpit'); await checkOverflow(mp, 'm-login'); await shot(mp, 'm-login-branding');
console.log('ISSUES', JSON.stringify(issues)); console.log('ERRORS', JSON.stringify(errors));
await browser.close();
