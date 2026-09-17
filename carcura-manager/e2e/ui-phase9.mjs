import { chromium } from 'playwright';
import fs from 'node:fs';
const S = process.env.SHOTS;
const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = []; const errors = [];
async function checkOverflow(page, label) { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) issues.push(`${label}: Overflow ${r.sw} > ${r.cw}`); }
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });

// Angebot aus Kundenakte
await page.goto(base + '/kunden'); await page.click('text=Max Mustermann');
await page.click('.card:has(h2:has-text("Angebote")) a.btn');
await page.waitForSelector('h1:has-text("Neues Angebot")');
await page.fill('label:has-text("Titel") + input', 'Keramikversiegelung Paket');
await page.click('button:has-text("Keramikversiegelung")');
await page.locator('.items-editor input[inputmode="decimal"]').nth(0).fill('899');
await checkOverflow(page, 'angebot-form'); await shot(page, '40-angebot-form');
await page.click('button:has-text("Angebot erstellen")');
await page.waitForSelector('h1:has-text("AN-")');
await checkOverflow(page, 'angebot-detail'); await shot(page, '41-angebot-detail');
const opdf = await page.request.get(base + (await page.locator('a:has-text("PDF")').getAttribute('href')));
if (opdf.status() !== 200) issues.push('Angebots-PDF ' + opdf.status()); else fs.writeFileSync(`${S}/angebot.pdf`, await opdf.body());
// Senden ohne SMTP -> Fehlermeldung erwartet
await page.click('button:has-text("Senden")');
await page.click('.modal button:has-text("Senden")');
await page.waitForSelector('.toast.error');
await page.keyboard.press('Escape');
// Annehmen + Auftrag erstellen
await page.click('button:has-text("Angenommen")');
await page.waitForSelector('.badge:has-text("Angenommen")');
await page.click('button:has-text("Auftrag erstellen")');
await page.waitForSelector('h1:has-text("AU-")');
// Rechnung aus Auftrag
await page.click('button:has-text("Rechnung")');
await page.waitForSelector('h1:has-text("Rechnungsentwurf")');
await checkOverflow(page, 'rechnung-entwurf'); await shot(page, '42-rechnung-entwurf');
await page.click('button:has-text("Ausstellen")');
await page.click('.modal button:has-text("Ausstellen")');
await page.waitForSelector('h1:has-text("RE-")');
await checkOverflow(page, 'rechnung'); await shot(page, '43-rechnung');
const ipdf = await page.request.get(base + (await page.locator('a:has-text("PDF")').getAttribute('href')));
if (ipdf.status() !== 200) issues.push('Rechnungs-PDF ' + ipdf.status()); else fs.writeFileSync(`${S}/rechnung.pdf`, await ipdf.body());
// Teilzahlung
await page.click('button:has-text("Zahlung")');
await page.fill('.modal label:has-text("Betrag") + input', '500');
await page.click('.modal button:has-text("Erfassen")');
await page.waitForSelector('text=Zahlung erfasst');
await page.waitForSelector('td:has-text("500,00")');
// Restzahlung
await page.click('button:has-text("Zahlung")');
await page.click('.modal button:has-text("Erfassen")');
await page.waitForSelector('.badge:has-text("Bezahlt")');
await shot(page, '44-rechnung-bezahlt');
// Listen + Dashboard
await page.goto(base + '/rechnungen'); await page.waitForSelector('td.mono:has-text("RE-")'); await checkOverflow(page, 'rechnungen'); await shot(page, '45-rechnungen');
await page.goto(base + '/angebote'); await page.waitForSelector('td.mono:has-text("AN-")'); await shot(page, '46-angebote');
await page.goto(base + '/'); await page.waitForSelector('text=Umsatz heute'); await checkOverflow(page, 'dashboard'); await shot(page, '47-dashboard');
const total = await page.locator('.kpi:has-text("Umsatz heute") .value').textContent();
if (!total.includes('1.069,81')) issues.push('Dashboard-Umsatz falsch: ' + total); // 899 * 1,19
// Mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies());
const mp = await mctx.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
for (const [path, name, wait] of [['/rechnungen', 'm-rechnungen', 'td.mono'], ['/angebote', 'm-angebote', 'td.mono'], ['/', 'm-dashboard3', 'text=Umsatz heute']]) { await mp.goto(base + path); await mp.waitForSelector(wait); await checkOverflow(mp, name); await shot(mp, name); }
await mp.goto(base + '/rechnungen'); await mp.click('td.mono >> nth=0'); await mp.waitForSelector('h1:has-text("RE-")'); await checkOverflow(mp, 'm-rechnung'); await shot(mp, 'm-rechnung');
console.log('ISSUES', JSON.stringify(issues)); console.log('ERRORS', JSON.stringify(errors));
await browser.close();
