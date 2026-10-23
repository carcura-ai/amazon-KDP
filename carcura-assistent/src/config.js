// Liest die Einstellungen aus Umgebungsvariablen (.env wird von Docker Compose geladen).

function list(value) {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Nummern im WhatsApp-Format: nur Ziffern, mit Ländervorwahl, ohne + oder 00.
export function normalizeNumber(raw) {
  let n = String(raw || "").replace(/[^\d]/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "49" + n.slice(1);
  return n;
}

// OWNERS="Alex:4917012345678,Richy:4915112345678"
function parseOwners(value) {
  return list(value).map((entry) => {
    const [name, number] = entry.split(":");
    return { name: name.trim(), number: normalizeNumber(number) };
  }).filter((o) => o.name && o.number);
}

export function loadConfig(env = process.env) {
  const cfg = {
    port: Number(env.PORT || 3000),
    dataDir: env.DATA_DIR || "./data",
    timezone: env.TIMEZONE || "Europe/Berlin",
    owners: parseOwners(env.OWNERS),

    wa: {
      token: env.WA_TOKEN || "",
      phoneNumberId: env.WA_PHONE_NUMBER_ID || "",
      verifyToken: env.WA_VERIFY_TOKEN || "",
      appSecret: env.WA_APP_SECRET || "",
      graphVersion: env.WA_GRAPH_VERSION || "v23.0",
      templateName: env.WA_TEMPLATE_NAME || "carcura_hinweis",
      templateLang: env.WA_TEMPLATE_LANG || "de",
    },

    anthropic: {
      model: env.CLAUDE_MODEL || "claude-opus-5-5",
      effort: env.CLAUDE_EFFORT || "medium",
      fallbacks: (env.CLAUDE_FALLBACKS || "on") !== "off",
    },

    leadSecret: env.LEAD_SECRET || "",

    wp: {
      url: (env.WP_URL || "https://carcura.info").replace(/\/+$/, ""),
      user: env.WP_USER || "",
      appPassword: env.WP_APP_PASSWORD || "",
    },

    mail: {
      host: env.SMTP_HOST || "smtp.web.de",
      port: Number(env.SMTP_PORT || 587),
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      from: env.MAIL_FROM || "Carcura <carcura@web.de>",
      bcc: env.MAIL_BCC || "",
    },

    weather: {
      lat: Number(env.WEATHER_LAT || 50.69),
      lon: Number(env.WEATHER_LON || 7.58),
      place: env.WEATHER_PLACE || "Walterschen",
    },

    weeklySummary: {
      enabled: (env.WEEKLY_SUMMARY || "on") !== "off",
      weekday: Number(env.WEEKLY_SUMMARY_WEEKDAY || 1), // 1 = Montag
      hour: Number(env.WEEKLY_SUMMARY_HOUR || 9),
    },

    sessionIdleHours: Number(env.SESSION_IDLE_HOURS || 12),
    sessionMaxMessages: Number(env.SESSION_MAX_MESSAGES || 80),
  };
  return cfg;
}

export function checkConfig(cfg) {
  const missing = [];
  if (!cfg.owners.length) missing.push("OWNERS");
  if (!cfg.wa.token) missing.push("WA_TOKEN");
  if (!cfg.wa.phoneNumberId) missing.push("WA_PHONE_NUMBER_ID");
  if (!cfg.wa.verifyToken) missing.push("WA_VERIFY_TOKEN");
  if (!cfg.wa.appSecret) missing.push("WA_APP_SECRET");
  if (!cfg.leadSecret) missing.push("LEAD_SECRET");
  return missing;
}
