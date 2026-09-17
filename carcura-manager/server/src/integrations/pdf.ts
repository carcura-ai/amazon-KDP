import { chromium, type Browser } from 'playwright';
import type { FastifyBaseLogger } from 'fastify';

/**
 * PDF-Erzeugung über Chromium (Playwright). Der Browser wird beim ersten Bedarf
 * gestartet und wiederverwendet. Auf dem Rechner des Mandanten: `npx playwright install chromium`
 * oder CHROMIUM_PATH auf ein vorhandenes Chrome/Chromium zeigen lassen.
 */
export class PdfService {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(private readonly executablePath: string | null, private readonly log: FastifyBaseLogger) {}

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium
        .launch({ executablePath: this.executablePath ?? undefined, args: ['--disable-gpu', '--no-sandbox'] })
        .then((b) => {
          this.browser = b;
          b.on('disconnected', () => { this.browser = null; });
          return b;
        })
        .finally(() => { this.launching = null; });
    }
    return this.launching;
  }

  async render(html: string, opts: { landscape?: boolean; footerHtml?: string } = {}): Promise<Buffer> {
    let browser: Browser;
    try {
      browser = await this.getBrowser();
    } catch (err) {
      this.log.error({ err }, 'Chromium konnte nicht gestartet werden');
      throw new Error('PDF-Erzeugung nicht verfügbar: Chromium fehlt. Bitte `npx playwright install chromium` ausführen oder CHROMIUM_PATH setzen.');
    }
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: opts.landscape ?? false,
        printBackground: true,
        margin: { top: '16mm', bottom: opts.footerHtml ? '22mm' : '16mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: Boolean(opts.footerHtml),
        headerTemplate: '<span></span>',
        footerTemplate: opts.footerHtml ?? '<span></span>',
      });
      return Buffer.from(pdf);
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }
}
