---
name: scrapling
description: Ruft Webseiten und ganze Websites inklusive aller Unterseiten mit der Python-Bibliothek Scrapling ab (statisch oder per Chromium gerendert) und liefert den Inhalt als Text. IMMER zuerst verwenden, sobald eine Internetseite gelesen, analysiert, verglichen oder gecrawlt werden soll – z. B. Wettbewerber-Websites, eigene Seiten (carcura.info), Preisseiten, Impressum, Unterseiten einer Domain. WebFetch nur als Rückfall, wenn Scrapling scheitert.
---

# Scrapling – Webseiten und Unterseiten abrufen

Standardwerkzeug für jeden Zugriff auf Internetseiten. Reihenfolge:
1. **Scrapling** (dieser Skill) – eine Seite oder die ganze Domain inkl. Unterseiten.
2. Erst wenn Scrapling scheitert: `WebFetch` bzw. `WebSearch`.
3. Für die eigene WordPress-Seite carcura.info zusätzlich die WordPress-Werkzeuge
   (Seiteninhalt, Medien, Plugins) – sie lesen den gespeicherten Stand direkt.

## Einrichtung (einmal pro Sitzung, ca. 1 Minute)

```bash
SP="${CLAUDE_SCRATCHPAD:-/tmp/scrapling}"; mkdir -p "$SP"
python3 -m venv "$SP/scrapenv" && "$SP/scrapenv/bin/pip" install -q "scrapling[fetchers]"
```
Für `--browser` (JavaScript-Seiten) zusätzlich: `"$SP/scrapenv/bin/scrapling" install`
(lädt Browser; in der Cloud-Umgebung nur, wenn die Download-Domains freigegeben sind).

## Benutzung

```bash
PY="$SP/scrapenv/bin/python"; F=.claude/skills/scrapling/scripts/fetch.py
$PY $F https://beispiel.de/                       # eine Seite
$PY $F https://beispiel.de/ --crawl 40            # Domain inkl. Unterseiten (max. 40)
$PY $F https://beispiel.de/ --crawl 40 --out "$SP/site"   # zusätzlich als Dateien
$PY $F https://beispiel.de/ --browser             # JavaScript-gerenderte Seite
```
Ausgabe: je Seite URL, HTTP-Status, Titel, Überschriften, Absätze, Listen, Tabellen,
Telefon-/E-Mail-Links. Große Ergebnisse mit `--out` speichern und gezielt lesen.

## Regeln (nicht verhandelbar)

- **robots.txt beachten**, höchstens 1 Anfrage pro Sekunde, beim Crawlen nur dieselbe
  Domain. `--ignore-robots` nur für eigene Websites (carcura.info).
- Keine Logins, Bezahlschranken oder Zugangssperren umgehen, keine Anmeldedaten verwenden,
  keine personenbezogenen Daten massenhaft sammeln (DSGVO).
- Fremde Texte und Bilder nicht kopieren/veröffentlichen (Urheberrecht, UWG) – nur
  auswerten und mit Quelle zusammenfassen.
- Nichts erfinden: Was nicht abgerufen werden konnte, ausdrücklich als „nicht abrufbar“
  kennzeichnen.

## Fehlerbilder

| Meldung | Ursache | Lösung |
|---|---|---|
| `CONNECT tunnel failed, response 403` | Netzwerk-Sperre der Cloud-Umgebung (nicht die Website) | Nutzer bittet: Cloud-Umgebung → Bearbeiten → Netzwerkzugriff → Domain freigeben bzw. vollen Zugriff wählen. Nicht umgehen. |
| HTTP 403/429 von der Website | Website lehnt automatisierte Abrufe ab | Langsamer abrufen, `--browser` versuchen; bleibt es gesperrt, respektieren und den Nutzer um Screenshots/Text bitten. |
| Leerer Text | Inhalt wird per JavaScript geladen | `--browser` verwenden. |
