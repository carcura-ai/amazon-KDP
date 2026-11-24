// Datum, Uhrzeit und Wetter für den lockeren Einstieg ("geiles Wetter draußen, oder?").

const WEATHER_CODES = {
  0: "klar und sonnig", 1: "überwiegend sonnig", 2: "leicht bewölkt", 3: "bedeckt",
  45: "neblig", 48: "neblig mit Reif", 51: "leichter Niesel", 53: "Niesel", 55: "starker Niesel",
  61: "leichter Regen", 63: "Regen", 65: "starker Regen", 66: "gefrierender Regen", 67: "gefrierender Regen",
  71: "leichter Schneefall", 73: "Schneefall", 75: "starker Schneefall", 77: "Schneegriesel",
  80: "Regenschauer", 81: "kräftige Schauer", 82: "heftige Schauer", 85: "Schneeschauer", 86: "Schneeschauer",
  95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
};

let cached = { at: 0, text: "" };

export async function weatherText(cfg, fetchImpl = globalThis.fetch, now = Date.now()) {
  if (now - cached.at < 30 * 60 * 1000 && cached.text) return cached.text;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}` +
      `&current=temperature_2m,weather_code&timezone=Europe%2FBerlin`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const temp = Math.round(d.current.temperature_2m);
    const desc = WEATHER_CODES[d.current.weather_code] || "wechselhaft";
    cached = { at: now, text: `${cfg.place}: ${temp} °C, ${desc}` };
  } catch {
    cached = { at: now, text: "" }; // Wetter ist nett, aber nicht wichtig
  }
  return cached.text;
}

export function dateTimeText(timezone, date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date) + " Uhr";
}

// Wochentag (1 = Montag … 7 = Sonntag) und Stunde in der gegebenen Zeitzone.
export function localParts(timezone, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, weekday: "short", hour: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { weekday, hour: Number(parts.hour), day: `${parts.year}-${parts.month}-${parts.day}` };
}
