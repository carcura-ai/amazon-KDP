import { chromium } from 'playwright';
const base = 'http://127.0.0.1:4800';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.request.post(base + '/api/auth/login', { data: { email: 'admin@carcura.info', password: 'Carcura-2026x' } });
const out = [];
for (const path of ['/', '/leads', '/kunden', '/fahrzeuge', '/einstellungen', '/einstellungen/benutzer', '/einstellungen/leistungen', '/einstellungen/integrationen', '/einstellungen/audit', '/betreiber']) {
  await page.goto(base + path);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  out.push(`${path}: ${r.sw > r.cw + 1 ? 'OVERFLOW ' + r.sw : 'ok'}`);
}
console.log(out.join('\n'));
await browser.close();
