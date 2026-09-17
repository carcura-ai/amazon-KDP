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
// Testbild erzeugen (PNG 1x1 reicht nicht für sharp-Vorschau? doch, sharp verarbeitet es)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync(`${S}/test.png`, png);

// Kundenakte -> Dokumente hochladen
await page.goto(base + '/kunden');
await page.click('text=Max Mustermann');
await page.click('button:has-text("Dokumente & Bilder")');
await page.waitForSelector('.dropzone');
await page.setInputFiles('.dropzone input[type=file]', `${S}/test.png`);
await page.waitForSelector('.thumb img');
await checkOverflow(page, 'kunde-dokumente');
await shot(page, '30-kunde-dokumente');

// Protokoll anlegen
await page.click('button:has-text("Protokolle")');
await page.click('a:has-text("Annahme")');
await page.waitForSelector('h1:has-text("Annahmeprotokoll")');
await page.fill('label:has-text("Kilometerstand") + input', '48500');
await page.selectOption('label:has-text("Zustand außen") + select', 'leicht verschmutzt');
await page.click('label:has-text("Warndreieck")');
// Schaden in die Skizze klicken
const svg = page.locator('.sketch svg');
await svg.scrollIntoViewIfNeeded();
const box = await svg.boundingBox();
await svg.click({ position: { x: box.width * 0.2, y: box.height * 0.3 } });
await page.waitForSelector('.sketch .mark');
await page.fill('input[placeholder="Beschreibung"]', 'Kratzer Kotflügel vorne links');
await page.fill('textarea', 'Kunde bestätigt Vorschaden.');
await checkOverflow(page, 'protokoll-neu');
await shot(page, '31-protokoll-neu');
await page.click('button:has-text("Protokoll anlegen")');
await page.waitForSelector('text=PR-');
await page.waitForURL(/\/protokolle\/[0-9a-f-]+$/);
// Foto hochladen
await page.setInputFiles('.dropzone input[type=file]', `${S}/test.png`);
await page.waitForSelector('.thumb img');
// Unterschrift
await page.click('button:has-text("Kunde unterschreibt")');
const pad = page.locator('.sigpad');
await pad.scrollIntoViewIfNeeded();
const pb = await pad.boundingBox();
await page.mouse.move(pb.x + 20, pb.y + 80); await page.mouse.down(); await page.mouse.move(pb.x + 120, pb.y + 40, { steps: 10 }); await page.mouse.move(pb.x + 220, pb.y + 100, { steps: 10 }); await page.mouse.up();
await page.fill('.modal input[placeholder="Name in Druckbuchstaben"]', 'Max Mustermann');
await page.click('.modal button:has-text("Übernehmen")');
await page.waitForSelector('text=Unterschrift gespeichert');
await page.waitForSelector('.sig-preview img');
await checkOverflow(page, 'protokoll');
await shot(page, '32-protokoll');
// PDF-Entwurf abrufen
const pdfHref = await page.locator('a:has-text("PDF")').getAttribute('href');
const pdf = await page.request.get(base + pdfHref);
if (pdf.status() !== 200 || !(await pdf.body()).subarray(0, 4).toString().startsWith('%PDF')) issues.push('Protokoll-PDF fehlgeschlagen ' + pdf.status());
fs.writeFileSync(`${S}/protokoll.pdf`, await pdf.body());
// Abschließen
await page.click('button:has-text("Abschließen")');
await page.click('.modal button:has-text("Abschließen")');
await page.waitForSelector('text=Protokoll abgeschlossen');
await page.waitForSelector('.badge:has-text("abgeschlossen")');
await shot(page, '33-protokoll-final');
// Kundenakte PDF + Auftrag PDF
const kpdf = await page.request.get(base + '/api/customers/' + (await page.locator('a[href^="/kunden/"]').first().getAttribute('href')).split('/').pop() + '/pdf');
if (kpdf.status() !== 200) issues.push('Kundenakte-PDF ' + kpdf.status());
fs.writeFileSync(`${S}/kundenakte.pdf`, await kpdf.body());
// Dokumente-Tab zeigt PDF
await page.click('a[href^="/kunden/"] >> nth=0');
await page.click('button:has-text("Dokumente & Bilder")');
await page.waitForSelector('.doc-row:has-text("PR-")');
await shot(page, '34-kunde-dokumente-pdf');
// Logo hochladen
await page.goto(base + '/einstellungen');
await page.setInputFiles('label:has-text("Logo hochladen") input[type=file]', `${S}/test.png`);
await page.waitForSelector('text=Logo gespeichert');
await page.waitForSelector('.brand-mark img');
await shot(page, '35-logo');

// Mobile: Protokoll
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
await mctx.addCookies(await ctx.cookies());
const mp = await mctx.newPage();
mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await mp.goto(page.url().includes('/kunden/') ? page.url() : base + '/kunden');
await mp.goto(base + '/kunden'); await mp.click('text=Max Mustermann'); await mp.click('button:has-text("Protokolle")'); await mp.waitForSelector('.doc-row'); await mp.click('.doc-row >> nth=0'); await mp.waitForSelector('.sketch'); await checkOverflow(mp, 'm-protokoll'); await shot(mp, 'm-protokoll');
await mp.goto(base + '/kunden'); await mp.click('text=Max Mustermann'); await mp.click('button:has-text("Dokumente")'); await mp.waitForSelector('.thumb'); await checkOverflow(mp, 'm-dokumente'); await shot(mp, 'm-dokumente');
console.log('ISSUES', JSON.stringify(issues)); console.log('ERRORS', JSON.stringify(errors));
await browser.close();
