// Überträgt Anfragen in den Carcura Manager (Lead-Eingang POST /api/public/leads/website, Header X-Lead-Token).
// Fehler werden nur protokolliert: Die WhatsApp-Meldung an Alex und Richy darf daran nie scheitern.

export class ManagerClient {
  constructor(cfg = {}, fetchImpl = globalThis.fetch, log = console) {
    this.url = cfg.url || "";
    this.token = cfg.token || "";
    this.fetch = fetchImpl;
    this.log = log;
  }

  get enabled() {
    return Boolean(this.url && this.token);
  }

  async pushLead(lead, { channel = "whatsapp", externalId = "" } = {}) {
    if (!this.enabled) return { skipped: true };
    const body = {
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.telefon || "",
      vehicle: lead.fahrzeug || "",
      service: lead.leistung || "",
      message: [lead.nachricht, ...(lead.notizen || [])].filter(Boolean).join("\n"),
      customer_type: lead.kundentyp === "firma" ? "firma" : "privat",
      source: String(lead.quelle || "assistent").toLowerCase().slice(0, 60),
      channel,
      external_id: externalId,
    };
    try {
      const res = await this.fetch(`${this.url}/api/public/leads/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Lead-Token": this.token },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.log.error(`[manager] Lead nicht übertragen: HTTP ${res.status} ${data.error || ""}`);
        return { ok: false, status: res.status };
      }
      return { ok: true, id: data.id, duplicate: Boolean(data.duplicate) };
    } catch (err) {
      this.log.error("[manager] Lead nicht übertragen:", err.message);
      return { ok: false, error: err.message };
    }
  }
}
