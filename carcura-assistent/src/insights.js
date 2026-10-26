// Zahlen von außen: Google Ads, Google Analytics 4 und Google-Unternehmensprofil über die
// Windsor.ai-API (ein API-Schlüssel für alle verbundenen Konten), dazu optional Meta Ads.
// Jede Quelle wird einzeln abgefragt; fällt eine aus, kommen die anderen trotzdem.

const BASE = "https://connectors.windsor.ai";
const DAY = 24 * 60 * 60 * 1000;

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export class Insights {
  constructor({ windsor = {}, timezone = "Europe/Berlin", fetchImpl = globalThis.fetch, log = console }) {
    Object.assign(this, { windsor, timezone, fetchImpl, log });
  }

  get configured() {
    return Boolean(this.windsor.apiKey);
  }

  ymd(ms) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: this.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  }

  async query(connector, account, fields, from, to) {
    const params = new URLSearchParams({ api_key: this.windsor.apiKey, fields: fields.join(","), date_from: from, date_to: to });
    if (account) params.set("select_accounts", account);
    const res = await this.fetchImpl(`${BASE}/${connector}?${params}`, { signal: AbortSignal.timeout(60000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(`${connector}: ${json.error?.message || `HTTP ${res.status}`}`);
    return Array.isArray(json.data) ? json.data : [];
  }

  // Zeitraum: die letzten `tage` abgeschlossenen Tage (heute zählt nicht mit) plus Vergleich davor.
  async period(tage = 7, now = Date.now()) {
    if (!this.configured) throw new Error("Zahlen sind nicht eingerichtet (WINDSOR_API_KEY fehlt).");
    const to = now - DAY;
    const from = to - (tage - 1) * DAY;
    const prevTo = from - DAY;
    const prevFrom = prevTo - (tage - 1) * DAY;
    const range = [this.ymd(from), this.ymd(to)];
    const prev = [this.ymd(prevFrom), this.ymd(prevTo)];

    const safe = (p) => p.catch((err) => {
      this.log.error("[insights]", err.message);
      return { fehler: err.message };
    });
    const w = this.windsor;
    const [ads, adsPrev, meta, web, webPrev, events, eventsPrev, profil, bewertungen] = await Promise.all([
      safe(this.ads(...range)), safe(this.ads(...prev)),
      w.metaAccount ? safe(this.meta(...range)) : Promise.resolve(null),
      safe(this.web(...range)), safe(this.web(...prev)),
      safe(this.events(...range)), safe(this.events(...prev)),
      safe(this.profile(...range)),
      safe(this.reviews(...range)),
    ]);

    return {
      zeitraum: `${range[0]} bis ${range[1]}`,
      vergleich: `${prev[0]} bis ${prev[1]}`,
      google_ads: { aktuell: ads, vorher: adsPrev },
      ...(meta ? { meta_ads: meta } : {}),
      website: { aktuell: merge(web, events), vorher: merge(webPrev, eventsPrev) },
      google_profil: profil,
      bewertungen,
      hinweise: [
        "Google-Ads-Conversions zählen auch Klicks auf Anruf/WhatsApp und können doppelt zählen – echte Anfragen stehen in der eigenen Anfragenliste.",
        "formular_angefangen zählt jeden Start eines Formulars (auch Newsletter); fast_anfragen = angefangen minus gesendet.",
      ],
    };
  }

  async ads(from, to) {
    const rows = await this.query("google_ads", this.windsor.adsAccount, ["campaign", "spend", "clicks", "impressions", "conversions"], from, to);
    const kampagnen = rows.map((r) => ({
      name: r.campaign, ausgaben_eur: round(r.spend), klicks: num(r.clicks), impressionen: num(r.impressions), conversions: round(r.conversions),
    }));
    const sum = (k) => round(kampagnen.reduce((a, c) => a + c[k], 0));
    const ausgaben = sum("ausgaben_eur"), klicks = sum("klicks");
    return {
      ausgaben_eur: ausgaben, klicks, impressionen: sum("impressionen"), conversions: sum("conversions"),
      kosten_pro_klick_eur: klicks ? round(ausgaben / klicks) : null, kampagnen,
    };
  }

  async meta(from, to) {
    const rows = await this.query("facebook", this.windsor.metaAccount, ["campaign", "spend", "clicks", "impressions", "reach"], from, to);
    const sum = (k) => round(rows.reduce((a, r) => a + num(r[k]), 0));
    return { ausgaben_eur: sum("spend"), klicks: sum("clicks"), impressionen: sum("impressions"), reichweite: sum("reach"), kampagnen: rows.map((r) => r.campaign) };
  }

  async web(from, to) {
    const rows = await this.query("googleanalytics4", this.windsor.ga4Account, ["session_default_channel_group", "sessions", "totalusers", "engaged_sessions"], from, to);
    const nach_kanal = {};
    for (const r of rows) nach_kanal[r.session_default_channel_group || "Sonstige"] = num(r.sessions);
    const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);
    return { besuche: sum("sessions"), besucher: sum("totalusers"), aktive_besuche: sum("engaged_sessions"), nach_kanal };
  }

  async events(from, to) {
    const rows = await this.query("googleanalytics4", this.windsor.ga4Account, ["event_name", "event_count"], from, to);
    const c = (name) => num(rows.find((r) => r.event_name === name)?.event_count);
    const gesendet = c("cc_anfrage"), angefangen = c("form_start");
    return {
      anfragen_gesendet: gesendet,
      formular_angefangen: angefangen,
      fast_anfragen: Math.max(0, angefangen - gesendet),
      whatsapp_klicks: c("cc_whatsapp"),
      anruf_klicks: c("cc_anruf"),
      preisrechner_genutzt: c("cc_preisband"),
      anfrage_buttons_geklickt: c("cc_cta_anfrage"),
      video_gestartet: c("cc_video_start"),
    };
  }

  async profile(from, to) {
    const rows = await this.query("google_my_business", this.windsor.gbpLocation, ["impressions", "website_clicks", "call_clicks", "direction_requests"], from, to);
    const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);
    return { aufrufe: sum("impressions"), website_klicks: sum("website_clicks"), anrufe: sum("call_clicks"), routen: sum("direction_requests") };
  }

  async reviews(from, to) {
    const rows = await this.query("google_my_business", this.windsor.gbpLocation,
      ["review_id", "review_create_time", "review_reviewer", "review_star_rating", "review_comment", "review_reply_comment", "review_average_rating_total", "review_total_count"], from, to);
    const list = rows.filter((r) => r.review_id).map(toReview).sort((a, b) => a.zeit.localeCompare(b.zeit));
    const any = rows[0] || {};
    return { neu: list, schnitt_gesamt: any.review_average_rating_total ?? null, anzahl_gesamt: any.review_total_count ?? null };
  }

  async recentReviews(tage = 14, now = Date.now()) {
    return (await this.reviews(this.ymd(now - tage * DAY), this.ymd(now))).neu;
  }
}

export function toReview(r) {
  return {
    id: r.review_id,
    zeit: r.review_create_time || "",
    name: r.review_reviewer || "Unbekannt",
    sterne: STARS[r.review_star_rating] || num(r.review_star_rating) || null,
    text: originalText(r.review_comment),
    antwort: r.review_reply_comment || "",
  };
}

// Google liefert "(Translated by Google) … (Original) …" – wir wollen nur das Original.
export function originalText(comment) {
  const s = String(comment || "");
  const i = s.indexOf("(Original)");
  return (i >= 0 ? s.slice(i + "(Original)".length) : s).trim();
}

function merge(a, b) {
  if (a?.fehler || b?.fehler) return { ...(a || {}), ...(b || {}) };
  return { ...a, ...b };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(v) {
  return Math.round(num(v) * 100) / 100;
}
