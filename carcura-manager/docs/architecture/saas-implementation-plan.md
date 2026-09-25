# Implementierungsplan: Carcura Manager als Self-Hosted- und SaaS-Branchensoftware

Grundlage: `docs/audit/phase1-repository-audit.md`. Grundsatz: bestehende Funktionen, Daten, APIs und Tests
bleiben erhalten. Alle Migrationen sind additiv. Goldene Regel: Carcura verdient mit Software, nicht mit Daten.

## Architekturentscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Tenant | Tabelle `companies` bleibt der Mandant, `company_id` ist die Tenant-ID | Umbenennung = hohes Regressionsrisiko ohne Nutzen |
| Betriebsmodus | `DEPLOYMENT_MODE=selfhosted` (Standard) oder `saas` | Self-Hosted bekommt alle Module ohne Abo; SaaS nutzt Abos und Entitlements |
| Datenbank | SQLite bleibt; Drizzle als Abstraktion; SQLite-spezifische Ausdrücke werden in `db/dialect.ts` gekapselt; PostgreSQL als späterer Treiber | Kein Vendor-Lock-in, kein Overengineering jetzt |
| System-Admin | Eigene Rechteebene (`is_platform_admin`), Pflicht-2FA, kein automatischer Zugriff auf Mandantendaten, Betreiber-Übersicht nur mit Metadaten | Trennung Verantwortlicher/Auftragsverarbeiter |
| Supportzugriff | `support_sessions`: Anfrage mit Begründung → Freigabe durch Mandanten-Admin (oder Break-Glass mit sofortiger Benachrichtigung) → befristet, standardmäßig nur lesend, jede Aktion auditiert | Art. 28, Nachvollziehbarkeit |
| Entitlements | `plans`, `plan_features`, `tenant_subscriptions`, `tenant_feature_overrides`; serverseitiger Guard `requireFeature()`; Deaktivieren sperrt nur den Zugriff, löscht nie Daten | Modularer Verkauf |
| Zahlung | Interface `PaymentProvider`, eingehende Webhooks mit Signaturprüfung und Idempotenz-Tabelle; kein fester Anbieter | Keine Zahlungsdaten im System |
| Audit | Hashkette je Mandant über Metadaten und Inhalts-Hash; Anonymisierung ersetzt Inhalte, lässt Kette intakt | Manipulationserschwerung trotz Löschpflichten |
| E-Rechnung | Strukturiertes Rechnungsmodell → XRechnung-CII-XML-Export mit Pflichtfeldprüfung; offizielle Validierung (KoSIT) als dokumentierter Schritt | Keine PDF-only-Architektur |

## Phasen, Dateien, Migrationen, Tests

### Phase 2 – Mandantenisolation
- Neuer Test `test/tenant-isolation.test.ts`: zwei Mandanten mit Daten in allen Modulen; Mandant B ruft **jede registrierte Route** mit IDs von A auf (automatisch aus dem Routenverzeichnis), dazu Suche, Exporte, PDFs, Dateien, KI-Werkzeuge. Erwartung: 403/404, keine Daten von A im Body.
- Fixes: Referenzprüfung bei Uploads und Import (`files/routes.ts`, `importexport.routes.ts`), mandantengebundene Nachladeabfragen (`appointments`, `orders`, `invoices`, `protocols`, `print`), Helfer `core/tenant.ts` (`assertOwned`).

### Phase 3 – Rollen, Rechte, System-Admin, Support
- `core/permissions.ts`: neue Rechte `invoices:cancel`, `invoices:export`, `privacy:manage`, `export:manage`, `api:manage`, `time:read`, `time:write`, `time:manage`, `subscription:manage`, `support:grant`; bestehende bleiben (Mapping der Beispielnamen in `docs/security/permissions.md`).
- Migration `0009_saas_core`: `support_sessions`, Spalten für Pflicht-2FA/Rollenzuordnung.
- `modules/platform/*`: Übersicht ohne Umsätze; Supportanfrage, Freigabe, Break-Glass, Ablauf.
- Tests: Rechte je Rolle, System-Admin ohne Mandantendaten, Supportsitzung nur befristet und auditiert.

### Phase 4 – Tarife, Module, Abos
- Migration: `plans`, `plan_features`, `plan_prices`, `tenant_subscriptions`, `tenant_feature_overrides`, `discount_codes`, `subscription_events`, `payment_webhook_events`.
- `core/entitlements.ts`, `modules/saas/*` (Tarife verwalten, Abo ändern, Kündigen, Webhook-Endpunkt), `integrations/payments/provider.ts`.
- Bestehende Module erhalten Feature-Schlüssel (z. B. `MARKETING`, `AI_ASSISTANT`, `COMPETITORS`, `INVENTORY`).
- Tests: Entitlements, Up-/Downgrade, Kündigung, Webhook-Signatur und Idempotenz, Daten bleiben bei Deaktivierung.

### Phase 5 – Datenschutz
- Migration: Lebenszyklusspalten (`restricted_at`, `retention_until`, `retention_reason`), `privacy_requests`, `data_exports`, `deletion_jobs`, `subprocessors`, `legal_documents`, `legal_acceptances`, `incidents`, `ai_usage_log`.
- `modules/privacy/*`: Einschränkung, Anfragenregister, Löschsuche mit Abhängigkeiten, Tenant-Export-ZIP, Tenant-Kündigung mit Frist, Subprozessor-Register, Rechtsdokumente, Incident-Log, Privacy-Dashboard; Retention-Engine erweitert.
- Tests: Export vollständig, Löschung respektiert Aufbewahrung, Einschränkung blockiert Versand, Tenant-Löschung nach Frist.

### Phase 6 – Security-Hardening
- CSRF (Origin/`Sec-Fetch-Site`), Magic-Byte-Prüfung, PDF-Aktivinhalte, Passwort-Reset und E-Mail-Verifikation, API-Schlüssel und `/api/v1`, ausgehende Webhooks mit HMAC/Retries/SSRF-Schutz, Audit-Hashkette, Request-ID, Log-Redaction, Liveness/Readiness, globales API-Rate-Limit, automatische Sicherung vor Migrationen, verschlüsselte Backups (optional per Passphrase).
- Tests: CSRF, Upload-Fälschung, XSS in PDFs/Exports, SQL-Injection über Such- und Filterparameter, SSRF, Rate-Limit, Audit-Kette.

### Phase 7 – Branchenfunktionen
- Migration: `time_entries`, `qc_templates`, `order_qc`, `order_materials` (über Lagerbewegungen), `paint_measurements`, `service_plans` (Pflegeabos), `automation_rules`, `booking_settings`, `booking_requests`, `portal_users`, `portal_tokens`, Protokollkorrektur (`corrects_protocol_id`).
- Module: Zeiterfassung, QS, Material, PTG (+ `MeasurementProvider`), Abos, Automationen, Online-Buchung, Kunden-/Autohausportal, QR, Bewertungsanfrage.

### Phase 8 – Rechnungen und E-Rechnung
- Rechnungsarten `invoice | cancellation | credit_note`, Korrekturrechnung, Zahlungsstatus (offen/teilweise/bezahlt/überfällig), Angebotsablauf-Job, CII-XML-Export mit Pflichtfeldprüfung.

### Phase 9/10 – Marketing und KI
- Entitlements, Aufbewahrung der Marketingdaten, KI-Einstellungen je Mandant (aktiv, erlaubte Datenkategorien), KI-Nutzungsprotokoll, Isolationstest der KI-Werkzeuge.

### Phase 11/12 – Oberfläche, Dokumentation, Tests, Audit
- Navigation nach Vorgabe, neue Seiten (Datenschutz, Mitarbeiter/Zeiten, Vertrag & Abo, Integrationen/API, System-Admin).
- Dokumentation unter `docs/architecture|privacy|security|saas|legal|api|deployment|testing|audit`.
- Abschluss: `docs/audit/final-audit.md`.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Regression in bestehender Installation | Self-Hosted-Standard mit allen Modulen, additive Migrationen, automatische Sicherung vor Migration, vollständige Testsuite je Phase |
| Unvollständige Mandantentrennung | Automatischer Routen-Test mit fremden IDs, Test bei jeder neuen Route |
| Scheinsicherheit bei Recht | Jede Rechtsfrage als „juristisch zu prüfen“ markiert; keine Zertifikats- oder Garantieaussagen |
| Umfang | Phasenweise Commits, jede Phase eigenständig lauffähig |
