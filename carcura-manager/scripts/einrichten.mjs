#!/usr/bin/env node
// Einrichtung einer laufenden Installation mit den echten Carcura-Daten:
// Firmendaten, Leistungskatalog mit Preisen (Stand carcura.info, September 2026), Logo,
// Windsor.ai-Anbindung (Google Ads, Meta, GA4, Instagram, Meta Lead Ads), E-Mail-Versand,
// KI-Assistent, Wettbewerber-Monitoring und Website-Lead-Token.
//
// Geheimnisse (Passwörter, API-Schlüssel) werden nur abgefragt und direkt an den lokalen
// Manager übergeben. Sie werden nirgends gespeichert außer verschlüsselt in dessen Datenbank.
//
// Aufruf: scripts\einrichten.cmd  (Windows)  oder  node scripts/einrichten.mjs
// Optionen: --alles            vorhandene Firmendaten/Integrationen überschreiben
//           --ohne-leistungen  Leistungskatalog nicht anfassen
//           --ohne-logo        Logo nicht hochladen
// Für Automatisierung können Antworten über Umgebungsvariablen vorgegeben werden:
// CM_EMAIL, CM_PASSWORD, CM_2FA_CODE, CM_WINDSOR_KEY, CM_SMTP_PASS, CM_CLAUDE_KEY, CM_PLACES_KEY,
// CM_JA=1 (alle Ja/Nein-Fragen mit Ja beantworten), CM_UEBERSPRINGEN=1 (fehlende Schlüssel = überspringen).
import readline from 'node:readline';
import process from 'node:process';
import { readFile } from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const base = (process.env.BASE ?? `http://127.0.0.1:${process.env.PORT ?? '4800'}`).replace(/\/$/, '');
const OVERWRITE = args.has('--alles');
const env = (k) => (process.env[k] ?? '').trim();

/* ------------------------------------------------------------------ Echte Stammdaten */
const COMPANY = {
  name: 'Carcura',
  legalName: 'Carcura GbR',
  email: 'carcura@web.de',
  phone: '+49 170 6669516',
  website: 'https://carcura.info',
  street: 'Hauptstr. 7',
  zip: '57632',
  city: 'Walterschen',
  country: 'DE',
  primaryColor: '#E8F320',
  secondaryColor: '#09090A',
  paymentTermsDays: 14,
  invoiceFooter: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. Zahlbar innerhalb von 14 Tagen ohne Abzug. Vielen Dank für Ihr Vertrauen.',
};
const LOGO_URL = 'https://carcura.info/wp-content/uploads/2026/06/CARCURA-FAHRZEUGAUFBEREITUNG-2.png';

// Windsor.ai: verbundene Konten (aus dem Windsor-Konto carcura@web.de gelesen)
const WINDSOR_ACCOUNTS = {
  googleAdsAccount: '919-151-5213',
  metaAccount: '4466807416930043',
  ga4Account: '548650753',
  instagramAccount: '17841473866439660',
  leadsAccount: '1285478717973511',
};

// Leistungskatalog laut carcura.info/leistungen (Ab-Preise, Kleinunternehmer § 19 UStG).
// durationMinutes = interne Planungswerte für den Kalender, keine Kundenzusage.
const eur = (n) => Math.round(n * 100);
const ONE_TIME = [
  ['Basic Innen & Außen', 'Paket', 145, 180, 'Gründliches Aussaugen, Cockpit- und Oberflächenreinigung, Scheiben innen und außen, Fußmatten, Handwäsche sowie Felgen und Einstiege grob gereinigt.'],
  ['Innenraumreinigung Normal', 'Innen', 90, 90, 'Aussaugen, Cockpit- und Oberflächenreinigung, Scheiben innen, Fußmattenreinigung und Kofferraum aussaugen.'],
  ['Innenraumreinigung Detailliert', 'Innen', 150, 180, 'Intensives Aussaugen inklusive Sitze und Ritzen, Cockpit mit Pinsel, Fußmatten, Kunststoffflächen, Scheiben und Kofferraum.'],
  ['Schonende Handwäsche', 'Außen', 60, 60, 'Vorwäsche, Handwäsche, Felgenreinigung, Reifenreinigung, Scheiben außen und schonende Trocknung.'],
  ['Handwäsche mit Wachs', 'Außen', 100, 90, 'Schonende Handwäsche inklusive Felgen, Reifen, Trocknung und Wachsauftrag für mehr Glanz und leichten Schutz.'],
  ['1-stufige Politur', 'Lack', 200, 240, 'Lackreinigung, Glanzsteigerung und Reduzierung leichter Mikrokratzer. Fahrzeug wird vorher angeschaut.'],
  ['2-stufige Politur', 'Lack', 300, 480, 'Intensivere Lackkorrektur bei Waschkratzern, Hologrammen und matterem Lackbild. Fahrzeug wird vorher angeschaut.'],
  ['Keramikversiegelung', 'Versiegelung', 400, 300, 'Keramischer Lackschutz für Auto und Felgen: starke Wasserabweisung, leichtere Reinigung im Alltag und Schutz der Lackoberfläche.'],
  ['Fotos oder Fahrzeugvideo', 'Zusatz', 0, 30, 'Auf Wunsch nach der Aufbereitung: Detailaufnahmen oder ein kurzer Clip. Preis nach Absprache (0 € = auf Anfrage).'],
];
const ABO = [
  ['Kombi Basic', '1x pro Monat', 120, 150, 'Innenraum aussaugen, Oberflächen reinigen, Scheiben innen und außen, Fußmatten, Handwäsche außen, Felgen- und Reifenreinigung.'],
  ['Kombi Care', '2x pro Monat', 230, 180, 'Bestseller. Gründlichere Innen- und Außenpflege: intensiveres Aussaugen, Cockpit und Verkleidungen, Scheiben, Fußmatten, Handwäsche, Felgen und Einstiege.'],
  ['Kombi Protect', '2x pro Monat', 280, 200, 'Wie Kombi Care, mit stärkerem Fokus auf Lackschutz, Glanz, Pflege der Außenflächen und Werterhalt.'],
  ['Weekly Basic', '1x pro Woche', 450, 120, 'Wöchentliche Innen- und Außenreinigung mit Aussaugen, Oberflächen, Scheiben, Handwäsche und Felgen.'],
  ['Weekly Care', '1x pro Woche', 520, 150, 'Wöchentlich mit mehr Detailarbeit: gründlichere Innenraumpflege, Felgenreinigung, Einstiege und Außenpflege.'],
  ['Außenwäsche Basic', '1x pro Monat', 55, 60, 'Schonende Handwäsche, Felgenreinigung oberflächlich, Einstiege grob, Reifenreinigung, Scheiben außen.'],
  ['Außenwäsche Basic', '2x pro Monat', 100, 60, 'Gleicher Umfang wie Außenwäsche Basic, doppelte Frequenz.'],
  ['Außenwäsche Basic', '1x pro Woche', 190, 60, 'Gleicher Umfang wie Außenwäsche Basic, wöchentlich.'],
  ['Außenwäsche Protect', '1x pro Monat', 65, 75, 'Handwäsche mit stärkerem Fokus auf Glanz und Schutz, Felgen, Reifenpflege, Scheiben außen, Einstiege.'],
  ['Außenwäsche Protect', '2x pro Monat', 120, 75, 'Gleicher Umfang wie Außenwäsche Protect, doppelte Frequenz.'],
  ['Außenwäsche Protect', '1x pro Woche', 230, 75, 'Gleicher Umfang wie Außenwäsche Protect, wöchentlich.'],
  ['Innenraum Basic', '1x pro Monat', 80, 90, 'Gründliches Aussaugen, Cockpit- und Oberflächenreinigung, Scheiben innen, Fußmatten, Kofferraum.'],
  ['Innenraum Basic', '2x pro Monat', 150, 90, 'Gleicher Umfang wie Innenraum Basic, doppelte Frequenz.'],
  ['Innenraum Basic', '1x pro Woche', 285, 90, 'Gleicher Umfang wie Innenraum Basic, wöchentlich.'],
  ['Innenraum Pflege Plus', '1x pro Monat', 95, 120, 'Intensives Aussaugen inklusive Sitze und Ritzen, Cockpit mit Pinsel, Fußmatten, Kunststoffflächen, Scheiben, Kofferraum.'],
  ['Innenraum Pflege Plus', '2x pro Monat', 175, 120, 'Gleicher Umfang wie Innenraum Pflege Plus, doppelte Frequenz.'],
  ['Innenraum Pflege Plus', '1x pro Woche', 330, 120, 'Gleicher Umfang wie Innenraum Pflege Plus, wöchentlich.'],
];
// Startkatalog aus der Ersteinrichtung (Preis 0). Wird deaktiviert, sobald der echte Katalog steht.
const STARTER = ['Innenreinigung Basis', 'Innenreinigung Intensiv', 'Polster- und Teppichreinigung', 'Lederpflege', 'Außenreinigung Handwäsche', 'Lackpolitur einstufig', 'Lackpolitur mehrstufig', 'Wachsversiegelung', 'Komplettaufbereitung', 'Geruchsneutralisation (Ozon)', 'Motorwäsche', 'Scheinwerferaufbereitung'];

const PLACES_QUERIES = ['Fahrzeugaufbereitung Walterschen', 'Autoaufbereitung Altenkirchen Westerwald', 'Autoaufbereitung Hachenburg', 'Keramikversiegelung Westerwald', 'Autopflege Weyerbusch'];

/* ------------------------------------------------------------------ Hilfsfunktionen */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
const say = (s = '') => process.stdout.write(s + '\n');
const ok = (s) => say(`  [OK] ${s}`);
const warn = (s) => say(`  [!]  ${s}`);
const done = [];
const skipped = [];

function ask(question, fallback = '') {
  if (!process.stdin.isTTY && env('CM_UEBERSPRINGEN') === '1') return Promise.resolve(fallback);
  return new Promise((resolve) => rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `, (a) => resolve((a ?? '').trim() || fallback)));
}
function askHidden(question) {
  if (!process.stdin.isTTY) return ask(question);
  return new Promise((resolve) => {
    const orig = rl._writeToOutput;
    let started = false;
    rl._writeToOutput = (s) => { if (!started) { process.stdout.write(s); started = true; } };
    rl.question(`${question}: `, (a) => { rl._writeToOutput = orig; process.stdout.write('\n'); resolve((a ?? '').trim()); });
  });
}
async function yes(question, dflt = true) {
  if (env('CM_JA') === '1') return true;
  const a = (await ask(`${question} (${dflt ? 'J/n' : 'j/N'})`)).toLowerCase();
  if (!a) return dflt;
  return a.startsWith('j') || a.startsWith('y');
}
async function secret(label, envKey, hint) {
  if (env(envKey)) return env(envKey);
  if (env('CM_UEBERSPRINGEN') === '1') return '';
  if (hint) say(`     ${hint}`);
  return askHidden(`  ${label} (Eingabe bleibt unsichtbar; leer = überspringen)`);
}

let cookie = '';
async function api(method, url, body) {
  const headers = { cookie };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(base + url, { method, headers, body: payload }); }
  catch (err) { throw new Error(`Keine Verbindung zu ${base} (${err.cause?.code ?? err.message}). Läuft der Manager (scripts\\start.cmd)?`); }
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  if (!r.ok) throw new Error(json?.message ?? json?.error ?? `${method} ${url} -> ${r.status}`);
  return json;
}
async function step(title, fn) {
  say(`\n${title}`);
  try { const r = await fn(); if (r === 'skip') skipped.push(title); else done.push(title); }
  catch (err) { warn(`Fehlgeschlagen: ${err.message}`); skipped.push(`${title} (Fehler: ${err.message})`); }
}

/* ------------------------------------------------------------------ Ablauf */
say('=====================================================');
say(' Carcura Manager: automatische Einrichtung');
say(` Server: ${base}`);
say('=====================================================');

try { await api('GET', '/api/health'); } catch (err) { say(`\n${err.message}`); rl.close(); process.exit(2); }
const status = await api('GET', '/api/setup/status');
if (status?.needsSetup) { say(`\nDie Ersteinrichtung im Browser wurde noch nicht abgeschlossen. Bitte zuerst ${base} öffnen, dann dieses Skript erneut starten.`); rl.close(); process.exit(2); }

/* 1) Anmeldung */
say('\n1) Anmeldung mit deinem Administrator-Konto');
const email = env('CM_EMAIL') || (await ask('  E-Mail'));
const password = env('CM_PASSWORD') || (await askHidden('  Passwort (Eingabe bleibt unsichtbar)'));
let login;
try { login = await api('POST', '/api/auth/login', { email, password }); }
catch (err) { say(`\nAnmeldung fehlgeschlagen: ${err.message}`); rl.close(); process.exit(3); }
if (login?.requires2fa) {
  const code = env('CM_2FA_CODE') || (await ask('  Code aus der Authenticator-App'));
  await api('POST', '/api/auth/2fa/verify', { challenge: login.challenge, code });
}
const me = await api('GET', '/api/auth/me');
ok(`Angemeldet als ${me.user?.firstName ?? ''} ${me.user?.lastName ?? ''} (${me.user?.role ?? ''})`);
if (me.user?.role !== 'admin') warn('Für die Einrichtung sind Administrator-Rechte nötig. Einige Schritte könnten fehlschlagen.');

/* 2) Firmendaten */
await step('2) Firmendaten (Carcura GbR, Walterschen)', async () => {
  const current = await api('GET', '/api/company');
  const patch = {};
  for (const [k, v] of Object.entries(COMPANY)) {
    const cur = current?.[k];
    const empty = cur === null || cur === undefined || cur === '';
    if (OVERWRITE || empty) patch[k] = v;
  }
  if (!current?.smallBusiness && (await yes('  Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer auf Rechnungen), wie auf carcura.info angegeben?'))) {
    patch.smallBusiness = true; patch.defaultVatBp = 0;
  }
  if (Object.keys(patch).length === 0) { ok('Alle Felder bereits gefüllt (mit --alles überschreiben).'); return; }
  await api('PATCH', '/api/company', patch);
  ok(`Gesetzt: ${Object.keys(patch).join(', ')}`);
  const missing = ['taxNumber', 'iban', 'bic', 'bankName'].filter((k) => !current?.[k]);
  if (missing.length) warn(`Noch von dir einzutragen unter Einstellungen -> Firma: ${missing.join(', ')} (stehen nirgends öffentlich).`);
});

/* 3) Leistungen und Preise */
if (!args.has('--ohne-leistungen')) await step('3) Leistungskatalog mit Preisen von carcura.info', async () => {
  const company = await api('GET', '/api/company');
  const vatBp = company?.smallBusiness ? 0 : (company?.defaultVatBp ?? 1900);
  const existing = (await api('GET', '/api/services?includeInactive=true')).items ?? [];
  const byName = new Map(existing.map((s) => [s.name, s]));
  let created = 0, updated = 0, deactivated = 0, order = 0;
  const upsert = async (name, category, priceEur, minutes, description) => {
    const body = { name, category, priceCents: eur(priceEur), vatBp, durationMinutes: minutes, description, isActive: true, sortOrder: order++ };
    const cur = byName.get(name);
    if (cur) {
      const changed = cur.priceCents !== body.priceCents || cur.description !== description || cur.category !== category || cur.vatBp !== vatBp || !cur.isActive;
      if (changed || OVERWRITE) { await api('PATCH', `/api/services/${cur.id}`, body); updated++; }
    } else { await api('POST', '/api/services', body); created++; }
  };
  for (const [name, cat, price, min, desc] of ONE_TIME) await upsert(name, cat, price, min, desc);
  for (const [name, freq, price, min, desc] of ABO) await upsert(`Abo ${name} (${freq})`, 'Pflege-Abo', price, min, `${desc} Monatspreis bei ${freq}, 12 Monate Mindestlaufzeit, danach monatlich kündbar.`);
  for (const s of existing) {
    if (STARTER.includes(s.name) && s.priceCents === 0 && s.isActive) { await api('PATCH', `/api/services/${s.id}`, { isActive: false }); deactivated++; }
  }
  ok(`${created} angelegt, ${updated} aktualisiert, ${deactivated} Platzhalter aus dem Startkatalog deaktiviert (Umsatzsteuer ${vatBp / 100} %).`);
});

/* 4) Logo */
if (!args.has('--ohne-logo')) await step('4) Firmenlogo von carcura.info', async () => {
  const branding = await api('GET', '/api/branding');
  if (branding?.hasLogo && !OVERWRITE) { ok('Logo bereits vorhanden.'); return; }
  let bytes = null;
  try { bytes = await readFile(new URL('./assets/carcura-logo.png', import.meta.url)); } catch { /* nicht im Paket */ }
  if (!bytes) {
    const r = await fetch(LOGO_URL, { headers: { 'User-Agent': 'Mozilla/5.0 CarcuraManager' } });
    if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status}). Alternativ: Einstellungen -> Firma -> Logo hochladen.`);
    bytes = Buffer.from(await r.arrayBuffer());
  }
  const fd = new FormData();
  fd.append('file', new File([bytes], 'carcura-logo.png', { type: 'image/png' }));
  await api('POST', '/api/company/logo', fd);
  ok('Logo hochgeladen (Anmeldeseite, Oberfläche, Angebots- und Rechnungs-PDF).');
});

/* 5) Windsor.ai */
await step('5) Marketing-Daten über Windsor.ai (Google Ads, Meta Ads, GA4, Instagram, Meta Lead Ads)', async () => {
  const cur = await api('GET', '/api/integrations/marketing/windsor');
  let apiKey = '';
  if (cur?.configured && cur?.hasSecrets?.apiKey && !OVERWRITE) ok('API-Key bereits hinterlegt, Konto-IDs werden aktualisiert.');
  else apiKey = await secret('Windsor.ai API-Key', 'CM_WINDSOR_KEY', 'Zu finden unter https://onboard.windsor.ai -> Settings -> API Key (Konto carcura@web.de).');
  if (!cur?.configured && !apiKey) { warn('Übersprungen. Später unter Einstellungen -> Integrationen -> Windsor.ai nachholen.'); return 'skip'; }
  await api('PUT', '/api/integrations/marketing/windsor', { apiKey, ...WINDSOR_ACCOUNTS });
  ok(`Gespeichert: Google Ads ${WINDSOR_ACCOUNTS.googleAdsAccount}, Meta ${WINDSOR_ACCOUNTS.metaAccount}, GA4 ${WINDSOR_ACCOUNTS.ga4Account}, Instagram ${WINDSOR_ACCOUNTS.instagramAccount}, Lead Ads ${WINDSOR_ACCOUNTS.leadsAccount}`);
  await api('POST', '/api/integrations/marketing/windsor/test');
  ok('Verbindungstest bestanden.');
  say('  Erster Abgleich der letzten 90 Tage läuft (kann 1 bis 2 Minuten dauern) ...');
  const sync = await api('POST', '/api/marketing/sync', { days: 90 });
  const results = Array.isArray(sync?.results) ? sync.results : Object.entries(sync?.results ?? {}).map(([k, v]) => ({ type: k, ...(typeof v === 'object' && v ? v : { message: String(v) }) }));
  for (const r of results) say(`     ${r.ok === false || r.error ? '[!] ' : '[OK]'} ${r.type ?? r.source ?? ''}: ${r.message ?? r.error ?? (r.rows !== undefined ? `${r.rows} Zeilen` : JSON.stringify(r))}`);
});

/* 6) E-Mail-Versand */
await step('6) E-Mail-Versand (Terminerinnerungen, Angebote, Rechnungen)', async () => {
  const cur = await api('GET', '/api/integrations/smtp');
  if (cur?.configured && !OVERWRITE) { ok(`Bereits eingerichtet (${cur.config?.host ?? ''}).`); return; }
  say('  Vorschlag: Postfach carcura@web.de über smtp.web.de. Voraussetzung: bei web.de unter');
  say('  Einstellungen -> POP3/IMAP den Zugriff für externe Programme freischalten.');
  if (!env('CM_SMTP_PASS') && env('CM_UEBERSPRINGEN') === '1') { warn('Übersprungen. Später unter Einstellungen -> Integrationen -> E-Mail nachholen.'); return 'skip'; }
  const host = env('CM_SMTP_HOST') || (await ask('  SMTP-Server', 'smtp.web.de'));
  const port = Number(env('CM_SMTP_PORT') || (await ask('  Port', '587')));
  const user = env('CM_SMTP_USER') || (await ask('  Benutzername', 'carcura@web.de'));
  const pass = await secret('Passwort des Postfachs', 'CM_SMTP_PASS');
  if (!pass) { warn('Übersprungen. Später unter Einstellungen -> Integrationen -> E-Mail nachholen.'); return 'skip'; }
  await api('PUT', '/api/integrations/smtp', { host, port, secure: port === 465, user, pass, fromName: 'Carcura', fromEmail: user.includes('@') ? user : COMPANY.email, replyTo: COMPANY.email });
  ok('Zugangsdaten gespeichert.');
  const t = await api('POST', '/api/integrations/smtp/test');
  ok(`Testnachricht an ${t?.to ?? me.user?.email} gesendet. Bitte Posteingang prüfen.`);
});

/* 7) KI-Assistent */
await step('7) KI-Assistent (Claude)', async () => {
  const cur = await api('GET', '/api/integrations/claude');
  if (cur?.configured && !OVERWRITE) { ok(`Bereits eingerichtet (Modell ${cur.model}).`); return; }
  const apiKey = await secret('Anthropic API-Key', 'CM_CLAUDE_KEY', 'Zu erstellen unter https://console.anthropic.com -> API Keys (Abrechnung nach Verbrauch, typischerweise wenige Euro pro Monat).');
  if (!apiKey) { warn('Übersprungen. Der Assistent bleibt bis dahin ausgeblendet.'); return 'skip'; }
  await api('PUT', '/api/integrations/claude', { apiKey, model: 'claude-sonnet-5' });
  ok('Gespeichert (Modell claude-sonnet-5, personenbezogene Daten werden pseudonymisiert).');
});

/* 8) Wettbewerber-Monitoring */
await step('8) Wettbewerber-Monitoring (Google Places)', async () => {
  const cur = await api('GET', '/api/integrations/google_places');
  if (cur?.configured && !OVERWRITE) { ok('Bereits eingerichtet.'); return; }
  const apiKey = await secret('Google-Places-API-Key', 'CM_PLACES_KEY', 'Google Cloud Console -> APIs -> "Places API (New)" aktivieren -> Anmeldedaten -> API-Schlüssel. Bis 200 USD/Monat Guthaben kostenlos.');
  if (!apiKey) { warn('Übersprungen. Später unter Einstellungen -> Integrationen -> Wettbewerber nachholen.'); return 'skip'; }
  await api('PUT', '/api/integrations/google_places', { apiKey, queries: PLACES_QUERIES, radiusKm: 40 });
  ok(`Suchbegriffe: ${PLACES_QUERIES.join(' | ')}`);
  const scan = await api('POST', '/api/competitors/scan');
  ok(`Erster Scan: ${scan?.found ?? scan?.count ?? '?'} Einträge gefunden.`);
});

/* 9) Website-Anbindung */
await step('9) Website-Lead-Eingang (carcura.info -> Manager)', async () => {
  const t = await api('GET', '/api/company/website-lead-token');
  say(`  Endpunkt: ${t.endpoint}`);
  say(`  Token:    ${t.token}`);
  say('  Der Endpunkt ist erst erreichbar, sobald der Manager eine öffentliche HTTPS-Adresse hat');
  say('  (siehe ANLEITUNG.md, Teil 6). Bis dahin laufen Website-Anfragen weiter über das WordPress-Plugin.');
});

/* Zusammenfassung */
say('\n=====================================================');
say(' Ergebnis');
say('=====================================================');
for (const d of done) say(`  [OK] ${d}`);
for (const s of skipped) say(`  [--] ${s}`);
say(`\nNächste Schritte im Browser (${base}):`);
say('  - Einstellungen -> Firma: Steuernummer und Bankverbindung eintragen (für Rechnungen).');
say('  - Einstellungen -> Konto: Zwei-Faktor-Anmeldung aktivieren.');
say('  - Leistungen: Preise und Zeiten prüfen; Abo-Leistungen sind als Monatspreis hinterlegt.');
rl.close();
