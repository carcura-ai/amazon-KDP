// Die KI hinter dem Chat: Claude mit den Carcura-Werkzeugen.
//
// Der Gesprächsverlauf wird nur angehängt, nie nachträglich verändert. Das verlangt die API,
// damit die Denk-Blöcke gültig bleiben, und es hält den Prompt-Cache warm. Datum, Wetter und
// neue Ereignisse stehen deshalb in der jeweiligen Nutzernachricht, nicht im System-Prompt.
// Nach längerer Pause oder sehr langem Verlauf beginnt ein frisches Gespräch.

import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, createToolHandlers } from "./tools.js";

const MAX_STEPS = 12;

export const SYSTEM_PROMPT = `Du bist der Carcura-Assistent – der digitale Kollege von Alex (Alexander Fuchs) und Richy (Richy Schumacher), den beiden Inhabern von Carcura GbR, Fahrzeugaufbereitung in Walterschen im Westerwald (Hauptstr. 7, 57632 Walterschen, Tel. +49 170 6669516, carcura@web.de, Website carcura.info).

Du schreibst mit den beiden per WhatsApp, jeweils im Einzelchat. Jede Nachricht beginnt mit einer Kontextzeile in eckigen Klammern (Datum, Uhrzeit, Wetter, mit wem du schreibst, neue Ereignisse). Diese Zeile kommt vom System, nicht vom Inhaber.

So schreibst du:
- Locker, kumpelhaft, wie ein Kollege in der Werkstatt-Gruppe: "Ey Alex", "Moin Richy", "läuft", "nice". Kurz und auf den Punkt – WhatsApp, kein Brief.
- Ab und zu passend ein Spruch zu Tageszeit oder Wetter, aber nicht in jeder Nachricht und nie auf Kosten der Info.
- Höchstens ein, zwei Emojis. WhatsApp-Formatierung: *fett*, Aufzählungen mit •. Keine Überschriften, kein Markdown mit #.
- Bei Entscheidungen konkret fragen, z. B. "Soll ich ihm per Mail schreiben und nach einem Termin fragen, oder ruft ihr an?"

Was du tun kannst:
- Anfragen verwalten: auflisten, Details zeigen, Status/Termin/Notiz/Zuständigkeit pflegen, Leads von Instagram, Telefon usw. eintragen.
- Dem anderen Inhaber Bescheid geben (partner_benachrichtigen), wenn es ihn betrifft – z. B. wer einen Kunden übernimmt.
- E-Mails an Kunden: erst Entwurf zeigen, dann nach OK senden. Ton gegenüber Kunden: freundlich, per Du, seriös, keine Slang-Wörter.
- Website carcura.info: Seiten lesen, Änderungen vorschlagen und nach OK ausführen. Vorher mit website_lesen die exakte HTML-Stelle holen und nur das Nötige ändern. Gestaltung, Klassen und Struktur nicht anfassen, wenn nur Text geändert werden soll. Achte auf Kontrast: nie dunkle Schrift auf dunklem Hintergrund.
- Belege: Schickt dir ein Inhaber ein Foto oder PDF einer Rechnung, lies die Eckdaten ab und speichere sie mit beleg_speichern. Erfinde keine Werte – was nicht lesbar ist, bleibt leer.
- Zahlen: wochen_zahlen liefert die eigene Anfragen-Statistik. zahlen_abrufen liefert Werbung (Google Ads, ggf. Meta), Website-Besucher, gesendete und fast gesendete Anfragen, Google-Profil und Bewertungen – nimm das bei Fragen wie "wie lief die Woche", "was hat die Werbung gebracht", "wie viele waren auf der Seite".
- Google-Bewertungen: bewertungen_liste zeigt sie. Antworten nur über bewertung_antwort_vorschlagen → Text zeigen → nach OK in neuer Nachricht bewertung_antwort_posten. Antworten an Kunden: per Du, herzlich, konkret auf das Geschriebene eingehen, kurz, Gruß "Dein Carcura-Team". Bei Kritik sachlich bleiben, nicht rechtfertigen, Klärung per Telefon anbieten.
- Meldet das System eine neue Bewertung mit Vorschlag R-…, und ein Inhaber schreibt "ok", "passt" o. ä., dann poste genau diesen Vorschlag. Will er Änderungen, leg einen neuen Vorschlag an.

Feste Regeln:
- Website-Änderungen und Kunden-E-Mails werden NIE ohne ausdrückliches OK in einer neuen Nachricht ausgeführt. Ein vorheriger Auftrag wie "schreib ihm" heißt: Entwurf zeigen und fragen "passt so?".
- Erfinde keine Fakten, Preise, Termine oder Kundendaten. Preise nur von der Website (Seite Leistungen) oder aus der Anfrage. Wenn du etwas nicht weißt oder ein Werkzeug fehlschlägt, sag es ehrlich.
- Behaupte nie, etwas erledigt zu haben, wenn das Werkzeug es nicht bestätigt hat.
- Kalender: Termine trägst du vorerst in die Anfrage ein (anfrage_aktualisieren, Feld termin). Eine echte Kalender-Anbindung kommt später – sag das, wenn jemand danach fragt.
- Kundendaten nur für die Bearbeitung der Anfrage verwenden und nicht unnötig an Dritte weitergeben.
- Rechts- und Steuerfragen: allgemeine Orientierung ja, aber auf Steuerberater oder Anwalt hinweisen, wenn es darauf ankommt.`;

export class Agent {
  constructor({ cfg, store, client, handlers }) {
    this.cfg = cfg;
    this.store = store;
    this.client = client || new Anthropic();
    this.handlers = handlers;
    this.locks = new Map();
  }

  static create(deps) {
    return new Agent({ ...deps, handlers: createToolHandlers(deps) });
  }

  sessionKey(owner) {
    return `session-${owner.number}`;
  }

  loadSession(owner, now = Date.now()) {
    const s = this.store.get(this.sessionKey(owner), null);
    const idleMs = this.cfg.sessionIdleHours * 60 * 60 * 1000;
    if (!s || now - s.lastAt > idleMs || s.messages.length > this.cfg.sessionMaxMessages) {
      // Frisches Gespräch; der Bestätigungszähler läuft weiter.
      return { startedAt: now, lastAt: now, turn: s?.turn || 0, messages: [] };
    }
    return s;
  }

  // Nachrichten eines Inhabers nacheinander verarbeiten, nie parallel.
  chat(owner, userContent) {
    const prev = this.locks.get(owner.number) || Promise.resolve();
    const run = prev.catch(() => {}).then(() => this.#chat(owner, userContent));
    this.locks.set(owner.number, run);
    return run;
  }

  async #chat(owner, userContent) {
    const session = this.loadSession(owner);
    session.turn += 1;
    session.lastAt = Date.now();
    session.messages.push({ role: "user", content: userContent });

    let reply = "";
    try {
      reply = await this.#loop(owner, session);
    } finally {
      this.store.set(this.sessionKey(owner), session);
    }
    return reply;
  }

  async #loop(owner, session) {
    const texts = [];
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await this.#request(session.messages);

      // Immer den kompletten Inhalt anhängen (inkl. Denk-Blöcke), nicht nur den Text.
      session.messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") {
        return "Dabei kann ich leider nicht helfen. Formulier's gern anders oder schreib mir, was du genau brauchst.";
      }

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) texts.push(block.text.trim());
      }

      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (toolUses.length && response.stop_reason === "max_tokens") {
        // Abgeschnittene Werkzeugeingaben nie ausführen.
        session.messages.push({ role: "user", content: abortResults(toolUses, "Abgebrochen: Eingabe abgeschnitten.") });
        return "Da ist mir die Antwort zu lang geworden – schreib's mir bitte in kleineren Schritten.";
      }
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      if (step === MAX_STEPS - 1) {
        session.messages.push({ role: "user", content: abortResults(toolUses, "Abgebrochen: zu viele Schritte.") });
        return "Das war mir gerade zu viel auf einmal – lass uns das in kleineren Schritten machen.";
      }

      // Alle Ergebnisse gesammelt in EINER Nutzernachricht zurückgeben.
      const results = [];
      for (const use of toolUses) {
        results.push(await this.#runTool(use, owner, session));
      }
      session.messages.push({ role: "user", content: results });
      texts.length = 0; // Zwischentexte vor Werkzeugaufrufen nicht doppelt senden
    }
    return texts.join("\n\n") || "Erledigt.";
  }

  async #request(messages) {
    const params = {
      model: this.cfg.anthropic.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: this.cfg.anthropic.effort },
      cache_control: { type: "ephemeral" },
    };
    if (this.cfg.anthropic.fallbacks) {
      // Server-seitiger Fallback, falls ein Sicherheitsfilter eine harmlose Anfrage ablehnt.
      return this.client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    }
    return this.client.messages.create(params);
  }

  async #runTool(use, owner, session) {
    const handler = this.handlers[use.name];
    try {
      if (!handler) throw new Error(`Unbekanntes Werkzeug ${use.name}`);
      const input = use.input && typeof use.input === "object" ? use.input : {};
      const result = await handler(input, { owner, session });
      return { type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result ?? { ok: true }) };
    } catch (err) {
      console.error(`[tool] ${use.name}:`, err.message);
      return { type: "tool_result", tool_use_id: use.id, is_error: true, content: err.message };
    }
  }

  // Einzelner Aufruf ohne Werkzeuge, z. B. für die lockere Formulierung einer Meldung.
  async write(instruction, maxTokens = 4000) {
    const response = await this.client.messages.create({
      model: this.cfg.anthropic.model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: instruction }],
    });
    if (response.stop_reason === "refusal") return "";
    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }
}

function abortResults(toolUses, reason) {
  return toolUses.map((u) => ({ type: "tool_result", tool_use_id: u.id, is_error: true, content: reason }));
}

export function isRetryable(err) {
  return err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError;
}
