# Live-Verifizierung auf amazon.de

Erhebt mit einem echten Browser (Playwright + Chromium) die Daten, die für eine
belastbare Bewertung fehlen. Ohne diese Daten bleibt jede Chance auf „beobachten"
und jede Scorecard unter 70 Punkten — so ist das System gebaut.

## Warum das ein eigener Schritt ist

Die Einrichtung lief in einer Cloud-Umgebung, deren Netzwerkrichtlinie
`www.amazon.de:443` und `trends.google.de:443` auf Tunnel-Ebene sperrt
(`gateway answered 403 to CONNECT`). Getestet mit `curl` **und** mit Playwright
plus echtem Chromium — beide scheitern mit `ERR_TUNNEL_CONNECTION_FAILED`.

Das ist **kein** Cookie-Banner, **kein** CAPTCHA und **keine** Anmeldung.
Kein Browser umgeht eine Sperre, die vor dem Verbindungsaufbau greift.
Auf einem Rechner mit normalem Internetzugang entfällt sie.

## Wichtig: Wo läuft Ihre Sitzung?

Claude Code im **Browser oder in der App** führt Befehle in einer Cloud-Umgebung
aus — nicht auf Ihrem PC, auch wenn Sie davor sitzen. Dort ist amazon.de gesperrt.

Für die Live-Verifizierung brauchen Sie Claude Code als **CLI in einem Terminal
auf dem eigenen Rechner**, oder Sie führen die Befehle unten selbst dort aus.

Schnelltest, ob eine Sitzung wirklich lokal läuft:

```bash
uname -a          # unter Windows-Git-Bash: MINGW64_NT-…
curl -s -o /dev/null -w '%{http_code}\n' https://www.amazon.de/   # muss 200 sein
```

## Aufruf unter Windows

Ohne Bash, direkt über Node — funktioniert in PowerShell und in der Eingabe­auf­for­de­rung:

```powershell
cd amazon-KDP
npm install playwright
npx playwright install chromium

node scripts/live-verifikation.mjs --chancen C3 --sichtbar
```

Voraussetzung ist Node.js (https://nodejs.org, LTS-Version).
Das Skript prüft selbst zuerst die Erreichbarkeit und bricht sonst mit Exit 4 ab.

Der Bash-Wrapper `live-verifikation.sh` ist für Linux und macOS gedacht; unter
Windows nehmen Sie den Node-Aufruf oben.

## Aufruf unter Linux und macOS

```bash
cd amazon-KDP

# Nur die zeitkritische Chance C3 (Laternenfest/Sankt Martin)
./scripts/live-verifikation.sh --chancen C3

# Alle acht Chancen
./scripts/live-verifikation.sh --alle

# Mit sichtbarem Browserfenster — sinnvoll beim ersten Lauf,
# damit Sie die Cookie-Abfrage sehen
./scripts/live-verifikation.sh --chancen C3 --sichtbar
```

Das Skript prüft zuerst die Erreichbarkeit, installiert bei Bedarf Playwright,
findet ein vorhandenes Chromium und startet erst dann die Erhebung.

## Was erhoben wird

Je Chance, je Wettbewerbstitel:

| Feld | Quelle |
|---|---|
| ASIN | Suchergebnisliste |
| Produkt-URL | `amazon.de/dp/<ASIN>` |
| Titel | Produktseite |
| Preis in EUR | Preisblock, deutsches Komma korrekt gelesen |
| Seitenzahl | Detailangaben |
| Format | Untertitelzeile (Taschenbuch, Gebundene Ausgabe …) |
| Veröffentlichungsdatum | Detailangaben, „Erscheinungstermin" |
| Bewertungsdurchschnitt | Sternewertung |
| Anzahl Rezensionen | Bewertungszähler |
| Bestseller-Rang | Rohtext, sofern sichtbar |
| Prüfzeitpunkt | ISO-Zeitstempel je Seite |

Zusätzlich je Suchbegriff die **Amazon-Suchvorschläge** (Autocomplete).

## Die wichtigste Eigenschaft: nichts wird geraten

Jedes Feld wird einzeln gelesen. Wird es nicht gefunden, steht dort `null` —
und der Titel führt eine Liste `fehlende_felder`, die genau benennt, was fehlte.
So sehen Sie in der Auswertung sofort, worauf eine Bewertung beruht.

Die Auswertelogik ist gegen eine Testseite mit deutschen Zahlenformaten geprüft:
`8,99 €` → `8.99`, `1.247 Sternebewertungen` → `1247`, `4,6 von 5` → `4.6`,
`84 Seiten` → `84`, Erscheinungstermin korrekt vom Herausgeber unterschieden.

## Grenzen — bewusst gesetzt

| Regel | Umsetzung |
|---|---|
| Keine Sperre umgehen | Bei CAPTCHA oder Blockseite bricht der Lauf ab und meldet das |
| Keine Anmeldung | Kein Login, keine Konto-Cookies, kein Zugriff auf KDP |
| Nicht aggressiv abrufen | 6 Sekunden Pause zwischen allen Seitenaufrufen (`--pause` anpassbar) |
| Keine Massenerhebung | Standard 5–7 Titel je Chance |

Bei einer Blockmeldung: Lauf abbrechen lassen, später erneut versuchen oder
`--pause 12000` setzen. **Nicht** versuchen, die Sperre zu umgehen — das
gefährdet Ihr bestehendes KDP-Konto.

## Ausgabe

```
amazon-kdp-business/research/raw/JJJJ-MM-TT/live-HHMMSS/
├── C1.json … C8.json      je Chance: Autocomplete, Titel, Fehler
├── wettbewerb.csv         alle Titel flach, für die Scorecard
└── zusammenfassung.json   Gesamtlauf inkl. Abbruchgrund
```

Jeder Lauf bekommt einen eigenen Zeitstempel-Ordner — vorherige Läufe bleiben
erhalten.

## Danach

```bash
claude
> Werte die Live-Daten aus research/raw/ aus, aktualisiere den Trendbericht
> und bewerte C3 mit kdp-opportunity-validator neu
```

Erreicht eine Chance ≥ 70 Punkte und `STARTEN`, öffnet der Orchestrator Stufe 3.

## Google Trends

Google Trends ist stark skriptgesteuert und liefert keine stabilen Selektoren.
Statt einer brüchigen Automatisierung: Kurve für Deutschland manuell öffnen,
Zeitraum 5 Jahre wählen, Screenshot oder CSV-Export in
`research/raw/JJJJ-MM-TT/` ablegen und Claude bitten, das mit auszuwerten.
Ein Werkzeug, das an einer Layoutänderung still falsche Zahlen liefert, wäre
schlechter als keines.
