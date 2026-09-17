# 02 – Zielarchitektur (Phase 2)

## Leitentscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Betriebsmodell | Lokale Web-Anwendung: ein Node-Prozess liefert API **und** Oberfläche unter `http://localhost:4800`. | Läuft ohne Installation von Datenbankservern auf Laptop/Rechner; identischer Code läuft später als Cloud-/SaaS-Instanz. |
| Backend | Node 22, TypeScript, Fastify 5 | Schnell, stabil, geringe Angriffsfläche, gute Testbarkeit (`app.inject`). |
| Datenbank | SQLite (WAL-Modus) über Drizzle ORM; Schema ist Postgres-kompatibel gehalten | Null Betriebsaufwand lokal, Backups sind Dateikopien, Wechsel zu PostgreSQL für SaaS über denselben Schema-Code. |
| Frontend | React 19, Vite, TanStack Query, React Router; eigenes Designsystem (CSS-Tokens) | Schnelle, flüssige Oberfläche; Branding pro Mandant über CSS-Variablen. |
| Auth | E-Mail + Passwort, `scrypt` (Node-Crypto, keine nativen Abhängigkeiten), serverseitige Sessions, signiertes httpOnly-Cookie, Leerlauf- und Absolut-Timeout, Rollen + Berechtigungsmatrix | Sicher, nachvollziehbar, erweiterbar um 2FA/Passkeys. |
| Mandanten | Jede fachliche Tabelle trägt `company_id`; jede Abfrage läuft über den Mandantenkontext der Session | Datentrennung ist strukturell, nicht optional. |
| Secrets | API-Keys pro Mandant AES-256-GCM-verschlüsselt in der Datenbank, Schlüssel aus `.env` (`APP_SECRET`) | Keine Klartext-Zugangsdaten, nichts im Frontend, nichts im Git. |
| PDF | HTML-Vorlagen → Chromium (Playwright) | Professionelle, gebrandete PDFs mit normalem CSS. |
| Hintergrundjobs | In-Prozess-Scheduler (`croner`) + Job-Tabelle mit Status, Retry, Backoff | Erinnerungen, Sync, wiederkehrende Ausgaben, Backups, Reports ohne externe Queue. |
| Offline | Kernfunktionen (CRM, Kalender, Aufträge, Rechnungen) arbeiten rein lokal; Integrationen laufen als Jobs mit Retry und zeigen den letzten erfolgreichen Sync an | Internetausfall blockiert das Tagesgeschäft nicht. |
| Dateien | Lokales Storage `data/files/<company_id>/…`, Metadaten in DB, Zugriff nur über autorisierte Routen | Vertrauliche Dokumente sind nie direkt öffentlich erreichbar. |

## Systemaufbau

```
┌───────────────────────────── Browser (Desktop / Tablet / Smartphone) ─────────────────────────────┐
│ React-App: Designsystem · App-Shell · Module (Dashboard, CRM, Fahrzeuge, Kalender, Aufträge, …)    │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                               │ HTTPS/HTTP  (Cookie-Session, JSON)
┌──────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
│ Fastify-Server                                                                                     │
│  ├─ /api/auth, /api/setup           Login, Logout, Session, Ersteinrichtung                        │
│  ├─ /api/<modul>                    fachliche Routen, Zod-Validierung, Berechtigungsprüfung        │
│  ├─ /api/public/leads/website       Lead-Eingang (Token, Rate-Limit, Duplikatschutz)               │
│  ├─ /files/<id>                     autorisierter Dateizugriff                                     │
│  └─ statische Web-App (dist)                                                                       │
│  Kern: Mandantenkontext · Audit-Log · Fehlerbehandlung · Logging (pino)                            │
│  Jobs: Erinnerungen · Sync (Windsor/GA4/Ads/Meta/GSC) · wiederkehrende Ausgaben · Backups · Reports│
│  Integrationen: MarketingSource-Adapter · Mail (SMTP) · PDF (Chromium) · KI (Claude API)            │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                               │
                 ┌─────────────────────────────┴───────────────┐
                 │ SQLite `data/app.db` (WAL) · `data/files/`   │
                 │ `data/backups/` (täglich + vor Updates)      │
                 └─────────────────────────────────────────────┘
```

## Backend-Struktur

```
server/src
├── index.ts            Start (Migrationen → App → Jobs)
├── app.ts              buildApp(): Plugins, Routen, Fehlerbehandlung (auch für Tests)
├── config.ts           Umgebungsvariablen (validiert)
├── db/                 Verbindung, Schema (Drizzle), Migrationen
├── core/               Passwort, Session, Berechtigungen, Audit, Verschlüsselung, Fehler, IDs
├── modules/<name>/     routes.ts (HTTP) · service.ts (Fachlogik) · schemas.ts (Zod)
├── integrations/       marketing/ (Windsor, GA4, Google Ads, Meta, GSC) · mail/ · pdf/ · ai/
└── jobs/               scheduler.ts, einzelne Jobs
```

Regeln: Routen validieren, Services rechnen, jede Service-Funktion erhält `ctx` (`companyId`, `userId`) und
filtert damit. Kein Service greift ohne `companyId` auf Mandantendaten zu.

## Berechtigungsmodell

Rollen: `admin`, `manager`, `employee`, `accounting`, `readonly`. Jede Rolle erhält eine Menge von
Berechtigungen (`customers:read`, `customers:write`, `invoices:write`, `finance:read`, `settings:write`, …).
Der Admin eines Mandanten kann die Zuordnung Rolle → Berechtigungen im Rahmen des Systems anpassen
(Tabelle `role_permissions`). Ein Betreiber-Flag (`is_platform_admin`) ist für die spätere zentrale
Administration vorgesehen.

## Fehler- und Ausfallverhalten

* Externe API nicht erreichbar → Job schlägt fehl, Retry mit exponentiellem Backoff (1, 5, 15, 60 Minuten),
  letzter Erfolg und Fehler sichtbar unter Einstellungen → Integrationen; die Oberfläche zeigt weiterhin die
  zuletzt synchronisierten Daten.
* Token abgelaufen → Adapter versucht Refresh; sonst Status „Aktion erforderlich“.
* Rate-Limit → Backoff nach `Retry-After`.
* Validierungsfehler → HTTP 400 mit Feldliste; interne Fehler → HTTP 500 mit Fehler-ID im Log.

## Teststrategie

* **Unit/Integration (Vitest):** In-Memory-SQLite pro Testdatei, echte Routen über `app.inject`.
* **Pflichtfälle:** Login/Logout/Timeout, Rollen, Mandantentrennung (Nutzer A sieht nie Daten von B),
  Lead → Kunde, Fahrzeug, Termin + Erinnerung, Angebot, Rechnung + PDF, Upload, Protokoll, Lager, Ausgaben,
  wiederkehrende Ausgaben, Finanzkennzahlen, Backup/Restore.
* **E2E (Playwright):** Login, Kundenanlage, Terminanlage, Rechnungs-PDF; Desktop- und Mobil-Viewport.
