// Die eigentliche Logik: Webhooks von WhatsApp, Anfragen von der Website, Auswertungen.
// Ohne HTTP-Server testbar; server.js hängt das nur an Port und Zeitplan.

import crypto from "node:crypto";
import { normalizeNumber } from "./config.js";
import { verifySignature } from "./whatsapp.js";
import { dateTimeText, weatherText, localParts } from "./context.js";
import { nextId } from "./store.js";
import { leadStats, reviewDraft, waContacts } from "./tools.js";

const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };

export class App {
  constructor({ cfg, store, wa, notifier, agent, insights = null, gbp = null, fetchImpl = globalThis.fetch, log = console }) {
    Object.assign(this, { cfg, store, wa, notifier, agent, insights, gbp, fetchImpl, log });
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
        const names = {};
        for (const c of value.contacts || []) names[c.wa_id] = c.profile?.name || "";
        for (const msg of value.messages || []) {
          if (this.seen.has(msg.id)) continue; // Meta liefert gelegentlich doppelt
          this.remember(msg.id);
          jobs.push(this.handleMessage(msg, names[msg.from] || "").catch((err) => this.log.error("[webhook]", err)));
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

  async handleMessage(msg, profileName = "") {
    const owner = this.ownerByNumber(msg.from);
    if (!owner) return this.handleStranger(msg, profileName);

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

  // Nachrichten von Nummern, die nicht Alex oder Richy gehören. Je nach KUNDEN_CHATS:
  //   hinweis – eigene Assistenten-Nummer: einmal am Tag auf die Firmennummer verweisen
  //   melden  – Firmennummer (Koexistenz mit der Business-App): Kunde bekommt nichts vom Bot,
  //             Alex und Richy werden benachrichtigt und antworten selbst in der App
  //   still   – nichts tun
  async handleStranger(msg, profileName = "") {
    const mode = this.cfg.customerChats;
    if (mode === "still") return;
    const last = this.strangers.get(msg.from) || 0;

    if (mode === "melden") {
      const preview = customerPreview(msg);
      const who = profileName ? `${profileName} (+${msg.from})` : `+${msg.from}`;
      for (const owner of this.cfg.owners) {
        this.notifier.addEvent(owner.number, `WhatsApp von Kunde ${who}: ${preview}`);
      }
      // Pro Kunde höchstens alle 2 Stunden melden, sonst nervt jede Folgenachricht.
      if (Date.now() - last < 2 * 60 * 60 * 1000) return;
      this.strangers.set(msg.from, Date.now());
      this.store.update("wa_contacts", [], (all) => [...all.slice(-999), { at: new Date().toISOString(), from: msg.from, name: profileName }]);
      await this.tell({
        task: `Ein Kunde (${who}) hat gerade per WhatsApp an die Firmennummer geschrieben. Sag in 1–2 Sätzen Bescheid und frag, wer übernimmt – ` +
          `die Antwort an den Kunden kommt von euch direkt in der WhatsApp-Business-App, du trägst es danach als Anfrage ein, wenn gewünscht.`,
        facts: `📲 *${who}*:\n„${preview}“`,
        preview: `WhatsApp von ${profileName || "einem Kunden"}: ${preview.slice(0, 80)}`,
        fallback: (o) => `Ey ${o.spitznamen[0]}, neue WhatsApp an die Firmennummer – wer übernimmt?`,
      });
      return;
    }

    // Kunden sollen nicht hier landen: einmal pro Tag freundlich weiterleiten.
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

    const facts = leadFacts(lead);
    const delivered = await this.tell({
      task: `Neue Anfrage über die Website. 1–3 lockere Sätze: Gruß passend zur Tageszeit, vielleicht ein Halbsatz zum Wetter, ` +
        `die Anfrage in einem Satz nennen, dann fragen, ob du per Mail nach einem Termin fragen sollst oder ob er bzw. der andere anruft – ` +
        `und ob du den Termin einträgst, sobald Datum und Uhrzeit feststehen. Keine Kontaktdaten wiederholen, die folgen darunter.\n\n${facts}`,
      facts,
      preview: `Neue Anfrage ${lead.id}: ${lead.leistung || "Anfrage"} von ${lead.name || "Kunde"}`,
      fallback: (o) => `Ey ${o.spitznamen[0]}, neue Anfrage: *${lead.leistung || "Anfrage"}*. Mail mit Terminfrage oder ruft ihr an?`,
    });
    for (const owner of this.cfg.owners) {
      this.notifier.addEvent(owner.number, `Neue Website-Anfrage ${lead.id} wurde euch gemeldet: ${lead.leistung} – ${lead.name}, ${lead.fahrzeug}. Status: neu.`);
    }
    return { status: 200, body: { ok: true, id: lead.id, delivered } };
  }

  // Schickt jedem Inhaber eine eigene, frisch formulierte Nachricht. Feste Fakten (Kontaktdaten,
  // Bewertungstext, IDs) stehen unverändert darunter, damit die KI daran nichts verdreht.
  async tell({ task, facts = "", preview, fallback, maxTokens }) {
    let weather = "";
    try {
      weather = await weatherText(this.cfg.weather, this.fetchImpl);
    } catch {
      weather = "";
    }
    const context = `[Kontext: ${dateTimeText(this.cfg.timezone)}${weather ? ` · Wetter ${weather}` : ""}]`;
    const results = {};
    for (const owner of this.cfg.owners) {
      const other = this.cfg.owners.filter((o) => o.number !== owner.number).map((o) => o.name).join(" und ") || "niemand";
      const recent = this.store.get(`openers-${owner.number}`, []);
      let intro = "";
      try {
        intro = await this.agent.write(
          `${context}\nDu schreibst jetzt NUR an ${owner.name} (der andere Inhaber ist ${other}). ` +
          `Sprich ihn direkt an, z. B. mit ${owner.spitznamen.join(" oder ")} – Anrede, Einstieg und Satzbau jedes Mal anders, wie ein Kumpel, nicht wie eine Vorlage. ` +
          (recent.length ? `So hast du zuletzt angefangen, das NICHT wiederholen: ${recent.map((r) => `"${r}"`).join(", ")}. ` : "") +
          `Gib nur die Nachricht aus.\n\n${task}`,
          maxTokens,
        );
      } catch (err) {
        this.log.error("[tell] Formulierung fehlgeschlagen:", err.message);
      }
      if (!intro) intro = fallback(owner);
      this.store.set(`openers-${owner.number}`, [...recent, intro.slice(0, 45)].slice(-6));
      const text = facts ? `${intro}\n\n${facts}` : intro;
      try {
        results[owner.name] = await this.notifier.send(owner, text, preview);
      } catch (err) {
        results[owner.name] = `fehler: ${err.message}`;
        this.log.error(`[tell] an ${owner.name} fehlgeschlagen:`, err.message);
      }
    }
    return results;
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
    const delivered = await this.tell({
      task: `Eine fertige Auswertung ist reingekommen (steht darunter). Schreib nur einen kurzen, lockeren Einleitungssatz dazu, keine Zahlen wiederholen.`,
      facts: text,
      preview: p.preview || "Die Wochenauswertung ist da",
      fallback: (o) => `Ey ${o.spitznamen[0]}, die Auswertung ist da:`,
    });
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
    const whatsapp = waContacts(this.store, 7, now.getTime());
    let zahlen = null;
    if (this.insights?.configured) {
      try {
        zahlen = await this.insights.period(7, now.getTime());
      } catch (err) {
        this.log.error("[weekly] Zahlen:", err.message);
      }
    }
    const daten = JSON.stringify({ eigene_anfragen: stats, whatsapp_kontakte: whatsapp, zahlen });
    const ads = zahlen?.google_ads?.aktuell;
    const web = zahlen?.website?.aktuell;
    const fallbackBody = [
      ads && !ads.fehler ? `• Google Ads: *${ads.ausgaben_eur} €* für ${ads.klicks} Klicks` : "",
      web && !web.fehler ? `• Website: ${web.besuche} Besuche, ${web.anfragen_gesendet} Anfragen gesendet, ${web.fast_anfragen} fast` : "",
      `• Anfragen: *${stats.neue_anfragen}* neu, WhatsApp-Kontakte: ${whatsapp.anzahl_kunden}`,
      `• Offen: ${stats.noch_offen.map((l) => l.id).join(", ") || "nichts"}`,
    ].filter(Boolean).join("\n");
    await this.tell({
      task: `Schreib ihm den Wochenbericht für WhatsApp (Montagmorgen), locker wie unter Kumpels. ` +
        `Aufbau, jeweils kurz: 1) Werbung: was ausgegeben (Google, ggf. Meta), Klicks und was dabei rauskam (echte Anfragen, WhatsApp-Kontakte), Vergleich zur Vorwoche. ` +
        `2) Website: Besucher und woher, gesendete Anfragen, fast gesendete Anfragen, WhatsApp- und Anruf-Klicks. ` +
        `3) Google-Profil: Aufrufe, Anrufe, Routen. 4) Neue Bewertungen und Schnitt. 5) Offene Anfragen mit ID. ` +
        `6) Ein konkreter Vorschlag für diese Woche, der sich direkt aus den Zahlen ergibt. ` +
        `Nur diese Zahlen verwenden, nichts erfinden oder hochrechnen. Fehlt eine Quelle (Feld fehler oder null), sag das in einem Halbsatz. ` +
        `Kernzahlen *fett*, Aufzählungen mit •, höchstens etwa 25 Zeilen.\n\n${daten}`,
      preview: `Wochenrückblick: ${stats.neue_anfragen} neue Anfragen`,
      fallback: (o) => `Jo ${o.spitznamen[0]}, Wochenrückblick 📊\n${fallbackBody}`,
      maxTokens: 6000,
    });
    return true;
  }

  // ---------- Google-Bewertungen ----------

  // Wird alle 30 Minuten aufgerufen. Beim allerersten Lauf werden vorhandene Bewertungen nur gemerkt.
  async reviewTick() {
    if (!this.insights?.configured || !this.cfg.reviews.watch) return 0;
    const list = await this.insights.recentReviews(14);
    const seen = this.store.get("reviews_seen", null);
    if (seen === null) {
      this.store.set("reviews_seen", list.map((r) => r.id));
      return 0;
    }
    const fresh = list.filter((r) => !seen.includes(r.id));
    if (!fresh.length) return 0;
    this.store.set("reviews_seen", [...seen, ...fresh.map((r) => r.id)].slice(-500));
    for (const r of fresh) {
      try {
        await this.announceReview(r);
      } catch (err) {
        this.log.error("[reviews]", err.message);
      }
    }
    return fresh.length;
  }

  async announceReview(r) {
    const stars = r.sterne || 0;
    const head = `${"⭐".repeat(Math.max(1, Math.min(5, stars)))} Neue Google-Bewertung von *${r.name}* (${stars}/5):\n` +
      (r.text ? `„${r.text.slice(0, 700)}“` : "(nur Sterne, kein Text)");
    let body;
    let event;
    if (r.antwort) {
      body = `Ist schon beantwortet: „${r.antwort.slice(0, 400)}“`;
      event = `Neue Bewertung von ${r.name} (${stars}/5), war schon beantwortet.`;
    } else {
      const reply = await this.draftReviewReply(r);
      let posted = false;
      if (reply && this.gbp?.configured && stars >= this.cfg.reviews.autoReplyMin) {
        try {
          await this.gbp.reply(r.id, reply);
          posted = true;
        } catch (err) {
          this.log.error("[reviews] Antwort posten:", err.message);
        }
      }
      if (posted) {
        body = `Hab direkt geantwortet ✅\n„${reply}“`;
        event = `Neue Bewertung von ${r.name} (${stars}/5), automatisch beantwortet: "${reply}"`;
      } else if (reply) {
        const draft = reviewDraft(this.store, { review_id: r.id, name: r.name, text: reply, owner: "*", turn: -1 });
        body = `Mein Vorschlag für die Antwort (${draft.id}):\n„${reply}“\n\n` + (this.gbp?.configured
          ? `Passt? Schreib mir „ok“, dann poste ich sie. Oder sag, was anders soll.`
          : `Zum Kopieren: Google-Profil → Rezensionen → Antworten. (Selbst posten kann ich, sobald die Google-Freigabe eingerichtet ist.)`);
        event = `Neue Bewertung von ${r.name} (${stars}/5): "${r.text.slice(0, 300)}". Antwortvorschlag ${draft.id}: "${reply}" – wartet auf OK.`;
      } else {
        body = `Die Antwort schreiben wir besser zusammen – sag mir kurz, wie ihr reagieren wollt.`;
        event = `Neue Bewertung von ${r.name} (${stars}/5): "${r.text.slice(0, 300)}" – noch ohne Antwort.`;
      }
    }
    await this.tell({
      task: `Neue Google-Bewertung (${stars}/5 von ${r.name}). Sag in 1–2 lockeren Sätzen Bescheid` +
        (stars >= 4 ? `, gern mit kurzer Freude darüber.` : `, sachlich und ohne Panik.`) + ` Was mit der Antwort passiert ist, steht darunter – nicht wiederholen.`,
      facts: `${head}\n\n${body}`,
      preview: `Neue ${stars}-Sterne-Bewertung von ${r.name}`,
      fallback: (o) => `Ey ${o.spitznamen[0]}, neue Bewertung!`,
    });
    for (const owner of this.cfg.owners) this.notifier.addEvent(owner.number, event);
  }

  async draftReviewReply(r) {
    const vorname = String(r.name).split(/\s+/)[0];
    try {
      const text = await this.agent.write(
        `Schreib die öffentliche Antwort von Carcura auf diese Google-Bewertung. Per Du, herzlich und konkret auf das Geschriebene eingehen ` +
        `(Fahrzeug, Leistung, Lob), 2–3 kurze Sätze, kein Werbesprech, keine Floskel-Kette, höchstens ein Emoji, Gruß "Dein Carcura-Team". ` +
        (r.sterne && r.sterne <= 3
          ? `Es ist eine kritische Bewertung: sachlich, nicht rechtfertigen, nichts zugeben oder bestreiten, was nicht feststeht, Klärung per Telefon unter +49 170 6669516 anbieten. `
          : "") +
        `Gib NUR den Antworttext aus.\n\nBewertung von ${r.name} (${r.sterne}/5):\n${r.text || "(kein Text, nur Sterne)"}`,
      );
      if (text) return text.trim();
    } catch (err) {
      this.log.error("[reviews] Entwurf:", err.message);
    }
    if (r.sterne >= 4) return `Vielen Dank, ${vorname}! Schön, dass du zufrieden bist – bis zum nächsten Mal in Walterschen.\n\nDein Carcura-Team`;
    return "";
  }
}

function leadFacts(lead) {
  return [
    `Anfrage ${lead.id} (${lead.kundentyp})`,
    `Leistung: ${lead.leistung || "–"}`,
    `Name: ${lead.name || "–"}`,
    `Fahrzeug: ${lead.fahrzeug || "–"}`,
    `Telefon: ${lead.telefon || "–"}`,
    `E-Mail: ${lead.email || "–"}`,
    lead.nachricht ? `Details:\n${lead.nachricht}` : "",
  ].filter(Boolean).join("\n");
}

function customerPreview(msg) {
  if (msg.type === "text") return clean(msg.text?.body, 300);
  const labels = { image: "Foto", video: "Video", audio: "Sprachnachricht", document: "Datei", location: "Standort", sticker: "Sticker" };
  const caption = clean(msg[msg.type]?.caption, 200);
  return `[${labels[msg.type] || msg.type}]${caption ? " " + caption : ""}`;
}

function clean(value, max) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}
