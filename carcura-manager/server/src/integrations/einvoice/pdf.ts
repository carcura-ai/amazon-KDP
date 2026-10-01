import zlib from 'node:zlib';

export interface EmbeddedFile { data: Buffer; isXml: boolean }
interface PdfStream { dict: string; data: Buffer }

/** Obergrenzen gegen manipulierte Dateien (Laufzeit linear, entpackte Größe begrenzt). */
const MAX_STREAM_HITS = 20_000;
const MAX_DICT_BYTES = 4096;
const MAX_INFLATED_BYTES = 20 * 1024 * 1024;
/** Gesamtbudget fürs Entpacken je Datei (viele kleine „Bomben“ dürfen den Server nicht ausbremsen). */
const MAX_INFLATED_TOTAL = 60 * 1024 * 1024;

/**
 * Findet alle Stream-Objekte einer PDF in einem einzigen linearen Durchlauf (kein Backtracking).
 * Liefert das Stream-Wörterbuch und die Rohdaten.
 */
function streams(pdf: Buffer): PdfStream[] {
  const src = pdf.toString('latin1');
  const out: PdfStream[] = [];
  let pos = 0;
  let hits = 0;
  while (hits++ < MAX_STREAM_HITS) {
    const idx = src.indexOf('stream', pos);
    if (idx < 0) break;
    pos = idx + 6;
    if (idx >= 3 && src.startsWith('end', idx - 3)) continue; // „endstream“
    const nl = src[idx + 6];
    if (nl !== '\n' && nl !== '\r') continue;
    const before = src.slice(Math.max(0, idx - MAX_DICT_BYTES), idx);
    const dictEnd = before.lastIndexOf('>>');
    if (dictEnd < 0 || before.slice(dictEnd + 2).trim() !== '') continue;
    const objKw = before.lastIndexOf('obj');
    if (objKw < 0 || !/\d+\s+\d+\s+$/.test(before.slice(Math.max(0, objKw - 24), objKw))) continue;
    const dictStart = before.indexOf('<<', objKw);
    if (dictStart < 0 || dictStart > dictEnd) continue;
    const dict = before.slice(dictStart + 2, dictEnd);
    const start = idx + 6 + (nl === '\r' && src[idx + 7] === '\n' ? 2 : 1);
    const lenMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let end = lenMatch ? start + Number(lenMatch[1]) : -1;
    if (end < start || end > src.length || !/^\s*endstream/.test(src.slice(end, end + 30))) {
      const e = src.indexOf('endstream', start);
      if (e < 0) break;
      end = e;
      while (end > start && (src[end - 1] === '\n' || src[end - 1] === '\r')) end--;
    }
    out.push({ dict, data: pdf.subarray(start, end) });
    pos = end;
  }
  return out;
}

class Budget { used = 0; ok() { return this.used < MAX_INFLATED_TOTAL; } }

function decode(s: PdfStream, budget = new Budget()): Buffer | null {
  const filter = /\/Filter\s*(\[\s*)?\/(\w+)/.exec(s.dict)?.[2];
  if (!filter) return s.data;
  if (filter !== 'FlateDecode' || !budget.ok()) return null; // andere Filter (z. B. verschlüsselt) nicht unterstützt
  const limit = Math.min(MAX_INFLATED_BYTES, MAX_INFLATED_TOTAL - budget.used);
  let out: Buffer | null = null;
  try { out = zlib.inflateSync(s.data, { maxOutputLength: limit }); } catch {
    try { out = zlib.inflateRawSync(s.data, { maxOutputLength: limit }); } catch { out = null; }
  }
  budget.used += out ? out.length : Math.min(limit, s.data.length * 4);
  return out;
}

const startsLikeXml = (b: Buffer) => b.subarray(0, 200).toString('utf8').replace(/^﻿/, '').trimStart().startsWith('<');
/** Eingebettete Datei: Typ EmbeddedFile oder XML-Untertyp (der Typ-Eintrag ist laut PDF-Norm optional). */
const isEmbeddedDict = (d: string) => /\/Type\s*\/EmbeddedFile\b/.test(d) || /\/Subtype\s*\/(text|application)#2[Ff]xml\b/.test(d);
const INVOICE_NS = /CrossIndustryInvoice|CrossIndustryDocument|urn:oasis:names:specification:ubl:schema:xsd:(Invoice|CreditNote)-2/;

/**
 * Liest in eine PDF eingebettete Dateien (ZUGFeRD/Factur-X legen die Rechnungsdaten als XML-Anhang
 * „factur-x.xml“ / „zugferd-invoice.xml“ / „xrechnung.xml“ ab). Unterstützt unkomprimierte und
 * FlateDecode-Streams; verschlüsselte PDFs liefern nichts (dann greift die Texterkennung).
 */
export function extractEmbeddedFiles(pdf: Buffer, limit = 10): EmbeddedFile[] {
  const out: EmbeddedFile[] = [];
  const budget = new Budget();
  for (const s of streams(pdf)) {
    if (!isEmbeddedDict(s.dict)) continue;
    const data = decode(s, budget);
    if (!data) { out.push({ data: Buffer.alloc(0), isXml: false }); continue; }
    out.push({ data, isXml: startsLikeXml(data) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Rechnungs-XML aus der PDF. Zuerst die als Anhang gekennzeichneten Dateien, sonst (z. B. wenn der
 * Anhang-Verweis in einem komprimierten Objekt-Stream steckt) alle Streams nach einer E-Rechnung durchsuchen.
 */
export function embeddedInvoiceXml(pdf: Buffer): string | null {
  const all = streams(pdf);
  const ordered = [...all.filter((s) => isEmbeddedDict(s.dict)), ...all.filter((s) => !isEmbeddedDict(s.dict) && !/\/Type\s*\/(Metadata|XObject|ObjStm|XRef|Font)/.test(s.dict)).slice(0, 500)];
  const budget = new Budget();
  for (const s of ordered) {
    if (!budget.ok()) break;
    const data = decode(s, budget);
    if (!data || !startsLikeXml(data)) continue;
    const text = data.toString('utf8');
    // Wurzelelement kann hinter langen Kommentaren (z. B. Lizenzhinweisen) stehen – ganzes Dokument prüfen
    if (INVOICE_NS.test(text)) return text;
  }
  return null;
}

/** PDF-Namen können Zeichen als #xx maskieren (z. B. /Java#53cript) – für die Prüfung auflösen. */
const unescapeNames = (t: string) => t.replace(/#([0-9a-fA-F]{2})/g, (_m, h: string) => String.fromCharCode(Number.parseInt(h, 16)));

/**
 * Sicherheitsprüfung einer PDF: Klartext plus entpackte Objekt-Streams (dort können Verweise auf
 * Anhänge oder Skripte versteckt sein), maskierte Namen aufgelöst.
 */
export function pdfSecurityScan(pdf: Buffer): { active: boolean; attachmentRefs: number; embedded: EmbeddedFile[] } {
  const budget = new Budget();
  let text = pdf.toString('latin1');
  for (const s of streams(pdf)) {
    if (!/\/Type\s*\/ObjStm\b/.test(s.dict)) continue;
    const d = decode(s, budget);
    if (d) text += '\n' + d.toString('latin1');
    if (!budget.ok()) { text += '\n/JavaScript'; break; } // nicht vollständig prüfbar → als aktiv werten
  }
  text = unescapeNames(text);
  const active = /\/(JavaScript|JS|Launch|RichMedia|XFA)\b/.test(text);
  const attachmentRefs = (text.match(/\/EF\s*<</g) ?? []).length;
  return { active, attachmentRefs, embedded: extractEmbeddedFiles(pdf, 50) };
}
