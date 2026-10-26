// Tests ohne echte Zugänge: WhatsApp, Claude, WordPress und E-Mail sind nachgebaut.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { Store } from "../src/store.js";
import { buildApp } from "../src/server.js";
import { templateSafe, splitText } from "../src/whatsapp.js";

const ALEX = "4917066695160";
const RICHY = "4915100000000";

function setup({ responses = [], pageRaw = "<p>Innenreinigung ab 90 €</p>", insights, gbp } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "carcura-"));
  const cfg = loadConfig({
    OWNERS: `Alex:+49 170 66695160,Richy:0151 00000000`,
    WA_TOKEN: "t", WA_PHONE_NUMBER_ID: "123", WA_VERIFY_TOKEN: "verify", WA_APP_SECRET: "appsecret",
    LEAD_SECRET: "leadsecret", DATA_DIR: dir, CLAUDE_FALLBACKS: "on",
  });
  const sent = [];
  const wa = {
    sendText: async (to, text) => { sent.push({ to, type: "text", text }); },
    sendTemplate: async (to, params) => { sent.push({ to, type: "template", params }); },
    markRead: async () => {},
    downloadMedia: async () => ({ buffer: Buffer.from("%PDF-1.4 test"), mimeType: "application/pdf" }),
  };
  const calls = [];
  const queue = [...responses];
  const respond = async (params) => {
    calls.push(structuredClone(params));
    const next = queue.shift();
    if (!next) return { stop_reason: "end_turn", content: [{ type: "text", text: "Alles klar 👍" }] };
    return typeof next === "function" ? next(params) : next;
  };
  const client = { messages: { create: respond }, beta: { messages: { create: respond } } };
  const page = { raw: pageRaw };
  const wp = {
    configured: true,
    findPages: async () => [{ id: 311, title: "Leistungen", url: "https://carcura.info/leistungen/" }],
    listPages: async () => [{ id: 311, title: "Leistungen", url: "https://carcura.info/leistungen/" }],
    getPage: async (id) => ({ id, title: "Leistungen", url: "https://carcura.info/leistungen/", raw: page.raw }),
    updatePageContent: async (id, raw) => { page.raw = raw; return { id, url: "https://carcura.info/leistungen/" }; },
  };
  const mails = [];
  const mailer = { send: async (m) => { mails.push(m); } };
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) }); // kein Wetter im Test
  const store = new Store(dir);
  const app = buildApp(cfg, { store, wa, client, wp, mailer, fetchImpl, insights, gbp });
  app.log = { error: () => {} };
  app.notifier.log = { error: () => {} };
  return { app, cfg, sent, calls, page, mails, store, dir };
}

function sign(body, secret = "appsecret") {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function webhookBody(from, text, id = crypto.randomUUID()) {
  return Buffer.from(JSON.stringify({
    entry: [{ changes: [{ value: { messages: [{ id, from, type: "text", text: { body: text } }] } }] }],
  }));
}

async function sendWhatsApp(app, from, text, id) {
  const body = webhookBody(from, text, id);
  const r = app.receiveWebhook(body, { "x-hub-signature-256": sign(body) });
  await r.done;
  return r;
}

const toolUse = (name, input, id = "tu_" + name) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }] });
const say = (text) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

test("Nummern werden ins WhatsApp-Format gebracht", () => {
  const { cfg } = setup();
  assert.deepEqual(cfg.owners.map((o) => o.number), [ALEX, RICHY]);
});

test("Meta-Bestätigung des Webhooks", () => {
  const { app } = setup();
  const ok = app.verifyWebhook(new URLSearchParams("hub.mode=subscribe&hub.verify_token=verify&hub.challenge=42"));
  assert.deepEqual(ok, { status: 200, body: "42" });
  const bad = app.verifyWebhook(new URLSearchParams("hub.mode=subscribe&hub.verify_token=falsch&hub.challenge=42"));
  assert.equal(bad.status, 403);
});

test("Falsche Signatur wird abgelehnt", async () => {
  const { app, sent } = setup();
  const body = webhookBody(ALEX, "hi");
  const r = app.receiveWebhook(body, { "x-hub-signature-256": sign(body, "falsch") });
  await r.done;
  assert.equal(r.status, 401);
  assert.equal(sent.length, 0);
});

test("Chat: Inhaber schreibt, KI nutzt Werkzeug und antwortet", async () => {
  const { app, sent, calls } = setup({ responses: [toolUse("anfragen_liste", {}), say("Ey Alex, aktuell nix offen 😎")] });
  await sendWhatsApp(app, ALEX, "was ist offen?");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, ALEX);
  assert.match(sent[0].text, /nix offen/);
  // Kontextzeile steht in der Nutzernachricht, System-Prompt bleibt fest
  const first = calls[0];
  assert.match(first.messages[0].content[0].text, /\[Kontext: .* Du schreibst mit Alex\]/);
  assert.equal(first.model, "claude-opus-5-5");
  assert.deepEqual(first.thinking, { type: "adaptive" });
  assert.deepEqual(first.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(first.fallbacks, "default");
  // Zweiter Aufruf enthält Werkzeugergebnis
  const second = calls[1];
  assert.equal(second.messages.at(-1).content[0].type, "tool_result");
  assert.equal(second.system, first.system);
});

test("Verlauf wird nur angehängt (Präfix bleibt identisch)", async () => {
  const { app, calls } = setup({ responses: [say("Moin!"), say("Klar.")] });
  await sendWhatsApp(app, ALEX, "moin");
  await sendWhatsApp(app, ALEX, "noch was");
  const [a, b] = calls;
  assert.deepEqual(b.messages.slice(0, a.messages.length), a.messages);
  assert.equal(b.messages.length, a.messages.length + 2);
});

test("Doppelt zugestellte Nachricht wird nur einmal bearbeitet", async () => {
  const { app, sent } = setup({ responses: [say("1"), say("2")] });
  await sendWhatsApp(app, ALEX, "hi", "wamid.1");
  await sendWhatsApp(app, ALEX, "hi", "wamid.1");
  assert.equal(sent.length, 1);
});

test("Website-Anfrage: beide bekommen Bescheid, außerhalb des Fensters per Vorlage", async () => {
  const { app, sent, store } = setup({ responses: [say("Ey Jungs, guten Mittag! Neue Anfrage für Basic Innen & Außen – Mail oder ruft ihr an?")] });
  const body = Buffer.from(JSON.stringify({
    name: "Max Muster", email: "max@example.com", phone: "0170 1", vehicle: "VW Golf",
    service: "Basic Innen & Außen", message: "Gewählte Leistungen: ...", customer_type: "privat", source: "anfrage_formular", website: "",
  }));
  const r = await app.receiveLead(body, { "x-carcura-secret": "leadsecret" });
  assert.equal(r.status, 200);
  assert.equal(r.body.id, "L-0001");
  assert.equal(store.get("leads", []).length, 1);
  // Noch nie geschrieben → Fenster zu → Vorlage an beide
  assert.deepEqual(sent.map((s) => [s.to, s.type]), [[ALEX, "template"], [RICHY, "template"]]);
  assert.doesNotMatch(sent[0].params[0], /\n/);

  // Alex antwortet → erst die volle Meldung nachliefern, dann KI-Antwort
  sent.length = 0;
  await sendWhatsApp(app, ALEX, "schreib ihm");
  assert.equal(sent[0].type, "text");
  assert.match(sent[0].text, /Max Muster/);
  assert.match(sent[0].text, /L-0001/);
  assert.equal(sent.length, 2);
});

test("Website-Anfrage: falsches Geheimnis und Honeypot", async () => {
  const { app, store, sent } = setup();
  const body = Buffer.from(JSON.stringify({ name: "Spam", website: "http://spam" }));
  assert.equal((await app.receiveLead(body, { "x-carcura-secret": "nope" })).status, 401);
  const r = await app.receiveLead(body, { "x-carcura-secret": "leadsecret" });
  assert.equal(r.body.ignored, "honeypot");
  assert.equal(store.get("leads", []).length, 0);
  assert.equal(sent.length, 0);
});

test("Website-Änderung nur nach Bestätigung in neuer Nachricht", async () => {
  const { app, page, sent } = setup({
    responses: [
      toolUse("website_aenderung_vorschlagen", { seiten_id: 311, suchen: "ab 90 €", ersetzen: "ab 95 €", grund: "Preis" }, "tu1"),
      // Versuch, im selben Zug auszuführen → muss scheitern
      (params) => {
        assert.match(params.messages.at(-1).content[0].content, /V-0001/);
        return toolUse("website_aenderung_ausfuehren", { vorschlag_id: "V-0001" }, "tu2");
      },
      (params) => {
        const res = params.messages.at(-1).content[0];
        assert.equal(res.is_error, true);
        assert.match(res.content, /Noch keine Bestätigung/);
        return say("Vorschlag V-0001: 90 € → 95 €. Passt so?");
      },
      toolUse("website_aenderung_ausfuehren", { vorschlag_id: "V-0001" }, "tu3"),
      say("Erledigt ✅"),
    ],
  });
  await sendWhatsApp(app, ALEX, "mach innenreinigung 95");
  assert.equal(page.raw, "<p>Innenreinigung ab 90 €</p>");
  await sendWhatsApp(app, ALEX, "ja passt");
  assert.equal(page.raw, "<p>Innenreinigung ab 95 €</p>");
  assert.match(sent.at(-1).text, /Erledigt/);
});

test("Vorschlag eines anderen Inhabers kann nicht ausgeführt werden", async () => {
  const { app, page } = setup({
    responses: [
      toolUse("website_aenderung_vorschlagen", { seiten_id: 311, suchen: "ab 90 €", ersetzen: "ab 99 €", grund: "x" }),
      say("ok?"),
      toolUse("website_aenderung_ausfuehren", { vorschlag_id: "V-0001" }),
      say("geht nicht"),
    ],
  });
  await sendWhatsApp(app, ALEX, "ändern");
  await sendWhatsApp(app, RICHY, "ja mach");
  assert.equal(page.raw, "<p>Innenreinigung ab 90 €</p>");
});

test("E-Mail: Entwurf, dann Senden nach OK, Anfrage wird kontaktiert", async () => {
  const { app, mails, store } = setup({
    responses: [
      toolUse("anfrage_eintragen", { name: "Lena", quelle: "Instagram", email: "lena@example.com", leistung: "Keramik" }),
      toolUse("email_entwurf", { an: "lena@example.com", betreff: "Dein Termin", text: "Hi Lena …", anfrage_id: "L-0001" }),
      say("Entwurf E-0001 – passt so?"),
      toolUse("email_senden", { entwurf_id: "E-0001" }),
      say("Ist raus ✅"),
    ],
  });
  await sendWhatsApp(app, RICHY, "lead von insta, schreib ihr");
  assert.equal(mails.length, 0);
  await sendWhatsApp(app, RICHY, "ja");
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "lena@example.com");
  assert.equal(store.get("leads", [])[0].status, "kontaktiert");
});

test("Partner benachrichtigen und als Ereignis merken", async () => {
  const { app, sent, calls } = setup({
    responses: [toolUse("partner_benachrichtigen", { text: "ich ruf den Golf-Kunden an" }), say("Hab Richy Bescheid gegeben."), say("Alles klar")],
  });
  await app.notifier.onInbound(app.cfg.owners[1]); // Richys Fenster offen
  await sendWhatsApp(app, ALEX, "sag richy ich ruf an");
  assert.ok(sent.some((s) => s.to === RICHY && s.type === "text" && /Von Alex/.test(s.text)));
  await sendWhatsApp(app, RICHY, "ok");
  const ctx = calls.at(-1).messages.at(-1).content[0].text;
  assert.match(ctx, /Alex hat dir über mich geschrieben/);
});

test("PDF-Beleg landet im Eingang und geht als Dokument an die KI", async () => {
  const { app, calls, store, dir } = setup({ responses: [say("Rechnung erfasst?")] });
  const body = Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: { messages: [{
    id: "wamid.doc", from: ALEX, type: "document", document: { id: "m1", filename: "rechnung.pdf", mime_type: "application/pdf" },
  }] } }] }] }));
  await app.receiveWebhook(body, { "x-hub-signature-256": sign(body) }).done;
  const inbox = store.get("inbox", []);
  assert.equal(inbox.length, 1);
  assert.ok(fs.existsSync(path.join(dir, "inbox", inbox[0].datei)));
  const content = calls[0].messages[0].content;
  assert.equal(content[1].type, "document");
});

test("Fremde Nummer bekommt einmal am Tag einen Hinweis", async () => {
  const { app, sent } = setup();
  await sendWhatsApp(app, "4911111111", "hallo");
  await sendWhatsApp(app, "4911111111", "hallo?");
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /6669516/);
});

test("Wochenübersicht montags ab 9 Uhr, nur einmal", async () => {
  const { app, sent } = setup({ responses: [say("Moin Jungs, ruhige Woche: 0 Anfragen.")] });
  const sundayEvening = new Date("2026-10-25T18:00:00Z");
  const monday0700 = new Date("2026-10-26T06:00:00Z"); // 07:00 in Berlin
  const monday0910 = new Date("2026-10-26T08:10:00Z"); // 09:10 in Berlin
  assert.equal(await app.weeklyTick(sundayEvening), false);
  assert.equal(await app.weeklyTick(monday0700), false);
  assert.equal(await app.weeklyTick(monday0910), true);
  assert.equal(await app.weeklyTick(monday0910), false);
  assert.equal(sent.length, 2);
});

test("Auswertung von außen wird an beide weitergeleitet", async () => {
  const { app, sent } = setup();
  const r = await app.receiveReport(Buffer.from(JSON.stringify({ text: "Woche 43: 12 Klicks, 2 Anfragen" })), { "x-carcura-secret": "leadsecret" });
  assert.equal(r.status, 200);
  assert.equal(sent.length, 2);
});

test("Hilfsfunktionen für Vorlagen und lange Texte", () => {
  assert.equal(templateSafe("a\nb\tc     d"), "a · b · c   d");
  const parts = splitText("x".repeat(9000));
  assert.ok(parts.length === 3 && parts.every((p) => p.length <= 4000));
});

test("Firmennummer-Modus: Kunde bekommt nichts, beide werden gemeldet (max. alle 2 h)", async () => {
  const { app, cfg, sent } = setup();
  cfg.customerChats = "melden";
  await sendWhatsApp(app, "4917699999999", "Was kostet Innenreinigung beim Golf?");
  await sendWhatsApp(app, "4917699999999", "Und habt ihr Samstag Zeit?");
  assert.equal(sent.filter((m) => m.to === "4917699999999").length, 0);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((m) => m.to).sort(), [ALEX, RICHY].sort());
  assert.match(JSON.stringify(sent[0]), /Innenreinigung/);
  // Folgenachricht landet als Kontext für die KI
  const events = app.notifier.takeEvents(ALEX);
  assert.equal(events.length, 2);
});

test("Bot-Nummer als Inhaber wird abgelehnt", async () => {
  const { checkConfig } = await import("../src/config.js");
  const cfg = loadConfig({ OWNERS: "Alex:0170 6669516", WA_BOT_NUMBER: "+49 170 6669516", WA_TOKEN: "t", WA_PHONE_NUMBER_ID: "1", WA_VERIFY_TOKEN: "v", WA_APP_SECRET: "a", LEAD_SECRET: "l" });
  assert.match(checkConfig(cfg).join(), /Bot-Nummer/);
});

// ---------- Zahlen und Bewertungen ----------

import { Insights, originalText } from "../src/insights.js";

function windsorFake(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const connector = u.pathname.slice(1);
    const fields = u.searchParams.get("fields");
    const data = routes(connector, fields, u.searchParams) ?? [];
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
  return { fetchImpl, calls };
}

test("Windsor: Zahlen werden richtig zusammengefasst", async () => {
  const { fetchImpl, calls } = windsorFake((c, f) => {
    if (c === "google_ads") return [{ campaign: "Suche", spend: 33.69, clicks: 50, impressions: 994, conversions: 3 }];
    if (c === "googleanalytics4" && f.startsWith("session")) return [{ session_default_channel_group: "Paid Search", sessions: 37, totalusers: 29, engaged_sessions: 22 }, { session_default_channel_group: "Direct", sessions: 42, totalusers: 38, engaged_sessions: 11 }];
    if (c === "googleanalytics4") return [{ event_name: "form_start", event_count: 6 }, { event_name: "cc_anfrage", event_count: 2 }, { event_name: "cc_whatsapp", event_count: 3 }];
    if (c === "google_my_business" && f.includes("review_id")) return [{ review_id: "r1", review_create_time: "2026-10-20T10:00:00Z", review_reviewer: "Uwe", review_star_rating: "FIVE", review_comment: "(Translated by Google) Great\n\n(Original)\nSuper Arbeit", review_average_rating_total: 4.8, review_total_count: 15 }];
    if (c === "google_my_business") return [{ impressions: 400, website_clicks: 9, call_clicks: 1, direction_requests: 12 }];
  });
  const ins = new Insights({ windsor: { apiKey: "k", adsAccount: "919-151-5213", ga4Account: "548650753", gbpLocation: "locations/1" }, fetchImpl, log: { error: () => {} } });
  const p = await ins.period(7, Date.parse("2026-10-26T08:00:00Z"));
  assert.equal(p.zeitraum, "2026-10-19 bis 2026-10-25");
  assert.equal(p.vergleich, "2026-10-12 bis 2026-10-18");
  assert.equal(p.google_ads.aktuell.ausgaben_eur, 33.69);
  assert.equal(p.google_ads.aktuell.kosten_pro_klick_eur, 0.67);
  assert.equal(p.website.aktuell.besuche, 79);
  assert.equal(p.website.aktuell.fast_anfragen, 4);
  assert.equal(p.google_profil.routen, 12);
  assert.equal(p.bewertungen.neu[0].text, "Super Arbeit");
  assert.equal(p.bewertungen.neu[0].sterne, 5);
  assert.ok(calls.every((u) => u.includes("api_key=k")));
  assert.ok(calls.some((u) => u.includes("select_accounts=locations%2F1")));
});

test("Windsor: eine ausgefallene Quelle bricht den Bericht nicht ab", async () => {
  const fetchImpl = async (url) => (url.includes("google_ads")
    ? { ok: false, status: 500, json: async () => ({ error: { message: "kaputt" } }) }
    : { ok: true, status: 200, json: async () => ({ data: [] }) });
  const ins = new Insights({ windsor: { apiKey: "k" }, fetchImpl, log: { error: () => {} } });
  const p = await ins.period(7);
  assert.match(p.google_ads.aktuell.fehler, /kaputt/);
  assert.equal(p.website.aktuell.besuche, 0);
});

test("Original-Text aus Google-Übersetzung", () => {
  assert.equal(originalText("(Translated by Google) Nice\n\n(Original)\nSchön"), "Schön");
  assert.equal(originalText("Nur deutsch"), "Nur deutsch");
  assert.equal(originalText(null), "");
});

function reviewSetup({ list, gbpConfigured, responses }) {
  const posted = [];
  const insights = { configured: true, recentReviews: async () => list.current, period: async () => ({}) };
  const gbp = { configured: gbpConfigured, reply: async (id, text) => { posted.push({ id, text }); } };
  const ctx = setup({ insights, gbp, responses });
  // Beide haben heute schon geschrieben → 24-h-Fenster offen, Text geht direkt raus.
  for (const o of ctx.cfg.owners) ctx.store.update("owners", {}, (all) => ({ ...all, [o.number]: { lastInbound: Date.now(), pending: [], events: [] } }));
  return { ...ctx, posted };
}

test("Bewertungen: erster Lauf merkt nur, neue 5 Sterne werden automatisch beantwortet und gemeldet", async () => {
  const list = { current: [{ id: "a", name: "Alt", sterne: 5, text: "alt", antwort: "" }] };
  const { app, sent, posted } = reviewSetup({ list, gbpConfigured: true, responses: [say("Danke dir, Uwe! Freut uns, dass der Golf wieder glänzt.\n\nDein Carcura-Team")] });
  assert.equal(await app.reviewTick(), 0);
  assert.equal(sent.length, 0);
  list.current = [...list.current, { id: "b", name: "Uwe Lettery", sterne: 5, text: "Super Arbeit am Golf", antwort: "" }];
  assert.equal(await app.reviewTick(), 1);
  assert.deepEqual(posted.map((p) => p.id), ["b"]);
  assert.equal(sent.length, 2);
  assert.match(sent[0].text, /Hab direkt geantwortet/);
  assert.equal(await app.reviewTick(), 0); // nicht doppelt
});

test("Bewertungen: kritische Bewertung wird nicht automatisch beantwortet, OK postet den Vorschlag", async () => {
  const list = { current: [] };
  const { app, sent, posted, store } = reviewSetup({ list, gbpConfigured: true, responses: [say("Schade, dass es nicht gepasst hat. Ruf uns gern an.\n\nDein Carcura-Team")] });
  await app.reviewTick();
  list.current = [{ id: "c", name: "Kritiker", sterne: 2, text: "War nicht zufrieden", antwort: "" }];
  await app.reviewTick();
  assert.equal(posted.length, 0);
  const draft = store.get("review_drafts", [])[0];
  assert.match(sent[0].text, new RegExp(draft.id));
  // Inhaber sagt ok → KI postet den Vorschlag
  const handlers = app.agent.handlers;
  await handlers.bewertung_antwort_posten({ vorschlag_id: draft.id }, { owner: { number: ALEX, name: "Alex" }, session: { turn: 3 } });
  assert.deepEqual(posted.map((p) => p.id), ["c"]);
});

test("Wochenbericht nimmt Werbe- und Website-Zahlen mit", async () => {
  const insights = { configured: true, recentReviews: async () => [], period: async () => ({ google_ads: { aktuell: { ausgaben_eur: 33.69, klicks: 50 } }, website: { aktuell: { besuche: 79 } } }) };
  const { app, sent, calls } = setup({ insights, responses: [say("Jo Jungs, *33,69 €* Werbung …")] });
  assert.equal(await app.weeklyTick(new Date("2026-10-26T08:10:00Z")), true);
  assert.match(JSON.stringify(calls[0].messages), /33\.69/);
  assert.equal(sent.length, 2);
});
