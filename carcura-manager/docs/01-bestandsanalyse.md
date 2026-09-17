# 01 – Bestandsanalyse (Phase 1)

Stand: 2026-09-17. Quelle: Repository `carcura-ai/amazon-KDP`, WordPress-Instanz `carcura.info`
(per MCP), verbundene Marketing-Connectoren dieser Sitzung.

## 1. Repository

| Befund | Bewertung |
|---|---|
| Das Repository enthält ausschließlich das Amazon-KDP-Kinderbuchsystem (Skills, Markdown-Vorlagen, Python-/Node-Skripte zur Buchproduktion). | Keine wiederverwendbare Carcura-Software, keine Datenbank, keine API, keine Authentifizierung. |
| Das Repository ist **öffentlich** (`visibility: public`). | Für ein kommerzielles Produkt mit Kundendaten-Logik ungeeignet. Empfehlung: neues **privates** Repository `carcura-ai/carcura-manager` anlegen und den Ordner `carcura-manager/` dorthin überführen. Bis dahin: keine Zugangsdaten, keine echten Kundendaten committen (`.gitignore` deckt `.env`, `data/`, Backups ab). |
| Keine CI, keine Tests, keine Lockfile-Pflege (package.json in `.gitignore`). | Wird im neuen Projektordner sauber aufgesetzt. |

## 2. WordPress `carcura.info` – bereits vorhandene Carcura-Systeme

Aktive Eigenentwicklungen (Plugins, Quellcode liegt **nicht** im Repository, nur auf dem Server):

| Plugin | Version | Funktion laut Beschreibung |
|---|---|---|
| Carcura CRM Suite (`carcura-privatkunden-anfragen`) | 4.2.0 | Privat-/Firmenkunden, Website- und Google-Leads, Newsletter, Kundenakten, E-Mails, Angebote, Termine, Rechnungen, Dokumente |
| Carcura Suite v2 (`carcura-suite-v2`) | 2.0.0 | CRM, WhatsApp-Anfragen, Kundenportal, Pflege-Erinnerungen, Abo-Verwaltung, Termine, Rechnungen, Bewertungsanfragen |
| Carcura Revenue Recovery (`carcura-revenue`) | 4.8.0 | Zentraler Lead-Funnel, Sofortreaktion, Follow-up-Engine, Lost-Lead-Recovery, Umsatz-Reporting; **REST-Endpunkt `POST /wp-json/ccrr/v1/lead`** (wird vom Anfrageformular der Seite `/anfragen/` genutzt) |
| Carcura Firmenkunden Portal | 1.5.0 | Fuhrpark-Kalkulator, Anfrageverwaltung, E-Mail-Versand |
| Carcura Newsletter & Rabattcode | 1.4.0 | Double-Opt-in, Rabattcode |

Weitere relevante Plugins: FluentSMTP (E-Mail-Versand konfiguriert), Site Kit (GA4 / Search Console verbunden),
Rank Math SEO, Contact Form 7, Complianz (DSGVO), Kubio (Theme-Builder), Easy MCP AI (MCP-Zugang für Claude).

### Lead-Vertrag des Website-Formulars (verifiziert aus dem Seitenquelltext)

```json
POST /wp-json/ccrr/v1/lead
{
  "name": "...", "email": "...", "phone": "...", "vehicle": "...",
  "service": "Leistung A, Leistung B", "message": "strukturierter Text",
  "customer_type": "privat" | "firma", "source": "anfrage_formular",
  "channel": "web", "gclid": "<Google-Klick-ID, 90 Tage aus localStorage>", "website": "<Honeypot>"
}
```
Antwort: `{ ok: true | false }`. Der `gclid` ermöglicht die Zuordnung Google-Ads-Klick → Lead.

### Bewertung

* Die Plugins speichern in **eigenen Tabellen** (keine WordPress-Post-Types registriert), ihre Lese-APIs sind von
  außen nicht dokumentiert. Aus der Sandbox ist `carcura.info` per HTTPS gesperrt; vom Laptop ist der Zugriff möglich.
* Drei Plugins (CRM Suite, Suite v2, Revenue) überlappen sich funktional (jeweils Termine, Rechnungen, CRM).
  Das ist die zentrale **technische Schuld**: drei Datensilos ohne gemeinsame Kundenakte, gebunden an WordPress,
  nicht mandantenfähig, nicht als Produkt verkaufbar.
* **Entscheidung:** Die neue Software wird das führende System (Single Source of Truth). WordPress bleibt Website und
  Lead-Eingang. Integration in zwei Stufen:
  1. **Sofort:** Die neue Software stellt einen kompatiblen Endpunkt `POST /api/public/leads/website` mit exakt dem
     obigen Payload bereit (abgesichert per Mandanten-Token). Das Website-Formular kann parallel an beide Systeme
     senden oder das Revenue-Plugin leitet den Lead per Webhook weiter.
  2. **Danach:** Einmaliger Import der Bestandsdaten aus den Plugin-Tabellen (CSV-Export aus WordPress → Import-Modul).
     Die Plugins werden dann stillgelegt, sobald die neue Software produktiv läuft.

## 3. Verbundene Marketing- und Analytics-Quellen (verifiziert)

| Quelle | Konto | Zugriffsweg für die Software |
|---|---|---|
| Google Analytics 4 | Property `548650753` (carcura.info) | GA4 Data API (Service-Account) **oder** Windsor.ai |
| Google Ads | Kunde `919-151-5213` | Google Ads API (Developer-Token + OAuth) **oder** Windsor.ai |
| Google Search Console | `https://carcura.info/` (siteOwner) | Search Console API (Service-Account) |
| Meta Ads | Werbekonto `4466807416930043` (Carcura GbR) | Marketing API (System-User-Token) **oder** Windsor.ai |
| Meta Lead Ads | Seite `1285478717973511` | Windsor.ai `facebook_leads` oder Graph API |
| Instagram | `17841473866439660` (_carcura_) | Windsor.ai `instagram` oder Graph API |
| Windsor.ai | alle fünf Quellen bereits verbunden | **eine** REST-API (`connectors.windsor.ai`) mit API-Key |

**Entscheidung:** Windsor.ai wird als **erster** Datenadapter implementiert, weil alle fünf Quellen dort bereits
verbunden sind und eine einzige Authentifizierung genügt (schnellster Weg zu echten Zahlen). Direkte Adapter
(Google Ads API, GA4 Data API, Meta Marketing API, Search Console API) folgen als gleichwertige Alternativen,
damit ein späterer Mandant ohne Windsor-Abo arbeiten kann. Alle Adapter liegen hinter einer gemeinsamen
Schnittstelle (`MarketingSource`).

## 4. Sicherheitsbefunde

1. Öffentliches Repository (siehe oben).
2. Zwei WordPress-Administratoren (`lumineecarcura`, `carcura-ai`); der MCP-Nutzer ist Administrator – für reine
   Lesezugriffe zu weit. Empfehlung: eigene Rolle mit minimalen Rechten oder Application Password mit Lese-Scope.
3. Das Website-Formular nutzt einen offenen REST-Endpunkt mit Honeypot, aber ohne Rate-Limit-Nachweis. Der neue
   Endpunkt wird mit Token, Rate-Limit und Duplikatschutz abgesichert.

## 5. Weiterverwendung

| Bestand | Entscheidung |
|---|---|
| Website, Formulare, SEO, DSGVO-Setup | bleibt unverändert |
| Lead-Payload-Vertrag `ccrr/v1/lead` | wird 1:1 übernommen (kompatibler Endpunkt) |
| FluentSMTP-Konfiguration | gleiche SMTP-Zugangsdaten werden in der Software je Mandant hinterlegt |
| GA4 / Google Ads / Meta / GSC / Windsor | werden als Adapter integriert |
| CRM-/Rechnungslogik der Plugins | wird **nicht** übernommen (nicht mandantenfähig, drei Silos); Daten werden importiert |
| KDP-System | unabhängiges Projekt, bleibt bestehen, keine Berührung |
