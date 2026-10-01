/**
 * Kleiner, sicherer XML-Leser für E-Rechnungen (ZUGFeRD/Factur-X/XRechnung).
 * Bewusst ohne DTD-/Entity-Unterstützung (kein XXE möglich): DOCTYPE wird abgewiesen, nur die fünf
 * Standard-Entities und numerische Zeichenreferenzen werden aufgelöst. Namensraum-Präfixe werden entfernt,
 * damit CII (rsm:/ram:/udt:) und UBL (cbc:/cac:) einheitlich abgefragt werden können.
 */
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const MAX_XML_BYTES = 5 * 1024 * 1024;

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, e: string) => {
    if (e === 'amp') return '&';
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    const code = e.startsWith('#x') ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

const local = (qname: string) => qname.slice(qname.indexOf(':') + 1);

export function parseXml(input: string): XmlNode {
  if (input.length > MAX_XML_BYTES) throw new Error('XML-Datei ist zu groß.');
  const src = input.replace(/^﻿/, '');
  if (/<!DOCTYPE/i.test(src)) throw new Error('XML mit DOCTYPE wird aus Sicherheitsgründen nicht verarbeitet.');
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1]!.text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const end = src.indexOf('-->', lt + 4); i = end < 0 ? src.length : end + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const end = src.indexOf(']]>', lt + 9); stack[stack.length - 1]!.text += src.slice(lt + 9, end < 0 ? src.length : end); i = end < 0 ? src.length : end + 3; continue; }
    if (src.startsWith('<?', lt)) { const end = src.indexOf('?>', lt + 2); i = end < 0 ? src.length : end + 2; continue; }
    const gt = src.indexOf('>', lt + 1);
    if (gt < 0) throw new Error('XML unvollständig.');
    const raw = src.slice(lt + 1, gt);
    if (raw.startsWith('/')) {
      const name = local(raw.slice(1).trim());
      const node = stack.pop();
      if (!node || node.name !== name || stack.length === 0) throw new Error(`XML fehlerhaft verschachtelt (${name}).`);
      i = gt + 1;
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const m = /^([^\s]+)([\s\S]*)$/.exec(body.trim());
    if (!m) throw new Error('XML-Element ohne Namen.');
    const attrs: Record<string, string> = {};
    for (const a of m[2]!.matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[local(a[1]!)] = decodeEntities(a[3] ?? a[4] ?? '');
    const node: XmlNode = { name: local(m[1]!), attrs, children: [], text: '' };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
    if (stack.length > 200) throw new Error('XML zu tief verschachtelt.');
    i = gt + 1;
  }
  if (stack.length !== 1) throw new Error('XML unvollständig (nicht geschlossene Elemente).');
  const doc = root.children[0];
  if (!doc) throw new Error('Leeres XML-Dokument.');
  return doc;
}

/** Erstes Kind-Element entlang eines Pfads (Namen ohne Präfix), z. B. child(n, 'SellerTradeParty', 'Name'). */
export function child(node: XmlNode | undefined, ...path: string[]): XmlNode | undefined {
  let cur = node;
  for (const p of path) {
    if (!cur) return undefined;
    cur = cur.children.find((c) => c.name === p);
  }
  return cur;
}

export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

export function text(node: XmlNode | undefined, ...path: string[]): string | null {
  const n = child(node, ...path);
  const t = n?.text.trim();
  return t ? t : null;
}

/** Alle Nachfahren mit dem Namen (Tiefensuche). */
export function descendants(node: XmlNode | undefined, name: string, out: XmlNode[] = []): XmlNode[] {
  if (!node) return out;
  for (const c of node.children) {
    if (c.name === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}
