# Tarife, Module und Abonnements

## Betriebsarten
| `DEPLOYMENT_MODE` | Verhalten |
|---|---|
| `selfhosted` (Standard) | alle Module frei, keine Abos, keine Zahlungsabwicklung |
| `saas` | Module je Tarif und Abo-Status, serverseitig geprüft |

Mandanten ohne Abo (vor Einführung der Tarife angelegt, z. B. der Betreiber-Mandant) gelten als „legacy“
und behalten alle Module. Neue Mandanten im SaaS-Modus starten mit einer Testphase im gewählten Tarif.

## Tarife und Preise
Tarife, Preise, Einrichtungsgebühren, Testtage, Benutzer- und Standortlimits stehen in der Datenbank
(Tabellen `plans`, `plan_features`, `addons`) und werden im Betreiberbereich gepflegt
(`/api/platform/plans`). Startwerte (Platzhalter, vor Verkaufsstart festlegen):

| Tarif | Monat | Jahr | Benutzer | Module |
|---|---|---|---|---|
| Start | 29 € | 290 € | 2 | Kunden, Fahrzeuge, Kalender, Aufträge, Angebote, Rechnungen, Protokolle, Basisberichte, Sicherungen |
| Business | 59 € | 590 € | 5 | + CRM/Leads, Aufgaben, Lager, Finanzen, Margen, Pflegeabos, Erinnerungen, Marketing, erweiterte Berichte, Zeiterfassung |
| Pro | 99 € | 990 € | 15 | + Autohaus-/Kundenportal, Online-Buchung, PTG, E-Rechnung, erweiterte Auswertungen, Wettbewerber, KI, API, Rechte je Rolle, White Label |
| Enterprise | ab 149 € | individuell | unbegrenzt | alle Module inkl. Standorte, Flotten, Gruppen, individuelle Integrationen |

Add-ons: KI, Marketing Analytics, Autohausportal, Kundenportal, Online-Buchung, PTG, E-Rechnung,
Zusatznutzer, Zusatzstandort.

## Prüfung (Entitlements)
- `core/entitlements.ts` berechnet je Anfrage die Module aus Tarif, Add-ons und Betreiber-Freischaltungen.
- `plugins/entitlements.ts` prüft jede Anfrage (Routen-Präfix → Modul) und liefert `402 feature_not_included`.
- Neue Module nutzen `app.requireFeature('KEY')`.
- **Deaktivieren löscht keine Daten.** Nach erneuter Buchung ist alles wieder da (Test vorhanden).
- Nach Vertragsende: Lesen und Export bleiben möglich, Ändern ist gesperrt (`402 subscription_inactive`).

## Lebenszyklus
`trial → active → (past_due) → cancelled → expired`, dazu `paused`. Täglicher Job `subscriptions.lifecycle`:
Testphase abgelaufen → expired; Kündigung nach Vertragsende → expired; vorgemerkter Downgrade zum
Zeitraumwechsel; Abrechnungszeitraum fortschreiben (manueller Anbieter).
Upgrade gilt sofort, Downgrade zum Ende des Zeitraums; ein Downgrade unter die aktuelle Benutzerzahl wird abgelehnt.

## Zahlungsanbieter
Interface `PaymentProvider` (`integrations/payments/provider.ts`): createCustomer, createSubscription,
changeSubscription, cancelSubscription, getSubscription, createCheckout, verifyWebhook.
Vorhanden: `manual` (Rechnung/Überweisung, Freischaltung durch den Betreiber) und `signed`
(HMAC-signierte Webhooks, Vorlage für eigene Anbindungen). Stripe, Mollie oder Paddle werden als weitere
Klasse ergänzt. Es werden keine Zahlungsdaten gespeichert, nur externe Kunden- und Abo-IDs.

Webhooks: `POST /api/webhooks/payments/<anbieter>`, Signatur und Zeitfenster (5 Minuten) werden geprüft,
jedes Ereignis wird genau einmal verarbeitet (Tabelle `payment_webhook_events`, nur Metadaten und Hash).

## Kennzahlen im Betreiberbereich
`/api/platform/metrics`: Mandanten, Abos je Status, MRR (ohne Testphasen, inkl. Add-ons und Rabatt),
ARR = MRR × 12, Churn der letzten 30 Tage, Modulnutzung. Ohne zahlende Abos wird keine Umsatzzahl
ausgegeben (`null`).

## Kündigung (Mandant)
Einstellungen → Vertrag & Abo → Kündigen: aktueller Vertrag, Vertragsende, Hinweis auf Datenexport,
ausdrückliche Bestätigung, Bestätigungs-E-Mail, Audit-Eintrag. Rücknahme bis zum Vertragsende möglich.
Für Verbraucherverträge (B2C) gelten zusätzliche gesetzliche Anforderungen (u. a. Kündigungsbutton nach
§ 312k BGB); diese sind vor einer B2C-Freigabe juristisch zu prüfen.
