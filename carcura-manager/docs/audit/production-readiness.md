# Production-Readiness-Check – Carcura Management

Stand: 26.09.2026 · Branch `claude/kind-curie-4rhi0y` · Ziel: zentraler Server (Docker + Caddy, EU) für den **eigenen
Betrieb von Carcura**; externe Kunden erst später.

Keine Aussage in diesem Dokument ist eine Zusicherung von DSGVO-Konformität oder einer Zertifizierung. Es beschreibt
den technisch geprüften Stand.

## 1. Wie geprüft wurde

| Prüfung | Ergebnis |
|---|---|
| Typprüfung Server + Web (`npm run typecheck`) | fehlerfrei |
| Server-Tests (Vitest) | **122 / 122 bestanden** (vorher 110; 12 neue Tests für die Korrekturen unten) |
| Desktop-Tests | 6 / 6 bestanden |
| Produktions-Build (`npm run build`) | erfolgreich |
| Produktionsstart lokal (`NODE_ENV=production`, `TRUST_PROXY=1`, `PUBLIC_URL=https://…`) hinter simuliertem Proxy | Health, Setup, Login, Sitzung, CSRF-Abwehr, Rate-Limit, Kontosperre, Sicherung und **Wiederherstellung über Neustart** erfolgreich durchgespielt |
| Caddy (aus Quellcode gebaut) | `caddy validate` gültig; Reverse-Proxy + Log-Filter live geprüft (Query-Strings und Cookies erscheinen nicht im Log) |
| Windows-Installer | GitHub-Actions-Lauf erfolgreich, Release „Carcura Management 1.0.0 (Windows)“ veröffentlicht |
| Sicherheits-Review (Auth, Sessions, Rechte, Setup, Uploads) | Befunde unten; kritische und hohe behoben |
| Integrations-Review (Google/Meta/Website-Leads) | Stand unten |

Nicht geprüft werden konnte: ein echter `docker build` (in der Prüfumgebung läuft kein Docker-Daemon), echte
Zertifikatsausstellung bei Let's Encrypt, echte Konten bei Windsor/Google/Meta, der Installer auf einem echten
Windows-PC. Diese Punkte sind Teil der Inbetriebnahme-Checkliste (Abschnitt 9).

## 2. Während des Audits behobene Fehler

| # | Schwere | Befund | Korrektur | Test |
|---|---|---|---|---|
| F1 | **kritisch** | Ersteinrichtung ohne Schutz: Wer einen frisch gestarteten Server zuerst aufruft (neue Zertifikate erscheinen sofort in öffentlichen CT-Logs und werden gescannt), legt das erste Admin- und Betreiberkonto an. | Einrichtungscode: Pflicht, sobald der Server nicht ausschließlich lokal läuft (Docker, Proxy, öffentliche Adresse). Code wird beim Start ins Log geschrieben (`docker compose logs app \| grep Einrichtungscode`) oder per `SETUP_TOKEN` gesetzt. Feld im Einrichtungsassistenten. | `production-readiness.test.ts` |
| F2 | hoch | Zwei gleichzeitige Ersteinrichtungen gelangen beide (zwei Betreiberkonten). | Erneute Prüfung innerhalb der Transaktion. | ja |
| F3 | hoch | Rate-Limit ließ sich mit wechselnden, gefälschten Cookies/Headern umgehen (Login-Brute-Force, CPU-Last durch Passwort-Hashing). | Limit je Client-IP (hinter Caddy aus `X-Forwarded-For`). | ja |
| F4 | hoch | 2FA-Code unbegrenzt durchprobierbar (kein Fehlerzähler, Zähler wurde bei jedem Passwort-Login zurückgesetzt). | Fehlversuche beim zweiten Faktor zählen zur Kontosperre (5 Versuche → 15 Min.); Zurücksetzen erst nach bestandenem zweiten Faktor. | ja |
| F5 | hoch | Benutzer mit „Benutzer verwalten“ ohne Admin-Rolle konnten Passwort/2FA des Admins bzw. Betreibers zurücksetzen oder sich selbst zum Admin machen. | Admin- und Betreiberkonten nur durch Admins bzw. den Betreiber selbst änderbar. | ja |
| F6 | hoch (Betrieb) | Wiederherstellung einer Sicherung über die Oberfläche wurde im Docker-Betrieb nie ausgeführt (nur mit Laptop-Startskript). | `CM_SUPERVISOR=docker`: Server beendet sich nach dem Vormerken, Docker startet neu, Wiederherstellung läuft beim Start. Live getestet. | ja |
| F7 | hoch (Betrieb) | Keine Sicherung vor Datenbank-Migrationen bei Server-Updates. | Vor ausstehenden Migrationen wird automatisch eine `pre-update`-Sicherung erstellt; schlägt sie fehl, startet der Server nicht. | ja |
| F8 | mittel (Betrieb) | Docker-Logs ohne Größenbegrenzung → Festplatte läuft über Monate voll; Health-Check erzeugte alle 30 s Logzeilen. | Log-Rotation (5 × 10 MB je Dienst); Health-Endpunkte loggen nur Warnungen. | – |
| F9 | mittel (Datenschutz) | Caddy-Filter `query { delete * }` entfernte keine Query-Strings (Wildcard wird von Caddy nicht unterstützt) → Einmal-Links (Passwort-Reset) im Proxy-Log. | Regex-Filter; zusätzlich `Set-Cookie` und `X-Lead-Token` entfernt. Live geprüft. | manuell |
| F10 | mittel | Kein `.dockerignore`: Beim Bauen aus einem Arbeitsordner mit `data/` (Kundendaten, Schlüssel) wären diese ins Image kopiert worden. | `.dockerignore` schließt Daten, Schlüssel, `.env`, Sicherungen aus. | – |
| F11 | mittel | Website-Lead: identische Anfrage nach mehr als 24 h → HTTP 500 (eindeutiger Index), Lead verloren. | Neue Anfrage erhält eigenen Schlüssel; Absender-`external_id` bleibt dauerhaft idempotent. | ja |
| F12 | mittel | Windsor-Sync: fiel eine Quelle aus (z. B. GA4 nicht verbunden), wurden **keine Meta-Leads** importiert. | Quellen einzeln; Leads werden immer übernommen. Bei pausiertem Windsor-Tarif werden GA4/Instagram-Nullzeilen nicht mehr geschrieben. | ja |

## 3. Backend

| Bereich | Stand | Bewertung |
|---|---|---|
| Produktionskonfiguration | `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, `DATA_DIR=/data` im Image; `PUBLIC_URL` aus `DOMAIN` | ok |
| Environment/Secrets | `.env` nur auf dem Server, nicht im Git (`.gitignore`, `.dockerignore`); `APP_SECRET` ≥ 32 Zeichen erzwungen, sonst erzeugter Schlüssel in `/data/app-secret.key` (0600) | ok – `APP_SECRET` setzen **und separat aufbewahren** |
| Gespeicherte Zugangsdaten (SMTP, API-Schlüssel) | AES-256-GCM, Schlüssel aus `APP_SECRET`; nie an den Browser | ok |
| Fehlerbehandlung | einheitliche JSON-Fehler; 500er ohne Details nach außen, mit Fehler-ID im Log | ok |
| Logging | strukturiert (JSON), Request-ID, keine Query-Strings/Header/Bodies, Schwärzung von Passwort/Token | ok |
| Health Checks | `/api/health/live`, `/api/health/ready` (DB + Speicherplatz), `/api/health` (Version, für Desktop-App); Docker-HEALTHCHECK | ok |
| API | alle Routen außer den öffentlichen (Login, Reset, Setup, Branding, Rechtstexte, Website-Leads, Zahlungs-Webhook) verlangen Anmeldung – automatisiert geprüft | ok |
| Rate Limits | global 1200/Min./IP; Login, 2FA 10/Min.; Setup 5/Min.; Website-Leads 30/Min. | ok (nach F3) |
| CORS | keine CORS-Freigaben außer `/api/health` (nur lesend) | ok |
| CSRF | SameSite=Lax + Prüfung von Origin/Sec-Fetch-Site bei allen schreibenden Anfragen | ok (live getestet) |
| Authentifizierung | scrypt (N=2^16), Passwortregel ≥ 10 Zeichen mit Groß/Klein/Ziffer, Sperre nach 5 Fehlversuchen (15 Min.), 2FA (TOTP + Wiederherstellungscodes) | ok |
| Sitzungen | 256-bit-Zufallswert, signiertes HttpOnly/Secure/SameSite-Cookie, Leerlauf 8 h, max. 30 Tage, Widerruf bei Logout, Passwortänderung, Deaktivierung | ok |
| Sicherheits-Header | CSP ohne Fremdquellen, HSTS, X-Frame-Options, nosniff, Referrer-Policy, `no-store` für API | ok |

## 4. Docker / Server

| Bereich | Stand |
|---|---|
| Docker Compose | `app` (nur intern, Port 4800 nicht veröffentlicht) + `caddy` (80/443, HTTP/3) |
| HTTPS / Zertifikate | Caddy holt und erneuert Let's-Encrypt-Zertifikate automatisch; HTTP→HTTPS-Weiterleitung automatisch |
| Restart | `restart: unless-stopped` für beide Dienste; sauberes Beenden bei SIGTERM (30 s) |
| Volumes | `carcura-data` (Datenbank, Dateien, Sicherungen), `caddy-data` (Zertifikate) |
| Backups | täglich 02:30 im Volume (14 automatische + 20 manuelle werden behalten), manuell per Oberfläche, `pre-update` vor Migrationen |
| Restore | per Oberfläche (Neustart durch Docker, F6) oder bei großen Sicherungen per Datei (siehe Anleitung) |
| Updates | `git pull` + `docker compose up -d --build`; Migrationen laufen beim Start in einer Transaktion, vorher automatische Sicherung (F7) |
| Container-Rechte | läuft als Benutzer `node`, nicht als root |
| Offen | Sicherungen liegen auf **demselben Server** → eine externe Kopie ist Pflicht (Abschnitt 8) |

## 5. Datenbank (SQLite)

- Für einen Betrieb mit wenigen gleichzeitigen Nutzern geeignet: WAL-Modus, `busy_timeout`, Fremdschlüssel aktiv.
- Sicherung per `VACUUM INTO` (konsistent auch bei laufendem Betrieb), Wiederherstellung mit Sicherheitskopie des vorherigen Stands; live getestet.
- Migrationen: 14 additive Drizzle-Migrationen, transaktional; automatische Sicherung vorher.
- Integrität: Audit-Log mit Hashkette je Mandant (`verifyAuditChain`), Löschregister außerhalb der Datenbank.
- PostgreSQL-Wechsel: Schema über Drizzle, keine SQLite-Spezialfunktionen in der Fachlogik außer `rowid` in der Audit-Kette (dokumentiert). Ein PostgreSQL-Adapter ist **nicht** umgesetzt – erst bei mehreren Kunden bzw. hoher Last nötig.

## 6. Mandantenfähigkeit

- Automatischer Test ruft **jede registrierte Route** mit Kennungen eines fremden Mandanten auf; keine Route liefert fremde Daten (Test grün).
- `assertRefs` prüft alle referenzierten IDs (Kunde, Fahrzeug, Auftrag, Datei …) gegen den Mandanten.
- Datei-Downloads nur über `storage.get(companyId, id)`; kein Pfad-Traversal.
- Für den eigenen Betrieb (ein Mandant) nicht kritisch, aber bereits abgesichert.

## 7. Sicherheit – Stand und offene Punkte

Umgesetzt und geprüft: Passwort-Hashing, Kontosperre, 2FA, Passwort-Reset (Einmal-Token, gehasht, 30 Min.), CSRF,
Rate-Limit, Upload-Prüfung am Dateiinhalt (JPG/PNG/WebP/PDF), Bilder neu kodiert und in Sandbox ausgeliefert,
CSV-Export gegen Formel-Injektion, Audit-Log mit Hashkette ohne Geheimnisse, Rollen/Rechte, Supportzugriff nur
befristet, auf den Mandanten beschränkt und vollständig protokolliert.

Offen (nicht kritisch für den eigenen Betrieb):

| Punkt | Relevanz |
|---|---|
| „2FA für Admins erzwingen“ wird nur in der Oberfläche durchgesetzt, nicht serverseitig | vor externen Kunden |
| Kontosperre verrät, dass ein Konto existiert, und kann durch Dritte ausgelöst werden (15 Min.) | vor externen Kunden |
| Antwortzeit beim Passwort-Reset verrät existierende Konten | vor externen Kunden |
| Sitzungskennungen im Klartext in der DB (Sicherungs-ZIP enthält gültige Sitzungen) | vor externen Kunden (Hash speichern) |
| Mandant deaktivieren beendet laufende Sitzungen seiner Nutzer nicht | nur SaaS |
| Break-Glass ohne Vier-Augen-Prinzip; Mandantenbenachrichtigung nur mit Mandanten-SMTP | nur SaaS |
| TOTP-Code innerhalb von ~90 s wiederverwendbar; 2FA-Änderung beendet andere Sitzungen nicht | später |
| PDF-Prüfung auf aktive Inhalte erkennt nicht jede Verschleierung | später (Risiko gering, PDF-Viewer sandboxed) |
| Logo-Upload: Typprüfung auf `image/*` nach Inhaltserkennung | später |
| SSRF-Schutz (`netguard`) vorbereitet, aber nicht eingebunden | vor externen Kunden (Mandanten-SMTP/Webhooks) |
| Verschlüsselte Sicherungen (`BACKUP_PASSPHRASE` wird gelesen, aber noch nicht verwendet) | vor externen Kunden; für den eigenen Betrieb durch verschlüsselte externe Ablage abgedeckt |
| Server-Tests laufen nicht automatisch in CI (nur der Desktop-Build) | als Nächstes sinnvoll |

## 8. Electron / Windows

| Bereich | Stand |
|---|---|
| Produktionsbuild / NSIS | GitHub Actions baut `Carcura-Management-Setup-1.0.0.exe`, Release veröffentlicht; Desktop- und Startmenü-Verknüpfung, eigenes Fenster |
| Sicherheit | `contextIsolation`, `sandbox`, kein Node im Renderer, Navigation nur zum eigenen Server, Fuses (kein RunAsNode, ASAR-Integrität, Cookie-Verschlüsselung per Windows-DPAPI), keine DevTools im Build, Cache wird beim Beenden geleert |
| Serververbindung | HTTPS-Pflicht (Ausnahme: private Netze für Tests), Zertifikatsfehler werden nie übergangen, Versionsprüfung gegen `MIN_DESKTOP_VERSION` |
| Offline | „Keine Verbindung“ mit „Erneut versuchen“ beim Start und bei Verbindungsabbruch im Hauptfenster |
| Updates | **nicht automatisch**: neue Version = neuen Installer ausführen (Daten liegen auf dem Server). `electron-updater` ist vorbereitet, Update-Adresse leer |
| Code-Signing | nicht signiert → SmartScreen-Warnung. Workflow signiert automatisch, sobald `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` als GitHub-Secrets hinterlegt sind (OV-Zertifikat) |
| Hinweis | `allowPrivateHttp: true` erlaubt unverschlüsselte Verbindungen zu privaten Netzen – für die Kundenversion auf `false` setzen |

## 9. Datenschutz (technische Einordnung, keine Rechtsberatung)

**Technisch bereits umgesetzt:** Hosting-fähig in der EU (eigener Server), keine Drittanbieter-Skripte/Tracker in der
Oberfläche, TLS, Verschlüsselung gespeicherter Zugangsdaten, Rollen/Rechte, Audit-Log, Datenminimierung
(Fahrzeugfelder reduziert), Auskunft/Export je Person und Mandant, Einschränkung (Art. 18), Löschung mit
Aufbewahrungssperre und Löschprotokoll, Löschregister nach Wiederherstellung, Subprozessor-Register, KI-Nutzung
protokolliert und pseudonymisiert, Logs ohne Query-Strings/Cookies.

**Technisch noch erforderlich:** externe (verschlüsselte) Sicherungskopie, SSRF-Schutz einbinden, verschlüsselte
Sicherungsdateien, serverseitige 2FA-Pflicht, gehashte Sitzungskennungen, Einwilligungsfelder für Website-Leads.

**Juristisch zu prüfen:** AVV mit Hoster (Hetzner: im Kundenkonto), E-Mail-Anbieter und ggf. Windsor.ai/Google/Meta/
Anthropic (KI); Verarbeitungsverzeichnis; TOM-Dokument; Datenschutzerklärung (Website-Formular → CRM, Lead-Import aus
Meta); Aufbewahrungsfristen (§ 147 AO, § 257 HGB) mit dem Steuerberater; bei externen Kunden AGB + AVV als Auftragsverarbeiter.

**Für den ersten eigenen Betrieb relevant:** AVV Hetzner, externe Sicherung, Datenschutzerklärung der Website ergänzt
um die Weiterleitung ins CRM, Verarbeitungsverzeichnis-Eintrag „Kunden- und Auftragsverwaltung“.

**Erst vor externen Kunden relevant:** eigener AVV (Carcura als Auftragsverarbeiter), TOM-Anlage, Subprozessorliste
veröffentlicht, Vorfallprozess, Code-Signatur, die offenen Sicherheitspunkte aus Abschnitt 7.

## 10. API-Integrationen

| Integration | Funktioniert im Code | Nur vorbereitet / fehlt |
|---|---|---|
| **Google Ads (Kosten, Klicks, Conversions)** | über Windsor.ai (Abruf alle 6 h, getestet mit simulierten Antworten); Direktanbindung Google-Ads-API mit Refresh-Token | **Nachtrag 26.09.2026:** auf **v25** aktualisiert (v18 abgeschaltet; v22 wird am 07.10.2026 abgeschaltet), unzulässiges `pageSize` entfernt, Version per `GOOGLE_ADS_API_VERSION` anpassbar. Kein OAuth-Anmeldedialog (Refresh-Token manuell). Kein Test mit echtem Konto nachweisbar. |
| **Google Leads (Lead-Formulare)** | – | **nicht umgesetzt** (kein Webhook, kein Abruf). Nur Zuordnung von Website-Anfragen mit `gclid` zu „Google Ads“. |
| **Meta Ads (Kosten, Reichweite)** | über Windsor.ai; Direktanbindung Marketing API | **Nachtrag 26.09.2026:** von v21.0 (abgelaufen; seit 09.06.2026 nur noch ≥ v24.0) auf **v25.0** aktualisiert, per `META_GRAPH_API_VERSION` anpassbar; kein Token-Ablauf-Handling (System-User-Token empfohlen). |
| **Meta Leads (Lead Ads)** | über Windsor.ai (Abruf alle 6 h, idempotent, Feldnamen passend zu Carcuras Formular); nach F12 unabhängig von anderen Quellen | kein Echtzeit-Webhook (Verzögerung bis 6 h oder manueller Sync); **Windsor-Free-Plan liefert laut Anleitung derzeit Platzhalterwerte** → aktuell keine echten Daten. |
| **Website-Leads** | Endpunkt `POST /api/public/leads/website` mit Token, Rate-Limit, Honeypot, Duplikatschutz, Quellerkennung (gclid/fbclid); getestet | **Nachtrag 26.09.2026:** WordPress-Weiterleitung als MU-Plugin `integrations/wordpress/carcura-manager-lead-bridge.php` bereitgestellt (serverseitig, Token nur in `wp-config.php`, bestehendes Plugin bleibt Rückfallebene); gegen den Produktions-Build getestet. Keine E-Mail-Benachrichtigung bei neuem Lead, keine Einwilligungsfelder, E-Mail-Format nicht geprüft. |

## 11. Kosten für den ersten produktiven Betrieb (Richtwerte, aktuelle Preise beim Anbieter prüfen)

| Posten | Empfehlung | ca. Kosten/Monat |
|---|---|---|
| Server | Hetzner Cloud, Shared vCPU, **2 vCPU / 4 GB RAM / 40 GB**, Standort Deutschland, Ubuntu 24.04 (4 GB wegen Chromium-PDF und Docker-Build) | ca. 7 € (CX23), ersatzweise ca. 14–16 € (CPX22); Stand Okt. 2026 |
| Server-Backups | Hetzner-Backup-Option (tägliche Server-Snapshots, 7 Stände) | + 20 % des Serverpreises ≈ 1 € |
| Externe Sicherung | Hetzner Storage Box (kleinste Stufe) mit täglichem `rsync` der Sicherungs-ZIPs – oder wöchentlicher Download auf einen eigenen PC/NAS | ca. 3–4 € (oder 0 €) |
| Domain/DNS | vorhanden (carcura.info) – nur ein A-Eintrag `app` | 0 € |
| E-Mail | vorhandenes Postfach von carcura.info per SMTP (Port **587**, STARTTLS – Hetzner sperrt bei neuen Konten ausgehend Port 25/465) | 0 € |
| Firewall | Hetzner Cloud Firewall (22, 80, 443) | 0 € |
| **Summe Minimum** | | **ca. 9–20 €** |
| Später, vor externen Kunden | Code-Signing-Zertifikat | ca. 10 $/Monat (Azure Trusted Signing) bis ca. 300 €/Jahr (OV) |

Nicht nötig: Kubernetes, Managed Database, Load Balancer, CDN, externes Monitoring-Abo. Optional kostenlos: ein
Uptime-Check (z. B. Hetzner-Monitoring oder UptimeRobot-Free) auf `https://app.carcura.info/api/health/ready`.

## 12. Ergebnis

### A – Kann jetzt produktiv für Carcura selbst eingesetzt werden
- Zentraler Server mit Docker + Caddy, HTTPS, Neustart, Log-Rotation, Health-Checks
- Ersteinrichtung mit Einrichtungscode, Login, Rollen, 2FA, Passwort-Reset (mit SMTP)
- Kunden, Fahrzeuge, Aufträge, Termine, Protokolle, Angebote, Rechnungen, PDFs, Lager, Finanzen, Aufgaben, Berichte
- Tägliche Sicherung, Sicherung vor Updates, Wiederherstellung per Oberfläche
- Windows-App (Installer, Verbindung, Offline-Hinweis) – mit einmaliger SmartScreen-Bestätigung
- Website-Lead-Endpunkt (sobald die Website ihn aufruft), Windsor-Sync (sobald Windsor echte Daten liefert)

**Voraussetzungen vor dem ersten Echtbetrieb (Einrichtung, keine Entwicklung):**
1. `APP_SECRET` erzeugen, in `.env` setzen und zusätzlich offline aufbewahren (Passwortmanager).
2. Hetzner-Firewall (22/80/443), SSH nur mit Schlüssel, AVV im Hetzner-Konto abschließen.
3. Externe Sicherungskopie einrichten (Hetzner-Backup-Option **und** Storage Box oder regelmäßiger Download).
4. SMTP über Port 587 eintragen und Passwort-Reset einmal testen.
5. Eine Wiederherstellung einmal auf dem Server testen, bevor echte Daten eingegeben werden.
6. Admin-Konto mit 2FA absichern.

### B – Muss vor dem ersten externen Kunden erledigt werden
- Code-Signatur des Installers; `allowPrivateHttp` in der Kundenversion aus
- Offene Sicherheitspunkte aus Abschnitt 7 (serverseitige 2FA-Pflicht, gehashte Sitzungen, generische Sperrmeldung, Reset-Timing, SSRF-Schutz, Mandanten-Deaktivierung beendet Sitzungen, Break-Glass-Benachrichtigung)
- Verschlüsselte Sicherungsdateien (`BACKUP_PASSPHRASE`)
- Server-Tests in CI
- Rechtliches: AGB, AVV (Carcura als Auftragsverarbeiter), TOM, Subprozessorliste, Datenschutzerklärung, juristische Prüfung
- Oberflächen für Abo/Vertrag, Datenschutz-Center, Supportzugriff

### C – Kann später ergänzt werden
- Automatische Desktop-Updates (Update-Server), PostgreSQL-Adapter
- Meta-Lead-Webhook (Echtzeit), Google-Lead-Formulare, E-Mail-Benachrichtigung bei neuen Leads, Einwilligungsfelder
- API v1 mit Schlüsseln, ausgehende Webhooks
- Branchenfunktionen (Zeiterfassung, QS, Material, PTG, Pflegeabos, Online-Buchung, Portale, E-Rechnung)
- Kleinere Härtungen (TOTP-Replay, Logo-Typprüfung, PDF-Prüfung)
