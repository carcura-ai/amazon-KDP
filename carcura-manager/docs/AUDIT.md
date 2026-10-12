# Bestandsaufnahme Carcura Manager (Phase 0)

Stand: 12.10.2026 · Branch `claude/kind-curie-4rhi0y` · Grundlage: Commit `90cb116`
Art der Prüfung: Lesen des Quellcodes, Ausführen der vorhandenen Tests, Abhängigkeitsprüfung, Secret-Scan. **In Phase 0
wurde kein Code geändert.**

Pfadangaben sind relativ zu `carcura-manager/`. `S/` = `server/src/`, `W/` = `web/src/`.

## Inhalt

1. Zusammenfassung
2. Technik
3. Betrieb
4. Funktionsabgleich (Abschnitte 4 bis 7 des Auftrags)
5. Sicherheitsbefund
6. Datenschutzbefund
7. Zahlungsarten: Erfassung von Barzahlungen
8. Prüfung der Rechtsangaben aus dem Auftrag
9. Grenzen dieser Prüfung

---

## 1. Zusammenfassung

| Bereich | Ergebnis |
|---|---|
| Codebasis | Gute Grundlage: TypeScript, Fastify 5, Drizzle mit SQLite, React 19. 62 Tabellen, Mandantentrennung über `company_id`, 177 automatisierte Tests, alle grün; Typprüfung ohne Fehler. |
| Sicherheit | Solides Fundament. Offen sind aber **3 hohe** und **13 mittlere** Befunde, darunter: Ein gesperrter Mandant kann sich weiter anmelden. Ein Nicht-Admin mit „Benutzer verwalten“ kann sich selbst Rechte geben. Die 2FA-Pflicht für Mandanten-Admins prüft nur die Oberfläche. Der SSRF-Schutz ist nicht angeschlossen. Sicherungen sind unverschlüsselt und liegen auf demselben Server. |
| Abhängigkeiten | Produktivcode: **2 hohe Schwachstellen** (`extract-zip`, `sharp` < 0.35.5). Entwicklungswerkzeuge: 1 hohe, 4 mittlere. Desktop-App: 1 hohe, 8 mittlere. |
| Geheimnisse | Keine echten Schlüssel im Repository oder in der Git-Historie gefunden; nur Testwerte. |
| Datenschutz | Vorhanden sind Löschroutine, Anonymisierung, Sperrvermerk, Auskunfts-ZIP und Mandantenexport. Es **fehlen**: Einwilligungsverwaltung, Prüfung des Einwilligungssignals für Klick-Kennungen und das Verpixel-Werkzeug. Die meisten Datenschutzfunktionen sind nur per API erreichbar, ohne Oberfläche. |
| Barzahlung | Kann an **3 Stellen erfasst werden**: Rechnungszahlung, Ausgabe, wiederkehrende Ausgabe (Abschnitt 7). |
| Kernablauf | Anfrage, Kunde, Termin, Protokoll, Auftrag und Rechnung sind vorhanden. **Es fehlen**: Online-Terminanfrage, Statusmeldungen zum Auftrag, Checklisten, Auftragszeit, Boxen, Preise je Fahrzeugklasse, Pflegeabos, Lexware-Anbindung, Onboarding-Assistent. |
| Modulsystem | 33 Feature-Schlüssel und Tarife sind vorhanden. Die Sperre greift aber **nur im SaaS-Modus**, die Oberfläche blendet gesperrte Module nicht aus, und etwa 12 Schlüssel haben keine Funktion dahinter. Die Tarifbeschreibungen versprechen nicht vorhandene Funktionen, etwa „Zeiterfassung“, „E-Rechnung“ und „Online-Buchung“. |
| CI | Server-Tests laufen **nicht** in der CI. Es fehlen Linter, SAST, Secret-Scan und automatische Update-Vorschläge. |

---

## 2. Technik

### 2.1 Stack und Versionen

| Teil | Technik | Fundstelle |
|---|---|---|
| Laufzeit | Node ≥ 22.13 (Container: Node 24, `node:24-bookworm-slim`) | `package.json`, `deploy/Dockerfile:3,13` |
| Server | Fastify ^5.12.5, Zod ^4.6.5, Drizzle ORM ^0.45.2, Pino ^10, Croner ^10, Nodemailer ^10, Sharp ^0.35.4, Playwright ^1.63 (PDF), @anthropic-ai/sdk ^0.126 | `server/package.json` |
| Datenbank | SQLite über das eingebaute `node:sqlite` (`DatabaseSync`), WAL, `foreign_keys=ON`, mit einer Kompatibilitätsschicht für Drizzle | `S/db/sqlite.ts:1`, `S/db/index.ts:23-44` |
| Web | React ^19.3, React Router ^7.18, TanStack Query ^5, Recharts ^3, Vite ^8.3 | `web/package.json` |
| Desktop | Electron ^44.4.5 als reiner Client des zentralen Servers, ohne lokale Geschäftsdaten | `desktop/src/main.cjs:116,129` |
| iOS-Hülle | Capacitor | `app/capacitor.config.json` |
| Sprache | TypeScript ^7.0.2 | |

### 2.2 Architektur

- Ein Prozess (Fastify) liefert die API (`/api/*`), die Dateien (`/files/:id`) und das gebaute Frontend (`web/dist`) mit SPA-Fallback aus (`S/app.ts:279-291`).
- **Module unter `S/modules/`:** analysis, appointments, assistant, auth, billing, company, competitors, crm, dashboard, files, finance, imports, integrations, inventory, marketing, orders, platform, print, privacy, protocols, reports, saas, search, setup, system, tasks, users.
- **Registrierung:** explizit in `S/app.ts:234-275`.
- **Querschnitt in `S/core/`:** Audit, Verschlüsselung (AES-256-GCM), Mandant, Sitzung, Rechte, Entitlements, Abos, TOTP, netguard.
- **Plugins:** `S/plugins/auth.ts`, `S/plugins/entitlements.ts`.
- **Integrationen in `S/integrations/`:** KI, E-Rechnungs-Parser, Marketing, Zahlungen, Mail, PDF, Speicher, Sicherung.

### 2.3 Datenmodell

`S/db/schema.ts` enthält 62 Tabellen. Mandantenspalte ist `company_id`.

- **Mit `company_id` und Fremdschlüssel auf `companies`:**
  - users, sessions, role_permissions, support_sessions
  - services, customers, leads, vehicles, activities, number_sequences, integrations
  - appointments, orders, files, protocols, offers, invoices
  - inventory_items, expenses, recurring_expenses
  - marketing_daily, web_analytics_daily, social_daily, seo_daily
  - reports, competitors, assistant_messages, tasks
  - tenant_subscriptions, tenant_addons, tenant_feature_overrides
  - privacy_requests, data_exports, legal_acceptances, document_imports, api_keys, webhook_endpoints
- **Mit `company_id`, aber ohne Fremdschlüssel:**
  - audit_log, email_log, order_items, protocol_damages, offer_items, invoice_items, payments
  - inventory_movements, competitor_snapshots, subscription_events, deletion_log, ai_usage_log, webhook_deliveries
  - nullable: jobs, payment_webhook_events, incidents
- **Ohne Mandantenspalte (global):** companies, user_tokens (über user_id), system_settings, plans, plan_features, addons, discount_codes, subprocessors, legal_documents.
- **Beziehungen:**
  - vehicles → customers
  - Positionen → Kopf (order_items, offer_items, invoice_items, protocol_damages)
  - payments → invoices, inventory_movements → inventory_items
- **Ohne Fremdschlüssel in der Datenbank:** fachliche Verweise wie `orders.customer_id` und `files.customer_id`. Sie werden in der Anwendung geprüft (`assertRefs`, `S/core/tenant.ts:28-39`).
- **Ungenutzte Tabellen:** `api_keys`, `webhook_endpoints` und `webhook_deliveries` sind angelegt, werden aber nirgends benutzt. Routen unter `/api/v1` gibt es nicht.
- **Migrationen:**
  - 15 SQL-Dateien (`server/drizzle/0000_init.sql` … `0014_document_imports.sql`), automatisch beim Start angewendet (`S/db/index.ts:43`).
  - Vorher läuft automatisch eine Sicherung „pre-update“ (`S/index.ts:25,72-82`).
  - **Rückwärts-Migrationen gibt es nicht.** Der Auftrag verlangt umkehrbare Migrationen (siehe PLAN.md).

### 2.4 Mandantentrennung

- **Mandant je Anfrage:**
  - Das signierte Cookie `cm_sid` wird über `resolveSession` aufgelöst und setzt `req.auth.companyId` (`S/plugins/auth.ts:27-36`).
  - Bei Supportzugriff wechselt der Mandant (`S/core/session.ts:15-31`).
- **Durchsetzung:**
  - Jede Route filtert **von Hand** mit `eq(table.companyId, ctx.companyId)`. Es gibt keine zentrale Abfrageschicht.
  - Dateien liegen je Mandant in `files/<companyId>/…` und werden über `(id, companyId)` geladen (`S/integrations/storage.ts:82,110,164`).
- **Abweichung von der eigenen Doku:** Einige `UPDATE`- und `DELETE`-Befehle filtern nur nach ID. Davor steht jeweils eine mandantengeprüfte Existenzprüfung, deshalb ist das derzeit **kein Leck**, aber eine Fehlerquelle. Beispiele:
  - `S/modules/crm/services.routes.ts:53`
  - `S/modules/users/routes.ts:91`
  - `S/modules/crm/leads.routes.ts:111,122`
  - `S/modules/tasks/routes.ts:109,118`
  - `S/modules/orders/routes.ts:115,138`

  `docs/privacy/tenant-isolation.md:8` behauptet dagegen „jede Abfrage gefiltert“.
- **Tests:** `server/test/tenant-isolation.test.ts`, 7 Tests.
  - Mandant A wird in allen Modulen mit dem Marker `ZZMARKERA` befüllt.
  - Mandant B ruft jede Route mit Pfadparameter mit den IDs von A auf, ebenso alle GET-Listen und die Schreibrouten mit fremden Verweisen. Mandantenexport-ZIP, PDFs, `/files/:id` und die KI-Werkzeuge sind abgedeckt.
  - **Lücken:**
    - Die Tests laufen nur im Modus `selfhosted`, nicht im Modus `saas`.
    - 4 Routen stehen auf einer Ausnahmeliste.
    - Hintergrundjobs werden nicht auf Mandantentrennung geprüft.
    - Es gibt keine Tests je Rolle für alle Routen.

### 2.5 Hintergrundjobs

Alle in `S/index.ts:29-47`, mit Croner, Zeitzone Europe/Berlin und Protokoll in der Tabelle `jobs`.

| Job | Zeitplan | Zweck |
|---|---|---|
| reminders | alle 10 min | Terminerinnerungen per E-Mail |
| invoices.overdue | täglich 00:05 | Rechnungen als überfällig markieren |
| expenses.recurring | täglich 00:10 | wiederkehrende Ausgaben buchen |
| marketing.sync | alle 6 h | Werbe- und Analysedaten abrufen |
| reports.weekly / monthly / yearly | Mo 06:00 / 1. 06:30 / 2.1. 07:00 | Berichte per E-Mail |
| competitors.scan | Mo 05:00 | Google-Places-Abruf |
| backup.daily | täglich 02:30 | Sicherung |
| privacy.retention | täglich 03:45 | Lösch- und Aufbewahrungslauf |
| subscriptions.lifecycle / tenants.lifecycle | täglich 01:20 / 01:40 | SaaS-Abo- und Mandantenstatus |
| support.expire | alle 15 min | Supportzugriffe beenden |
| sessions.cleanup | täglich 03:15 | abgelaufene Sitzungen löschen |

### 2.6 Externe Dienste und APIs

| Dienst | Richtung und Daten | Fundstelle |
|---|---|---|
| SMTP (je Mandant, zusätzlich System-SMTP) | ausgehend: Empfänger, Text, PDF-Anhänge | `S/integrations/mail.ts:41-80` |
| Anthropic: KI-Assistent | ausgehend: Fragen, Verlauf, Kennzahlen; Kundendaten pseudonymisiert, außer Freigabe | `S/integrations/ai/assistant.ts:16,84-115` |
| Anthropic: Belegerkennung | ausgehend: vollständiges PDF bzw. Bild (Standard: aus) | `S/integrations/ai/documents.ts:88-115` |
| Google Ads, GA4, Search Console | eingehend: Kennzahlen | `S/integrations/marketing/google.ts` |
| Meta Graph API | eingehend: Kennzahlen (Token in der URL) | `S/integrations/marketing/meta.ts:14-24` |
| Windsor.ai | eingehend: Kennzahlen **und Meta-Leads mit Name, E-Mail, Telefon**; API-Schlüssel in der URL | `S/integrations/marketing/windsor.ts:23-28,82-96` |
| Google Places | ausgehend: Suchbegriff und Ort; eingehend: Wettbewerberdaten | `S/modules/competitors/places.ts:11` |
| Zahlungen | nur `manual` und ein HMAC-signierter Webhook für SaaS-Abos; Stripe und Mollie nicht angebunden | `S/integrations/payments/provider.ts` |
| Lexware Office, sevDesk | **nicht vorhanden** (nur Datei-Import von Lexware-Rechnungen) | — |
| SMS | nicht vorhanden | — |
| WordPress | eingehend: Leads über `integrations/wordpress/carcura-manager-lead-bridge.php` mit `X-Lead-Token` | `S/modules/crm/public.routes.ts:40-103` |

### 2.7 Tests, CI, Werkzeuge

- **Server:** Vitest, 19 Testdateien, **177 Tests, alle grün** (Lauf vom 12.10.2026, 42 s). Typprüfung von Server und Web ohne Fehler.
- **Ende-zu-Ende:** 13 Playwright-Skripte in `e2e/` (390 × 844 px und Desktop). Sie werden **von Hand** gestartet, haben keine automatischen Prüfungen und laufen nicht in der CI. `docs/testing/` ist leer.
- **Desktop:** `node --test` (`desktop/test/lib.test.cjs`).
- **CI** (`/.github/workflows/`): nur `desktop-windows.yml`, `ios-app.yml`, `ios-ipa-unsigned.yml`. **Server-Tests, Typprüfung, Linter, `npm audit`, SAST und Secret-Scan laufen nicht in der CI.**
- **Linter- und Formatierer-Konfiguration:** nicht vorhanden. **Dependabot bzw. Renovate:** nicht vorhanden.
- **Testabdeckung:** wird nicht gemessen.

### 2.8 Build und Deployment (laut Repository)

- **Container:**
  - `deploy/Dockerfile`: mehrstufig, läuft als Nutzer `node`, Healthcheck `/api/health`.
  - `deploy/docker-compose.yml`: App plus `caddy:2` mit automatischem HTTPS über Let's Encrypt. Logs sind auf 10 MB × 5 begrenzt.
- **Caddyfile:**
  - Antwort-Header `Server` entfernt.
  - Zugriffsprotokoll ohne Query-Strings, Cookies und Tokens.
  - **Kein ausdrücklicher `tls`-Block**: Es gelten die Caddy-Standards (TLS 1.2/1.3). Eine Festlegung nach TR-02102-2 fehlt.
- **Update:** Aktualisierung aus der Oberfläche heraus, mit Sicherung vorher (`S/modules/system/routes.ts`).

---

## 3. Betrieb

| Punkt | Befund | Quelle |
|---|---|---|
| Hosting heute | **Im Repository nicht festgelegt.** Laut Auftrag liegt `manager.carcura.info` per DNS auf demselben Plesk-Server wie `carcura.info` und liefert nur das abgelaufene Plesk-Standardzertifikat von 2019. **Selbst prüfen konnte ich das nicht**: DNS- und HTTPS-Abfragen auf carcura.info sind aus dieser Umgebung gesperrt. | Auftrag |
| Vorgesehenes Hosting | Docker auf einem eigenen Server in der EU, beispielhaft Hetzner (CX23 bzw. CPX22). Für Sicherungen außerhalb des Servers sind Hetzner-Snapshots bzw. eine Storage Box als **manueller Schritt** beschrieben. | `docs/deployment/zentraler-server-und-desktop-app.md:66-71`, `docs/05-betrieb.md` |
| Rechenzentrum | nicht festgelegt, kein AV-Vertrag dokumentiert | — |
| Datensicherung | täglich als ZIP (Datenbankkopie per `VACUUM INTO` plus Dateien plus Manifest) nach `data/backups`, **auf demselben Datenträger**; behalten werden 14 automatische und 20 manuelle. **Nicht verschlüsselt**: `BACKUP_PASSPHRASE` wird eingelesen, aber nie verwendet. Die Wiederherstellung ist getestet (`server/test/phase17.test.ts`), ein **regelmäßiger automatischer Wiederherstellungstest fehlt**. | `S/integrations/backup.ts:37-124`, `S/config.ts:106` |
| Verschlüsselung gespeicherter Daten | nur Integrationsgeheimnisse und TOTP-Schlüssel (AES-256-GCM); keine Datenträgerverschlüsselung dokumentiert | `S/core/crypto.ts` |
| Monitoring | `/api/health/live`, `/api/health/ready` (Datenbank, freier Speicher), Systemstatus in den Einstellungen. **Keine Alarmierung** bei Ausfall, Fehlerrate, Job-Laufzeit, Sicherungsfehler oder Zertifikatsablauf. | `S/app.ts:221-232` |
| Protokollierung | Pino mit Schwärzung von Cookie, Authorization, Token, Passwort und API-Key; Caddy ohne Query-Strings. Aufbewahrung über Docker-Logrotation (10 MB × 5), Dauer nicht festgelegt. | `S/app.ts:105-115` |
| WordPress (carcura.info) | 17 aktive Plugins, davon **5 eigene Carcura-Plugins mit Kundendaten**: CRM Suite 4.2.0, Suite v2 2.0.0 (u. a. WhatsApp-Anfragen, Bewertungsanfragen, Abo-Verwaltung), Revenue Recovery 4.8.0, Newsletter 1.4.0, Firmenkunden-Portal 1.5.0. Dazu das neue Kündigungs-Plugin. Damit liegen Kundendaten **doppelt** in WordPress und im Manager. | WordPress-Schnittstelle, Abruf vom 12.10.2026 |

---

## 4. Funktionsabgleich

Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt

### 4.1 Sicherheit (Abschnitt 4 des Auftrags)

| Anforderung | Status | Fundstelle und Lücke |
|---|---|---|
| TLS gültig, automatische Erneuerung | 🟡 | Caddy erneuert automatisch. Ob produktiv eingerichtet: offen (siehe Abschnitt 3). |
| Nur TLS 1.2/1.3, Cipher nach TR-02102-2, SSL Labs mindestens A | 🟡 | Caddy-Standard; nicht ausdrücklich festgelegt und nicht gemessen |
| HSTS, Umleitung von HTTP auf HTTPS | ✅ | `S/app.ts:182` (nur wenn `PUBLIC_URL` mit https beginnt), Caddy leitet automatisch um |
| CSP ohne `unsafe-inline` | ❌ | `style-src 'self' 'unsafe-inline'` (`S/app.ts:172`); 293 `style={{…}}` im Web |
| `frame-ancestors 'none'` | ❌ | `'self'` bzw. `X-Frame-Options: SAMEORIGIN` |
| nosniff, Referrer-Policy, Permissions-Policy | ✅ | `S/app.ts:175-178`. Referrer-Policy ist `same-origin`, also strenger als gefordert. |
| Keine Server- oder Versionsangaben | 🟡 | Header bereinigt, aber das öffentliche `/api/health` liefert die Version mit `ACAO: *` (`S/app.ts:232`) |
| Argon2id oder bcrypt ≥ 12 | ❌ | scrypt mit N = 2^16, unter der OWASP-Empfehlung von 2^17 (`S/core/password.ts:3`) |
| Mindestlänge 12, keine Zeichenklassen-Pflicht | ❌ | Mindestlänge 10 mit Pflicht zu Groß-, Kleinbuchstaben und Ziffer (`S/core/password.ts:36-42`) |
| Liste kompromittierter Passwörter (lokal) | ❌ | nicht vorhanden |
| Sperre nach 5 Fehlversuchen | ✅ | `S/modules/auth/routes.ts:14-15,53-64` (15 min) |
| Rate-Limit je IP und je Konto | 🟡 | je IP vorhanden; je Konto nur über die Sperre |
| 2FA (TOTP) Pflicht für Betreiber und Admins | 🟡 | Betreiber: serverseitig, aber nur im Modus `saas` (`S/plugins/auth.ts:61`). Mandanten-Admins: **nur in der Oberfläche** (`S/modules/auth/routes.ts:91`). |
| Wiederherstellungscodes | ✅ | 10 Codes, einmalig nutzbar |
| WebAuthn/Passkeys (optional) | ❌ | — |
| Passwort zurücksetzen mit Einmal-Token | ✅ | 256 Bit, als SHA-256 gespeichert, 30 min gültig, einmalig, beendet alle Sitzungen (`S/modules/auth/reset.routes.ts`) |
| Cookies Secure, HttpOnly, SameSite | ✅ | `S/app.ts:144-151`; `Secure` nur bei https, kein Präfix `__Host-` |
| Neue Sitzungs-ID nach Anmeldung | ✅ | `S/core/session.ts:58` |
| Abmeldung nach 8 h Inaktivität | ✅ | `SESSION_IDLE_MINUTES=480` |
| „Überall abmelden“ | ❌ | nur intern bei Passwortwechsel, Deaktivierung und Reset |
| Mandantentrennung mit IDOR-Tests je Ressource | 🟡 | breiter Test vorhanden; Lücken siehe 2.4 |
| Rollen serverseitig, Tests je Rolle | 🟡 | `requireAuth(…perms)`; **Rechte-Ausweitung möglich** (5.2 H2), keine Tests je Rolle für alle Routen |
| Validierung, parametrisierte Abfragen, Escaping, CSRF | ✅ | Zod überall, keine `sql.raw`-Aufrufe, `esc()` in PDF-Vorlagen, Prüfung von Origin und Sec-Fetch-Site (`S/app.ts:207-218`) |
| Upload: Typ nach Inhalt, Größenlimit | ✅ | Magic Bytes, aktive PDF-Inhalte werden abgewiesen, 25 MB (`S/integrations/storage.ts:12-52`); Ausnahme Logo (5.2 M8) |
| Bilder neu kodieren, EXIF und GPS entfernen | ✅ | `sharp().rotate()` ohne Metadaten (`storage.ts:121-133`) |
| Ablage außerhalb des Web-Roots, Auslieferung nur nach Anmeldung | ✅ | `DATA_DIR/files/<companyId>/…`, `/files/:id` mit Recht und Mandantenprüfung |
| Virenscan (optional) | ❌ | — |
| Keine Schlüssel im Repository oder in der Historie | ✅ | Scan siehe 5.4 |
| API-Schlüssel der Mandanten verschlüsselt, Schlüssel außerhalb der DB, Rotation | 🟡 | AES-256-GCM, Schlüssel aus `APP_SECRET` bzw. einer Schlüsseldatei. **Kein Rotationsweg, keine Schlüsselversion**, ein Geheimnis für drei Zwecke. |
| Datenträger verschlüsselt, Sicherungen mit AES-256 | ❌ | Sicherungen unverschlüsselt |
| Tägliche Sicherung an einem zweiten Ort in der EU | ❌ | nur auf dem gleichen Datenträger |
| Monatlicher automatischer Wiederherstellungstest, RPO/RTO | ❌ | — |
| Sicherheitsereignisse protokollieren | 🟡 | Anmeldung, Fehlversuche, 2FA, Rechte, Export, Löschung, Support werden protokolliert. **Es fehlen:** Abmeldung, Fehlversuche bei unbekanntem Konto, 403-Ereignisse. |
| Audit-Log nur anfügbar und manipulationsgeschützt | 🟡 | Hash-Kette je Mandant, aber **ohne Schlüssel** (SHA-256) und ohne Schutz in der Datenbank. Anonymisierung ändert Einträge (`S/modules/privacy/anonymize.ts:66`). |
| CI mit Tests, Linter, Abhängigkeitsprüfung, SAST, Secret-Scan, Update-Vorschlägen | ❌ | siehe 2.7 |
| Öffentliche Endpunkte: Rate-Limit und Bot-Schutz ohne US-Dienst | 🟡 | Rate-Limit und Honeypot vorhanden, **keine Zeitprüfung**, kein reCAPTCHA (gut). Token auch als `?token=` in der URL erlaubt. |
| Keine Drittland-Ressourcen (Schriften, CDNs) | ✅ | keine gefunden |
| `docs/INCIDENT.md` | 🟡 | Vorfall-Register in der App (`incidents`), aber kein Vorfall-Konzept als Dokument |
| OWASP-ZAP-Scan | ❌ | nicht durchgeführt |

### 4.2 Datenschutz und Rechtspflichten (Abschnitt 5)

| Anforderung | Status | Fundstelle und Lücke |
|---|---|---|
| Hosting in der EU mit AV-Vertrag, Standort dokumentiert | ❌ | nicht festgelegt |
| Unterauftragsverarbeiter: Doku und Anzeige in der App | 🟡 | Tabelle `subprocessors`, vorbefüllt (`S/modules/platform/tenant-lifecycle.ts:104-118`). Alle Einträge haben den AV-Status `to_review`. Der Zweck „Belegerkennung“ fehlt bei Anthropic. Keine Oberfläche, kein `SUBPROCESSORS.md`. |
| Entwürfe in `docs/legal/` (AV-Vertrag, TOM, VVT, Muster-Datenschutzhinweise, DSFA-Bewertung) | ❌ | Ordner leer. Rechtstexte sind nur betreiberweit in der Datenbank (`legal_documents`). |
| Auskunft und Export (Art. 15/20) | ✅ | Dossier als JSON, ZIP mit Dateien (`S/modules/privacy/center.routes.ts:107`, `export.ts:110`); **für Leads ohne Kunde fehlt der Export** |
| Berichtigung | ✅ | `PATCH /api/customers/:id` |
| Löschung mit Sperrvermerk bei Aufbewahrungspflicht | ✅ | `eraseCustomer`, `retentionUntil`, `purgeExpiredRetention` (`S/modules/privacy/lifecycle.ts`) |
| Widerspruch | 🟡 | nur als Eintrag im Register, ohne technische Wirkung |
| Oberfläche für Betroffenenrechte | 🟡 | Kundenansicht: nur JSON-Export und Löschen. Einschränkung, Anfragenregister, Löschprotokoll und ZIP-Export gibt es **nur über die API**. |
| Löschkonzept mit täglichem Job und Protokoll, Fristen je Mandant | 🟡 | Job und `deletion_log` vorhanden; Fristen über `settings_json`. Die Oberfläche zeigt nicht alle Fristen. `jobLogRetentionDays` ist wirkungslos. Beim Löschen von Leads bleiben **Aktivitäten mit Nachrichtentext** erhalten. Der manuelle Löschlauf eines Mandanten-Admins läuft **für alle Mandanten** (`S/modules/privacy/routes.ts:87-91`). Ein `LOESCHKONZEPT.md` fehlt. |
| Datensparsamkeit | ✅ | Pflichtfelder minimal, kein Geburtsdatum. VIN, Baujahr, Kilometerstand und Farbe sind nicht mehr erfassbar; Altwerte bleiben in der Datenbank. |
| Kennzeichen verpixeln, Einwilligung zur Veröffentlichung | ❌ | — |
| gclid/fbclid nur mit Einwilligungssignal | ❌ | werden immer gespeichert (`S/modules/crm/public.routes.ts:25-27,80-93`) |
| Barzahlung entfernen | ❌ | siehe Abschnitt 7 |
| WhatsApp nur als wa.me-Link | ✅ | `S/modules/appointments/routes.ts:104`. Der Link entsteht aber auch bei eingeschränkten Kunden. |
| KI ins Labor, Standard aus | 🟡 | Standard aus (Pseudonymisierung bzw. Belegerkennung) bzw. im Tarif abschaltbar. Kein Modul „Labor“. `docs/06…md:40` behauptet „kein Dokumentinhalt“, die Belegerkennung sendet aber das ganze Dokument. |
| USt-Schätzung und Liquidität ins Labor | ❌ | `S/modules/finance/routes.ts:169-231`, für alle sichtbar |
| Wettbewerber-Monitoring (Places) | ❌ | speichert täglich **Bewertung, Anzahl, Status und Preisniveau** als Verlauf (`competitor_snapshots`). Laut Google-Bedingungen nicht zulässig, siehe 8. |
| Keine fest verdrahteten Carcura-Daten | 🟡 | Mail und PDF kommen aus den Mandantendaten. **Reste:** PWA-Name „Carcura Manager“ (`web/public/manifest.webmanifest:2`), Absender-Standard „Carcura Management“ (`S/config.ts:99`), Carcura-Formularfeld bei Meta-Leads (`S/integrations/marketing/windsor.ts:83`), Hilfetexte mit carcura.info (`W/pages/Settings.tsx:257,272,311`), Desktop- und iOS-Konfiguration, Exportkennung und Header `x-carcura-signature`. |
| Keine Demo- und Testdaten in Produktion | ✅ | `e2e/demo-seed.mjs` ist nirgends eingebunden; Standardleistungen haben Preis 0 |
| Lexware-Office-Übergabe, sevDesk | ❌ | — |
| Sammelrechnung | ❌ | aus einem Auftrag entsteht genau eine Rechnung |
| Kleinunternehmer-Modus mit § 19-Hinweis | ✅ | `companies.smallBusiness`, `S/integrations/pdf-templates.ts:168,188` |
| Warnung bei 25.000 / 100.000 € | ❌ | — |
| Eigene Rechnungsstellung als abschaltbares Modul | 🟡 | vorhanden mit Nummernkreis, Festschreibung und Storno, aber nicht abschaltbar. **Keine XRechnung/ZUGFeRD-Erzeugung**, kein KoSIT, kein DATEV- bzw. Z3-Export. |
| Einwilligungsverwaltung je Kanal, Double-Opt-in, Sperrliste | ❌ | — |
| Bewertungsanfragen und Pflege-Erinnerungen mit Einwilligungsprüfung | ❌ | im Manager nicht vorhanden (im WordPress-Plugin Suite v2 schon, siehe Abschnitt 3) |
| E-Mail über EU-Anbieter, SPF/DKIM/DMARC | 🟡 | SMTP je Mandant, keine Anleitung bzw. Prüfung |
| Vollständiger Export (Data Act) mit dokumentiertem Format | 🟡 | ZIP mit JSON, CSV und Dateien plus SHA-256 (`S/modules/privacy/export.ts:73-107`); Formatbeschreibung nur als `LIESMICH.txt` im ZIP. Die Oberfläche fehlt. |

### 4.3 Kernfunktionen (Abschnitt 6)

| Anforderung | Status | Fundstelle und Lücke |
|---|---|---|
| **6.1** Annahmeprotokoll mit Skizze, Fotos, Unterschrift, eingefrorenem PDF | ✅ | `S/modules/protocols/routes.ts`, Status `final` sperrt |
| Rückgabeprotokoll | 🟡 | Typ `handover` vorhanden, aber **ohne Bezug** zum Annahmeprotokoll |
| Vorher-Nachher je Schadenposition | ❌ | — |
| Zustandsstufe 1–4, Lackschichtdicke | ❌ | nur die Schwere eines Schadens (3 Stufen); `PAINT_MEASUREMENT` ist nur ein Schlüssel |
| SHA-256 über PDF und Fotos, auf dem PDF angezeigt | 🟡 | SHA-256 je Datei in der Datenbank (`files.sha256`), nicht auf dem PDF, kein Gesamt-Hash |
| Kopie per E-Mail nach der Unterschrift | ❌ | — |
| Haftungsklausel als Textbaustein | ❌ | fest im Code (`S/integrations/pdf-templates.ts:141`) |
| Signatur-Metadaten (Name, Zeit, Gerät, Prüfpfad) | 🟡 | Name und Zeit; kein Gerät bzw. User-Agent |
| **6.2** Öffentliche Terminanfrage mit freien Slots, Widget, WCAG | ❌ | nur Website-Lead-Formular über WordPress |
| Verbindliche Buchung mit Anzahlung | ❌ | (bewusst später) |
| **6.3** Statusmeldungen zum Auftrag (angenommen, in Arbeit, fertig) | ❌ | nur Terminbestätigung, Erinnerung, Angebots- und Rechnungsmail (`S/integrations/templates.ts`) |
| Vorlagen je Mandant | ❌ | Texte fest im Code |
| Erinnerung 24–48 h vorher | 🟡 | in Tagen (`reminderDaysBefore`, Standard 2), nur E-Mail |
| **6.4** Leistungskatalog mit Paketen | 🟡 | Leistungen mit Preis, Dauer und Material (`schema.ts:178-196`), keine Pakete |
| Preise je Fahrzeugklasse, Zustandszuschlag | ❌ | `vehicles.vehicleType` nur als Freitext |
| Branchenvorlage ohne Marktpreise | 🟡 | Startkatalog mit Preis 0 (`S/modules/company/defaultServices.ts`), fest |
| Nachkalkulation Soll/Ist, Stundenertrag | 🟡 | Preis- und Margenanalyse (`S/modules/analysis/pricing.ts`); keine Ist-Zeit |
| **6.5** Checklisten je Leistung | ❌ | — |
| Auftragszeit Start/Stopp je Mitarbeiter | ❌ | nur `startedAt`/`finishedAt` je Auftrag |
| Boxen bzw. Stellplätze als Ressource, Konfliktprüfung | ❌ / 🟡 | Konflikte nur je Mitarbeiter und nur als Warnung |
| **6.6** Pflegeabo-Verwaltung | ❌ | nur der Schlüssel `SERVICE_PLANS` |
| Wiedervorlage nach Pflegeintervall | ❌ | Aufgaben nur manuell |
| Übernahme aus „Revenue Recovery“ | ❌ | Plugin nicht im Repository; die Brücke leitet nur Leads weiter |
| **6.7** B2B: Preislisten, Sammelaufträge, Standorte, Zahlungsziel je Kunde, Mahnstufen | ❌ | nur Kundentyp „geschäftlich“ und ein Zahlungsziel je Mandant |

### 4.4 Verkaufsfähigkeit (Abschnitt 7)

| Anforderung | Status | Fundstelle und Lücke |
|---|---|---|
| Onboarding-Assistent | ❌ | nur Ersteinrichtung (Firma plus Admin), `W/pages/Setup.tsx` |
| CSV-Import mit Vorschau und Duplikatprüfung | 🟡 | Kunden und Leads mit Probelauf (`S/modules/crm/importexport.routes.ts:139-186`); **Fahrzeuge** nur als Spalte, ohne Kennzeichen-Duplikatprüfung |
| Demo-Mandant | ❌ | nur ein Entwickler-Skript |
| Hilfe je Bildschirm, Support-Kontakt, „Was ist neu“ | ❌ | nur Feld-Hinweise |
| Systemstatus | ✅ | `S/modules/system/routes.ts:29-41` |
| White-Label | 🟡 | Logo, Farben, Produktname, Fußzeile, Absender je Mandant. **Keine Rechtstexte bzw. Mail-Vorlagen je Mandant**, Reste siehe 4.2. |
| Betreiber: Mandanten anlegen, Module schalten, sperren, Kennzahlen | 🟡 | Server kann das. Die **Oberfläche** kann nur anlegen und an/aus schalten. Die **Sperre wirkt nicht** (5.2 H1). |
| Mandanten-Export und -Löschung durch den Betreiber | 🟡 | Löschung vorhanden; Export nur durch den Mandanten selbst |
| Supportzugriff nur mit befristeter, protokollierter Freigabe | ✅ | `S/modules/platform/support.routes.ts`. Break-Glass ohne Vier-Augen-Prinzip, Benachrichtigung nur bei SMTP des Mandanten. |
| Monitoring mit Alarm | ❌ | — |
| Leistung: unter 2 s über 4G, Vorschaubilder | ❌ | nicht gemessen; keine Vorschaubilder in reduzierter Größe gefunden |
| Barrierefreiheit WCAG 2.1 AA | ❌ | nicht geprüft |
| Smartphone ab 360 px | 🟡 | Umbrüche bei 1100 und 860 px, Seitenleiste als Off-Canvas; Tests nur bei 390 px und von Hand |
| Modul- und Feature-Flag-System | 🟡 | `S/core/entitlements.ts` (33 Schlüssel, Tarife, Zusatzpakete, Overrides). Sperre **nur im SaaS-Modus**; die Oberfläche liest die Freischaltungen nicht. `requireFeature()` ist ungenutzt. |

---

## 5. Sicherheitsbefund

Schweregrade: **kritisch** heißt sofortiger Datenabfluss bzw. Übernahme ohne Anmeldung möglich; **hoch** heißt erhebliches
Risiko bei Betrieb mit fremden Mandanten; **mittel** und **niedrig** bewerten nach OWASP ASVS L2 bzw. BSI APP.3.1.

**Kritische Befunde: keine.**

### 5.1 Abhängigkeiten (`npm audit` vom 12.10.2026)

| Paket | Schwere | Einsatz | Befund |
|---|---|---|---|
| `extract-zip` (alle Versionen) | hoch | Produktiv: Wiederherstellung von Sicherungen (`S/integrations/backup.ts:81,109`) | Symlink- und Pfad-Traversal (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3); **keine korrigierte Version**, das Paket muss ersetzt werden. Ausnutzbar nur durch ein hochgeladenes Sicherungs-ZIP eines Admins. |
| `sharp` < 0.35.5 | hoch | Produktiv: Bildverarbeitung | librsvg CVE-2026-96889 (GHSA-wq5f-xc86-pv6w); Korrektur verfügbar |
| `source-map-js` 1.0.0–1.2.1 | hoch | Entwicklung | Korrektur verfügbar |
| `esbuild` ≤ 0.24.2 (über drizzle-kit) | mittel | Entwicklung | nur Entwicklungsserver |
| Desktop: `http-cache-semantics` ≤ 4.2.0 | hoch | Build bzw. Updater | Korrektur prüfen |
| Desktop: `sprintf-js` u. a. | mittel (8) | Build | Korrektur prüfen |

### 5.2 Befunde im Code

| Nr. | Schwere | Befund | Fundstelle |
|---|---|---|---|
| H1 | **hoch** | Ein **gesperrter Mandant arbeitet weiter.** `isActive=false` wird bei Anmeldung und Sitzung nicht geprüft; bestehende Sitzungen bleiben gültig. | `S/modules/platform/routes.ts:70-80`, `S/core/session.ts:94-95`, `S/modules/auth/routes.ts:44` |
| H2 | **hoch** | **Rechte-Ausweitung**: Wer `users:manage` hat (ohne Admin zu sein), kann die Rechte jeder Nicht-Admin-Rolle ändern, auch die eigene, und sich so `backups:manage` und `integrations:manage` geben. | `S/modules/company/routes.ts:92-103` |
| H3 | **hoch** | Die **2FA-Pflicht für Mandanten-Admins** wirkt nur in der Oberfläche; die API ist ohne 2FA nutzbar. Für Betreiber gilt sie nur im Modus `saas`. | `S/modules/auth/routes.ts:91`, `S/plugins/auth.ts:61` |
| H4 | hoch (SaaS) / niedrig (eigener Betrieb) | **SSRF**: Der SMTP-Host des Mandanten ist frei wählbar, `S/core/netguard.ts` ist nirgends eingebunden. Damit lassen sich interne Ports abtasten. | `S/modules/integrations/routes.ts:12-13`, `S/integrations/mail.ts:63` |
| M1 | mittel | Sicherungen **unverschlüsselt** und auf **demselben Datenträger**; sie enthalten Sitzungs-IDs im Klartext. | `S/integrations/backup.ts`, `S/config.ts:106` |
| M2 | mittel | Sitzungs-IDs im Klartext in der Datenbank | `S/core/session.ts:61-72` |
| M3 | mittel | Die Kontosperre verrät, ob ein Konto existiert (HTTP 423, Prüfung vor dem Hash), und Dritte können jedes Konto 15 min sperren. | `S/modules/auth/routes.ts:49-51` |
| M4 | mittel | Am Zeitverhalten von „Passwort vergessen“ lässt sich ablesen, ob ein Konto existiert (wartet auf den SMTP-Versand). | `S/modules/auth/reset.routes.ts:28,41` |
| M5 | mittel | TOTP-Codes sind ca. 90 s wiederverwendbar; das Ein- bzw. Ausschalten von 2FA beendet andere Sitzungen nicht. | `S/core/totp.ts:246-251`, `S/modules/auth/twofa.routes.ts:193-218` |
| M6 | mittel | Kein „Überall abmelden“, keine Sitzungsliste; absolute Sitzungsdauer 30 Tage | `S/config.ts` |
| M7 | mittel | Ein Geheimnis (`APP_SECRET`) für Cookie-Signatur, Verschlüsselung und 2FA-Challenge; Schlüssel per SHA-256 statt KDF; **keine Rotation** | `S/core/crypto.ts:8-29` |
| M8 | mittel | Audit-Kette ohne Schlüssel (nachrechenbar), nicht nur anfügbar (Anonymisierung ändert, die Löschfrist entfernt Einträge) | `S/core/audit.ts:28-51` |
| M9 | mittel | Wiederherstellung aus einem hochgeladenen ZIP ohne Integritätsprüfung und Größenlimit beim Entpacken (siehe auch `extract-zip`) | `S/integrations/backup.ts:78-86` |
| M10 | mittel | Break-Glass ohne zweite Person; Mandant wird nur benachrichtigt, wenn er eigenes SMTP hat | `S/modules/platform/support.routes.ts:45-46,126` |
| M11 | mittel | Website-Lead-Token im Klartext gespeichert und als `?token=` in der URL zulässig; keine Zeitprüfung gegen Bots | `S/modules/crm/public.routes.ts:40-43` |
| M12 | mittel | Kein Virenscan; keine Liste kompromittierter Passwörter | — |
| M13 | mittel | Server-Tests, `npm audit`, SAST und Secret-Scan nicht in der CI | `/.github/workflows/` |
| N1 | niedrig | scrypt N = 2^16; Zeichenklassen-Pflicht; keine Höchstlänge bei Anmeldung und Passwortwechsel (bis 25 MB Body) | `S/core/password.ts` |
| N2 | niedrig | CSP `style-src 'unsafe-inline'`, `frame-ancestors 'self'` | `S/app.ts:172` |
| N3 | niedrig | Logo-Upload prüft nur den vom Client gemeldeten Typ | `S/modules/files/routes.ts:110` |
| N4 | niedrig | `/api/health` öffentlich mit Version | `S/app.ts:232` |
| N5 | niedrig | PDF-Chromium mit `--no-sandbox`, JavaScript an, Netzwerk nicht gesperrt (Inhalte sind escaped) | `S/integrations/pdf.ts:19,38-41` |
| N6 | niedrig | Abmeldung, 403 und Fehlversuche bei unbekannten Konten werden nicht protokolliert | `S/core/audit.ts` |
| N7 | niedrig | `UPDATE`/`DELETE` nur nach ID (siehe 2.4); LIKE-Platzhalter nicht maskiert | mehrere |
| N8 | niedrig | Der manuelle Löschlauf eines Mandanten-Admins läuft über alle Mandanten (nur Fristen, keine fremden Daten sichtbar) | `S/modules/privacy/routes.ts:87-91` |
| N9 | niedrig | iOS-Hülle: gespeicherte Server-URL per `innerHTML` (Self-XSS) | `app/www/index.html:58` |
| N10 | niedrig | Kein ausdrücklicher TLS-Block in Caddy (Standard ist gut, aber nicht festgelegt) | `deploy/Caddyfile` |

### 5.3 Bereits gut umgesetzt

- Parametrisierte Abfragen, Zod-Validierung, CSRF-Prüfung über Origin.
- Upload-Prüfung nach Inhalt, EXIF-Entfernung, Ablage außerhalb des Web-Roots.
- Passwort-Reset nach Stand der Technik.
- Supportzugriff nur befristet und protokolliert.
- Schwärzung in den Logs.
- Keine Drittland-Ressourcen.
- Sicherung vor jeder Migration.
- Wiederherstellung samt erneutem Anwenden von Löschungen (`S/modules/privacy/reapply.ts`).

### 5.4 Geheimnisse

- **Arbeitsstand** (`detect-secrets` 1.5.0): 51 Treffer, **alle** in Tests, E2E-Skripten oder Konstanten (Base32-Alphabet, Setup-Code-Alphabet, Demo-Schlüssel `demo-key-nicht-gueltig`).
- **Git-Historie** (alle Branches, Muster für Anthropic, AWS, Google, GitHub, Slack, Stripe, Meta, private Schlüssel): 3 Treffer, alle Testwerte (`sk-ant-test-…`, ein Platzhalter-Schlüssel aus `x`, ein 1×1-PNG).
- **`.env`-Dateien in der Historie:** nur `.env.example` mit leeren Werten.
- **Ergebnis:** Kein echter Schlüssel gefunden, **keine Rotation nötig.** gitleaks war in dieser Umgebung nicht installierbar; es kommt in Phase 1 in die CI.

---

## 6. Datenschutzbefund

### 6.1 Personenbezogene Daten

| Tabelle | Daten |
|---|---|
| customers | Anrede, Name, Firma, Anschrift, E-Mail, 2 Telefonnummern, Notizen, Tags, Quelle |
| leads | Name, Kontakt, Anschrift, Nachricht, Fahrzeugtext, **gclid/fbclid**, Kampagne |
| vehicles | **Kennzeichen**, Marke, Modell, Notizen; Altwerte VIN, Baujahr, km, Farbe |
| protocols, protocol_damages, files | **Fotos**, Unterschriften (Bild), Name der unterzeichnenden Person, Schäden, km-Stand |
| activities, email_log, appointments, orders | Nachrichteninhalte, E-Mail-Adressen, Betreff, Notizen |
| offers, invoices, payments, document_imports | Rechnungsdaten, ausgelesene Käufer- und Verkäuferdaten |
| users, sessions, user_tokens, legal_acceptances, api_keys | Name, E-Mail, Passwort-Hash, **IP-Adressen, User-Agent** |
| audit_log | **vollständige Vorher- und Nachher-Datensätze**, IP |
| assistant_messages | Freitext der KI-Chats |
| privacy_requests | Name und Kontakt der betroffenen Person |
| competitors | Telefon und Anschrift von Wettbewerbern (Unternehmensdaten, ggf. Einzelunternehmer) |

### 6.2 Empfänger außerhalb des Systems

| Empfänger | Daten | Standort bzw. Grundlage | Standard |
|---|---|---|---|
| SMTP des Mandanten bzw. des Systems | Kundenmails mit Anhängen | abhängig vom Anbieter | aktiv |
| Anthropic (USA) | KI-Assistent: Kennzahlen und Freitext; Kundendaten nur nach Freigabe. Belegerkennung: ganzes Dokument. | Drittland, Grundlage nicht dokumentiert | aus |
| Windsor.ai | API-Schlüssel; liefert Meta-Leads (personenbezogen) | nicht dokumentiert | nur wenn eingerichtet |
| Google (Ads, GA4, Search Console, Places) | ausgehend nur Zugangsdaten und Suchbegriff; eingehend Kennzahlen bzw. Wettbewerberdaten | USA bzw. EU-Bedingungen | nur wenn eingerichtet |
| Meta | Zugangsdaten (Token in der URL) | USA | nur wenn eingerichtet |
| Schriften, CDN, Fehler-Tracking | **keine** | — | — |

### 6.3 Löschfristen (Ist-Stand, `S/modules/privacy/settings.ts`, `retention.ts`)

| Daten | Frist |
|---|---|
| Verlorene Leads | 12 Monate |
| Leads in den Status new bzw. contact_attempt | 24 Monate |
| E-Mail-Protokoll | 12 Monate |
| Audit-Log | 24 Monate (mind. 6) |
| Marketing-Kennzahlen | 25 Monate |
| KI-Verlauf | 180 Tage |
| KI-Nutzungsprotokoll | ≥ 365 Tage |
| Belegimport-Rohdaten | 180 Tage (fest) |
| Jobprotokoll | 90 Tage (fest; die Einstellung wirkt nicht) |
| Inaktive Kunden | Standard aus |
| Rechnungsbelege | Standard 10 Jahre, einstellbar 6–12 (`documentRetentionYears`). Der Auftrag schlägt **8 Jahre** vor (§ 147 Abs. 3 AO n. F.). |

### 6.4 Einwilligungen

- **Kein Einwilligungsmodell.** Es fehlen Kanal, Zeitpunkt, Wortlaut, Quelle, Nachweis, Double-Opt-in, Widerruf und Sperrliste.
- **Erinnerungen:** Terminerinnerungen gelten als Service-Nachricht. Sie prüfen nur Einschränkung bzw. Anonymisierung.
- **Bewertungsanfragen und Pflege-Erinnerungen** gibt es im Manager nicht. Im WordPress-Plugin „Carcura Suite“ gibt es laut Beschreibung „Bewertungsanfragen“ und „Fahrzeugpflege-Erinnerungen“. Der Code liegt nicht in diesem Repository und wurde **nicht geprüft**.

### 6.5 Doku-Aussagen, die nicht zum Code passen

- `docs/06-datenschutz-und-sicherheit.md:40`: Dort steht „kein Dokumentinhalt, keine Fotos“ an die KI. Die Belegerkennung sendet aber, sofern eingeschaltet, das ganze Dokument.
- `docs/06…md:38` und `docs/privacy/tenant-isolation.md:8`: „jede Abfrage gefiltert“ – siehe 2.4.
- `docs/06…md` vergibt in mehreren Zeilen den Status „erfüllt“. Das ist eine Selbsteinschätzung, kein Testat. In der **Oberfläche** stehen keine Aussagen wie „zertifiziert“ oder „rechtssicher“ (Suche ohne Treffer). Die Tarifbeschreibungen in `S/core/entitlements.ts:55-66` versprechen jedoch nicht vorhandene Funktionen.

---

## 7. Zahlungsarten: Erfassung von Barzahlungen

**Ergebnis: Der Manager kann heute Barzahlungen erfassen.** Nach den BMF-FAQ zur Kassenführung hätte ein Fakturamodul mit
dieser Möglichkeit eine Kassenfunktion im Sinne der Nr. 1.2 AEAO zu § 146a (siehe 8).

| Stelle | Fundstelle |
|---|---|
| Rechnungszahlung erfassen (Server) | `S/modules/billing/invoices.routes.ts:231` – `z.enum(['cash','transfer','card','paypal','other'])` |
| Ausgaben und wiederkehrende Ausgaben (Server) | `S/modules/finance/routes.ts:14,24,43` – `METHODS = ['cash','transfer','card','paypal','direct_debit','other']` |
| Datenmodell | `S/db/schema.ts:668` (payments.method), `:733` (expenses.paymentMethod), `:764` (recurring_expenses.paymentMethod) |
| Übernahme in wiederkehrende Buchungen | `S/jobs/recurring.ts:33` |
| Bezeichnung „Bar“ | `W/lib/format.ts:61,65` |
| Auswahlfeld | `W/pages/Billing.tsx:259` (Zahlung), `W/pages/Finance.tsx:149` (Ausgabe), `:207` (wiederkehrend) |
| Anzeige | `W/pages/Billing.tsx:308` |
| CSV-Export | `S/modules/crm/importexport.routes.ts:117` |
| Nicht betroffen | PDF-Vorlagen (immer „Bitte überweisen Sie…“), Belegimport (immer `transfer`), E-Rechnungs-Parser (nur lesend) |

---

## 8. Prüfung der Rechtsangaben aus dem Auftrag

**Wie geprüft:** Die Primärquellen (gesetze-im-internet.de, EUR-Lex, BSI, BMF, developers.lexware.io) waren aus dieser
Umgebung **nicht direkt abrufbar**. Die Netzwerkfreigabe blockiert sie; der Webabruf scheiterte an der Namensauflösung. Geprüft
wurde deshalb über eine Websuche, **beschränkt auf die amtlichen Domains** (Auszüge aus gesetze-im-internet.de,
bundesfinanzministerium.de, recht.bund.de, eur-lex.europa.eu, bsi.bund.de, developers.lexware.io, cloud.google.com,
cheatsheetseries.owasp.org). Diese Auszüge sind gut belegt, aber kein vollständiges Lesen des Normtexts. Vor der Umsetzung
der jeweiligen Phase lese ich den Volltext, sobald der Zugriff möglich ist.

| Angabe im Auftrag | Ergebnis | Abweichung bzw. Hinweis |
|---|---|---|
| § 19 UStG: 25.000 € Vorjahr / 100.000 € laufendes Jahr | ✅ bestätigt (Normtext; BMF-Schreiben vom 18.03.2025) | Ab dem Umsatz, mit dem 100.000 € überschritten werden, entfällt die Befreiung **sofort**. Die Warnung muss also vorher kommen. |
| § 147 Abs. 3 AO: Buchungsbelege 8 Jahre (BEG IV), Bücher 10, Geschäftsbriefe 6 | ✅ bestätigt (BEG IV, BGBl. 2024 I Nr. 323) | Übergangsregelung für Altbelege mit dem Steuerberater klären |
| § 146a AO: Fakturasoftware mit Barerfassung = Kassenfunktion | ✅ bestätigt (BMF-FAQ zur Kassenführung, AEAO zu § 146a Nr. 1.2) | Ausnahme laut BMF nur, wenn die Software Barzahlungen **gar nicht** erfassen kann |
| § 379 AO: Bußgeld bis 25.000 € | 🟡 nur aus Sekundärquelle (Haufe) | Normtext von § 379 Abs. 1 und 7 AO vor Phase 2 im Volltext lesen |
| **Neu, nicht im Auftrag:** Regierungsentwurf „Kassenpflicht“ | ⚠️ **Abweichung bzw. neuer Sachverhalt** | Kabinettsbeschluss vom 23.09.2026 (laut IHK Köln): Kassenpflicht ab Gesamtumsatz > 100.000 €, voraussichtlich ab 2028, Bagatellgrenze 12.000 € Barumsatz. Laut Begründung des Referentenentwurfs sollen **auch Kartenzahlungen** im Aufzeichnungssystem erfasst werden. Noch nicht beschlossen. Carcura betrifft das als Kleinunternehmer voraussichtlich nicht, **Mandanten über 100.000 € schon**. Ob die Zahlungsart „Karte“ im Manager dann Folgen hat, ist eine Frage an den Steuerberater (siehe OFFENE-FRAGEN). |
| E-Rechnung: Ausstellung B2B ab 2027 bei > 800.000 € Vorjahresumsatz, ab 2028 für alle | ✅ bestätigt (BMF-FAQ E-Rechnung, § 27 Abs. 38 UStG) | Ausnahmen für Kleinunternehmer (§ 34a UStDV) und Kleinbetragsrechnungen bis 250 € (§ 33 UStDV) **nicht im Normtext gelesen**, nur aus dem BMF-Umfeld bekannt; vor Phase 2 prüfen |
| § 356a BGB, Widerrufsfunktion seit 19.06.2026 | 🟡 inhaltlich bestätigt | Neufassung im BGBl. 2026 I Nr. 28. Das genaue Datum des Inkrafttretens konnte ich aus den Auszügen nicht sicher belegen. Betrifft nur Variante B (verbindliche Online-Buchung). |
| BGH VI ZR 225/17: Zufriedenheitsbefragung per E-Mail = Werbung | ✅ bestätigt (Urteil vom 10.07.2018) | |
| BayLDA zu WhatsApp: konformer Einsatz „in der Regel“ nicht begründbar | ⚠️ **Formulierung nicht gefunden** | Eine Präsentation des bayerischen Wirtschaftsministeriums gibt das BayLDA so wieder: Einsatz im Kundenkontakt zulässig, wenn der Kunde **vorher auf die Risiken hingewiesen** wurde; vom Adressbuchabgleich wird abgeraten. Für den Plan ändert das nichts, die Lösung „nur wa.me-Link, kein Adressbuchabgleich“ ist in beiden Fällen die vorsichtige. Die Begründung in der Doku passe ich an. |
| Data Act: kein Wechselentgelt ab 12.01.2027 | ✅ bestätigt (Art. 29 VO (EU) 2023/2854) | Bis dahin sind nur kostendeckende, ermäßigte Wechselentgelte zulässig |
| BSI TR-02102-2 | ✅ aktuelle Version **2026-01** | Statische (EC)DH-Suiten nur bis 2026, DHE bis 2029; TLS 1.3 mit AES-GCM empfohlen. Konkrete Suiten in Phase 1 aus dem Volltext. |
| OWASP Argon2id | ✅ mindestens m = 19 MiB, t = 2, p = 1 | bcrypt nur für Altsysteme. Umsetzung entweder über Argon2 in `node:crypto` (neuere Node-24-Versionen; Verfügbarkeit in Phase 1 verifizieren) oder das Paket `argon2`. |
| Google Places: Speichern und Zwischenspeichern | ⚠️ **Verlauf nicht zulässig** | Laut Places-API-Richtlinien darf nur die **Place-ID dauerhaft** gespeichert werden; Breiten- und Längengrad höchstens 30 Tage. Bewertung, Anzahl und Status gehören nicht zu den Ausnahmen. Der vorhandene Verlauf (`competitor_snapshots`) widerspricht dem. Folge: nur Place-ID speichern und live abrufen; ein Verlauf ist nicht möglich. Entscheidung zu den gespeicherten Altdaten siehe PLAN.md. |
| Lexware Office Public API | ✅ geeignet | Rechnung als Entwurf oder final anlegen; **XRechnung**, wenn der Kontakt dafür eingerichtet ist (mit Prüfung); Zahlungsstatus über den Payments-Endpunkt (`openAmount`, `paymentStatus`). Rate-Limit **2 Anfragen/s**, API-Schlüssel 24 Monate gültig. ZUGFeRD-Erzeugung über die API ist noch zu prüfen. |
| sevDesk API | ✅ als zweite Option geeignet | E-Rechnung über `propertyIsEInvoice` (ZUGFeRD) bzw. XML-Abruf. Über die API nur als **Entwurf** anlegbar. |

Quellen der Websuche (Auswahl): [§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html),
[BMF-Schreiben Kleinunternehmer 18.03.2025](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/2025-03-18-sonderregelung-kleinunternehmer.pdf?__blob=publicationFile&v=3),
[BMF-FAQ Kassengesetz](https://www.bundesfinanzministerium.de/Content/DE/FAQ/FAQ-steuergerechtigkeit-belegpflicht.html),
[AEAO zu § 146a](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/AO-Anwendungserlass/2023-06-30-AEAO-Par-146-AO.pdf?__blob=publicationFile&v=1),
[Referentenentwurf Kassenpflicht](https://www.bundesfinanzministerium.de/Content/DE/Gesetzestexte/Gesetze_Gesetzesvorhaben/Abteilungen/Abteilung_IV/21_Legislaturperiode/2026-08-07-G-Kassenpflicht/1-Referentenentwurf.pdf?__blob=publicationFile&v=2),
[IHK Köln zum Kabinettsbeschluss](https://www.ihk.de/koeln/hauptnavigation/recht-steuern/steuern/bundesregierung-beschliesst-kassenpflicht-7183040),
[BMF-FAQ E-Rechnung](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html),
[§ 27 UStG](https://www.gesetze-im-internet.de/ustg_1980/__27.html),
[§ 356a BGB](https://www.gesetze-im-internet.de/bgb/__356a.html),
[BGBl. 2026 I Nr. 28](https://www.recht.bund.de/bgbl/1/2026/28/regelungstext.pdf?__blob=publicationFile&v=1),
[Data Act (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=CELEX%3A32023R2854),
[BSI TR-02102](https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Technische-Richtlinien/TR-nach-Thema-sortiert/tr02102/tr-02102.html),
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[Places API Policies](https://developers.google.com/maps/documentation/places/web-service/policies),
[Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms),
[Lexware API](https://developers.lexware.io/docs/),
[Lexware Kochbuch Rechnungen](https://developers.lexware.io/cookbooks/invoices/),
[sevDesk E-Rechnung per API](https://tech.sevdesk.com/api_news/posts/2024_11_15-einvoice_changes/),
[BGH VI ZR 225/17](https://www.it-recht-kanzlei.de/kundenzufriedenheitsanfrage-rechnung-bgh.html),
[StMWi Bayern: WhatsApp for Business](https://www.stmwi.bayern.de/fileadmin/user_upload/handel/Pr%C3%A4sentationen/2023-04-20_WhatsApp_for_Business.pdf).

---

## 9. Grenzen dieser Prüfung

- Den **Live-Server** (`manager.carcura.info`: TLS, DNS, Hosting, Plesk) konnte ich aus dieser Umgebung nicht erreichen. Die Angaben dazu stammen aus dem Auftrag.
- Die **WordPress-Plugins** (CRM Suite, Suite v2, Revenue Recovery u. a.) liegen nicht im Repository. Ihr Code wurde nicht geprüft; bekannt ist nur die Plugin-Liste.
- **Kein Penetrationstest** und kein OWASP-ZAP-Scan; das ist in Phase 1 bzw. 5 vorgesehen.
- **Rechtliche Einordnungen** in diesem Dokument sind technische Vorbereitung, keine Rechtsberatung. Offene Rechtsfragen stehen in `docs/legal/OFFENE-FRAGEN.md`.
