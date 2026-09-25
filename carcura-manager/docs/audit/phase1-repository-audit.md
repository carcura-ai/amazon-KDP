# Phase 1 – Repository-Audit Carcura Manager

Stand: 25.09.2026, Codebasis Version 0.2.1 (Commit 5834a0e), Branch `claude/kind-curie-4rhi0y`.
Methode: vollständiges Lesen von Schema, Auth, Rechten, App-Aufbau, Speicher, Integrationen und
aller Server-Module; Stichproben in der Web-Oberfläche; Abgleich mit den vorhandenen Tests.
Dieses Dokument beschreibt den Ist-Zustand **vor** dem SaaS-Umbau. Rechtliche Aussagen sind keine
Rechtsberatung; alles unter „juristisch zu prüfen“ muss eine qualifizierte Beratung bewerten.

## 1. Architektur (Ist)

| Schicht | Umsetzung |
|---|---|
| Laufzeit | Node.js ≥ 22.13, ein Prozess, Startskript mit Neustart-/Update-Codes |
| HTTP | Fastify 5, Cookies (signiert), Rate-Limit-Plugin (nur gezielt), Multipart |
| Datenbank | SQLite über `node:sqlite` mit Kompatibilitätsschicht (`db/sqlite.ts`), Drizzle ORM, 9 versionierte Migrationen (`server/drizzle/0000–0008`) |
| Oberfläche | React 19 + Vite, ausgeliefert vom selben Server, PWA-Manifest |
| Dateien | Dateisystem `data/files/<companyId>/<jahr>/<monat>/<uuid>.<ext>` |
| PDF | Playwright-Chromium, HTML-Vorlagen |
| Jobs | croner-Scheduler im Prozess (Erinnerungen, Überfälligkeit, Wiederkehrendes, Marketing-Sync, Berichte, Wettbewerber, Backup, Aufbewahrung, Session-Bereinigung) |
| Integrationen | SMTP, Windsor.ai, Google Ads/GA4/Search Console (Service Account), Meta Ads, Anthropic, Google Places |
| Geheimnisse | AES-256-GCM (`SecretBox`), Schlüssel aus `APP_SECRET` oder `data/app-secret.key` (nicht in der Datenbank, nicht im Backup) |

**Mandantenmodell:** Die Tabelle `companies` ist der Mandant (Tenant). Alle fachlichen Tabellen tragen
`company_id`. Es gibt keinen globalen Filter; jede Abfrage setzt den Mandanten selbst.
Der Betreiber (System-Admin) ist ein normaler Benutzer eines Mandanten mit `is_platform_admin = 1`.

## 2. Vorhandene Funktionen

Dashboard (nur echte Daten, Kennzeichnung Fakt/Berechnung/Prognose/Empfehlung), globale Suche, Leads mit
Quelle/Status/gclid/fbclid/Kampagne, Duplikaterkennung, Lead→Kunde, Kundenakte mit Aktivitäten, Fahrzeuge
mit Kennzeichen-Duplikatwarnung, Kalender (Tag/Woche/Monat/Liste) mit E-Mail-Bestätigung/-Erinnerung und
wa.me-Link, Aufträge (8 Status) mit Positionen, Annahme-/Übergabeprotokolle mit Schäden, Fotos, zwei
Unterschriften, PDF und Einfrieren, Dokumentenablage, Angebote (5 Status) mit PDF/E-Mail/Umwandlung,
Rechnungen mit lückenloser Nummer beim Ausstellen, Teilzahlungen, Überfälligkeit, Storno per
Stornorechnung, § 19 UStG, Leistungskatalog mit Materialkosten, Preis-/Margenanalyse, Lager mit
Bewegungen, Ausgaben inkl. wiederkehrender, Marketing-Sync und -Auswertung, Wochen-/Monats-/
Jahresberichte als PDF, Wettbewerber über Google Places, KI-Assistent mit 11 Werkzeugen und
Pseudonymisierung, Aufgaben, 5 Rollen mit 38 Einzelrechten (je Mandant anpassbar), TOTP-2FA mit
Backup-Codes, Audit-Log, Art.-15-Dossier, Anonymisierung/Löschung, Aufbewahrungsfristen,
tägliche Backups mit Wiederherstellung, Update/Neustart aus der Oberfläche, White-Label (Logo, Farben,
Produktname, „powered by“), Betreiber-Übersicht über Mandanten, CSV-Import/-Export, JSON-Firmenexport,
Website-Lead-Eingang mit Token und Honeypot.

## 3. Datenbank

29 Tabellen, alle fachlichen mit `company_id`, Unique-Indizes je Mandant für Nummern
(`customers_number_unique`, `invoices_number_unique` …), Indizes auf `(company_id, …)`.
Fremdschlüssel nur teilweise deklariert (z. B. `vehicles.customer_id`), viele Referenzen
(`orders.customer_id`, `invoices.customer_id`, `files.customer_id`) ohne FK. Geldbeträge als Integer-Cent,
Steuersätze als Basispunkte. Zeitstempel als ISO-Text; SQLite-spezifisch sind `strftime`-Defaults,
`real`-Mengen und einige Raw-SQL-Fragmente (`strftime('%w', …)` im KI-Werkzeug, `like`).

## 4. Authentifizierung und Autorisierung

- Passwörter: scrypt (N=2^16, r=8, p=1), Richtlinie ≥ 10 Zeichen, Groß/Klein/Ziffer, Sperre nach 5 Fehlversuchen für 15 Minuten.
- Sessions: 32-Byte-Zufallstoken in DB, signiertes HttpOnly-Cookie, `SameSite=Lax`, `Secure` bei HTTPS, Leerlauf- und Absolut-Timeout, Widerruf bei Passwortwechsel/Deaktivierung.
- Rechte: serverseitig per `requireAuth(...permissions)`; Rollenrechte je Mandant in `role_permissions`.
- 2FA: TOTP, für Admins per Mandanteneinstellung erzwingbar (Standard aus).

## 5. API

185 Routen unter `/api/*` und `/files/:id`, alle mit Zod-Validierung. Keine Versionierung, keine API-Schlüssel,
keine ausgehenden Webhooks. Öffentliche Routen: `/api/health`, `/api/setup` (nur vor Ersteinrichtung),
`/api/branding`, `/api/auth/*`, `/api/public/leads/website` (Token).

## 6. Tests

11 Vitest-Dateien, 68 Tests (API-Ebene über `app.inject`), 9 Playwright-UI-Skripte.
Mandantentrennung wird in `crm.test.ts` exemplarisch (Kunden, Lead-Token) und in `files.test.ts`
(fremder Kunde bei Protokoll) geprüft. **Es fehlt ein systematischer Test über alle Routen.**

## 7. Sicherheitsbefunde

| Nr. | Befund | Schwere | Fundstelle |
|---|---|---|---|
| S1 | Upload vertraut dem vom Browser gemeldeten MIME-Typ; keine Magic-Byte-Prüfung, PDFs werden nicht auf aktive Inhalte geprüft | mittel | `integrations/storage.ts`, `modules/files/routes.ts` |
| S2 | Upload akzeptiert `customerId/vehicleId/orderId/protocolId` ohne Prüfung, ob sie zum Mandanten gehören (Verknüpfung auf fremde IDs möglich, kein Lesezugriff) | mittel | `modules/files/routes.ts` |
| S3 | Kein expliziter CSRF-Schutz; es wirkt nur `SameSite=Lax` | mittel | `app.ts` |
| S4 | Betreiber-Admin ist Benutzer eines Mandanten, 2FA nicht Pflicht, sieht Rechnungssummen aller Mandanten; kein kontrollierter Supportzugriff | hoch (für SaaS) | `modules/platform/routes.ts` |
| S5 | Audit-Log nicht manipulationserschwert, keine Request-ID | mittel | `core/audit.ts` |
| S6 | Backups unverschlüsselt, auf demselben Datenträger | mittel | `integrations/backup.ts` |
| S7 | Nachgelagerte Lesezugriffe per nackter ID nach geprüftem Hauptdatensatz; Terminliste lädt Benutzer aller Mandanten in den Speicher | niedrig (Defense in Depth) | `appointments`, `orders`, `invoices`, `protocols`, `print` |
| S8 | Kein Passwort-Reset per E-Mail, keine E-Mail-Verifikation | mittel (SaaS) | – |
| S9 | Rate-Limit nur für Login, Setup, 2FA, KI, Website-Leads; nicht global | niedrig | `app.ts` |
| S10 | Logger ohne Redaction-Regeln für Cookies/Authorization | niedrig | `app.ts` |
| S11 | Nur ein Health-Endpunkt, keine Readiness-Prüfung der Datenbank | niedrig | `app.ts` |
| S12 | Keine Prüfung, ob Migrationen vor dem Start automatisch gesichert werden (nur Update-Skript sichert) | mittel | `index.ts`, `db/index.ts` |
| S13 | `style-src 'unsafe-inline'` in der CSP (React-Inline-Styles) | niedrig | `app.ts` |

## 8. Datenschutzbefunde

| Nr. | Befund |
|---|---|
| D1 | Kein Einschränkungs-Flag (Art. 18), kein Register der Betroffenenanfragen mit Fristen |
| D2 | Lebenszyklus nur „aktiv/anonymisiert“; keine Aufbewahrungssperre mit Begründung und Enddatum |
| D3 | Kein vollständiger Mandantenexport als ZIP (JSON, CSV, PDFs, Dateien) mit Protokoll |
| D4 | Kein Kündigungs- und Löschworkflow für Mandanten |
| D5 | Kein Subprozessor-Register, keine Dokumentation der Drittlandübermittlungen im System |
| D6 | Keine Versionierung von Rechtsdokumenten und keine Zustimmungsnachweise |
| D7 | Kein Incident-Log |
| D8 | Aufbewahrung von Marketing-, KI-Verlaufs- und Systemdaten nicht geregelt |
| D9 | Audit-Log speichert Vorher/Nachher-Zustände inkl. personenbezogener Felder (für Nachvollziehbarkeit nötig; Frist und Anonymisierung vorhanden) |
| D10 | KI-Nutzung wird nicht protokolliert (wer, wann, welche Werkzeuge, ob Personendaten) |

## 9. SaaS-Lücken

Keine Tarife, Module, Entitlements, Abonnements, Zahlungsanbieter-Schnittstelle, Webhooks, Signup,
E-Mail-Verifikation, Mandanten-Onboarding, Betreiber-Kennzahlen (MRR/ARR/Churn), Reseller, Domains,
Lizenzmodus. Keine Trennung von System-Admin und Mandantendaten.

## 10. Fachliche Lücken (Branchensoftware)

Zeiterfassung, Qualitätskontrolle mit Checkliste, Materialverbrauch je Auftrag, Lackschichtmessung (PTG),
Pflegeabos/wiederkehrende Aufträge, Follow-up-Automationen, Online-Buchung, Kunden- und Autohausportal,
QR-Codes, Bewertungsanfrage, Korrekturprozess für abgeschlossene Protokolle, Gutschrift/Korrekturrechnung,
Zahlungsstatus „teilweise bezahlt“ als eigener Status, automatischer Angebotsablauf, E-Rechnung
(XRechnung/ZUGFeRD).

## 11. Technische Schulden

- Mandant heißt im Code `company`, fachlich „Tenant“; eine Umbenennung aller Tabellen wäre riskant und bringt keinen Nutzen. Entscheidung: Name bleibt, Begriff wird dokumentiert (`company_id` = `tenant_id`).
- Raw-SQL-Fragmente mit SQLite-Funktionen verstreut; für PostgreSQL müssen sie gekapselt werden.
- Fehlende Fremdschlüssel; Integrität wird in Handlern geprüft.
- Einstellungen als JSON in `companies.settings_json`.

## 12. Migrationsrisiken

- SQLite kann Spalten nur additiv ändern; Drizzle erzeugt bei Typänderungen Tabellen-Neuaufbauten. Deshalb nur additive Migrationen, Tabellen-Neuaufbau nur mit Test.
- Laufende Installation des Betreibers (Windows-Laptop) muss ohne Datenverlust und ohne Funktionsverlust weiterlaufen. Neue Module dürfen dort nichts sperren: Standardmodus „self-hosted“ mit allen Modulen.
- Vor jeder Migration muss automatisch gesichert werden.
