import dns from 'node:dns/promises';
import net from 'node:net';
import { badRequest } from './errors.js';

/**
 * SSRF-Schutz für vom Benutzer angegebene Ziele (Webhooks, SMTP im SaaS-Betrieb):
 * nur öffentliche Adressen, keine internen Netze, kein localhost, keine Cloud-Metadatendienste.
 * Die Prüfung erfolgt beim Speichern UND bei jeder Verbindung (Schutz vor DNS-Rebinding).
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224 || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
}

export async function resolvePublicHost(host: string): Promise<string[]> {
  const h = host.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(h) ? [h] : (await dns.lookup(h, { all: true, verbatim: true })).map((a) => a.address);
  if (addrs.length === 0) throw badRequest('Die Adresse ist nicht auflösbar.');
  if (addrs.some(isPrivateIp)) throw badRequest('Interne oder private Netzadressen sind als Ziel nicht erlaubt.');
  return addrs;
}

export async function assertPublicHttpsUrl(url: string, opts: { allowHttp?: boolean } = {}): Promise<URL> {
  let u: URL;
  try { u = new URL(url); } catch { throw badRequest('Ungültige Adresse.'); }
  if (u.protocol !== 'https:' && !(opts.allowHttp && u.protocol === 'http:')) throw badRequest('Nur verschlüsselte Adressen (https://) sind erlaubt.');
  if (u.username || u.password) throw badRequest('Die Adresse darf keine Zugangsdaten enthalten.');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(u.hostname)) throw badRequest('Interne Hostnamen sind nicht erlaubt.');
  await resolvePublicHost(u.hostname);
  return u;
}
