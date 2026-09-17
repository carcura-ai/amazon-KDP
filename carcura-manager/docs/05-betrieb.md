# 05 – Installation, Start, Betrieb

## Voraussetzungen (Laptop / Rechner)

| Komponente | Version | Hinweis |
|---|---|---|
| Node.js | 22.12 oder neuer | https://nodejs.org (LTS) |
| Chromium für PDFs | wird von Playwright installiert | `npx playwright install chromium` (einmalig, ~150 MB) oder `CHROMIUM_PATH` auf ein vorhandenes Chrome/Edge zeigen lassen |
| Internet | für Marketing-Sync, E-Mail-Versand, Updates | Kernfunktionen (CRM, Kalender, Aufträge, Protokolle, Rechnungen) laufen ohne Internet |

## Installation

```bash
cd carcura-manager
npm install                      # Server- und Web-Abhängigkeiten (Workspaces)
npx playwright install chromium  # Chromium für PDF-Erzeugung
npm run build                    # Web-App bauen, Server kompilieren
npm start                        # startet http://127.0.0.1:4800
```

Beim ersten Aufruf erscheint der **Einrichtungsassistent** (Unternehmen + Administrator).

Windows: Die Befehle in PowerShell ausführen. Ein Autostart lässt sich über den Aufgabenplaner
(„Bei Anmeldung“ → `node C:\…\carcura-manager\server\dist\index.js`) einrichten.

## Entwicklung

```bash
npm run dev:server   # Fastify mit Neustart bei Änderungen (Port 4800)
npm run dev:web      # Vite-Dev-Server (Port 5173, Proxy auf 4800)
npm test             # Server-Tests (Vitest)
node e2e/ui-smoke.mjs && node e2e/ui-phase7.mjs && node e2e/ui-phase8.mjs   # Browser-Tests gegen laufenden Server
```

## Umgebungsvariablen (`.env` im Ordner `carcura-manager`, Vorlage `.env.example`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | 4800 | HTTP-Port |
| `HOST` | 127.0.0.1 | `0.0.0.0` für Zugriff aus dem lokalen Netz (Tablet in der Werkstatt) |
| `DATA_DIR` | ./data | Datenbank, Dateien, Backups, Schlüssel |
| `APP_SECRET` | (automatisch in `data/app-secret.key`) | Signatur der Sessions und Verschlüsselung der Zugangsdaten. **In Produktion Pflicht, niemals verlieren** – ohne Schlüssel sind gespeicherte API-Zugangsdaten nicht mehr lesbar. |
| `SESSION_IDLE_MINUTES` | 480 | Leerlauf-Timeout |
| `SESSION_MAX_DAYS` | 30 | Absolute Sitzungsdauer |
| `CHROMIUM_PATH` | (Playwright-Standard) | Pfad zu Chrome/Chromium für PDFs |
| `PUBLIC_URL` | http://127.0.0.1:4800 | Basis-URL in E-Mails und für den Website-Lead-Endpunkt |
| `LOG_LEVEL` | info | pino-Loglevel |

## Datenablage

```
data/
├── app.db              SQLite-Datenbank (WAL-Modus, app.db-wal / app.db-shm gehören dazu)
├── app-secret.key      Anwendungsgeheimnis (nur wenn APP_SECRET nicht gesetzt)
├── files/<mandant>/    hochgeladene Bilder, PDFs, Signaturen, Logo
└── backups/            automatische und manuelle Backups (Phase 19)
```

## Website-Lead-Eingang einrichten

1. Einstellungen → Integrationen → Endpunkt und Token kopieren.
2. Im Website-Formular (oder im Revenue-Plugin per Webhook) zusätzlich an
   `POST <PUBLIC_URL>/api/public/leads/website` mit Header `X-Lead-Token: <Token>` senden.
   Payload-Format ist identisch zum bestehenden Formular (`name, email, phone, vehicle, service, message, customer_type, source, channel, gclid, website`).
3. Solange der Rechner nur lokal erreichbar ist, muss die Anwendung für diesen Weg über eine
   öffentliche URL erreichbar sein (VPN/Tunnel/Server). Alternative bis dahin: CSV-Import (Phase 19).

## E-Mail-Versand

Einstellungen → E-Mail-Versand: SMTP-Host, Port, Benutzer, Passwort, Absender. Testmail-Button prüft die
Verbindung. Zugangsdaten werden AES-256-GCM-verschlüsselt gespeichert. Terminerinnerungen laufen
automatisch alle 10 Minuten (Fenster: `reminderDaysBefore` Tage, Standard 2).

## Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| „PDF-Erzeugung nicht verfügbar“ | `npx playwright install chromium` ausführen oder `CHROMIUM_PATH` setzen |
| Login-Sperre nach Fehlversuchen | 15 Minuten warten oder Passwort durch Admin zurücksetzen |
| E-Mails werden nicht gesendet | Einstellungen → E-Mail-Versand → Versandprotokoll zeigt den SMTP-Fehler |
| Port belegt | `PORT` in `.env` ändern |
| Datenbank gesperrt („database is locked“) | zweite Instanz läuft – nur eine Instanz pro Datenordner starten |

## Marketing-Anbindungen

| Anbindung | Benötigte Zugangsdaten | Was wird abgerufen |
|---|---|---|
| **Windsor.ai** (empfohlen, bereits für Carcura verbunden) | API-Key aus dem Windsor-Konto; optional Konto-IDs | Google Ads (Kampagnen/Tag), Meta Ads (Kampagnen/Tag inkl. Leads), GA4 (Sitzungen, Kanäle, Geräte, Landingpages), Instagram (Follower, Reichweite, Aufrufe, Likes), **Meta Lead Ads → automatischer Lead-Import ins CRM** |
| Google Ads API | Developer-Token, OAuth-Client, Refresh-Token, Kundennummer | Kampagnen je Tag (Impressionen, Klicks, Kosten, Conversions) |
| Meta Marketing API | System-User-Token (ads_read), Werbekonto-ID | Kampagnen je Tag (inkl. Leads aus `actions`) |
| Google Analytics 4 | Service-Account (JSON-Schlüssel), Property-ID | Sitzungen, Nutzer, Seitenaufrufe, Key Events je Kanal/Gerät/Landingpage |
| Search Console | Service-Account, Property-URL | Klicks, Impressionen, Position; Top-Suchanfragen und -Seiten |

Der Sync läuft automatisch alle 6 Stunden (letzte 7 Tage) und manuell über „Jetzt synchronisieren“ (30+ Tage).
Fehler erscheinen unter Einstellungen → Integrationen mit dem Originaltext der API. Alle Zugangsdaten liegen
verschlüsselt in der Datenbank und werden nie an den Browser gesendet.

**Attribution:** Kosten pro Lead und ROAS beziehen sich auf Leads bzw. Kunden, deren Quelle im CRM `google_ads`
oder `meta_ads` ist (Website-Formular mit gclid → Google Ads; Meta Lead Ads → Meta). Leads, die telefonisch
eingehen, müssen mit der richtigen Quelle erfasst werden, sonst werden Werbekosten ohne Leads gemeldet.

## Berichte (Woche / Monat / Jahr)

Berichte werden vom Zeitplaner automatisch erstellt: Wochenbericht montags 06:00, Monatsbericht am 1. um 06:30,
Jahresbericht am 2. Januar um 07:00 (jeweils für die letzte abgeschlossene Periode). Unter „Berichte“ kann
jederzeit ein Bericht manuell erzeugt werden, auch für die laufende Periode. Jeder Bericht wird als PDF abgelegt
und, falls SMTP eingerichtet ist, an die Admin-Adresse des Mandanten gesendet. Aufbau je Bereich:
Fakten (gemessen) → Was hat sich verändert (berechnet) → Mögliche Ursachen (Interpretation) → Empfehlungen (Vorschlag).
Bei fehlenden Daten steht „Nicht genügend Daten“ bzw. „Keine … erfasst“; es werden keine Werte geschätzt.

## KI-Business-Assistent (Claude)

Einrichtung unter Einstellungen → Integrationen → „KI-Business-Assistent (Claude)“: Anthropic-API-Key
(console.anthropic.com) und Modell (Standard `claude-opus-5`). Der Key wird verschlüsselt gespeichert und nie an
den Browser gesendet. Der Assistent erhält **keine** Dokumente oder Rohdaten, sondern ruft ausschließlich definierte
Werkzeuge auf (Kennzahlen, Lead-Funnel, Kampagnen, offene Rechnungen, Ausgaben, inaktive Kunden, Auslastung,
Lager, Kundensuche, Berichte). Die dabei übermittelten Werte enthalten Kundennamen/Kontaktdaten nur bei den
Werkzeugen „Kundensuche“, „inaktive Kunden“ und „offene Rechnungen“ – das ist im Datenschutzhinweis des Mandanten
zu berücksichtigen (Auftragsverarbeitung mit Anthropic, Daten werden laut Anthropic-API-Bedingungen nicht zum
Training verwendet). Kosten: pro Frage einige Cent (je nach Werkzeugaufrufen); Token-Verbrauch wird je Antwort
gespeichert. Fehler (ungültiger Key, Limit, Überlastung) werden verständlich angezeigt.

## Wettbewerber-Monitoring (Google Places API)

Einrichtung unter Einstellungen → Integrationen → „Wettbewerber-Monitoring“: Google-Cloud-API-Key mit aktivierter
**Places API (New)**, Suchbegriffe (z. B. „Fahrzeugaufbereitung“, „Autoaufbereitung“), Standort (Breite/Länge) und
Radius. Der Scan läuft montags 05:00 und manuell über „Jetzt scannen“. Abgerufen werden nur öffentliche Daten des
Google-Unternehmensprofils (Name, Adresse, Website, Bewertung, Anzahl Rezensionen). Kein Scraping, keine Umgehung
von Zugriffsbeschränkungen. Der eigene Betrieb wird in der Liste als „eigener“ Eintrag markiert und liefert die
eigene Bewertungsentwicklung. Wettbewerber ohne API lassen sich manuell mit Notizen (Preise, Leistungen) pflegen.
Kosten: Google Places „Text Search (Basic/Advanced)“ pro Anfrage; bei wöchentlichem Scan mit wenigen Begriffen
liegt das im kostenlosen Monatskontingent von Google.
