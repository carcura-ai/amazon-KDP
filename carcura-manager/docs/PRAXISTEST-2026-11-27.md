# Praxistest Carcura Manager – 20 simulierte Betriebe

Datum: 27.11.2026 · Stand der Software: Commit `95fd2da` (Branch `claude/kind-curie-4rhi0y`) · Testinstanz lokal, ohne Mailversand

> **Wichtig:** Die 20 Betriebe sind **KI-Simulationen**, keine echten Kunden.
> - **Zuverlässig** ist, was sie in der Software tatsächlich ausprobiert haben: was lief, was fehlte, welche Fehler auftraten. Die Fehler sind im Code nachgeprüft (Abschnitt 4).
> - **Nur Schätzungen** sind die Angaben zu Mehraufträgen und zur Zahlungsbereitschaft. Sie zeigen eine Richtung, sind aber keine Marktdaten.
> - **Bestätigen** sollte man das mit mindestens 5 echten Betrieben.

## 1. Wie getestet wurde

- **Aufbau:** Je Betrieb ein eigener Mandant mit Admin-Konto. Ein Agent (Sonnet, wenig Rechenaufwand) spielte über die Programmschnittstelle einen Arbeitstag seiner Branche durch:
  - eigene Leistungen und Preise anlegen
  - Anfrage → Kunde und Fahrzeug → Termin
  - Annahmeprotokoll mit Schäden, zwei Unterschriften und Abschluss
  - Auftrag → Angebot bzw. Rechnung (ausstellen, Zahlung, PDF)
  - Aufgabe, Lager, Dashboard, Bericht, Export
- **Umfang:** 20 von 20 Agenten fertig, 168 Programmaufrufe, ca. 7 Minuten Laufzeit.
- **Nicht getestet:** die Bedienoberfläche (Klickwege, Smartphone-Darstellung) und echte E-Mails.

## 2. Ergebnis auf einen Blick

| Nr | Betrieb | Hilft es? | Mehraufträge/Monat (Schätzung) | Zahlungsbereitschaft €/Monat (Schätzung) | Wichtigster Wunsch |
|---|---|---|---|---|---|
| 1 | Mobiler Solo-Detailer | teilweise | 0–2 | 15–29 | Anfahrtspauschale und Materialabbuchung |
| 2 | Stationär, 2 Inhaber (wie Carcura) | teilweise | 1–4 | 29–59 | Stellplatz-Planung und Erinnerung zur Keramik-Wartung |
| 3 | Premium-Keramik | teilweise | 1–3 | 29–59 | Garantiezertifikat mit Nachkontroll-Erinnerung |
| 4 | Aufbereitung für Autohäuser | teilweise | 2–6 | 29–59 | Monats-Sammelrechnung je Autohaus, Staffelpreise |
| 5 | Flottenpflege | teilweise | 2–6 | 30–70 | Serientermine und Monats-Sammelrechnung |
| 6 | Folierer (Wrapping) | teilweise | 0–2 | 29–59 | Folienverbrauch je Auftrag (Rolle, Charge, Marge), mehrtägige Aufträge |
| 7 | Lackschutzfolie (PPF) | teilweise | 1–3 | 29–59 | Folienverbrauch und Marge je Auftrag |
| 8 | Scheibentönung | teilweise | 1–4 | 19–39 | Garantiezertifikat (Folientyp, ABE) und Lagerabzug |
| 9 | Lackierer / Karosserie | teilweise | 1–4 | 30–60 | Versicherungsakte (Schadennummer, Gutachten, Direktabrechnung) |
| 10 | Smart Repair mobil | teilweise | 1–4 | 15–35 | Versicherungsfall mit Selbstbeteiligung |
| 11 | Dellendrücker | teilweise | 1–3 | 15–39 | Kalkulation nach Dellenzahl und -größe, Hagelabrechnung |
| 12 | Freie Werkstatt | teilweise | 3–10 | 29–59 | HU/AU- und Reifenwechsel-Erinnerung |
| 13 | Reifenservice | teilweise | 0–15 | 20–50 | Einlagerung mit Lagerplatz und Saisonerinnerung |
| 14 | Handwaschanlage | teilweise | 5–20 | 0–39 | Waschclub-Abos und Schnellverkauf* |
| 15 | Wohnmobil-Aufbereitung | teilweise | 0–2 | 20–50 | Preis nach Fahrzeuglänge, Einlagerungs-Abo |
| 16 | Oldtimer-Pflege | teilweise | 1–3 | 29–49 | Stellplatz-Einlagerung mit Abo-Abrechnung |
| 17 | Motorrad-Aufbereitung | teilweise | 1–3 | 20–39 | Wintereinlagerung, Schadenbereiche für Motorräder |
| 18 | Innenraum / Geruch | teilweise | 1–4 | 19–39 | Auffrischungs-Abos mit Erinnerung |
| 19 | Gebrauchtwagenhändler | teilweise | 1–3 | 0–49 | Fahrzeugbestand mit Marge und § 25a-Rechnung |
| 20 | 3 Standorte | teilweise | 5–20 | 60–150 | Standortverwaltung |

\* Eine Schnellkasse würde Barzahlungen erfassen und damit Kassenpflicht auslösen (siehe AUDIT.md, Abschnitt 7). Das kommt bewusst **nicht** in die Software.

**Zusammengefasst:**
- **„Hilft es?“** Alle 20 antworten „teilweise“. Der Kernablauf überzeugt durchweg, branchenspezifische Funktionen fehlen.
- **Zahlungsbereitschaft (Schätzung):** Median 25–50 €/Monat, Mittel 23–55 €. Fast alle knüpfen den oberen Wert an ihre wichtigste Wunschfunktion.
- **Mehraufträge (Schätzung):** Median 1–4 pro Monat. Begründet wird das fast immer mit schnellerem Nachfassen bei Anfragen und Angeboten, nicht mit neuen Kunden. Mehrere Agenten sagen ausdrücklich, dass der Hauptnutzen Ordnung und Zeitersparnis ist.

**Einordnung am Markt** (echte Preise, siehe AUDIT.md bzw. PLAN.md): RO App ab 29 €, CATAMA 99 € plus 799 € Einrichtung, DETAILING | ONE mit kostenlosem Basistarif. Die geschätzte Zahlungsbereitschaft liegt damit im Bereich der günstigen Anbieter. Mehr ist nur mit Einrichtung und Support als Mehrwert oder mit Branchenfunktionen realistisch.

## 3. Was gut ist (von fast allen genannt)

- Der Ablauf von der Anfrage bis zur bezahlten Rechnung läuft durchgängig, ohne Abbruch und ohne Serverfehler.
- Mehrwertsteuer, Summen, Teilzahlungen und Nummernkreise sind korrekt; eine Überzahlung wird verständlich abgelehnt.
- Das Annahmeprotokoll mit Schadensbereich, Art, Schwere und Unterschriften passt zum Alltag; das PDF ist sofort da.
- Das Lager verhindert Minusbestände mit deutscher Meldung.
- Dashboard, Monatsbericht, Preisanalyse und CSV-Export sind sofort nutzbar.
- Fehlermeldungen nennen das falsche Feld.

## 4. Gemeldete Fehler, im Code nachgeprüft

| Meldung (Nr) | Prüfung | Einordnung |
|---|---|---|
| Nach Teilzahlung bleibt der Status „offen“, kein „teilbezahlt“ (1, 16, 17) | **bestätigt**: Rechnungsstatus kennt nur draft/open/sent/overdue/paid/cancelled (`invoices.routes.ts:18`) | Verbesserung: Status bzw. Anzeige „teilbezahlt“ mit Restbetrag |
| Überlappender Termin ohne Warnung (2, 11) | **bestätigt mit Einschränkung**: Die Konfliktprüfung gilt nur je Mitarbeiter. Ohne zugewiesenen Mitarbeiter gibt es keine Prüfung, Boxen fehlen ganz (`appointments/routes.ts:52`). | bekannte Lücke, Plan 3.7 |
| Gleiches Kennzeichen doppelt angelegt (2, 4) | **teilweise**: Die Antwort enthält eine Duplikatliste, die Agenten haben sie übersehen. Es gibt keine Sperre und keine deutliche Warnung. | Verbesserung: deutlicher Hinweis bzw. Bestätigung |
| Angebot umwandeln: leerer Body ergibt 400 (1) | erwartet: Das Ziel (`to`) ist Pflicht | Kurzanleitung bzw. Hilfetext ergänzen |
| Lager-Einheit „l“ abgelehnt (9, 19), „Satz“ fehlt (13) | bestätigt: feste Einheitenliste | Verbesserung: freie Einheit oder mehr Einheiten |
| Monatsbericht im November zeigt Oktober (20) | so gewollt: Standard ist die letzte abgeschlossene Periode | Oberfläche sollte „laufender Monat“ anbieten |
| Unbekannte Felder (z. B. Schadennummer) werden still verworfen (10) | so gewollt (Validierung entfernt unbekannte Felder) | zeigt den Bedarf an Versicherungsfeldern |
| Steuerzeichen in der Termin-Antwort (6) | nicht nachvollziehbar, vermutlich ein Zeilenumbruch im Text des Agenten | kein Befund |

**Serverfehler (5xx) oder falsche Berechnungen: keine.**

## 5. Was fehlt, sortiert nach Häufigkeit

| Anzahl | Lücke | Im Umbauplan? |
|---|---|---|
| 17/20 | **Abos bzw. wiederkehrende Aufträge und Abrechnung** | ja, Pflegeabos (3.8); wiederkehrende **Abrechnung** noch nicht |
| 17/20 | **Mehrere Standorte** | nur optional (B2B +2–3 PT) |
| 14/20 | **Materialverbrauch je Auftrag automatisch aus dem Lager** (Folie, Keramik, Chemie) | teilweise (3.5 Nachkalkulation) |
| 13/20 | **Versicherungsfall** (Schadennummer, Gutachten, Selbstbeteiligung, Direktabrechnung) | **nein** |
| 13/20 | **Händler: Sammelauftrag bzw. Sammelrechnung, Rahmen- und Staffelpreise** | ja (3.9 B2B) |
| 8/20 | **Einlagerung** (Reifen, Wohnmobil, Motorrad, Oldtimer) mit Lagerplatz und Saisonabrechnung | **nein** |
| 8/20 | **Automatische Erinnerungen** (Wartung, HU/AU, Saison, Nachkontrolle) | teilweise (3.8 Wiedervorlage; Kundennachricht nur mit Einwilligung, 2.6) |
| 8/20 | **Fotos am Protokoll, Vorher-Nachher** | Upload vorhanden (nicht getestet); Vorher-Nachher ist Plan 3.1 |
| 6/20 | **Mobil:** Anfahrtspauschale, Einsatzort, Route | **nein** (Anfahrt als Position ist möglich, nicht automatisch) |
| 3/20 | Garantie- bzw. Zertifikatsverwaltung (Keramik, Folie, Tönung) | **nein** |
| 2/20 | Terminkonflikt mit Boxen bzw. Kapazität | ja (3.7) |
| 2/20 | Mehrtägige Aufträge | **nein** |
| je 1 | Werkstatt: HSN/TSN, Arbeitswerte, Teilebestellung · Händler: Fahrzeugbestand, § 25a · Preis nach Fahrzeuglänge · Motorrad-Schadenbereiche | außerhalb des Kerns |

## 6. Folgerungen für den Plan (Empfehlung)

1. **Zielgruppe schärfen:** Der Kern passt am besten zu **Aufbereitern, Folierern und Smart-Repair-Betrieben**. Werkstätten, Reifenhändler, Waschanlagen und Gebrauchtwagenhändler bräuchten eigene Fachfunktionen (Arbeitswerte, Einlagerung, Kasse, Fahrzeugbestand). Die gibt es bei Spezialanbietern schon. **Empfehlung: nicht in diese Branchen expandieren.**
2. **In Phase 3 vorziehen bzw. ergänzen** (alles mit Nutzen für Carcura selbst):
   - Pflegeabos **mit** wiederkehrender Abrechnung über Lexware (17/20)
   - Materialverbrauch je Leistung mit automatischer Lagerbuchung und Marge (14/20); gehört zur Nachkalkulation 3.5
   - Garantie- bzw. Pflegepass mit Nachkontroll-Termin (Keramik, Folie); klein, aber ein starkes Verkaufsargument
3. **Neu bewerten:**
   - **Versicherungsfall** (13/20): wichtig für Smart Repair, Lack und Dellen, für reine Aufbereiter selten. Als Zusatzmodul nach Phase 4 prüfen.
   - **Mehrere Standorte** (17/20): Viele haben es nur „nicht gefunden“, für Kleinbetriebe ist es nicht zwingend. Nur Nr. 20 macht es zur Bedingung, dafür aber mit der höchsten Zahlungsbereitschaft (60–150 €).
4. **Schnelle Verbesserungen** (je unter 0,5 PT): Status „teilbezahlt“, deutlicher Hinweis bei doppeltem Kennzeichen, Konfliktprüfung auch ohne Mitarbeiter, mehr Lagereinheiten, Bericht für den laufenden Monat.
5. **Preis:** Die simulierten 25–50 €/Monat passen zum Markt. Für das Modell „Service mit Software“ empfehle ich **Einrichtungspauschale plus Monatspreis**, etwa wie CATAMA (99 € plus Einrichtung). Den Preis erst nach Gesprächen mit echten Betrieben festlegen.

## 7. Nächste Schritte

1. **5 echte Betriebe** (3 Aufbereiter, 1 Folierer, 1 Smart Repair) 30 Minuten an der Software testen lassen und dabei dieselben Fragen stellen: Was fehlt? Was würdet ihr zahlen? Ergebnisse neben diese Tabelle legen.
2. Den Umbauplan um Material je Auftrag, wiederkehrende Abrechnung und Garantiepass ergänzen. Versicherungsfall und Standorte als Zusatzmodule einplanen. Danach Freigabe für Phase 1.
3. Die schnellen Verbesserungen aus 6.4 zusammen mit Phase 1 umsetzen (nach Freigabe).

## Anhang: Rohdaten

Die vollständigen Antworten aller 20 Agenten (JSON) liegen in `docs/praxistest-2026-11-27.json`.
