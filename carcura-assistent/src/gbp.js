// Antworten auf Google-Bewertungen posten (Google Business Profile API, v4-Endpunkt für Bewertungen).
// Optional: ohne Zugangsdaten schickt der Assistent den Antworttext zum Kopieren.

export class GoogleProfile {
  constructor({ clientId = "", clientSecret = "", refreshToken = "", account = "", location = "" } = {}, fetchImpl = globalThis.fetch) {
    Object.assign(this, { clientId, clientSecret, refreshToken, account, location, fetchImpl });
    this.token = null;
  }

  get configured() {
    return Boolean(this.clientId && this.clientSecret && this.refreshToken && this.account && this.location);
  }

  async accessToken() {
    if (this.token && this.token.until > Date.now() + 60000) return this.token.value;
    const res = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, refresh_token: this.refreshToken, grant_type: "refresh_token" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new Error(`Google-Anmeldung fehlgeschlagen: ${json.error_description || json.error || res.status}`);
    this.token = { value: json.access_token, until: Date.now() + (json.expires_in || 3600) * 1000 };
    return this.token.value;
  }

  async reply(reviewId, comment) {
    if (!this.configured) throw new Error("Antworten posten ist nicht eingerichtet (GBP_* in der .env).");
    const loc = this.location.replace(/^locations\//, "");
    const acc = this.account.replace(/^accounts\//, "");
    const url = `https://mybusiness.googleapis.com/v4/accounts/${acc}/locations/${loc}/reviews/${encodeURIComponent(reviewId)}/reply`;
    const res = await this.fetchImpl(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(`Google hat die Antwort abgelehnt: ${json.error?.message || res.status}`);
    }
    return true;
  }
}
