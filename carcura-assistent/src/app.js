// Die eigentliche Logik: Webhooks von WhatsApp, Anfragen von der Website, Auswertungen.
// Ohne HTTP-Server testbar; server.js hängt das nur an Port und Zeitplan.

import crypto from "node:crypto";
import { normalizeNumber } from "./config.js";
import { verifySignature } from "./whatsapp.js";
import { dateTimeText, weatherText, localParts } from "./context.js";
import { nextId } from "./store.js";
import { leadStats } from "./tools.js";

const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };

export class App {
  constructor({ cfg, store, wa, notifier, agent, fetchImpl = globalThis.fetch, log = console }) {
    Object.assign(this, { cfg, store, wa, notifier, agent, fetchImpl, log });
    this.seen = new Set(store.get("seen", []));
    this.strangers = new Map();
  }

  ownerByNumber(number) {
    const n = normalizeNumber(number);
    return this.cfg.owners.find((o) => o.number === n) || null;
  }

  // ---------- WhatsApp-Webhook ----------

  verifyWebhook(query) {
    if (query.get("hub.mode") === "subscribe" && query.get("hub.verify_token") === this.cfg.wa.verifyToken) {
      return { status: 200, body: query.get("hub.challenge") || "" };
    }
    return { status: 403, body: "forbidden" };
  }

  // Antwortet Meta sofort; die Verarbeitung läuft danach weiter (Promise wird zurückgegeben für Tests).
  receiveWebhook(rawBody, headers) {
    if (!verifySignature(rawBody, headers["x-hub-signature-256"], this.cfg.wa.appSecret)) {
      return { status: 401, body: "invalid signature", done: Promise.resolve() };
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return { status: 400, body: "bad json", done: Promise.resolve() };
    }
    const jobs = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          if (this.seen.has(msg.id)) continue; // Meta liefert gelegentlich doppelt
          this.remember(msg.id);
          jobs.push(this.handleMessage(msg).catch((err) => this.log.error("[webhook]", err)));
        }
      }
    }
    return { status: 200, body: "ok", done: Promise.all(jobs) };
  }

  remember(id) {
    this.seen.add(id);
    if (this.seen.size > 500) this.seen = new Set([...this.seen].slice(-300));
    this.store.set("seen", [...this.seen].slice(-300));
  }

  async handleMessage(msg) {
    const owner = this.ownerByNumber(msg.from);
    if (!owner) return this.handleStranger(msg);

    this.wa.markRead(msg.id);
    await this.notifier.onInbound(owner);

    const parts = await this.messageToContent(msg, owner);
    if (!parts) return;

    const events = this.notifier.takeEvents(owner.number);
    const weather = await weatherText(this.cfg.weather, this.fetchImpl);
    let header = `[Kontext: ${dateTimeText(this.cfg.timezone)}`;
    if (weather) header += ` · Wetter ${weather}`;
    header += ` · Du schreibst mit ${owner.name}`;
    if (events.length) {
      header += ` · Seit seiner letzten Nachricht passiert:\n` + events.map((e) => `• ${e.text}`).join("\n");
    }
    header += "]";

    let reply;
    try {
      reply = await this.agent.chat(owner, [{ type: "text", text: header }, ...parts]);
    } catch (err) {
      this.log.error(`[chat] ${owner.name}:`, err);
      reply = "Uff, da hakt gerade was bei mir 😅 Versuch's bitte gleich nochmal. Wenn's bleibt, sag Bescheid.";
    }
    if (reply) await this.wa.sendText(owner.number, reply);
  }

  async messageToContent(msg, owner) {
    switch (msg.type) {
      case "text":
        return [{ type: "text", text: msg.text?.body || "" }];
      case "button":
        return [{ type: "text", text: msg.button?.text || "" }];
      case "interactive":
        return [{ type: "text", text: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "" }];
      case "image":
      case "document":
        return this.mediaToContent(msg, owner);
      case "audio":
        await this.wa.sendText(owner.number, "Sprachnachrichten kann ich noch nicht abhören 🙉 Schreib's mir kurz als Text, dann leg ich los.");
        return null;
      case "reaction":
        return null;
      default:
        await this.wa.sendText(owner.number, `Mit "${msg.type}" kann ich noch nichts anfangen – schick mir Text, ein Foto oder ein PDF.`);
        return null;
    }
  }

  async mediaToContent(msg, owner) {
    const media = msg[msg.type];
    const caption = media.caption || "";
    let file;
    try {
      file = await this.wa.downloadMedia(media.id);
    } catch (err) {
      await this.wa.sendText(owner.number, `Die Datei konnte ich nicht laden (${err.message}). Schick sie bitte nochmal.`);
      return null;
    }
    const mime = (file.mimeType || media.mime_type || "").split(";")[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const original = media.filename ? `_${media.filename}` : `.${EXT[mime] || "bin"}`;
    const name = `${day}_${owner.name}_${msg.id.slice(-8)}${original}`;
    this.store.saveInboxFile(name, file.buffer);
    this.store.update("inbox", [], (all) => [...all, { datei: name, typ: mime, von: owner.name, at: new Date().toISOString(), beschriftung: caption }]);

    const note = `[Datei im Eingang gespeichert: ${name}${caption ? ` · Beschriftung: ${caption}` : ""}]`;
    const data = file.buffer.toString("base64");
    if (CLAUDE_IMAGE_TYPES.includes(mime)) {
      return [{ type: "image", source: { type: "base64", media_type: mime, data } }, { type: "text", text: note }];
    }
    if (mime === "application/pdf") {
      return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }, { type: "text", text: note }];
    }
    return [{ type: "text", text: `${note} (Dateityp ${mime || "unbekannt"} kann ich nicht lesen, nur ablegen.)` }];
  }

  async handleStranger(msg) {
    // Kunden sollen nicht hier landen: einmal pro Tag freundlich weiterleiten.
    const last = this.strangers.get(msg.from) || 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    this.strangers.set(msg.from, Date.now());
    await this.wa.sendText(msg.from,
      "Hi! 👋 Das ist die interne Nummer des Carcura-Assistenten. Für Anfragen und Termine erreichst du uns unter +49 170 6669516 (auch WhatsApp) oder über carcura.info/anfragen.");
  }

  // ---------- Anfragen von der Website ----------

  checkSecret(headers) {
    const given = Buffer.from(String(headers["x-carcura-secret"] || ""));
    const expected = Buffer.from(this.cfg.leadSecret);
    return expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
  }

  async receiveLead(rawBody, headers) {
    if (!this.checkSecret(headers)) return { status: 401, body: { ok: false } };
    let p;
    try {
      p = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return { status: 400, body: { ok: false, error: "bad json" } };
    }
    if (p.website) return { status: 200, body: { ok: true, ignored: "honeypot" } };

    const lead = {
      id: nextId(this.store, "L"),
      eingang: new Date().toISOString(),
      quelle: p.source === "anfrage_formular" ? "Website" : (p.source || "Website"),
      status: "neu",
      kundentyp: p.customer_type || "privat",
      name: clean(p.name, 120),
      telefon: clean(p.phone, 60),
      email: clean(p.email, 160),
      fahrzeug: clean(p.vehicle, 160),
      leistung: clean(p.service, 600),
      nachricht: clean(p.message, 4000),
      gclid: p.gclid ? "ja" : "",
      notizen: [],
    };
    this.store.update("leads", [], (all) => [...all, lead]);

    const text = await this.leadMessage(lead);
    const preview = `Neue Anfrage ${lead.id}: ${lead.leistung || "Anfrage"} von ${lead.name || "Kunde"}`;
    const delivered = await this.notifier.sendAll(text, preview);
    for (const owner of this.cfg.owners) {
      this.notifier.addEvent(owner.number, `Neue Website-Anfrage ${lead.id} wurde euch gemeldet: ${lead.leistung} – ${lead.name}, ${lead.fahrzeug}. Status: neu.`);
    }
    return { status: 200, body: { ok: true, id: lead.id, delivered } };
  }

  async leadMessage(lead) {
    const facts = [
      `Anfrage ${lead.id} (${lead.kundentyp})`,
      `Leistung: ${lead.leistung || "–"}`,
      `Name: ${lead.name || "–"}`,
      `Fahrzeug: ${lead.fahrzeug || "–"}`,
      `Telefon: ${lead.telefon || "–"}`,
      `E-Mail: ${lead.email || "–"}`,
      lead.nachricht ? `Details:\n${lead.nachricht}` : "",
    ].filter(Boolean).join("\n");

    let intro = "";
    try {
      const weather = await weatherText(this.cfg.weather, this.fetchImpl);
      intro = await this.agent.write(
        `[Kontext: ${dateTimeText(this.cfg.timezone)}${weather ? ` · Wetter ${weather}` : ""}]\n` +
        `Schreib Alex und Richy 1–3 lockere Sätze für WhatsApp zu dieser neuen Anfrage: kurzer Gruß passend zur Tageszeit, ` +
        `vielleicht ein Satz zum Wetter, dann die Anfrage in einem Satz nennen und fragen, ob du per Mail nach einem Termin fragen sollst ` +
        `oder ob einer von ihnen anruft – und ob du den Termin eintragen sollst, sobald sie Datum und Uhrzeit nennen. ` +
        `Keine Kontaktdaten wiederholen, die folgen darunter.\n\n${facts}`,
      );
    } catch (err) {
      this.log.error("[lead] Formulierung fehlgeschlagen:", err.message);
    }
    if (!intro) {
      intro = `Ey Jungs, neue Anfrage reingekommen: *${lead.leistung || "Anfrage"}*. Soll ich per Mail nach einem Termin fragen oder ruft einer von euch an?`;
    }
    return `${intro}\n\n${facts}`;
  }

  // ---------- Auswertungen ----------

  async receiveReport(rawBody, headers) {
    if (!this.checkSecret(headers)) return { status: 401, body: { ok: false } };
    let p;
    try {
      p = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return { status: 400, body: { ok: false } };
    }
    const text = clean(p.text, 12000);
    if (!text) return { status: 400, body: { ok: false, error: "text fehlt" } };
    const delivered = await this.notifier.sendAll(text, p.preview || "Die Wochenauswertung ist da");
    for (const owner of this.cfg.owners) {
      this.notifier.addEvent(owner.number, `Auswertung wurde geschickt: ${text.slice(0, 600)}`);
    }
    return { status: 200, body: { ok: true, delivered } };
  }

  // Wird regelmäßig aufgerufen; schickt montags die Anfragen-Übersicht der Woche.
  async weeklyTick(now = new Date()) {
    const w = this.cfg.weeklySummary;
    if (!w.enabled) return false;
    const t = localParts(this.cfg.timezone, now);
    if (t.weekday !== w.weekday || t.hour < w.hour) return false;
    if (this.store.get("weekly_last", "") === t.day) return false;
    this.store.set("weekly_last", t.day);

    const stats = leadStats(this.store.get("leads", []), 7, now.getTime());
    let text = "";
    try {
      text = await this.agent.write(
        `Schreib Alex und Richy eine kurze, lockere Wochenübersicht ihrer Anfragen für WhatsApp (Montagmorgen). ` +
        `Nenne Anzahl, was angefragt wurde und welche Anfragen noch offen sind (mit ID). Nur diese Zahlen verwenden:\n${JSON.stringify(stats)}`,
      );
    } catch (err) {
      this.log.error("[weekly]", err.message);
    }
    if (!text) {
      text = `Moin Jungs, Wochenrückblick: *${stats.neue_anfragen}* neue Anfragen in den letzten 7 Tagen. Noch offen: ${stats.noch_offen.map((l) => l.id).join(", ") || "nichts"}.`;
    }
    await this.notifier.sendAll(text, `Wochenrückblick: ${stats.neue_anfragen} neue Anfragen`);
    return true;
  }
}

function clean(value, max) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}
