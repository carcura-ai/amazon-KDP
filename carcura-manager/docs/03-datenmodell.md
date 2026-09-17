# 03 – Datenmodell

Alle fachlichen Tabellen tragen `company_id` (Mandant), `created_at`, `updated_at`. IDs sind UUIDs (Text).
Geldbeträge werden als **Cent (Integer)** gespeichert, Steuersätze in Basispunkten (1900 = 19 %).

```
companies ──< users ──< sessions
    │           └──< audit_log
    ├──< role_permissions
    ├──< company_settings (Branding, Nummernkreise, Öffnungszeiten)
    ├──< integrations (Typ, verschlüsselte Zugangsdaten, Sync-Status)
    ├──< services (Leistungskatalog: Name, Preis, Dauer, Kategorie)
    ├──< leads ──> customers (converted_customer_id)
    ├──< customers ──< vehicles
    │        ├──< activities (Kommunikationshistorie: Anruf, E-Mail, Notiz, Termin, Angebot, Rechnung, System)
    │        ├──< appointments ──> vehicles, users
    │        ├──< orders ──> vehicles, appointments ──< order_items
    │        ├──< offers ──< offer_items
    │        ├──< invoices ──< invoice_items, payments
    │        ├──< protocols (Übergabeprotokoll) ──< protocol_damages, files
    │        └──< documents / files (Angebote, Rechnungen, Protokolle, Bilder, Sonstiges)
    ├──< inventory_items ──< inventory_movements
    ├──< expenses, recurring_expenses
    ├──< marketing_daily (Quelle, Kampagne, Datum, Impressionen, Klicks, Kosten, Leads, Conversions)
    ├──< web_analytics_daily (Besucher, Sitzungen, Seitenaufrufe, Quelle, Gerät)
    ├──< social_daily (Plattform, Reichweite, Follower, Aufrufe, Likes, Kommentare)
    ├──< competitors ──< competitor_snapshots
    ├──< reports (Typ, Zeitraum, Inhalt JSON, PDF)
    ├──< tasks, notes
    ├──< jobs (Scheduler-Läufe, Status, Fehler, Retry)
    └──< backups
```

## Statuswerte

* Lead: `new, contact_attempt, contacted, offer_created, offer_sent, appointment, order, won, lost`
* Termin: `planned, confirmed, done, cancelled, no_show`
* Auftrag: `planned, accepted, in_progress, quality_check, finished, picked_up, completed, cancelled`
* Angebot: `draft, sent, accepted, rejected, expired`
* Rechnung: `draft, sent, open, overdue, paid, cancelled`
* Aufgabe: `open, in_progress, done`; Priorität `low, normal, high, urgent`

## Duplikaterkennung

Beim Anlegen von Leads/Kunden werden normalisierte E-Mail (`lower`), Telefonnummer (nur Ziffern, führende 0 → +49)
und Name (`lower`, ohne Sonderzeichen) verglichen; Fahrzeuge über normalisiertes Kennzeichen. Treffer werden als
Hinweis geliefert, das Anlegen wird nicht blockiert (bewusste Entscheidung des Nutzers).

## Nummernkreise

`company_settings.invoice_prefix` + laufende Nummer pro Jahr (`RE-2026-0001`), analog `AN-` für Angebote und
`KD-` für Kundennummern. Vergabe erfolgt transaktional, damit keine Lücken/Doppelungen entstehen.
