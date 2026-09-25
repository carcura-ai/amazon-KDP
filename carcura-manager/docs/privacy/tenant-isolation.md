# Mandantentrennung (Tenant Isolation)

## Modell
- Ein Mandant (Tenant) ist ein eigenständiger Betrieb, technisch eine Zeile in `companies`. Die Spalte `company_id` in allen fachlichen Tabellen ist die Tenant-ID.
- Die Tenant-ID einer Anfrage stammt **ausschließlich** aus der serverseitigen Sitzung (`req.auth.companyId`), nie aus Body, Query oder Pfad.
- Dateien liegen je Mandant unter `data/files/<companyId>/…` und werden nur über `/files/:id` nach Prüfung von Sitzung, Recht und Mandant ausgeliefert. Es gibt keine öffentlichen Dateipfade.

## Regeln im Code
1. Jede Abfrage auf fachliche Tabellen enthält `eq(<tabelle>.companyId, ctx.companyId)`; auch Nachladeabfragen nach bereits geprüftem Hauptdatensatz.
2. Jede vom Client gesendete Referenz (Kunde, Fahrzeug, Lead, Auftrag, Angebot, Rechnung, Protokoll, Termin, Mitarbeiter, Leistung, Lagerartikel) wird mit `assertRefs()` aus `server/src/core/tenant.ts` gegen den Mandanten geprüft. IDs sind nie alleinige Autorisierung.
3. Fehlende oder fremde Datensätze liefern 404 (nicht 403), damit Existenz fremder IDs nicht erkennbar ist.
4. Mandantenübergreifende Funktionen (Betreiber-Übersicht, Backups der gesamten Installation) sind nur für den System-Admin erreichbar und liefern keine Kundendaten.

## Automatischer Nachweis
`server/test/tenant-isolation.test.ts` legt in Mandant A Daten mit einer Markierung in allen Modulen an und prüft als Admin von Mandant B:
- **jede registrierte Route mit Pfadparameter** mit den IDs von A (GET, POST, PUT, PATCH, DELETE): kein 2xx, keine Daten von A;
- **jede GET-Route ohne Parameter**, zusätzlich mit fremden IDs im Query (Listen, Suche, Exporte, Dashboard, Berichte): keine Daten von A;
- **jede schreibende Route** mit fremden Referenzen im Body: Abweisung;
- Suche nach Kennzeichen, E-Mail, Telefon, FIN von A: keine Treffer;
- KI-Werkzeuge im Kontext von B: keine Daten von A;
- Daten von A sind danach unverändert.

Neue Routen werden automatisch erfasst (Routenverzeichnis `app.routeIndex`). Ein unbekannter Pfadparameter lässt den Test fehlschlagen, bis die Zuordnung ergänzt ist.

## Gefundene und behobene Lücken (Phase 2)
| Befund | Behebung |
|---|---|
| Aufgaben akzeptierten fremde Kunden-, Lead-, Fahrzeug-, Auftrags- und Mitarbeiter-IDs | `assertRefs` in Anlage und Änderung |
| Uploads akzeptierten fremde Kunden-, Fahrzeug-, Auftrags- und Protokoll-IDs | `assertRefs` vor dem Speichern |
| KI-Gespräch mit unbekannter ID lieferte leere Liste statt 404 | 404 |
| Nachladeabfragen per nackter ID (Aufträge, Rechnungen, Protokolle, Termine, Druck, Erinnerungen, Leads, Fahrzeuge) | Mandantenfilter ergänzt |
| Terminliste lud Benutzer aller Mandanten in den Speicher | auf eigenen Mandanten begrenzt |

## Grenzen
- Die Trennung ist logisch (gemeinsame Datenbank, `company_id`). Eine physische Trennung (Datenbank je Mandant) ist für Enterprise-Kunden über eine eigene Installation möglich.
- Backups umfassen die gesamte Installation und sind deshalb nur dem System-Admin zugänglich.
