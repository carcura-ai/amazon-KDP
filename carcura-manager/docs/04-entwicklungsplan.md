# 04 – Entwicklungsplan

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Bestandsanalyse | erledigt (`01-bestandsanalyse.md`) |
| 2 | Architektur, Datenmodell, Teststrategie | erledigt (`02-architektur.md`, `03-datenmodell.md`) |
| 3 | Backend-Kern: Mandanten, Benutzer, Login, Sessions, Rollen, Audit | erledigt |
| 4 | Designsystem, App-Shell, Login/Setup | erledigt |
| 5 | CRM: Leads, Kunden, Historie, Duplikate, Website-Lead-Eingang | erledigt |
| 6 | Fahrzeuge | erledigt |
| 7 | Kalender, Termine, Aufträge, Erinnerungen (E-Mail automatisch, WhatsApp per Link) | erledigt |
| 8 | Protokolle, Bilder, Dokumente, PDF (Protokoll, Kundenakte, Auftrag) | erledigt |
| 9 | Angebote, Rechnungen (lückenlose Nummern, Storno, Zahlungen, E-Mail-Versand mit PDF) | erledigt |
| 10–11 | Lager (Bestände, Bewegungen, Mindestbestand), Finanzen (Ausgaben, wiederkehrende Kosten, Periodenübersicht, Hinweise mit Kennzeichnung) | erledigt |
| 12–13 | Marketing-Adapter (Windsor.ai inkl. Meta-Lead-Import, Google Ads API, Meta Marketing API, GA4, Search Console), Marketing-Dashboard mit CRM-Attribution, Analyse-Hinweise | erledigt |
| 14–16 | Berichte (Woche/Monat/Jahr, automatisch + manuell, PDF, Struktur Zahlen → Veränderung → Ursache → Empfehlung), Preisanalyse je Leistung, KI-Business-Assistent (Claude, nur Systemdaten über Werkzeuge), Wettbewerber-Monitoring (Google Places API, manuelle Einträge, wöchentlicher Scan) | erledigt |
| 17–18 | Mandantenfähigkeit geprüft (jede Tabelle mit `company_id`, Betreiber-Ebene mit Kennzahlen je Mandant), White-Label (Produktname, Herstellerhinweis, Logo/Farben auf Anmeldeseite, PDFs, E-Mails), Aufgaben-Modul, CSV-Import/-Export, Gesamtexport (JSON) | erledigt |
| 19 | Sicherungen (täglich 02:30, manuell, Download, Upload, Wiederherstellung mit Sicherheitskopie), Update aus der Oberfläche mit Sicherung davor, Start-/Update-/Installationsskripte (Windows, macOS, Linux), CLI für Wartung | erledigt |
| 20 | Gesamttest: 61 Server-Tests, 8 Browser-Suiten (Desktop und Mobil, Überlaufprüfung), Dokumentation und README | erledigt |
| 21 | Datenschutz- und Sicherheitsprüfung (DSGVO/BSI): Löschkonzept mit Anonymisierung, Auskunftsexport, Aufbewahrungsläufe, Zwei-Faktor-Authentifizierung (TOTP), Sicherheits-Header, KI-Pseudonymisierung, Prüfbericht mit VVT-, TOM- und Informationstext-Vorlagen (`06-datenschutz-und-sicherheit.md`) | erledigt |

Jede Phase endet mit: Tests grün, Typecheck grün, Commit, Aktualisierung dieser Tabelle.
