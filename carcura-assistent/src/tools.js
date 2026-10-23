// Werkzeuge, die die KI im Chat benutzen darf.
//
// Sicherheitsregel im Code (nicht nur im Prompt): Website-Änderungen und Kunden-E-Mails
// laufen zweistufig. Erst entsteht ein Vorschlag, der dem Inhaber gezeigt wird. Ausführen
// geht erst, wenn danach eine neue Nachricht des Inhabers kam (seine Bestätigung).

import { nextId } from "./store.js";
import { countOccurrences, stripTags } from "./wordpress.js";

const LEAD_STATUS = ["neu", "kontaktiert", "termin", "erledigt", "verloren"];
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

export const TOOL_DEFINITIONS = [
  {
    name: "anfragen_liste",
    description: "Listet Kundenanfragen (Website und manuell eingetragene Leads), neueste zuerst. Optional nach Status filtern.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: LEAD_STATUS, description: "Nur Anfragen mit diesem Status" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Höchstzahl, Standard 10" },
      },
    },
  },
  {
    name: "anfrage_details",
    description: "Zeigt alle Angaben zu einer Anfrage, z. B. L-0007.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "Anfrage-ID wie L-0007" } },
      required: ["id"],
    },
  },
  {
    name: "anfrage_eintragen",
    description: "Trägt einen Lead ein, der nicht über die Website kam (Instagram, Telefon, persönlich, Empfehlung).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        telefon: { type: "string" },
        email: { type: "string" },
        fahrzeug: { type: "string" },
        leistung: { type: "string", description: "Gewünschte Leistung(en)" },
        quelle: { type: "string", description: "z. B. Instagram, Telefon, Empfehlung, persönlich" },
        notiz: { type: "string" },
      },
      required: ["name", "quelle"],
    },
  },
  {
    name: "anfrage_aktualisieren",
    description: "Ändert Status, Termin oder Notiz einer Anfrage. Termin als Text, z. B. 'Sa 25.10.2026 10:00'.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: LEAD_STATUS },
        termin: { type: "string" },
        notiz: { type: "string", description: "Wird an die bestehenden Notizen angehängt" },
        zustaendig: { type: "string", description: "Wer kümmert sich (Alex oder Richy)" },
      },
      required: ["id"],
    },
  },
  {
    name: "partner_benachrichtigen",
    description: "Schickt dem anderen Inhaber eine WhatsApp-Nachricht, z. B. 'Alex ruft den Kunden an' oder eine Info zu einer Anfrage. Text locker formulieren.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "Nachrichtentext an den Partner" } },
      required: ["text"],
    },
  },
  {
    name: "website_seiten",
    description: "Sucht Seiten der Website carcura.info. Ohne Suchbegriff: alle veröffentlichten Seiten mit ID.",
    input_schema: {
      type: "object",
      properties: { suche: { type: "string" } },
    },
  },
  {
    name: "website_lesen",
    description: "Liest den Inhalt einer Seite. Mit 'stelle' bekommst du den exakten HTML-Ausschnitt um diesen Text herum (nötig für Änderungen). Ohne 'stelle': lesbarer Text der Seite.",
    input_schema: {
      type: "object",
      properties: {
        seiten_id: { type: "integer" },
        stelle: { type: "string", description: "Textstück, um das herum der HTML-Quelltext gezeigt wird" },
      },
      required: ["seiten_id"],
    },
  },
  {
    name: "website_aenderung_vorschlagen",
    description: "Bereitet eine Änderung an einer Website-Seite vor (Suchen und Ersetzen im HTML). 'suchen' muss exakt einmal auf der Seite vorkommen; vorher mit website_lesen die exakte Stelle holen. Führt NICHTS aus. Zeig dem Inhaber danach kurz vorher/nachher und frag nach seinem OK.",
    input_schema: {
      type: "object",
      properties: {
        seiten_id: { type: "integer" },
        suchen: { type: "string", description: "Exakter HTML-Ausschnitt, der ersetzt wird" },
        ersetzen: { type: "string", description: "Neuer HTML-Ausschnitt" },
        grund: { type: "string", description: "Kurz, was geändert wird" },
      },
      required: ["seiten_id", "suchen", "ersetzen", "grund"],
    },
  },
  {
    name: "website_aenderung_ausfuehren",
    description: "Führt einen vorher erstellten Änderungsvorschlag aus. Nur benutzen, nachdem der Inhaber in einer NEUEN Nachricht ausdrücklich zugestimmt hat.",
    input_schema: {
      type: "object",
      properties: { vorschlag_id: { type: "string", description: "z. B. V-0003" } },
      required: ["vorschlag_id"],
    },
  },
  {
    name: "email_entwurf",
    description: "Erstellt einen E-Mail-Entwurf an einen Kunden (Absender carcura@web.de). Sendet NICHT. Zeig den Entwurf und frag nach OK. Ton: freundlich, per Du wie auf der Website, unterschreiben mit 'Viele Grüße, Alex & Richy – Carcura'.",
    input_schema: {
      type: "object",
      properties: {
        an: { type: "string", description: "E-Mail-Adresse des Kunden" },
        betreff: { type: "string" },
        text: { type: "string" },
        anfrage_id: { type: "string" },
      },
      required: ["an", "betreff", "text"],
    },
  },
  {
    name: "email_senden",
    description: "Sendet einen E-Mail-Entwurf. Nur nach ausdrücklicher Zustimmung des Inhabers in einer NEUEN Nachricht.",
    input_schema: {
      type: "object",
      properties: { entwurf_id: { type: "string", description: "z. B. E-0002" } },
      required: ["entwurf_id"],
    },
  },
  {
    name: "beleg_speichern",
    description: "Speichert die Eckdaten einer Rechnung oder Quittung, die ein Inhaber als Foto/PDF geschickt hat (Datei liegt schon im Eingang). Nur Werte eintragen, die auf dem Beleg stehen.",
    input_schema: {
      type: "object",
      properties: {
        datei: { type: "string", description: "Dateiname aus dem Eingang" },
        art: { type: "string", enum: ["eingangsrechnung", "ausgangsrechnung", "quittung", "sonstiges"] },
        datum: { type: "string" },
        betrag_brutto: { type: "number" },
        aussteller: { type: "string" },
        kunde: { type: "string" },
        beschreibung: { type: "string" },
      },
      required: ["datei", "art"],
    },
  },
  {
    name: "wochen_zahlen",
    description: "Kennzahlen der Anfragen für die letzten N Tage (Anzahl, Status, Leistungen, Quellen).",
    input_schema: {
      type: "object",
      properties: { tage: { type: "integer", minimum: 1, maximum: 90 } },
    },
  },
];

export function createToolHandlers(deps) {
  const { store, notifier, owners, wp, mailer } = deps;

  const leads = () => store.get("leads", []);
  const findLead = (id) => leads().find((l) => l.id.toLowerCase() === String(id || "").trim().toLowerCase());

  function gate(item, session, owner) {
    if (!item) return "Unbekannte ID.";
    if (item.owner !== owner.number) return "Dieser Vorschlag wurde von jemand anderem erstellt.";
    if (item.done) return "Schon erledigt.";
    if (Date.now() - item.at > PROPOSAL_TTL_MS) return "Vorschlag ist älter als 24 Stunden – bitte neu erstellen.";
    if (session.turn <= item.turn) {
      return "Noch keine Bestätigung: Zeig dem Inhaber den Vorschlag und warte auf seine Antwort in einer neuen Nachricht.";
    }
    return null;
  }

  return {
    anfragen_liste({ status, limit = 10 }) {
      let list = [...leads()].reverse();
      if (status) list = list.filter((l) => l.status === status);
      return list.slice(0, limit).map(shortLead);
    },

    anfrage_details({ id }) {
      const lead = findLead(id);
      if (!lead) throw new Error(`Anfrage ${id} nicht gefunden.`);
      return lead;
    },

    anfrage_eintragen(input, { owner }) {
      const lead = {
        id: nextId(store, "L"),
        eingang: new Date().toISOString(),
        quelle: input.quelle,
        status: "neu",
        name: input.name,
        telefon: input.telefon || "",
        email: input.email || "",
        fahrzeug: input.fahrzeug || "",
        leistung: input.leistung || "",
        nachricht: "",
        notizen: input.notiz ? [`${owner.name}: ${input.notiz}`] : [],
        eingetragen_von: owner.name,
      };
      store.update("leads", [], (all) => [...all, lead]);
      return { gespeichert: lead.id };
    },

    anfrage_aktualisieren({ id, status, termin, notiz, zustaendig }, { owner }) {
      const lead = findLead(id);
      if (!lead) throw new Error(`Anfrage ${id} nicht gefunden.`);
      const next = { ...lead };
      if (status) next.status = status;
      if (termin) next.termin = termin;
      if (zustaendig) next.zustaendig = zustaendig;
      if (notiz) next.notizen = [...(lead.notizen || []), `${owner.name}: ${notiz}`];
      next.geaendert = new Date().toISOString();
      store.update("leads", [], (all) => all.map((l) => (l.id === lead.id ? next : l)));
      return shortLead(next);
    },

    async partner_benachrichtigen({ text }, { owner }) {
      const others = owners.filter((o) => o.number !== owner.number);
      const results = {};
      for (const other of others) {
        const msg = `💬 Von ${owner.name}: ${text}`;
        results[other.name] = await notifier.send(other, msg, `${owner.name}: ${text}`);
        notifier.addEvent(other.number, `${owner.name} hat dir über mich geschrieben: "${text}"`);
      }
      return { gesendet: results };
    },

    async website_seiten({ suche }) {
      return suche ? wp.findPages(suche) : wp.listPages();
    },

    async website_lesen({ seiten_id, stelle }) {
      const page = await wp.getPage(seiten_id);
      if (!stelle) {
        const text = stripTags(page.raw);
        return { titel: page.title, url: page.url, text: text.slice(0, 8000), gekuerzt: text.length > 8000 };
      }
      const hits = [];
      let i = page.raw.indexOf(stelle);
      while (i !== -1 && hits.length < 5) {
        hits.push(page.raw.slice(Math.max(0, i - 600), i + stelle.length + 600));
        i = page.raw.indexOf(stelle, i + stelle.length);
      }
      return { titel: page.title, url: page.url, treffer: countOccurrences(page.raw, stelle), ausschnitte: hits };
    },

    async website_aenderung_vorschlagen({ seiten_id, suchen, ersetzen, grund }, { owner, session }) {
      const page = await wp.getPage(seiten_id);
      const n = countOccurrences(page.raw, suchen);
      if (n !== 1) {
        throw new Error(`Der Suchtext kommt ${n}× vor, er muss genau 1× vorkommen. Hol dir mit website_lesen die exakte Stelle.`);
      }
      const proposal = {
        id: nextId(store, "V"), at: Date.now(), turn: session.turn, owner: owner.number,
        seiten_id, titel: page.title, url: page.url, suchen, ersetzen, grund, done: false,
      };
      store.update("proposals", [], (all) => [...all.slice(-49), proposal]);
      return {
        vorschlag_id: proposal.id,
        seite: `${page.title} (${page.url})`,
        vorher: stripTags(suchen).slice(0, 500) || suchen.slice(0, 500),
        nachher: stripTags(ersetzen).slice(0, 500) || ersetzen.slice(0, 500),
        hinweis: "Noch nicht ausgeführt. Frag jetzt nach dem OK.",
      };
    },

    async website_aenderung_ausfuehren({ vorschlag_id }, { owner, session }) {
      const proposal = store.get("proposals", []).find((p) => p.id === vorschlag_id);
      const blocked = gate(proposal, session, owner);
      if (blocked) throw new Error(blocked);
      const page = await wp.getPage(proposal.seiten_id);
      if (countOccurrences(page.raw, proposal.suchen) !== 1) {
        throw new Error("Die Seite hat sich inzwischen geändert – Stelle nicht mehr eindeutig. Bitte neu vorschlagen.");
      }
      const updated = await wp.updatePageContent(proposal.seiten_id, page.raw.replace(proposal.suchen, () => proposal.ersetzen));
      store.update("proposals", [], (all) => all.map((p) => (p.id === proposal.id ? { ...p, done: true, ausgefuehrt: new Date().toISOString() } : p)));
      store.update("changelog", [], (all) => [...all, { at: new Date().toISOString(), von: owner.name, seite: proposal.titel, grund: proposal.grund, vorschlag: proposal.id }]);
      return { erledigt: true, url: updated.url, hinweis: "Seite ist live geändert. Falls ein Cache aktiv ist, kann es ein paar Minuten dauern." };
    },

    email_entwurf({ an, betreff, text, anfrage_id }, { owner, session }) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an)) throw new Error("Ungültige E-Mail-Adresse.");
      const draft = {
        id: nextId(store, "E"), at: Date.now(), turn: session.turn, owner: owner.number,
        an, betreff, text, anfrage_id: anfrage_id || "", done: false,
      };
      store.update("drafts", [], (all) => [...all.slice(-49), draft]);
      return { entwurf_id: draft.id, an, betreff, text, hinweis: "Noch nicht gesendet. Frag jetzt nach dem OK." };
    },

    async email_senden({ entwurf_id }, { owner, session }) {
      const draft = store.get("drafts", []).find((d) => d.id === entwurf_id);
      const blocked = gate(draft, session, owner);
      if (blocked) throw new Error(blocked);
      if (!mailer) throw new Error("E-Mail-Versand ist nicht eingerichtet (SMTP_USER / SMTP_PASS).");
      await mailer.send({ to: draft.an, subject: draft.betreff, text: draft.text });
      store.update("drafts", [], (all) => all.map((d) => (d.id === draft.id ? { ...d, done: true, gesendet: new Date().toISOString() } : d)));
      if (draft.anfrage_id && findLead(draft.anfrage_id)) {
        const lead = findLead(draft.anfrage_id);
        store.update("leads", [], (all) => all.map((l) => (l.id === lead.id
          ? { ...l, status: l.status === "neu" ? "kontaktiert" : l.status, notizen: [...(l.notizen || []), `${owner.name}: E-Mail "${draft.betreff}" gesendet`] }
          : l)));
      }
      return { gesendet: true, an: draft.an };
    },

    beleg_speichern(input, { owner }) {
      const known = store.get("inbox", []).some((f) => f.datei === input.datei);
      if (!known) throw new Error(`Datei ${input.datei} ist nicht im Eingang.`);
      const beleg = { id: nextId(store, "B"), erfasst: new Date().toISOString(), von: owner.name, ...input };
      store.update("belege", [], (all) => [...all, beleg]);
      return { gespeichert: beleg.id, hinweis: "Für die Buchhaltung bitte zusätzlich ans Buchhaltungsprogramm bzw. den Steuerberater geben." };
    },

    wochen_zahlen({ tage = 7 }) {
      return leadStats(leads(), tage);
    },
  };
}

export function shortLead(l) {
  return {
    id: l.id, eingang: l.eingang, status: l.status, name: l.name, leistung: l.leistung,
    fahrzeug: l.fahrzeug, quelle: l.quelle, termin: l.termin || "", zustaendig: l.zustaendig || "",
  };
}

export function leadStats(all, tage, now = Date.now()) {
  const since = now - tage * 24 * 60 * 60 * 1000;
  const recent = all.filter((l) => Date.parse(l.eingang) >= since);
  const count = (key) => recent.reduce((acc, l) => {
    const k = l[key] || "unbekannt";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const offen = all.filter((l) => l.status === "neu").map(shortLead);
  return { zeitraum_tage: tage, neue_anfragen: recent.length, nach_status: count("status"), nach_quelle: count("quelle"), leistungen: recent.map((l) => l.leistung).filter(Boolean), noch_offen: offen };
}
