import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddedInvoiceXml } from '../src/integrations/einvoice/pdf.js';
import { parseEInvoice } from '../src/integrations/einvoice/parse.js';
import { pdfHasActiveContent, pdfRisk } from '../src/integrations/storage.js';
import { parseXml } from '../src/integrations/einvoice/xml.js';
import { ciiXml, plainPdf, zugferdPdf } from './fixtures/einvoice.js';

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

  it('Sicherheitsprüfung: weitere Anhänge, maskierte Skript-Namen und versteckte Anhänge werden abgewiesen', () => {
    const ok = zugferdPdf(ciiXml());
    expect(pdfHasActiveContent(ok, { allowEmbeddedXml: true })).toBe(false);
    // zweiter Anhang ohne /Type, nur über /EF verwiesen
    const extra = Buffer.concat([ok, Buffer.from('9 0 obj\n<< /Length 4 >>\nstream\nMZ\x90\x00\nendstream\nendobj\n10 0 obj\n<< /Type /Filespec /F (tool.exe) /EF << /F 9 0 R >> >>\nendobj\n', 'latin1')]);
    expect(pdfHasActiveContent(extra, { allowEmbeddedXml: true })).toBe(true);
    // maskierter Name /Java#53cript
    expect(pdfHasActiveContent(Buffer.concat([ok, Buffer.from('11 0 obj\n<< /S /Java#53cript >>\nendobj\n', 'latin1')]), { allowEmbeddedXml: true })).toBe(true);
    // normale Uploads: jeder Anhang gesperrt
    expect(pdfHasActiveContent(ok)).toBe(true);
  });

  it('Sicherheitsprüfung: Anhang-Verweise müssen auf die Rechnungs-XML zeigen (auch indirekt), Rest wird abgewiesen', async () => {
    const zlib = await import('node:zlib');
    const ok = zugferdPdf(ciiXml());
    const exe = '9 0 obj\n<< /Length 4 >>\nstream\nMZ\x90\x00\nendstream\nendobj\n';
    const patch = (from: string, to: string, extra = '') => Buffer.concat([Buffer.from(ok.toString('latin1').replace(from, to), 'latin1'), Buffer.from(extra, 'latin1')]);
    // ein /EF-Eintrag mit zwei Zielen: /F = XML, /UF = Programm
    expect(pdfRisk(patch('/EF << /F 4 0 R >>', '/EF << /F 4 0 R /UF 9 0 R >>', exe), { allowEmbeddedXml: true })).toBe('active');
    // Dateianhang-Anmerkung mit indirektem /EF auf ein Programm
    expect(pdfRisk(Buffer.concat([ok, Buffer.from(`${exe}10 0 obj\n<< /Type /Annot /Subtype /FileAttachment /FS << /Type /Filespec /F (a.exe) /EF 11 0 R >> >>\nendobj\n11 0 obj\n<< /F 9 0 R >>\nendobj\n`, 'latin1')]), { allowEmbeddedXml: true })).toBe('active');
    // indirekter /EF-Verweis nur auf die XML (so schreibt z. B. Mustang) bleibt erlaubt
    expect(pdfRisk(patch('/EF << /F 4 0 R >>', '/EF 12 0 R', '12 0 obj\n<< /F 4 0 R /UF 4 0 R >>\nendobj\n'), { allowEmbeddedXml: true })).toBeNull();
    // HTML statt Rechnungs-XML
    expect(pdfRisk(zugferdPdf('<html><body><script>alert(1)</script></body></html>'), { allowEmbeddedXml: true })).toBe('active');
    // übergroßer Objekt-Stream (Skript dahinter versteckt) ist nicht prüfbar → abgewiesen
    const big = zlib.deflateSync(Buffer.concat([Buffer.from('1 0 ', 'latin1'), Buffer.alloc(9 * 1024 * 1024, 0x20), Buffer.from('<< /S /JavaScript /JS (app.alert(1)) >>', 'latin1')]));
    const hidden = Buffer.concat([plainPdf(), Buffer.from(`20 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${big.length} >>\nstream\n`, 'latin1'), big, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    expect(pdfRisk(hidden)).toBe('uncheckable');
    expect(pdfRisk(hidden, { allowEmbeddedXml: true })).toBe('uncheckable');
    // kleiner Objekt-Stream mit Skript wird erkannt
    const small = zlib.deflateSync(Buffer.from('7 0 << /S /JavaScript /JS (x) >>', 'latin1'));
    expect(pdfRisk(Buffer.concat([plainPdf(), Buffer.from(`21 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${small.length} >>\nstream\n`, 'latin1'), small, Buffer.from('\nendstream\nendobj\n', 'latin1')]))).toBe('active');
  });

  it('viele kleine Entpack-Bomben blockieren den Upload nicht', async () => {
    const zlib = await import('node:zlib');
    const bomb = zlib.deflateSync(Buffer.alloc(21 * 1024 * 1024, 0x20));
    const parts: Buffer[] = [plainPdf()];
    for (let i = 0; i < 200; i++) parts.push(Buffer.from(`${100 + i} 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${bomb.length} >>\nstream\n`, 'latin1'), bomb, Buffer.from('\nendstream\nendobj\n', 'latin1'));
    const pdf = Buffer.concat(parts);
    const t0 = Date.now();
    expect(pdfRisk(pdf, { allowEmbeddedXml: true })).toBe('uncheckable');
    expect(embeddedInvoiceXml(pdf)).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('XML-Leser: riesige Attribute/Tags blockieren den Server nicht', () => {
    const t0 = Date.now();
    expect(() => parseXml(`<a b${'x'.repeat(4_000_000)}>`)).toThrow();
    expect(() => parseXml(`<a ${'b="1" '.repeat(600_000)}></a>`)).toThrow();
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('PDF-Durchsuchung bleibt bei vielen Stream-Schlüsselwörtern schnell', () => {
    const junk = Buffer.from('%PDF-1.4\n' + 'x stream\n'.repeat(2_500_000), 'latin1'); // ~25 MB
    const t0 = Date.now();
    expect(embeddedInvoiceXml(junk)).toBeNull();
    expect(pdfHasActiveContent(junk, { allowEmbeddedXml: true })).toBe(false);
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
