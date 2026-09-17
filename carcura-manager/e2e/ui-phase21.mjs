import { chromium } from 'playwright';
import { totpCode } from '../server/dist/core/totp.js';
const S = process.env.SHOTS; const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const issues = []; const errors = [];
async function checkOverflow(page, label) { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) issues.push(`${label}: Overflow ${r.sw} > ${r.cw}`); }
const shot = (page, name) => page.screenshot({ path: `${S}/${name}.png`, fullPage: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });

// Konto & Datenschutz: 2FA einrichten
await page.goto(base + '/einstellungen/konto'); await page.waitForSelector('text=Zwei-Faktor-Authentifizierung (2FA)');
await checkOverflow(page, 'konto'); await shot(page, '90-konto');
await page.locator('button:has-text("2FA einrichten")').click(); await page.waitForSelector('svg');
const secret = (await page.locator('span.mono').first().textContent()).trim();
await page.fill('input[placeholder="123456"]', totpCode(secret));
await page.locator('button:has-text("Aktivieren")').click();
await page.waitForSelector('text=Wiederherstellungscodes');
const codes = await page.locator('.mono span').allTextContents();
if (codes.length !== 10) issues.push(`backup codes: ${codes.length}`);
await shot(page, '91-2fa-codes');
await page.locator('button:has-text("Ich habe die Codes gesichert")').click();
await page.waitForSelector('.badge:has-text("aktiv")');

// Datenschutz-Einstellungen speichern
await page.locator('label:has-text("Zwei-Faktor-Authentifizierung für Administratoren erzwingen") input').check();
await page.locator('button[type="submit"]:has-text("Speichern")').last().click(); await page.waitForSelector('.toast:has-text("Datenschutz-Einstellungen gespeichert")');
await page.locator('button:has-text("Aufbewahrungslauf jetzt ausführen")').click(); await page.waitForSelector('.toast:has-text("Aufbewahrungslauf")');
await shot(page, '92-datenschutz');

// Abmelden, Anmeldung mit zweitem Faktor
await page.request.post(base + '/api/auth/logout');
await page.goto(base + '/login'); await page.waitForSelector('h1:has-text("Anmelden")');
await page.fill('input[type="email"]', 'admin@carcura.info'); await page.fill('input[type="password"]', 'Carcura-2026x'); await page.click('button[type="submit"]');
await page.waitForSelector('text=Zweiter Faktor'); await checkOverflow(page, 'login-2fa'); await shot(page, '93-login-2fa');
await page.fill('input[autocomplete="one-time-code"]', '000000'); await page.click('button[type="submit"]'); await page.waitForSelector('text=ungültig');
await page.fill('input[autocomplete="one-time-code"]', totpCode(secret)); await page.click('button[type="submit"]'); await page.waitForSelector('text=Guten Tag');

// Kunde anonymisieren (mit Rechnung) – Erika Beispiel hat aus ui-phase9 eine Rechnung
await page.goto(base + '/kunden'); await page.waitForSelector('h1:has-text("Kunden")');
await page.locator('tr.row-link:has-text("Max Mustermann")').first().click(); await page.waitForSelector('text=Stammdaten');
const dossier = await page.request.get(base + page.url().replace(base, '').replace('/kunden/', '/api/customers/') + '/dossier');
if (!dossier.ok() || !(await dossier.json()).purpose) issues.push('dossier fehlt');
await page.locator('.page-head button.danger, button.btn.danger').first().click(); await page.waitForSelector('text=Löschung nach Art. 17 DSGVO');
await shot(page, '94-loeschen-dialog');
await page.locator('.modal button:has-text("Endgültig löschen")').click(); await page.waitForSelector('.toast:has-text("anonymisiert")');
await page.waitForSelector('h1:has-text("Kunden")');
const list = await (await page.request.get(base + '/api/customers?includeInactive=true&q=Gel%C3%B6schter')).json();
if (!list.items.some((c) => c.firstName === 'Gelöschter')) issues.push('anonymisierter Kunde fehlt in Liste');

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies()); const mp = await mctx.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await mp.goto(base + '/einstellungen/konto'); await mp.waitForSelector('text=Zwei-Faktor-Authentifizierung (2FA)'); await mp.waitForTimeout(600); await checkOverflow(mp, 'm-konto'); await shot(mp, 'm-konto');
await mctx.clearCookies(); await mp.goto(base + '/login'); await mp.fill('input[type="email"]', 'admin@carcura.info'); await mp.fill('input[type="password"]', 'Carcura-2026x'); await mp.click('button[type="submit"]'); await mp.waitForSelector('text=Zweiter Faktor'); await checkOverflow(mp, 'm-login-2fa'); await shot(mp, 'm-login-2fa');
console.log('ISSUES', JSON.stringify(issues)); console.log('ERRORS', JSON.stringify(errors));
await browser.close();
