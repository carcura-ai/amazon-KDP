// WhatsApp Cloud API (offizielle Meta-Schnittstelle): Senden, Medien laden, Signatur prüfen.

import crypto from "node:crypto";

const MAX_TEXT = 4000; // Meta erlaubt 4096 Zeichen pro Textnachricht

export class WhatsApp {
  constructor(cfg, fetchImpl = globalThis.fetch) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
    this.base = `https://graph.facebook.com/${cfg.graphVersion}`;
  }

  async call(path, body) {
    const res = await this.fetch(`${this.base}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`WhatsApp: ${msg}`);
      err.code = data?.error?.code;
      throw err;
    }
    return data;
  }

  async sendText(to, text) {
    const parts = splitText(text);
    for (const part of parts) {
      await this.call(`${this.cfg.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: part, preview_url: false },
      });
    }
  }

  // Vorlage (Template) für Nachrichten außerhalb des 24-Stunden-Fensters.
  async sendTemplate(to, params) {
    return this.call(`${this.cfg.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: this.cfg.templateName,
        language: { code: this.cfg.templateLang },
        components: [{
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: templateSafe(p) })),
        }],
      },
    });
  }

  async markRead(messageId) {
    try {
      await this.call(`${this.cfg.phoneNumberId}/messages`, {
        messaging_product: "whatsapp", status: "read", message_id: messageId,
      });
    } catch { /* nicht kritisch */ }
  }

  async downloadMedia(mediaId) {
    const meta = await this.fetch(`${this.base}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.cfg.token}` },
    });
    if (!meta.ok) throw new Error(`Medien-Info nicht abrufbar (HTTP ${meta.status})`);
    const info = await meta.json();
    const file = await this.fetch(info.url, { headers: { Authorization: `Bearer ${this.cfg.token}` } });
    if (!file.ok) throw new Error(`Medien-Download fehlgeschlagen (HTTP ${file.status})`);
    return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: info.mime_type };
  }
}

// Prüft X-Hub-Signature-256, damit nur Meta Nachrichten einliefern kann.
export function verifySignature(rawBody, header, appSecret) {
  if (!header || !appSecret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Template-Variablen dürfen keine Zeilenumbrüche, Tabs oder >4 Leerzeichen am Stück enthalten.
export function templateSafe(text, max = 300) {
  let t = String(text || "").replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim();
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  return t || "-";
}

export function splitText(text, max = MAX_TEXT) {
  const t = String(text || "").trim();
  if (t.length <= max) return [t];
  const parts = [];
  let rest = t;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
