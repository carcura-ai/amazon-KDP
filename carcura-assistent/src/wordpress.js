// WordPress-REST-API mit Anwendungspasswort (Benutzer → Profil → Anwendungspasswörter).

export class WordPress {
  constructor(cfg, fetchImpl = globalThis.fetch) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
    this.auth = "Basic " + Buffer.from(`${cfg.user}:${cfg.appPassword}`).toString("base64");
  }

  get configured() {
    return Boolean(this.cfg.user && this.cfg.appPassword);
  }

  async request(path, options = {}) {
    if (!this.configured) throw new Error("WordPress-Zugang ist nicht eingerichtet (WP_USER / WP_APP_PASSWORD).");
    const res = await this.fetch(`${this.cfg.url}/wp-json${path}`, {
      ...options,
      headers: { Authorization: this.auth, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`WordPress: ${data?.message || `HTTP ${res.status}`}`);
    return data;
  }

  async findPages(query) {
    const q = encodeURIComponent(query);
    const pages = await this.request(`/wp/v2/pages?search=${q}&per_page=10&status=publish&_fields=id,title,link`);
    return pages.map((p) => ({ id: p.id, title: stripTags(p.title?.rendered || ""), url: p.link }));
  }

  async listPages() {
    const pages = await this.request(`/wp/v2/pages?per_page=50&status=publish&_fields=id,title,link`);
    return pages.map((p) => ({ id: p.id, title: stripTags(p.title?.rendered || ""), url: p.link }));
  }

  async getPage(id) {
    const p = await this.request(`/wp/v2/pages/${Number(id)}?context=edit&_fields=id,title,link,content,modified`);
    return { id: p.id, title: p.title?.raw || "", url: p.link, raw: p.content?.raw || "", modified: p.modified };
  }

  async updatePageContent(id, raw) {
    const p = await this.request(`/wp/v2/pages/${Number(id)}`, {
      method: "POST",
      body: JSON.stringify({ content: raw }),
    });
    return { id: p.id, url: p.link, modified: p.modified };
  }
}

export function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&ndash;/g, "–")
    .replace(/&quot;/g, '"').replace(/&#039;|&#8217;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

export function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}
