// Startpunkt: HTTP-Server und Zeitplan.
//
//   GET  /health        → Lebenszeichen
//   GET  /webhook       → Bestätigung durch Meta beim Einrichten
//   POST /webhook       → eingehende WhatsApp-Nachrichten
//   POST /lead          → neue Anfrage von der Website (Header X-Carcura-Secret)
//   POST /report        → fertige Auswertung zum Weiterleiten (Header X-Carcura-Secret)

import http from "node:http";
import { loadConfig, checkConfig } from "./config.js";
import { Store } from "./store.js";
import { WhatsApp } from "./whatsapp.js";
import { Notifier } from "./notify.js";
import { WordPress } from "./wordpress.js";
import { createMailer } from "./mailer.js";
import { Agent } from "./agent.js";
import { App } from "./app.js";
import { Insights } from "./insights.js";
import { GoogleProfile } from "./gbp.js";

const MAX_BODY = 2 * 1024 * 1024;

export function buildApp(cfg, overrides = {}) {
  const store = overrides.store || new Store(cfg.dataDir);
  const wa = overrides.wa || new WhatsApp(cfg.wa);
  const notifier = new Notifier({ store, wa, owners: cfg.owners });
  const wp = overrides.wp || new WordPress(cfg.wp);
  const mailer = overrides.mailer !== undefined ? overrides.mailer : createMailer(cfg.mail);
  const insights = overrides.insights || new Insights({ windsor: cfg.windsor, timezone: cfg.timezone });
  const gbp = overrides.gbp || new GoogleProfile(cfg.gbp);
  const agent = Agent.create({ cfg, store, client: overrides.client, notifier, owners: cfg.owners, wp, mailer, insights, gbp });
  return new App({ cfg, store, wa, notifier, agent, insights, gbp, fetchImpl: overrides.fetchImpl });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function createServer(app) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, body) => {
      const isText = typeof body === "string";
      res.writeHead(status, { "Content-Type": isText ? "text/plain; charset=utf-8" : "application/json" });
      res.end(isText ? body : JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && url.pathname === "/health") return send(200, { ok: true });
      if (req.method === "GET" && url.pathname === "/webhook") {
        const r = app.verifyWebhook(url.searchParams);
        return send(r.status, r.body);
      }
      if (req.method !== "POST") return send(404, "not found");

      const raw = await readBody(req);
      if (url.pathname === "/webhook") {
        const r = app.receiveWebhook(raw, req.headers);
        send(r.status, r.body); // Meta erwartet schnell ein 200
        await r.done;
        return;
      }
      if (url.pathname === "/lead") {
        const r = await app.receiveLead(raw, req.headers);
        return send(r.status, r.body);
      }
      if (url.pathname === "/report") {
        const r = await app.receiveReport(raw, req.headers);
        return send(r.status, r.body);
      }
      return send(404, "not found");
    } catch (err) {
      console.error("[http]", err);
      if (!res.headersSent) send(500, { ok: false });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const missing = checkConfig(cfg);
  if (missing.length) {
    console.error(`Fehlende Einstellungen: ${missing.join(", ")} – siehe .env.example`);
    process.exit(1);
  }
  const app = buildApp(cfg);
  createServer(app).listen(cfg.port, () => {
    console.log(`Carcura-Assistent läuft auf Port ${cfg.port} (Inhaber: ${cfg.owners.map((o) => o.name).join(", ")})`);
  });
  // Alle 10 Minuten prüfen, ob die Wochenübersicht fällig ist.
  setInterval(() => app.weeklyTick().catch((err) => console.error("[weekly]", err)), 10 * 60 * 1000);
  // Alle 30 Minuten nach neuen Google-Bewertungen schauen (erster Lauf nach 1 Minute).
  const reviews = () => app.reviewTick().catch((err) => console.error("[reviews]", err.message));
  setTimeout(reviews, 60 * 1000);
  setInterval(reviews, 30 * 60 * 1000);
}
