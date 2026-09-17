import { chromium } from 'playwright';
const S = process.env.SHOTS;
const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = [];
const consoleErrors = [];
async function checkOverflow(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (r.sw > r.cw + 1) issues.push(`${label}: horizontaler Overflow ${r.sw} > ${r.cw}`);
}
async function shot(page, name) { await page.screenshot({ path: `${S}/${name}.png`, fullPage: true }); }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

// 1) Setup
await page.goto(base);
await page.waitForSelector('text=Ersteinrichtung');
await shot(page, '01-setup');
await page.fill('input[placeholder="z. B. Carcura"]', 'Carcura');
await page.fill('input[type=email] >> nth=0', 'info@carcura.info');
const admins = page.locator('form input');
await page.locator('label:has-text("Vorname *") + input').fill('Alex');
await page.locator('label:has-text("Nachname *") + input').fill('Fuchs');
await page.locator('label:has-text("E-Mail (Anmeldename) *") + input').fill('admin@carcura.info');
await page.locator('label:has-text("Passwort *") + input').first().fill('Carcura-2026x');
await page.locator('label:has-text("Passwort wiederholen *") + input').fill('Carcura-2026x');
await page.click('button:has-text("Einrichtung abschließen")');
await page.waitForSelector('text=Guten Tag, Alex', { timeout: 15000 });
await checkOverflow(page, 'dashboard');
await shot(page, '02-dashboard-leer');

// 2) Lead anlegen über UI
await page.click('a:has-text("Leads")');
await page.waitForSelector('h1:has-text("Leads")');
await page.click('button:has-text("Lead anlegen")');
await page.locator('.modal label:has-text("Vorname") + input').fill('Max');
await page.locator('.modal label:has-text("Nachname") + input').fill('Mustermann');
await page.locator('.modal label:has-text("Telefon") + input').fill('0171 1234567');
await page.locator('.modal label:has-text("E-Mail") + input').fill('max@example.de');
await page.locator('.modal label:has-text("Gewünschte Leistung") + input').fill('Komplettaufbereitung');
await page.locator('.modal label:has-text("Fahrzeug (Text)") + input').fill('Audi A4 Avant');
await page.click('.modal button:has-text("Anlegen")');
await page.waitForSelector('h1:has-text("Max Mustermann")');
await checkOverflow(page, 'lead-detail');
await shot(page, '03-lead-detail');

// 3) Website-Lead per API (Token aus Einstellungen)
const tokenRes = await page.request.get(base + '/api/company/website-lead-token');
const { token } = await tokenRes.json();
const wl = await page.request.post(base + '/api/public/leads/website', { headers: { 'x-lead-token': token }, data: { name: 'Erika Beispiel', email: 'erika@example.de', phone: '0221 555 123', vehicle: 'VW Golf', service: 'Innenreinigung Intensiv', message: 'Bitte Rückruf', customer_type: 'privat', source: 'anfrage_formular', channel: 'web', gclid: 'abc123', website: '' } });
if (!(await wl.json()).ok) issues.push('Website-Lead nicht angenommen');

// 4) Status ändern + Umwandeln
await page.selectOption('select >> nth=0', 'contacted');
await page.waitForSelector('text=Status aktualisiert');
await page.click('button:has-text("In Kunde umwandeln")');
await page.click('.modal button:has-text("Neuen Kunden anlegen")');
await page.waitForSelector('h1:has-text("Max Mustermann")');
await page.waitForSelector('text=KD-000001');
await checkOverflow(page, 'customer-detail');
await shot(page, '04-kunde');

// 5) Fahrzeug hinzufügen
await page.click('.card:has(h2:has-text("Fahrzeuge")) button');
await page.locator('.modal label:has-text("Kennzeichen") + input').fill('K-MM 2024');
await page.locator('.modal label:has-text("Marke") + input').fill('Audi');
await page.locator('.modal label:has-text("Modell") + input').fill('A4 Avant');
await page.locator('.modal label:has-text("Baujahr") + input').fill('2021');
await page.locator('.modal label:has-text("Kilometerstand") + input').fill('48000');
await page.click('.modal button:has-text("Hinzufügen")');
await page.waitForSelector('text=Fahrzeug angelegt');
await page.waitForSelector('text=K-MM 2024');
await page.click('button:has-text("Historie")');
await shot(page, '05-kunde-historie');

// 6) Suche
await page.fill('input[type=search]', 'K-MM');
await page.waitForSelector('.search-hit .title');
await shot(page, '06-suche');
await page.keyboard.press('Enter');
await page.waitForSelector('h1:has-text("Audi A4 Avant")');
await checkOverflow(page, 'vehicle-detail');

// 7) Leads-Liste, Kundenliste, Einstellungen
await page.goto(base + '/leads');
await page.waitForSelector('text=Erika Beispiel');
await checkOverflow(page, 'leads-list');
await shot(page, '07-leads');
await page.goto(base + '/einstellungen');
await page.waitForSelector('h2:has-text("Branding")');
await checkOverflow(page, 'settings');
await shot(page, '08-einstellungen');
await page.goto(base + '/einstellungen/benutzer');
await page.waitForSelector('h2:has-text("Berechtigungen je Rolle")');
await checkOverflow(page, 'settings-users');
await shot(page, '09-benutzer');
await page.goto(base + '/einstellungen/leistungen');
await page.waitForSelector('text=Innenreinigung Basis');
await shot(page, '10-leistungen');
await page.goto(base + '/');
await page.waitForSelector('text=Zuletzt eingegangene Leads');
await page.waitForSelector('text=Erika Beispiel');
await shot(page, '11-dashboard');

// 8) Mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies());
const mp = await mctx.newPage();
mp.on('pageerror', (e) => consoleErrors.push('mobile pageerror: ' + e.message));
for (const [path, name, wait] of [['/', 'm-dashboard', 'text=Guten Tag'], ['/leads', 'm-leads', 'text=Erika Beispiel'], ['/kunden', 'm-kunden', 'text=Max Mustermann'], ['/einstellungen', 'm-einstellungen', 'text=Branding']]) {
  await mp.goto(base + path);
  await mp.waitForSelector(wait);
  await checkOverflow(mp, name);
  await shot(mp, name);
}
await mp.goto(base + '/kunden');
await mp.waitForSelector('text=Max Mustermann');
await mp.click('text=Max Mustermann');
await mp.waitForSelector('text=KD-000001');
await checkOverflow(mp, 'm-kunde');
await shot(mp, 'm-kunde');
await mp.click('button[aria-label="Menü"]');
await mp.waitForTimeout(400);
await shot(mp, 'm-menu');

// 9) Logout & Login
await page.click('button[aria-label="Abmelden"]');
await page.waitForSelector('h1:has-text("Anmelden")');
await shot(page, '12-login');
await page.fill('input[type=email]', 'admin@carcura.info');
await page.fill('input[type=password]', 'falsch');
await page.click('button:has-text("Anmelden")');
await page.waitForSelector('text=E-Mail oder Passwort ist falsch');
await page.fill('input[type=password]', 'Carcura-2026x');
await page.click('button:has-text("Anmelden")');
await page.waitForSelector('text=Guten Tag, Alex');

console.log('ISSUES', JSON.stringify(issues));
console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
await browser.close();
