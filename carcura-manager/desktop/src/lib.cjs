'use strict';
/** Reine Hilfsfunktionen ohne Electron-Abhängigkeit (mit Node testbar: npm test). */

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])$/i;

/**
 * Prüft und normalisiert eine Server-Adresse. Liefert { origin, insecure? } oder { error }.
 * Nur https; http nur für localhost/private Netze (Test- oder Werkstatt-Server), wenn erlaubt.
 */
function normalizeServerUrl(input, opts = {}) {
  const allowPrivateHttp = opts.allowPrivateHttp !== false;
  let v = String(input || '').trim().replace(/\/+$/, '');
  if (!v) return { error: 'Bitte eine Server-Adresse eingeben.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = (PRIVATE_HOST.test(v.split(/[/:]/)[0]) ? 'http://' : 'https://') + v;
  let u;
  try { u = new URL(v); } catch { return { error: 'Die Adresse ist ungültig.' }; }
  if (u.username || u.password) return { error: 'Die Adresse darf keine Zugangsdaten enthalten.' };
  if (u.protocol === 'https:') return { origin: u.origin };
  if (u.protocol === 'http:' && allowPrivateHttp && PRIVATE_HOST.test(u.hostname)) return { origin: u.origin, insecure: true };
  if (u.protocol === 'http:') return { error: 'Aus Sicherheitsgründen sind nur verschlüsselte Adressen (https://) erlaubt.' };
  return { error: 'Nur http(s)-Adressen sind möglich.' };
}

/** Vergleicht Versionen „1.2.3“. Negativ: a < b. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

/** Externe Links: nur https, mailto, tel (kein file:, javascript:, http:). */
function isSafeExternal(url) {
  try { return ['https:', 'mailto:', 'tel:'].includes(new URL(url).protocol); } catch { return false; }
}

/** Liegt die angeforderte lokale Datei innerhalb des UI-Ordners? (Schutz vor Path Traversal) */
function resolveUiFile(uiDir, requestUrl, path) {
  let u;
  try { u = new URL(requestUrl); } catch { return null; }
  if (u.host !== 'app') return null;
  const file = path.normalize(path.join(uiDir, decodeURIComponent(u.pathname)));
  return file.startsWith(uiDir + path.sep) ? file : null;
}

module.exports = { PRIVATE_HOST, normalizeServerUrl, compareVersions, isSafeExternal, resolveUiFile };
