#!/usr/bin/env node
/**
 * Live-Verifizierung der Trendchancen auf amazon.de mit echtem Browser.
 *
 * Erhebt je Chance: Autocomplete-Vorschläge, mindestens N Wettbewerbstitel mit
 * Preis, Seitenzahl, Format, Veröffentlichungsdatum, Bewertung, Rezensionszahl,
 * Bestseller-Rang, ASIN, Produkt-URL und Prüfzeitpunkt.
 *
 * GRUNDREGELN — bewusst konservativ:
 *   - Kein Umgehen von Sperren. Bei CAPTCHA oder Blockseite bricht der Lauf ab.
 *   - Keine Anmeldung, keine Cookies eines Amazon-Kontos, kein Zugriff auf KDP.
 *   - Feste Wartezeit zwischen allen Seitenaufrufen (Standard 6 s).
 *   - Nicht gefundene Felder werden `null` — niemals geraten oder gefüllt.
 *
 * Aufruf:
 *   node scripts/live-verifikation.mjs --chancen C1,C3 --titel 6
 *   node scripts/live-verifikation.mjs --alle
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJEKT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASIS = 'https://www.amazon.de';

// ---------------------------------------------------------------- Argumente

function args() {
  const a = process.argv.slice(2);
  const get = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
  return {
    chancen: a.includes('--alle') ? null : (get('--chancen', '') || '').split(',').filter(Boolean),
    minTitel: parseInt(get('--titel', '5'), 10),
    pauseMs: parseInt(get('--pause', '6000'), 10),
    sichtbar: a.includes('--sichtbar'),
    hilfe: a.includes('--hilfe') || a.includes('-h'),
  };
}

const O = args();
if (O.hilfe) {
  console.log(`
Live-Verifizierung amazon.de

  --alle              alle Chancen aus der Suchbegriffsdatei prüfen
  --chancen C1,C3     nur diese Chancen
  --titel N           Mindestzahl Wettbewerbstitel je Chance (Standard 5)
  --pause MS          Wartezeit zwischen Seitenaufrufen (Standard 6000)
  --sichtbar          Browserfenster anzeigen (hilfreich bei Cookie-Abfrage)

Suchbegriffe stehen in amazon-kdp-business/data/suchbegriffe.json
`);
  process.exit(0);
}

// Playwright erst nach der Hilfe laden, damit `--hilfe` auch ohne
// installiertes Playwright funktioniert.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('FEHLER: Playwright fehlt. Installieren mit:  npm install playwright');
  process.exit(3);
}

// ---------------------------------------------------------------- Hilfsmittel

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));
const jetzt = () => new Date().toISOString();

function log(m) { console.log(`${new Date().toISOString().slice(11, 19)}  ${m}`); }

/** Erkennt Amazons Blockseiten. Wir umgehen sie nicht — wir brechen ab. */
async function istBlockiert(page) {
  const url = page.url();
  if (/\/errors\/validateCaptcha|\/ap\/signin/.test(url)) return 'CAPTCHA oder Anmeldeseite';
  const txt = (await page.content()).slice(0, 4000);
  if (/Geben Sie die angezeigten Zeichen|Type the characters you see|automated access/i.test(txt)) {
    return 'CAPTCHA-Abfrage im Seiteninhalt';
  }
  return null;
}

/** Cookie-Hinweis einmalig bestätigen. Kein Umgehen — nur der normale Klick. */
async function cookiesBestaetigen(page) {
  for (const sel of ['#sp-cc-accept', 'input[name="accept"]', '[data-cel-widget="sp-cc-accept"]']) {
    const el = await page.$(sel);
    if (el) { await el.click().catch(() => {}); log('Cookie-Hinweis bestätigt'); await schlafen(1200); return true; }
  }
  return false;
}

/** Zahl aus deutschem Text ("1.234", "4,5") robust lesen — sonst null. */
function zahl(text, { komma = false } = {}) {
  if (!text) return null;
  const m = text.replace(/\s/g, '').match(komma ? /(\d+[,.]\d+)/ : /(\d[\d.]*)/);
  if (!m) return null;
  const roh = komma ? m[1].replace(',', '.') : m[1].replace(/\./g, '');
  const n = parseFloat(roh);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------- Erhebung

/** Amazon-Suchvorschläge über den öffentlichen Completion-Dienst. */
async function autocomplete(page, begriff) {
  const url = `https://completion.amazon.de/api/2017/suggestions?mid=A1PA6795UKMFR9&alias=aps&prefix=${encodeURIComponent(begriff)}&limit=11`;
  try {
    const r = await page.request.get(url, { timeout: 15000 });
    if (!r.ok()) return { vorschlaege: null, fehler: `HTTP ${r.status()}` };
    const j = await r.json();
    return { vorschlaege: (j.suggestions || []).map((s) => s.value).filter(Boolean), fehler: null };
  } catch (e) {
    return { vorschlaege: null, fehler: e.message.split('\n')[0] };
  }
}

/** Organische Suchtreffer → ASIN-Liste. */
async function suchtreffer(page, begriff, anzahl) {
  const url = `${BASIS}/s?k=${encodeURIComponent(begriff)}&i=stripbooks`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const blocked = await istBlockiert(page);
  if (blocked) throw new Error(`BLOCKIERT bei Suche "${begriff}": ${blocked}`);
  await cookiesBestaetigen(page);

  return page.$$eval('[data-asin]', (els, max) => {
    const out = [];
    for (const el of els) {
      const asin = el.getAttribute('data-asin');
      if (!asin || asin.length !== 10) continue;
      if (out.some((o) => o.asin === asin)) continue;
      const t = el.querySelector('h2 span, h2 a span');
      out.push({ asin, titel_suchliste: t ? t.textContent.trim() : null });
      if (out.length >= max) break;
    }
    return out;
  }, anzahl);
}

/** Produktseite auslesen. Jedes Feld einzeln — nicht gefunden bleibt null. */
async function produktDaten(page, asin) {
  const url = `${BASIS}/dp/${asin}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const blocked = await istBlockiert(page);
  if (blocked) throw new Error(`BLOCKIERT bei ASIN ${asin}: ${blocked}`);

  const roh = await page.evaluate(() => {
    const t = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : null; };
    const details = {};
    document.querySelectorAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr')
      .forEach((li) => {
        const txt = li.textContent.replace(/‎|‏/g, '').trim();
        const [k, ...v] = txt.split(':');
        if (k && v.length) details[k.trim()] = v.join(':').trim();
      });
    return {
      titel: t('#productTitle'),
      preisText: t('.a-price .a-offscreen') || t('#price') || t('#kindle-price'),
      bewertungText: t('#acrPopover .a-icon-alt') || t('[data-hook="rating-out-of-text"]'),
      rezensionenText: t('#acrCustomerReviewText'),
      formatText: t('#productSubtitle'),
      details,
      bsrText: (document.body.innerText.match(/Amazon Bestseller-Rang:?[\s\S]{0,400}/) || [null])[0],
    };
  });

  const d = roh.details || {};
  // Reihenfolge ist bedeutsam: Der erste Treffer gewinnt. "Herausgeber" enthält oft
  // den Verlagsnamen statt eines Datums und darf "Erscheinungstermin" nie verdrängen.
  const ersterTreffer = (muster) => {
    for (const re of muster) { const k = Object.keys(d).find((x) => re.test(x)); if (k) return k; }
    return null;
  };
  const seitenK = ersterTreffer([/Seitenzahl/i, /Print-Länge/i, /^Taschenbuch/i, /^Gebundene Ausgabe/i]);
  const datumK = ersterTreffer([/Erscheinungstermin/i, /Veröffentlichungsdatum/i, /Publikationsdatum/i]);

  return {
    asin,
    url,
    geprueft_am: jetzt(),
    titel: roh.titel,
    preis_eur: zahl(roh.preisText, { komma: true }),
    preis_roh: roh.preisText,
    seitenzahl: seitenK ? zahl(d[seitenK]) : null,
    format: roh.formatText,
    veroeffentlicht: datumK ? d[datumK] : null,
    bewertung: zahl(roh.bewertungText, { komma: true }),
    rezensionen: zahl(roh.rezensionenText),
    bsr_roh: roh.bsrText ? roh.bsrText.replace(/\s+/g, ' ').slice(0, 300) : null,
    // Explizit dokumentieren, was NICHT gefunden wurde:
    fehlende_felder: [
      ['preis_eur', roh.preisText], ['seitenzahl', seitenK], ['veroeffentlicht', datumK],
      ['bewertung', roh.bewertungText], ['rezensionen', roh.rezensionenText], ['bsr', roh.bsrText],
    ].filter(([, v]) => !v).map(([k]) => k),
  };
}

// ---------------------------------------------------------------- Hauptlauf

const begriffsDatei = `${PROJEKT}/amazon-kdp-business/data/suchbegriffe.json`;
if (!existsSync(begriffsDatei)) {
  console.error(`FEHLER: ${begriffsDatei} fehlt.`); process.exit(3);
}
const alleChancen = JSON.parse(readFileSync(begriffsDatei, 'utf8'));
const zuPruefen = O.chancen && O.chancen.length
  ? alleChancen.filter((c) => O.chancen.includes(c.id))
  : alleChancen;

if (!zuPruefen.length) { console.error('FEHLER: keine passende Chance gefunden.'); process.exit(3); }

const datum = new Date().toISOString().slice(0, 10);
const zeit = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const ausgabeDir = `${PROJEKT}/amazon-kdp-business/research/raw/${datum}/live-${zeit}`;
mkdirSync(ausgabeDir, { recursive: true });

log(`Start Live-Verifizierung — ${zuPruefen.length} Chance(n), min. ${O.minTitel} Titel je Chance`);
log(`Ausgabe: ${ausgabeDir}`);

const browser = await chromium.launch({
  headless: !O.sichtbar,
  executablePath: process.env.CHROMIUM_BIN || undefined,
});
const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();

const ergebnisse = [];
let abbruch = null;

for (const chance of zuPruefen) {
  log(`--- ${chance.id}: ${chance.thema}`);
  const eintrag = { ...chance, geprueft_am: jetzt(), autocomplete: [], titel: [], fehler: [] };

  try {
    for (const b of chance.suchbegriffe) {
      const ac = await autocomplete(page, b);
      eintrag.autocomplete.push({ begriff: b, ...ac, geprueft_am: jetzt() });
      log(`  autocomplete "${b}": ${ac.vorschlaege ? ac.vorschlaege.length + ' Vorschläge' : 'FEHLER ' + ac.fehler}`);
      await schlafen(O.pauseMs);
    }

    const treffer = await suchtreffer(page, chance.suchbegriffe[0], O.minTitel + 3);
    log(`  ${treffer.length} Suchtreffer`);
    await schlafen(O.pauseMs);

    for (const t of treffer.slice(0, O.minTitel + 2)) {
      try {
        const p = await produktDaten(page, t.asin);
        eintrag.titel.push(p);
        log(`  ${t.asin}: ${p.preis_eur ?? '?'} EUR · ${p.seitenzahl ?? '?'} S. · ${p.bewertung ?? '?'}★ (${p.rezensionen ?? '?'})`);
      } catch (e) {
        if (/BLOCKIERT/.test(e.message)) throw e;
        eintrag.fehler.push({ asin: t.asin, fehler: e.message.split('\n')[0] });
      }
      await schlafen(O.pauseMs);
    }
  } catch (e) {
    eintrag.fehler.push({ fehler: e.message.split('\n')[0] });
    if (/BLOCKIERT/.test(e.message)) { abbruch = e.message; ergebnisse.push(eintrag); break; }
  }

  ergebnisse.push(eintrag);
  writeFileSync(`${ausgabeDir}/${chance.id}.json`, JSON.stringify(eintrag, null, 2));
}

await browser.close();

// ---------------------------------------------------------------- Ausgabe

const spalten = ['chance_id', 'asin', 'titel', 'preis_eur', 'seitenzahl', 'format',
  'veroeffentlicht', 'bewertung', 'rezensionen', 'bsr_roh', 'url', 'geprueft_am', 'fehlende_felder'];
const zeilen = [spalten.join(',')];
for (const e of ergebnisse) {
  for (const t of e.titel) {
    zeilen.push(spalten.map((s) => {
      const v = s === 'chance_id' ? e.id : s === 'fehlende_felder' ? (t.fehlende_felder || []).join(' ') : t[s];
      return v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
    }).join(','));
  }
}
writeFileSync(`${ausgabeDir}/wettbewerb.csv`, zeilen.join('\n'));
writeFileSync(`${ausgabeDir}/zusammenfassung.json`, JSON.stringify({
  gestartet: datum, chancen: ergebnisse.length,
  titel_gesamt: ergebnisse.reduce((s, e) => s + e.titel.length, 0),
  abbruch, ergebnisse,
}, null, 2));

log(`Fertig. ${ergebnisse.reduce((s, e) => s + e.titel.length, 0)} Titel erhoben.`);
if (abbruch) {
  log(`ABGEBROCHEN: ${abbruch}`);
  log('Amazon hat den automatisierten Zugriff blockiert. Der Lauf wurde beendet,');
  log('statt die Sperre zu umgehen. Später erneut versuchen oder --pause erhöhen.');
  process.exit(1);
}
process.exit(0);
