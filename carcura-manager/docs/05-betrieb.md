# 05 – Installation, Start, Betrieb

## Voraussetzungen (Laptop / Rechner)

| Komponente | Version | Hinweis |
|---|---|---|
| Node.js | 22.12 oder neuer | https://nodejs.org (LTS) |
| Chromium für PDFs | wird von Playwright installiert | `npx playwright install chromium` (einmalig, ~150 MB) oder `CHROMIUM_PATH` auf ein vorhandenes Chrome/Edge zeigen lassen |
| Internet | für Marketing-Sync, E-Mail-Versand, Updates | Kernfunktionen (CRM, Kalender, Aufträge, Protokolle, Rechnungen) laufen ohne Internet |

## Installation

**Empfohlen (Skripte):**

```
scripts\install.cmd        Windows: Abhängigkeiten, Chromium, Build, .env
scripts\start.cmd          Windows: Start (bleibt geöffnet, führt Neustart/Update aus)
bash scripts/install.sh    macOS/Linux
bash scripts/start.sh      macOS/Linux
```

**Manuell:**

```bash
cd carcura-manager
npm install                      # Server- und Web-Abhängigkeiten (Workspaces)
npx playwright install chromium  # Chromium für PDF-Erzeugung
npm run build                    # Web-App bauen, Server kompilieren
npm start                        # startet http://127.0.0.1:4800
```

Beim ersten Aufruf erscheint der **Einrichtungsassistent** (Unternehmen + Administrator).

**Autostart Windows:** Aufgabenplaner → „Aufgabe erstellen“ → Trigger „Bei Anmeldung“ → Aktion
`C:\…\carcura-manager\scripts\start.cmd`. Alternativ eine Verknüpfung zu `start.cmd` in den
Autostart-Ordner (`shell:startup`) legen. **macOS:** `start.sh` als Anmeldeobjekt oder per launchd.

**Zugriff vom Smartphone/Tablet im selben WLAN:** `HOST=0.0.0.0` in `.env` setzen, danach
`http://<IP-des-Laptops>:4800` aufrufen. Für Zugriff von außerhalb einen HTTPS-Tunnel (z. B. Cloudflare
Tunnel) oder einen kleinen Server verwenden – dann ist `APP_SECRET` Pflicht.

## Entwicklung

```bash
npm run dev:server   # Fastify mit Neustart bei Änderungen (Port 4800)
npm run dev:web      # Vite-Dev-Server (Port 5173, Proxy auf 4800)
npm test             # Server-Tests (Vitest)
# Browser-Tests gegen laufenden Server mit frischem DATA_DIR, in dieser Reihenfolge:
for s in ui-smoke ui-phase7 ui-phase8 ui-phase9 ui-phase10 ui-phase12 ui-phase14 ui-phase17; do SHOTS=/tmp/shots node e2e/$s.mjs; done
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

## Aufgaben, Import und Export

- **Aufgaben** (Menüpunkt „Aufgaben“): Rückrufe, Nachfassen, Bestellungen mit Fälligkeit, Priorität, Zuständigem
  und Bezug zu Kunde, Lead oder Auftrag. Fällige und überfällige Aufgaben erscheinen im Dashboard und als Zähler
  in der Navigation; in Kunden- und Lead-Akten gibt es ein eigenes Aufgaben-Panel.
- **CSV-Export** (Excel-kompatibel, Semikolon, UTF-8): Kunden, Leads, Fahrzeuge, Rechnungen (mit Zeitraum, z. B.
  für den Steuerberater), Ausgaben. Buttons „CSV“ auf den jeweiligen Seiten.
- **CSV-Import** von Kunden und Leads: Datei wählen → Vorschau (erkannte Spalten, Duplikate nach E-Mail/Telefon
  werden übersprungen) → Import. Kennzeichen/Marke/Modell legen beim Kundenimport direkt ein Fahrzeug an.
- **Gesamtexport (JSON)** unter Einstellungen → Unternehmen: alle Daten des Mandanten (Datenportabilität,
  Archiv, Mandantenwechsel). Der Einzelexport einer Kundenakte (DSGVO-Auskunft) ist in der Kundenakte verfügbar.

## White-Label und Mandanten

Je Mandant: Firmenname, Logo, Haupt-/Sekundärfarbe, **Produktname** (statt „Manager“) und optionaler
**Herstellerhinweis** („powered by …“). Diese Werte gelten für Oberfläche, Browser-Titel, Anmeldeseite
(`/login`, bei mehreren Mandanten `/login?mandant=<slug>`), PDFs und E-Mails. Neue Mandanten legt der
Softwarebetreiber unter „Mandanten“ an (mit Kennzahlen je Mandant: Benutzer, Kunden, Leads, Rechnungen,
Speicher, letzte Anmeldung). Ein Betreiber-Benutzer wird in der Datenbank mit `is_platform_admin = 1`
gekennzeichnet (der erste Administrator der Installation ist automatisch Betreiber).

## Sicherungen, Wiederherstellung, Updates

- **Automatisch:** täglich 02:30 (und beim Start, falls heute noch keine Sicherung existiert). Es bleiben die letzten
  14 automatischen und 20 manuellen Sicherungen erhalten (`data/backups/`).
- **Manuell:** Einstellungen → System & Sicherung → „Jetzt sichern“; Download als ZIP; Löschen.
- **Inhalt:** konsistente Kopie der Datenbank (`VACUUM INTO`, WAL-sicher), alle Dateien (Bilder, PDFs, Unterschriften)
  und ein Manifest. **Nicht enthalten:** `data/app-secret.key` – ohne diesen Schlüssel lassen sich gespeicherte
  Zugangsdaten (SMTP, API-Keys) nach einer Wiederherstellung auf einem anderen Rechner nicht entschlüsseln.
  Den Schlüssel deshalb separat sichern (Passwort-Manager).
- **Wiederherstellung:** aus der Liste oder per Upload einer ZIP-Sicherung. Die Datei wird geprüft und vorgemerkt;
  beim nächsten Start (über das Startskript automatisch) wird der aktuelle Stand als Sicherheitskopie
  (`data/backups/pre-restore-…`) beiseitegelegt und die Sicherung eingespielt. Ohne Oberfläche:
  `node server/dist/cli.js restore <datei.zip>` bei gestopptem Server.
- **Update:** „Update installieren“ erstellt eine Sicherung und beendet die Anwendung mit Exit-Code 76; das
  Startskript führt dann `scripts/update` aus (git pull, npm install, Build) und startet neu. Exit-Code 75 = Neustart.
  Ohne Startskript: Anwendung beenden, `scripts/update.cmd` bzw. `bash scripts/update.sh` ausführen.
- **3-2-1-Regel:** Sicherungen zusätzlich auf ein externes Laufwerk oder in eine Cloud kopieren (z. B. den Ordner
  `data/backups` mit OneDrive/Google Drive synchronisieren). Ein Backup auf demselben Laptop schützt nicht vor
  Diebstahl, Defekt oder Verschlüsselungstrojanern.

## Laufende Jobs (Zeitplaner)

| Job | Zeitpunkt |
|---|---|
| Terminerinnerungen (E-Mail) | alle 10 Minuten |
| Überfällige Rechnungen markieren | täglich 00:05 |
| Wiederkehrende Kosten buchen | täglich 00:10 |
| Marketing-Sync (letzte 7 Tage) | alle 6 Stunden |
| Tagessicherung | täglich 02:30 |
| Wettbewerber-Scan | montags 05:00 |
| Wochen-/Monats-/Jahresbericht | Mo 06:00 / 1. 06:30 / 2. Jan 07:00 |
| Sitzungsbereinigung | täglich 03:15 |

Status und Fehler der letzten Läufe: Einstellungen → System & Sicherung → „Automatische Aufgaben“.
