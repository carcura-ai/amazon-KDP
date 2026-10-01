import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddedInvoiceXml } from '../src/integrations/einvoice/pdf.js';
import { parseEInvoice } from '../src/integrations/einvoice/parse.js';
import { pdfHasActiveContent } from '../src/integrations/storage.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'real');
const read = (f: string) => fs.readFileSync(path.join(dir, f));
const fromPdf = (f: string) => { const buf = read(f); expect(pdfHasActiveContent(buf, { allowEmbeddedXml: true })).toBe(false); const xml = embeddedInvoiceXml(buf); expect(xml).not.toBeNull(); return parseEInvoice(xml!)!.invoice; };
const sum = (lines: Array<{ netCents: number }>) => lines.reduce((s, l) => s + l.netCents, 0);

describe('Echte E-Rechnungen verschiedener Erzeuger', () => {
  it('ZUGFeRD 2.x (EN 16931) als PDF/A-3: Lizenzkommentar vor dem Wurzelelement, zwei Steuersätze', () => {
    const inv = fromPdf('EN16931_Einfach.pdf');
    expect(inv).toMatchObject({ number: '471102', issueDate: '2024-11-15', netCents: 47300, vatCents: 5687, grossCents: 52987 });
    expect(inv.seller.name).toBe('Lieferant GmbH');
    expect(inv.buyer).toMatchObject({ name: 'Kunden AG Mitte', street: 'Kundenstraße 15', zip: '69876', city: 'Frankfurt' });
    expect(sum(inv.lines)).toBe(inv.netCents);
    expect(inv.vat.reduce((s, v) => s + v.vatCents, 0)).toBe(inv.vatCents);
  });

  it('Teilrechnung mit Anzahlung und Rabatt auf Belegebene', () => {
    const inv = fromPdf('EN16931_1_Teilrechnung.pdf');
    expect(inv).toMatchObject({ grossCents: 19765, prepaidCents: 5000, dueCents: 14765 });
    expect(inv.netCents! + inv.vatCents!).toBe(inv.grossCents);
  });

  it('ZUGFeRD 1.0 (CrossIndustryDocument)', () => {
    const inv = fromPdf('MustangGnuaccountingBeispielRE-20170509_505.pdf');
    expect(inv).toMatchObject({ number: 'RE-20170509/505', issueDate: '2017-05-09', dueDate: '2017-05-30', netCents: 49600, vatCents: 7504, grossCents: 57104 });
    expect(inv.buyer).toMatchObject({ name: 'Theodor Est', zip: '88802', city: 'Spielkreis' });
    expect(inv.lines).toHaveLength(3);
    expect(sum(inv.lines)).toBe(49600);
  });

  it('XRechnung der KoSIT in beiden Syntaxen liefert identische Werte', () => {
    const ubl = parseEInvoice(read('kosit-01.01a-INVOICE_ubl.xml').toString('utf8'))!;
    const cii = parseEInvoice(read('kosit-01.01a-INVOICE_uncefact.xml').toString('utf8'))!;
    expect(ubl.syntax).toBe('ubl');
    expect(cii.syntax).toBe('cii');
    for (const inv of [ubl.invoice, cii.invoice]) expect(inv).toMatchObject({ number: '123456XX', issueDate: '2016-04-04', netCents: 31486, vatCents: 2204, grossCents: 33690 });
    expect(ubl.invoice.vat).toEqual(cii.invoice.vat);
  });

  it('manipulierte PDF: lineare Laufzeit, begrenzte Entpackgröße (Zip-Bombe)', async () => {
    const zlib = await import('node:zlib');
    const bomb = zlib.deflateSync(Buffer.alloc(200 * 1024 * 1024, 0x20));
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n4 0 obj\n<< /Type /EmbeddedFile /Filter /FlateDecode >>\nstream\n', 'latin1'), bomb, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    expect(embeddedInvoiceXml(pdf)).toBeNull();
    const junk = Buffer.from('%PDF-1.4\n' + '1 0 obj << stream\n'.repeat(400_000), 'latin1');
    const t0 = Date.now();
    expect(embeddedInvoiceXml(junk)).toBeNull();
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
