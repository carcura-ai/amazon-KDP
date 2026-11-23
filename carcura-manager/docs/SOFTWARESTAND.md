# Carcura Manager – Softwarestand

Stand: 23.11.2026 · Commit `2e7316d` · Server v0.3.0 · 180 Tests grün · Details zu Lücken: `docs/AUDIT.md`

## 1. Was die Software kann

| Bereich | Funktion |
|---|---|
| Anmeldung | Login, 2FA (TOTP und Wiederherstellungscodes), Passwort vergessen per E-Mail, Sperre nach 5 Fehlversuchen, Abmeldung nach 8 h Inaktivität |
| Benutzer | 5 Rollen, Rechte je Rolle anpassbar, Admin-Schutz |
| Dashboard | Kennzahlen nur aus echten Daten: Umsatz, offene Posten, Termine, Aufgaben |
| Leads | Pipeline, Quelle (Website, Google, Meta), Umwandlung in Kunde, Duplikat-Hinweis, Eingang von der Website (WordPress) |
| Kunden | Akte mit Historie, privat und geschäftlich, CSV-Import mit Vorschau und Export, DSGVO-Auskunft und -Löschung |
| Fahrzeuge | Kennzeichen, Marke, Modell, Historie, Kennzeichen-Duplikate |
| Kalender | Tag, Woche, Monat, Liste; Termine je Mitarbeiter mit Konfliktwarnung; Terminbestätigung, Erinnerungsmail, WhatsApp-Link |
| Aufträge | Positionen, Status, Auftrags-PDF |
| Protokolle | Annahme und Übergabe: Fahrzeugskizze mit Schadensmarkern, Fotos, Unterschrift Kunde und Mitarbeiter, PDF nach Abschluss gesperrt |
| Angebote | Positionen, PDF, Versand per E-Mail, Umwandlung in Auftrag oder Rechnung |
| Rechnungen | Nummernkreis, Festschreibung, Storno, Zahlungen, Überfällig-Markierung, PDF, Versand; Kleinunternehmer § 19 |
| Belegimport | Ausgangs- und Eingangsrechnungen hochladen (ZUGFeRD, XRechnung, PDF); KI-Erkennung optional |
| Finanzen | Ausgaben, wiederkehrende Ausgaben, Cashflow, USt-Schätzung |
| Lager | Bestände, Mindestmenge, Bewegungen |
| Aufgaben | mit Bezug zu Kunde, Lead oder Auftrag; fällig bzw. überfällig |
| Marketing | Google Ads, GA4, Search Console, Meta, Windsor.ai: Kosten pro Lead, ROAS, Umsatz je Quelle |
| Wettbewerber | Google-Places-Suche wöchentlich (Verlauf laut AUDIT nicht zulässig) |
| Berichte | Woche, Monat, Jahr automatisch per E-Mail und als PDF |
| KI-Assistent | Fragen zu eigenen Daten (Anthropic), Kundendaten pseudonymisiert |
| Suche | global über Kunden, Leads, Fahrzeuge |
| Datenschutz | Löschfristen-Job, Anonymisierung, Sperrvermerk, Auskunft als ZIP, Mandantenexport, Löschprotokoll (vieles nur per API) |
| System | tägliche Sicherung, Wiederherstellung, Update aus der Oberfläche, Job-Protokoll, Status |
| Mandanten (SaaS) | mehrere Firmen, Tarife und Module, Abo-Status, Betreiber-Ebene, befristeter Supportzugriff, Rechtstexte, Selbstregistrierung |
| API-Schlüssel (neu) | Programme dürfen Kunden, Fahrzeuge, Aufträge, Leads und Termine lesen und anlegen bzw. ändern; kein Löschen, keine Rechnungen; Anlegen und Sperren per CLI |
| Apps | Web (Smartphone, Tablet, Desktop), Windows-App (Electron), iPhone-Hülle (Capacitor) |

**Fehlt laut Plan:** Online-Terminanfrage, Statusmeldungen zum Auftrag, Checklisten, Auftragszeit, Boxen, Preise je Fahrzeugklasse, Pflegeabos, Lexware-Anbindung, Einwilligungsverwaltung, Onboarding-Assistent.

## 2. Design

- **Stil:** dunkel und reduziert. Hintergrund `#0a0a0b`, Karten `#151517`, Text `#f4f4f5`, Akzent Neongelb `#e8f320`.
- **White-Label:** Akzentfarbe, Logo und Produktname je Mandant.
- **Statusfarben:** grün (ok), gelb (Warnung), rot (Fehler), blau (Info).
- **Aufbau:** Seitenleiste links mit Navigation nach Rechten, Inhalt als Karten und Tabellen. Unter 860 px wird die Seitenleiste zum ausklappbaren Menü und der Kalender zur Liste.
- **Bausteine:** eigene UI-Komponenten (Knopf, Karte, Badge, Dialog, Felder) und Diagramme mit Recharts.
- **PDFs:** Kopf mit Logo und Firma, Fuß mit Kontakt, Bank und Steuer, in der Farbe des Mandanten.
- **Schriften:** keine externen Schriften oder CDNs; alles wird selbst ausgeliefert.

## 3. Technik kurz

Node 24, Fastify 5, SQLite (`node:sqlite`) mit Drizzle (62 Tabellen, Mandant über `company_id`), React 19 mit Vite, PDF über
Chromium (Playwright), Bilder mit Sharp, Mail mit Nodemailer, Jobs mit Croner. Betrieb: Docker mit Caddy (HTTPS).

## 4. Jede Code-Datei in einem Satz

### Server-Kern (`server/src`)
- `index.ts` – Start: Datenbank, Migration mit Sicherung vorher, Jobs, erneutes Anwenden von Löschungen nach einer Wiederherstellung.
- `app.ts` – Webserver: Plugins, Sicherheits-Header, CSRF, Rate-Limit, alle Routen, Health-Endpunkte, Auslieferung der Oberfläche.
- `config.ts` – liest die Einstellungen aus der Umgebung (Modus selfhosted bzw. saas, Pfade, SMTP, Limits).
- `cli.ts` – Wartung ohne Server: Sicherung, Liste, Wiederherstellung, API-Schlüssel anlegen, auflisten und sperren.
- `db/schema.ts` – alle 62 Tabellen.
- `db/index.ts` – Drizzle-Verbindung und automatische Migration.
- `db/sqlite.ts` – Anpassung von `node:sqlite` an Drizzle.
- `plugins/auth.ts` – Sitzung bzw. API-Schlüssel prüfen, Rechte erzwingen, Betreiber-2FA.
- `plugins/entitlements.ts` – sperrt Module nach Tarif (nur im SaaS-Modus).

### core
- `apikeys.ts` – API-Schlüssel erzeugen, gehasht prüfen, Bereiche festlegen.
- `audit.ts` – Audit-Log mit Hash-Kette, Geheimnisse geschwärzt.
- `context.ts` – Mandanten- und Benutzerkontext einer Anfrage.
- `crypto.ts` – AES-256-GCM für Zugangsdaten.
- `csv.ts` – CSV-Lesen und -Schreiben im Excel-Format.
- `entitlements.ts` – Module, Tarife, Zusatzpakete und ihre Auflösung.
- `errors.ts` – einheitliche Fehlertypen.
- `ids.ts` – ID-Erzeugung.
- `lineItems.ts` – Netto, MwSt. und Brutto; Kleinunternehmer 0 %.
- `netguard.ts` – SSRF-Schutz (vorhanden, noch nicht eingebunden).
- `normalize.ts` – Telefonnummer, E-Mail und Kennzeichen vereinheitlichen.
- `numbering.ts` – lückenlose Nummernkreise.
- `password.ts` – Passwort-Hash (scrypt) und Passwortregeln.
- `permissions.ts` – Rollen und Rechte.
- `session.ts` – Sitzungen anlegen, prüfen und beenden.
- `subscriptions.ts` – Abo-Lebenszyklus (Test, aktiv, gekündigt).
- `tenant.ts` – prüft, dass fremde IDs zum eigenen Mandanten gehören.
- `totp.ts` – 2FA-Codes.
- `validation.ts` – gemeinsame Zod-Prüfungen.

### integrations
- `mail.ts` – E-Mail-Versand über SMTP, Sperre bei eingeschränkten Kunden.
- `pdf.ts` – PDF-Erzeugung mit Chromium.
- `pdf-templates.ts` – HTML-Vorlagen für alle PDFs.
- `storage.ts` – Uploads: Typprüfung nach Inhalt, EXIF entfernen, Ablage je Mandant.
- `store.ts` – verschlüsselte Zugangsdaten je Mandant.
- `templates.ts` – Mail- und WhatsApp-Texte.
- `backup.ts` – Sicherung als ZIP und Wiederherstellung.
- `ai/assistant.ts` – KI-Assistent mit Werkzeugen auf echte Daten.
- `ai/documents.ts` – KI-Belegerkennung.
- `einvoice/model.ts` – einheitliches Rechnungsmodell.
- `einvoice/parse.ts` – erkennt und liest CII und UBL.
- `einvoice/pdf.ts` – zieht die XML aus ZUGFeRD-PDFs.
- `einvoice/xml.ts` – sicherer XML-Leser.
- `marketing/google.ts` – Abruf aus Google Ads, GA4 und Search Console.
- `marketing/meta.ts` – Abruf von Meta-Kampagnen.
- `marketing/windsor.ts` – Abruf über Windsor.ai inkl. Meta-Leads.
- `marketing/sync.ts` – Abgleich aller Quellen.
- `marketing/types.ts` – HTTP mit Wiederholung.
- `payments/provider.ts` – Schnittstelle zu Zahlungsanbietern (manuell bzw. signierter Webhook).

### jobs
- `scheduler.ts` – Zeitplaner mit Protokoll.
- `reminders.ts` – Terminerinnerungen.
- `overdue.ts` – überfällige Rechnungen.
- `recurring.ts` – wiederkehrende Ausgaben.

### modules (je Ordner die API eines Bereichs)
- `auth/routes.ts` – Login und Logout. `auth/twofa.routes.ts` – 2FA. `auth/reset.routes.ts` – Passwort vergessen.
- `users/routes.ts` – Benutzerverwaltung.
- `setup/routes.ts` – Ersteinrichtung.
- `company/routes.ts` – Firmendaten und Rechte. `company/branding.routes.ts` – öffentliches Branding. `company/defaultServices.ts` – Startkatalog (Preise 0).
- `crm/customers.routes.ts` – Kunden. `crm/vehicles.routes.ts` – Fahrzeuge. `crm/leads.routes.ts` – Leads. `crm/services.routes.ts` – Leistungen. `crm/activities.ts` – Verlauf. `crm/duplicates.ts` – Duplikatsuche. `crm/importexport.routes.ts` – CSV. `crm/public.routes.ts` – Website-Lead-Eingang.
- `appointments/routes.ts` – Termine.
- `orders/routes.ts` – Aufträge.
- `protocols/routes.ts` – Annahme- und Übergabeprotokolle.
- `billing/offers.routes.ts` – Angebote. `billing/invoices.routes.ts` – Rechnungen und Zahlungen. `billing/common.ts` – gemeinsame Positionen.
- `print/routes.ts` – PDFs von Akte und Auftrag.
- `files/routes.ts` – Upload und Download.
- `imports/routes.ts` und `imports/service.ts` – Belegimport mit Warteschlange und Zuordnung.
- `finance/routes.ts` – Ausgaben und Kennzahlen.
- `inventory/routes.ts` – Lager.
- `tasks/routes.ts` – Aufgaben.
- `dashboard/routes.ts` – Dashboard.
- `search/routes.ts` – Suche.
- `analysis/pricing.ts` und `analysis/routes.ts` – Preis- und Margenanalyse.
- `marketing/routes.ts` – Marketing-Einstellungen und -Auswertung.
- `competitors/places.ts` und `competitors/routes.ts` – Wettbewerber.
- `reports/generator.ts` und `reports/routes.ts` – Berichte.
- `assistant/routes.ts` – KI-Chat.
- `integrations/routes.ts` – SMTP mit Testmail.
- `privacy/` – Datenschutz:
  - `routes.ts` – Auskunft und Löschung
  - `center.routes.ts` – Datenschutz-Center
  - `export.ts` – Mandantenexport
  - `retention.ts` – Löschfristen
  - `lifecycle.ts` – Aufbewahrung
  - `anonymize.ts` – Anonymisierung
  - `reapply.ts` – Löschungen nach Wiederherstellung
  - `settings.ts` – Einstellungen
- `platform/routes.ts` – Mandanten anlegen. `platform/support.routes.ts` – Supportzugriff. `platform/compliance.routes.ts` – Subprozessoren, Rechtstexte, Vorfälle. `platform/tenant-lifecycle.ts` – Mandantenlöschung.
- `saas/admin.routes.ts` – Tarife und Rabatte. `saas/subscription.routes.ts` – Abo des Mandanten. `saas/legal-signup.routes.ts` – Registrierung und Rechtstexte. `saas/webhooks.routes.ts` – Zahlungs-Webhooks.
- `system/routes.ts` – Sicherung, Neustart, Update.

### Web (`web/src`)
- `main.tsx` – Einstieg. `app/routes.tsx` – Seiten-Routen. `app/shell.tsx` – Rahmen mit Navigation. `app/auth.tsx` – Anmeldestatus und Branding.
- `api/client.ts` – API-Aufrufe. `api/types.ts` – Datentypen.
- `components/ui/index.tsx` – UI-Bausteine. `components/pickers.tsx` – Kunden- und Fahrzeugauswahl. `components/lineItems.tsx` – Positionseditor. `components/documents.tsx` – Dateiliste.
- `lib/format.ts` – Formate und Bezeichnungen. `lib/desktop.ts` – Brücke zur Windows-App.
- `styles/tokens.css` – Farben und Abstände. `styles/base.css` – Layout und Umbrüche.
- `pages/` – eine Seite je Bereich:
  - Dashboard, Leads, LeadDetail, Customers, CustomerDetail, Vehicles, VehicleDetail
  - Calendar, Orders, Protocol, Billing, DocumentImports, Finance, Inventory, Tasks
  - Marketing, Competitors, Reports, Assistant
  - Settings, Platform, Setup, Login, PasswordReset

### Desktop, App, Betrieb
- `desktop/src/main.cjs` – Windows-App: lädt den Server, Sicherheitssperren, Updates. `preload.cjs` – kleine sichere Brücke. `lib.cjs` – Hilfsfunktionen. `ui/connect.*` – Seite zur Serververbindung.
- `app/www/index.html` – iPhone-Hülle mit Server-URL. `app/scripts/ios-prepare.sh` – baut das Xcode-Projekt.
- `deploy/Dockerfile` – Container. `deploy/docker-compose.yml` – App plus Caddy. `deploy/Caddyfile` – HTTPS und datensparsame Logs.
- `scripts/install|start|update|einrichten` (`.sh` und `.cmd`) – Installation, Start, Update, Einrichtung mit Carcura-Daten.
- `integrations/wordpress/carcura-manager-lead-bridge.php` – leitet Website-Anfragen an den Manager weiter.

### Tests
- `server/test/*.test.ts` – 20 Dateien, 180 Tests (u. a. Mandantentrennung, Rechte, Rechnungen, Datenschutz, Sicherung, Belegimport, API-Schlüssel).
- `e2e/*.mjs` – 13 Oberflächentests und Demo-Skripte (von Hand gestartet).
- `server/drizzle/*.sql` – 15 Migrationen.
