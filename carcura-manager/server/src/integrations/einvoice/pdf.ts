import zlib from 'node:zlib';

export interface EmbeddedFile { objNum: number | null; data: Buffer; isXml: boolean }
interface PdfStream { objNum: number | null; dict: string; data: Buffer }

/** Obergrenzen gegen manipulierte Dateien (Laufzeit linear, entpackte Größe begrenzt). */
const MAX_STREAM_HITS = 20_000;
const MAX_DICT_BYTES = 4096;
const MAX_INFLATED_BYTES = 8 * 1024 * 1024;
/** Gesamtbudget fürs Entpacken je Datei (viele kleine „Bomben“ dürfen den Server nicht ausbremsen). */
const MAX_INFLATED_TOTAL = 40 * 1024 * 1024;

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
    const objHead = objKw < 0 ? null : /(\d{1,10})\s+\d{1,5}\s+$/.exec(before.slice(Math.max(0, objKw - 24), objKw));
    if (!objHead) continue;
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
    out.push({ objNum: Number(objHead[1]), dict, data: pdf.subarray(start, end) });
    pos = end;
  }
  return out;
}

class Budget { used = 0; ok() { return this.used < MAX_INFLATED_TOTAL; } }

/**
 * Entpackt einen Stream. Ein Fehlschlag wird mit dem vollen Limit aufs Budget angerechnet, weil bis
 * dahin bereits so viel entpackt worden sein kann (sonst ließen sich viele kleine „Bomben“ billig stapeln).
 */
function decode(s: PdfStream, budget = new Budget()): Buffer | null {
  const filter = /\/Filter\s*(\[\s*)?\/(\w+)/.exec(s.dict)?.[2];
  if (!filter) return s.data;
  if (filter !== 'FlateDecode' || !budget.ok()) return null; // andere Filter (z. B. verschlüsselt) nicht unterstützt
  const limit = Math.min(MAX_INFLATED_BYTES, MAX_INFLATED_TOTAL - budget.used);
  let out: Buffer | null = null;
  try { out = zlib.inflateSync(s.data, { maxOutputLength: limit }); } catch (err) {
    if ((err as { code?: string }).code !== 'ERR_BUFFER_TOO_LARGE') {
      try { out = zlib.inflateRawSync(s.data, { maxOutputLength: limit }); } catch { out = null; }
    }
  }
  budget.used += out ? out.length : limit;
  return out;
}

const startsLikeXml = (b: Buffer) => b.subarray(0, 200).toString('utf8').replace(/^\uFEFF/, '').trimStart().startsWith('<');
/** Eingebettete Datei: Typ EmbeddedFile oder XML-Untertyp (der Typ-Eintrag ist laut PDF-Norm optional). */
const isEmbeddedDict = (d: string) => /\/Type\s*\/EmbeddedFile\b/.test(d) || /\/Subtype\s*\/(text|application)#2[Ff]xml\b/.test(d);
const INVOICE_NS = /CrossIndustryInvoice|CrossIndustryDocument|urn:oasis:names:specification:ubl:schema:xsd:(Invoice|CreditNote)-2/;
/** Rechnungs-XML (nicht nur „irgendetwas mit <“, z. B. HTML). */
const isInvoiceXml = (b: Buffer) => startsLikeXml(b) && INVOICE_NS.test(b.toString('utf8'));

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
    if (!data) { out.push({ objNum: s.objNum, data: Buffer.alloc(0), isXml: false }); continue; }
    out.push({ objNum: s.objNum, data, isXml: isInvoiceXml(data) });
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

/** Objekte in einem entpackten Objekt-Stream (Kopf: „Objektnummer Offset“-Paare, Daten ab /First). */
function objStmObjects(dict: string, data: string, into: Map<number, string>) {
  const n = Number(/\/N\s+(\d{1,7})/.exec(dict)?.[1] ?? 0);
  const first = Number(/\/First\s+(\d{1,10})/.exec(dict)?.[1] ?? -1);
  if (!n || first < 0 || first > data.length) return;
  const head = data.slice(0, first).trim().split(/\s+/).map(Number);
  for (let k = 0; k + 1 < head.length && k / 2 < n; k += 2) {
    const num = head[k]!;
    const off = first + head[k + 1]!;
    const next = k + 3 < head.length ? first + head[k + 3]! : data.length;
    if (Number.isFinite(num) && off >= first && next > off && !into.has(num)) into.set(num, data.slice(off, Math.min(next, off + MAX_DICT_BYTES)));
  }
}

/** Unkomprimierte Objekte „n g obj … endobj“ (nur der Anfang, für kleine Wörterbücher wie /EF). */
function plainObjects(src: string, into: Map<number, string>) {
  const re = /(\d{1,10})\s{1,5}\d{1,5}\s{1,5}obj\b/g;
  let m: RegExpExecArray | null;
  let hits = 0;
  while ((m = re.exec(src)) && hits++ < 200_000) {
    const num = Number(m[1]);
    const body = src.slice(re.lastIndex, re.lastIndex + MAX_DICT_BYTES);
    const end = body.search(/endobj|\bstream\r?\n/);
    if (!into.has(num)) into.set(num, end < 0 ? body : body.slice(0, end));
  }
}

/**
 * Sicherheitsprüfung einer PDF: Klartext plus entpackte Objekt-Streams (dort können Verweise auf
 * Anhänge oder Skripte versteckt sein), maskierte Namen aufgelöst.
 * - active: Skripte/Startaktionen o. Ä. gefunden
 * - uncheckable: Teile ließen sich nicht prüfen (verschlüsselte, defekte oder übergroße Objekt-Streams)
 * - attachmentTargets: Objektnummern aller Dateien, auf die Anhang-Einträge (/EF) verweisen;
 *   null, wenn ein Verweis nicht aufgelöst werden konnte
 */
export function pdfSecurityScan(pdf: Buffer): { active: boolean; uncheckable: boolean; attachmentRefs: number; attachmentTargets: number[] | null; embedded: EmbeddedFile[] } {
  const budget = new Budget();
  const plain = pdf.toString('latin1');
  let text = plain;
  let uncheckable = false;
  const objects = new Map<number, string>();
  plainObjects(plain, objects);
  for (const s of streams(pdf)) {
    if (!/\/Type\s*\/ObjStm\b/.test(s.dict)) continue;
    const d = decode(s, budget);
    if (!d || !budget.ok()) { uncheckable = true; break; } // nicht vollständig prüfbar
    const t = d.toString('latin1');
    text += '\n' + t;
    objStmObjects(s.dict, t, objects);
  }
  text = unescapeNames(text);
  const active = /\/(JavaScript|JS|Launch|RichMedia|XFA)\b/.test(text);
  // Anhang-Einträge: /EF << /F 5 0 R /UF 5 0 R >> oder indirekt /EF 7 0 R → alle Ziel-Objekte sammeln
  const targets = new Set<number>();
  let resolvable = true;
  let refs = 0;
  const efRe = /\/EF\b\s*(<<|(\d{1,10})\s+\d{1,5}\s+R)/g;
  let m: RegExpExecArray | null;
  while ((m = efRe.exec(text))) {
    refs++;
    let body: string | undefined;
    if (m[1] === '<<') {
      const close = text.indexOf('>>', efRe.lastIndex);
      body = close < 0 ? undefined : text.slice(efRe.lastIndex, close);
    } else {
      const obj = objects.get(Number(m[2]));
      const open = obj?.indexOf('<<') ?? -1;
      const close = obj?.indexOf('>>') ?? -1;
      body = obj && open >= 0 && close > open ? unescapeNames(obj.slice(open + 2, close)) : undefined;
    }
    if (body === undefined || /<</.test(body)) { resolvable = false; continue; }
    for (const r of body.matchAll(/(\d{1,10})\s+\d{1,5}\s+R/g)) targets.add(Number(r[1]));
  }
  return { active, uncheckable, attachmentRefs: refs, attachmentTargets: resolvable ? [...targets] : null, embedded: extractEmbeddedFiles(pdf, 50) };
}
