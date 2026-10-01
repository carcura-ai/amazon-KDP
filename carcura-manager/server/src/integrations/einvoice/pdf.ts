import zlib from 'node:zlib';

export interface EmbeddedFile { data: Buffer; isXml: boolean }

/**
 * Liest in eine PDF eingebettete Dateien (ZUGFeRD/Factur-X legen die Rechnungsdaten als XML-Anhang
 * „factur-x.xml“ / „zugferd-invoice.xml“ / „xrechnung.xml“ ab). Unterstützt unkomprimierte und
 * FlateDecode-Streams; verschlüsselte PDFs liefern nichts (dann greift die Texterkennung).
 */
export function extractEmbeddedFiles(pdf: Buffer, limit = 10): EmbeddedFile[] {
  const src = pdf.toString('latin1');
  const out: EmbeddedFile[] = [];
  const re = /\d+\s+\d+\s+obj\s*<<((?:(?!endobj)[\s\S])*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && out.length < limit) {
    const dict = m[1]!;
    if (!/\/Type\s*\/EmbeddedFile\b/.test(dict)) continue;
    const start = m.index + m[0].length;
    const lenMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let end = lenMatch ? start + Number(lenMatch[1]) : -1;
    if (end < start || end > src.length || !/^\s*endstream/.test(src.slice(end, end + 30))) {
      const e = src.indexOf('endstream', start);
      if (e < 0) continue;
      end = e;
      while (end > start && (src[end - 1] === '\n' || src[end - 1] === '\r')) end--;
    }
    let data = pdf.subarray(start, end);
    const filter = /\/Filter\s*(\[\s*)?\/(\w+)/.exec(dict)?.[2];
    if (filter === 'FlateDecode') {
      try { data = zlib.inflateSync(data); } catch { try { data = zlib.inflateRawSync(data); } catch { continue; } }
    } else if (filter) continue; // andere Filter (z. B. verschlüsselt/ASCII85) nicht unterstützt
    const head = data.subarray(0, 200).toString('utf8').replace(/^﻿/, '').trimStart();
    out.push({ data, isXml: head.startsWith('<') });
    re.lastIndex = end;
  }
  return out;
}

/** Erste eingebettete XML-Datei (Rechnungsdaten), sonst null. */
export function embeddedInvoiceXml(pdf: Buffer): string | null {
  const xml = extractEmbeddedFiles(pdf).find((f) => f.isXml);
  return xml ? xml.data.toString('utf8') : null;
}
