/**
 * CSV-Hilfsfunktionen ohne Fremdbibliothek. Export im deutschen Excel-Format
 * (Semikolon, UTF-8 mit BOM, CRLF); Import erkennt Semikolon, Komma und Tabulator.
 */
export interface CsvColumn<T> { key: string; label: string; get: (row: T) => unknown }

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : Array.isArray(v) ? v.join(', ') : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => cell(c.get(r))).join(';'));
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}

export const euro = (cents: number | null | undefined) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ','));

export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Array<[string, number]> = [[';', (firstLine.match(/;/g) ?? []).length], [',', (firstLine.match(/,/g) ?? []).length], ['\t', (firstLine.match(/\t/g) ?? []).length]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ';';
}

/** Parst CSV-Text in Objekte (Kopfzeile = Schlüssel). Anführungszeichen und Zeilenumbrüche in Feldern werden unterstützt. */
export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = input.replace(/^﻿/, '');
  const sep = detectSeparator(text);
  const records: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((c) => c.trim() !== '')) records.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c.trim() !== '')) records.push(row); }
  const headers = (records.shift() ?? []).map((h) => h.trim());
  const rows = records.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers, rows };
}
