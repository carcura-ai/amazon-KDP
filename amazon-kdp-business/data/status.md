# Projektstatus

> Wird von `kdp-business-orchestrator` nach **jeder** Stufe fortgeschrieben.
> Vor jeder Stufe lesen. Nie aus dem Gedächtnis fortsetzen.
> Aufbau und Regeln: `.claude/skills/kdp-business-orchestrator/references/statusfuehrung.md`

## Systemstatus

| Feld | Wert |
|---|---|
| Eingerichtet am | 2026-08-24 |
| Marktplatz | amazon.de |
| KDP-Konto | vorhanden (nicht verknüpft, keine Zugangsdaten gespeichert) |
| Aktive Bücher | 2 (Stufe 2, WEITER PRÜFEN — noch keine Produktionsfreigabe) |
| Aktive Reihen | 0 |
| Letzter Trendbericht | 2026-08-24 (Lauf 2) — C3 final validiert (69/100, WEITER PRÜFEN, gestoppt); C5 als stärkste ganzjährige Nische ausgewählt (noch keine Scorecard); übrige „beobachten" |

## Stufe 1 — Trendrecherche

Letzter Lauf:               2026-08-24, Lauf 2 (unbeaufsichtigt über `scripts/kdp-weekly-scan.sh`, Exit 0)
Ergebnis:                   8 Chancen erhoben, alle mit Einschätzung „beobachten",
                            alle mit `verifiziert: nein`.
                            Vergleich gegen Lauf 1: C1–C7 unverändert, C8 (Regentag-
                            Beschäftigungsbuch) neu. Zeitkritisch bleibt allein C3
                            (Laternenfest, Vorlauf 8–10 Wochen, Fenster läuft bereits).
                            Lauf 1 archiviert unter `reports/trends/archiv/`.
Artefakte:
  - amazon-kdp-business/reports/trends/2026-08-24-kdp-trends.md
  - amazon-kdp-business/reports/trends/2026-08-24-kdp-trends.csv
  - amazon-kdp-business/research/raw/2026-08-24/abrufprotokoll.md
Torbedingung erfüllt:       **nein** — verlangt ≥ 1 Chance mit „verfolgen", erreicht: 0.
Grund:                      `WebFetch` in dieser Umgebung für amazon.de und Google Trends
                            gesperrt. Ohne Autocomplete, Live-Preise, Rezensionszahlen und
                            BSR reicht die Beleglage nach `bewertungsraster.md` nur für
                            „beobachten". Das ist die vorgesehene Reaktion, kein Fehler.
Nächster Schritt:           Lauf auf einem Rechner mit Zugriff auf amazon.de wiederholen,
                            oder eine Chance gezielt mit manuell gelieferten Daten vertiefen.
Blockiert durch:            fehlende Daten (Netzsperre der Einrichtungsumgebung)
Aktualisiert:               2026-08-24

## Bücher

## Ohne Reihenname / Band 1 — Beschäftigungsbuch Autofahrt 5–7

Aktuelle Stufe:             2 — Validierung
Letzte abgeschlossene:      2 am 2026-08-24
Ergebnis der letzten Stufe: Scorecard erstellt, 63/100, WEITER PRÜFEN. Nachfrage über 12 real existierende Wettbewerbstitel belegt, aber Preis/Rezensionen/BSR/Druckkosten mangels Live-Zugriff auf amazon.de und kdp.amazon.com (Proxy blockiert beide Domains in dieser Sitzung) nicht verifizierbar und daher `keine Daten`.
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-beschaeftigungsbuch-auto-5-7.md
Torbedingung erfüllt:       nein — ≥70 Punkte und STARTEN nicht erreicht (63/100, WEITER PRÜFEN). Stufe 3 startet nicht.
Nächster Schritt:           Offene Fragen mit Nutzer klären (Wettbewerbsdaten und KDP-Druckkosten nachziehen), dann Scorecard erneut bewerten.
Blockiert durch:            fehlende Daten (Live-Zugriff amazon.de/kdp.amazon.com in dieser Sitzung nicht möglich)
Offene Fragen an Nutzer:
  1. Wettbewerbsprüfung mit echtem amazon.de-Zugriff wiederholen oder Nutzer liefert Preise/Rezensionen/BSR der 12 gelisteten Titel manuell?
  2. Margenrechnung nachziehen, sobald KDP-Druckkostenrechner erreichbar ist oder Nutzer aktuelle Sätze mitteilt?
Aktualisiert:               2026-08-24

**Einstieg:** Stufe 1 (Trendrecherche) nicht durchlaufen — Grund: Idee vom Nutzer vorgegeben. Ersetzt durch: Nutzereingabe „Beschäftigungsbuch für Kinder von 5 bis 7 Jahren auf langen Autofahrten". Einstieg direkt in Stufe 2, wie im Orchestrator-Skill unter „Einstieg" vorgesehen und hier protokolliert.

**TESTLAUF-Hinweis:** Auf ausdrücklichen Wunsch des Nutzers endet dieser Lauf nach Stufe 2. Es wurde nichts veröffentlicht, bestellt oder verknüpft — es bestand dazu ohnehin kein Anlass, da Stufe 2 keine dieser Aktionen umfasst.

## Ohne Reihenname / Band 1 — C3 Laternenfest/Sankt-Martin-Beschäftigungsbuch

Aktuelle Stufe:             2 — Validierung
Letzte abgeschlossene:      2 am 2026-08-24
Ergebnis der letzten Stufe: Finaler Validierungslauf mit echtem Browser (Playwright/Chromium, lokal, sichtbar), zwei unabhängige Suchläufe (C3 + C3B): 14 Wettbewerbstitel geprüft. Opportunity-Scorecard: **69/100 — WEITER PRÜFEN**, Schwelle 70 um 1 Punkt verfehlt. Formatlücke bestätigt (0 von 14 Titeln ein Rätsel-/Beschäftigungsformat), Nachfrage über Jahre belegt (4 Titel mit dreistelligen Rezensionszahlen: 200/158/194/248), aber 10 von 10 Autocomplete-Phrasen ohne Vorschlag. Marge mit live abgerufenen KDP-Druckkosten-/Tantiemesätzen gerechnet: Deckungsbeitrag ≈ 2,15 €/Exemplar.
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-c3-laternenfest.md
  - amazon-kdp-business/research/raw/2026-08-24/live-210533/, live-211918/ (C3 + C3B)
Torbedingung erfüllt:       nein — ≥70 Punkte und STARTEN nicht erreicht (69/100, WEITER PRÜFEN). Stufe 3 startet nicht.
Nächster Schritt:           Keiner für C3 — laut Entscheidungsregel gestoppt, siehe C5/C6-Eintrag unten.
Blockiert durch:            Torbedingung nicht erfüllt (69 < 70)
Offene Fragen an Nutzer:    keine
Aktualisiert:               2026-08-24 (finaler Lauf)

## Ohne Reihenname / Band 1 — C5/C6 Vergleich ganzjährige Nische (Entscheidungsregel nach C3-Stopp)

Aktuelle Stufe:             1 — Trendrecherche (Live-Verifizierung, noch keine Validator-Scorecard)
Letzte abgeschlossene:      Live-Verifizierung am 2026-08-24
Ergebnis:                   C5 (Restaurant) und C6 (Wartezimmer) live verifiziert. Beide Suchen liefern
                            dieselben 7 Titel — Amazon unterscheidet die beiden Positionierungen in der
                            organischen Suche nicht. Davon ist nur 1 Titel wirklich Restaurant-spezifisch
                            ("Beschäftigungsbuch für Kinder im Restaurant", 12 Rez., 5,0★, Mai 2025) — ein
                            echter, aktueller Proof-of-Concept-Wettbewerber mit positiver früher Traktion.
                            Für Wartezimmer wurde trotz gezielter Suche **kein einziger** dedizierter
                            Wettbewerber gefunden — reine Hypothese ohne jedes Signal. Beide Nischen stehen
                            zusätzlich im Schatten eines dominanten Generalisten-Titels ("Kindergarten-
                            Rätselspaß für unterwegs", 3.417 Rezensionen, Rang 25 gesamt, seit 2014 am Markt).
                            Alle 14 Preise fehlen (`preis_eur: null`) — echte Datenlücke, nicht erfunden.
                            Autocomplete für 6 getestete Phrasen (3× Restaurant, 3× Wartezimmer): 0 Vorschläge.
                            **Auswahl: C5 (Restaurant) ist die stärkere Nische** — belegt durch einen realen,
                            aktuellen Wettbewerber mit positiver Traktion; C6 hat kein einziges Signal.
Artefakte:
  - amazon-kdp-business/research/raw/2026-08-24/live-212314/C5.json
  - amazon-kdp-business/research/raw/2026-08-24/live-212314/C6.json
  - amazon-kdp-business/research/raw/2026-08-24/live-213656/ (C5, C5B — Preis-Selektor korrigiert)
Torbedingung erfüllt:       nein — C5 wurde danach vollständig validiert (58/100), siehe Eintrag unten
Nächster Schritt:           siehe C5-Scorecard-Eintrag unten
Blockiert durch:            keine
Aktualisiert:               2026-08-24

## Ohne Reihenname / Band 1 — C5 Restaurant-Beschäftigungsbuch (vollständige Scorecard)

Aktuelle Stufe:             2 — Validierung
Letzte abgeschlossene:      2 am 2026-08-24
Ergebnis der letzten Stufe: Vollständige Opportunity-Scorecard erstellt, 10 relevante Titel (2 direkte Restaurant-Wettbewerber, 8 benachbarte generische Beschäftigungsbücher, 8 themenfremde Treffer ausgeschlossen). Preis-Selektor im Skript korrigiert (`scripts/live-verifikation.mjs`), dadurch erstmals vollständige Preisdaten. **Ergebnis: 58/100, WEITER PRÜFEN.** Hauptschwäche: drei Hauschka-Verlag-Titel dominieren die Oberkategorie mit ~9.900 Rezensionen (BSR-Ränge 139/323/336 gesamt); die Restaurant-Positionierung selbst hat bereits 2 aktive Wettbewerber (einer 6 Wochen alt).
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-c5-restaurant.md
  - amazon-kdp-business/research/raw/2026-08-24/live-213656/
Torbedingung erfüllt:       nein — 58 < 70. Stufe 3 startet nicht.
Nächster Schritt:           laut Entscheidungsregel: C1, C2, C4, C7, C8 gebündelt live verifizieren, zwei stärkste vollständig validieren
Blockiert durch:            Torbedingung nicht erfüllt
Aktualisiert:               2026-08-24

## Vergleichslauf C1/C2/C4/C7/C8 (Entscheidungsregel nach C5-Stopp)

Live verifiziert am 2026-08-24 (`research/raw/2026-08-24/live-214238/`, 35 Titel). Kurzvergleich zur Auswahl
der zwei stärksten Chancen für vollständige Scorecards:
- **C1** (Adventskalender, engere Altersnische): einziges Muster in der gesamten Reihe mit echten
  Autocomplete-Vorschlägen (6+1), gesunde Rezensionsverteilung (9–1.532) — stärkste Chance.
- **C7** (Zahnarzt-Kinderbuch): zwei etablierte Titel (875, 580 Rez.), moderate Konkurrenz, ganzjährig —
  zweitstärkste Chance.
- C2 (Weihnachten Einzelband): enorme Nachfrage (7.454/9.702 Rez.), aber zwei Titel dominieren die Nische
  fast vollständig — Konkurrenzmoat zu groß, nicht in die engere Wahl genommen.
- C4 (Herbst): durchgehend 1–25 Rezensionen, kaum Autocomplete-Signal — zu schwach belegt.
- C8 (Regentag): dasselbe Hauschka-Dominanzmuster wie C5 (zwei Titel mit 5.523/5.396 Rez.) — strukturell
  wie C5, nicht erneut vollständig geprüft.
C2, C4, C8 erhielten deshalb **keine** vollständige Scorecard (Vorgabe: nur die zwei stärksten).

## Ohne Reihenname / Band 1 — C1 Adventskalender-Rätselbuch (vorläufige Scorecard, überholt)

**Überholt durch den finalen Nachschärfungslauf vom 2026-08-25 — siehe „Miro Fuchs / Band 1" unten.**
Vorläufiger Stand war 68/100 auf Basis von Story-Buch-Wettbewerbern (Spekulatius-Reihe), die sich im
Nachschärfungslauf als nicht direkt vergleichbar herausstellten (keine Rätselbücher). Finaler Stand: 65/100.
Aktualisiert:                2026-08-24

## Ohne Reihenname / Band 1 — C7 Zahnarzt-Kinderbuch (vollständige Scorecard)

Aktuelle Stufe:             2 — Validierung
Ergebnis:                   61/100, WEITER PRÜFEN. Reale Nachfrage (875/580 Rez.), aber −4 Risikopunkte
                            wegen sensiblem Thema ohne Fachprüfung und schwächstes Serienpotenzial der
                            verglichenen Chancen.
Artefakte:                  amazon-kdp-business/research/validated/2026-08-24-c7-zahnarzt.md
Torbedingung erfüllt:       nein — 61 < 70. Stufe 3 startet nicht.
Aktualisiert:                2026-08-24

## Ergebnis der gesamten Validierungsrunde (2026-08-24)

Keine geprüfte Chance erreicht 70 Punkte. Rangliste: **C3 69 · C1 68 · C7 61 · C5 58** (C2/C4/C8 nur
kursorisch verglichen, keine vollständige Scorecard). Laut Entscheidungsregel wird nichts erzwungen — Stufe 3
startet für keine Chance. Nichts veröffentlicht oder kostenpflichtig ausgeführt.

## Miro Fuchs / Band 1 — Miros Lichterwald-Adventskalender (C1-Nachschärfung)

Aktuelle Stufe:             3 — Buchentwicklung (kontrolliertes Pilotprojekt, Nutzerausnahme vom
                            Standard-Tor ≥70+STARTEN — siehe unten)
Letzte abgeschlossene:      2 am 2026-08-25 (finaler Nachschärfungslauf) — 65/100
Ergebnis der letzten Stufe: C1-Erstlauf fälschlich auf Story-Buch-Konkurrenz gestützt (Spekulatius-Reihe,
                            keine Rätselbücher). Gezielte Direktsuche (`C1B`) fand die echten 5 direkten
                            Rätselbuch-Wettbewerber (max. 77 Rez.) — dünnere, aber reale Nachfrage.
                            Skript um Altersangabe-Erfassung erweitert; Rezensionstext-Erfassung
                            versucht, aber leer geblieben (Datenlücke, offen benannt). **65/100 —
                            Band 65–69 ohne Ausschlusskriterium.**
Nutzerentscheidung:         Explizite Ausnahme vom Standard-Orchestrator-Tor: bei 65–69 ohne
                            Ausschlusskriterium startet ein **kontrolliertes Pilotprojekt** statt der
                            sonst zwingenden ≥70+STARTEN-Schwelle — angeordnet für genau diesen Lauf.
Ergebnis Stufe 3:           Vollständiges Konzept-/Manuskriptpaket erstellt: Charakterbibel (Miro, Lotte),
                            Reihenkonzept (3 Bände), Briefing, Seitenplan (56 S., 24 Tage), vollständiges
                            Manuskript inkl. Lösungen, 24 Illustration Briefs, Cover-Brief, KDP-Listing
                            (Titel/Beschreibung/7 Keywords/Kategorien), Preis-/Margenrechnung mit live
                            abgerufenen KDP-Sätzen (2,15 €/Exemplar bei 8,99 €), vollständige
                            Upload-Anleitung, Compliance-Selbstprüfung.
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-c1-adventskalender.md
  - amazon-kdp-business/research/raw/2026-08-24/live-215735/ (C1B)
  - amazon-kdp-business/books/series/miro-fuchs/ (vollständiges Paket, siehe Dateiliste im Ordner)
  - amazon-kdp-business/reports/compliance/2026-08-25-miros-lichterwald-adventskalender.md
Torbedingung erfüllt:       nein für Standard-Stufe 3 (kein STARTEN) — **ja** für die vom Nutzer
                            angeordnete Pilot-Ausnahme (65–69, kein Ausschlusskriterium)
Stufe 4 (Figurenkonsistenz): nicht durchlaufen — kein Referenzbogen, keine echten Illustrationen
Stufe 6 (Compliance):       NICHT FREIGEGEBEN (7 offene Punkte, siehe Compliance-Bericht) — Stufen 4–7
                            stehen aus, keine Veröffentlichung, keine Bestellung, keine Kontoverknüpfung
Nächster Schritt:           Illustrationen produzieren → Figurenkonsistenz-Freigabe → Layout → Lektorat
                            → erneute Compliance-Prüfung. Erst danach Nutzerfreigabe zur Veröffentlichung.
Blockiert durch:            fehlende Illustrationen, fehlendes menschliches Lektorat, fehlende
                            Figurenkonsistenz-Freigabe (alle Stufe 4/6, noch nicht angefordert)
Aktualisiert:               2026-08-25

**Folgelauf (2026-08-25, Nachmittag): Kritischer Farbfehler behoben + Referenzblätter erzeugt.**
Zuordnungsrätsel Tag 4/12/20 nutzten Farbe als Lösungsregel im geplant Schwarz-Weiß gedruckten
Innenteil — technisch nicht funktionsfähig. Behoben durch 5 SW-Muster (Sterne/Wellen/Blätter/Punkte/
Streifen statt Farbcode), Zuordnungsrätsel mischen jetzt zusätzlich Zeilenreihenfolge (vorher durch
reine Positionierung trivial lösbar). Vollständige Prüfung aller 24 Rätsel: 6 weitere Text/Grafik-
Abweichungen gefunden und behoben (siehe `lektorat.md`, dritte Runde). GPU-Prüfung: keine nutzbare
GPU (`gpu-check.md`). Fooocus-Bildgenerierung per **Playwright-Steuerung der sichtbaren
Weboberfläche** (nicht interne API, wie angeordnet) erfolgreich durchgeführt — Referenzblätter für
Miro (fertig, ~94 Min. Rechenzeit) und Lotte (fertig, ~87 Min.) erzeugt, feste Seeds/Modell/Prompts
vollständig dokumentiert in `druckdaten/referenzblaetter.md`. **Figurenkonsistenz für BEIDE Figuren
nicht bestanden**: Miro weicht ab (türkise Kennfarbe als Schärpe statt Schwanzspitze, Armband fehlt),
Lotte weicht stärker ab (mehrere unterschiedliche Farbvarianten statt einer konsistenten Figur,
Ästchen-Brille fehlt). Wie angeordnet: keine der 24 Szenenillustrationen gestartet, bevor
Figurenkonsistenz besteht. Fooocus-Server beendet. Lauf stoppt hier für die Nutzerfreigabe der
Figuren — 3 Optionen zur Wahl in `druckdaten/referenzblaetter.md`.

**Vorheriger autonomer Nachtlauf (2026-08-25 früh, unbeaufsichtigt bis zum damaligen technischen Blocker):**
Lektorat durchgeführt (7 Logikfehler in Rätseln behoben über zwei Prüfrunden, siehe `lektorat.md`).
24 Rätselgrafiken programmatisch erzeugt und geprüft (`scripts/generate-raetselgrafiken.py`) — bewusst
kein KI-Bild für Labyrinthe/Zählaufgaben, da Code Korrektheit garantiert, ein Diffusionsmodell nicht.
KDP-Cover-/Innenteil-Maße live geprüft (Bleed 0,125", Gutter 0,375", Vollcover 17,376×8,75"). Interior-
und Cover-Entwurfs-PDFs gebaut (`build-interior-pdf.py`, `build-cover.py`). Upload-Ordner mit
Metadaten-Checkliste zusammengestellt (`upload/LIESMICH.md`).
**Bildgenerierung (Fooocus) versucht:** Lizenzproblem erkannt und behoben (Juggernaut XL erfordert
kommerzielle Sondervereinbarung → auf SDXL Base 1.0/RAIL++-M umgestellt), 6,46-GB-Checkpoint via
Start-BitsTransfer erfolgreich geladen (erster Versuch am 10-Minuten-Zeitlimit der Hintergrund-
Ausführung gescheitert), Fooocus-Server lief nachweislich lokal. **Blockiert an:** Fooocus hat keine
einfache API — der Generieren-Button hängt an einer >100-Parameter-Sitzungskette, die ohne
verantwortbares Risiko (CPU-only, kein visuelles Feedback über Nacht) nicht blind automatisierbar ist.
**Einziger verbleibender Blocker**, ausführlich dokumentiert in `druckdaten/README.md`. Alle anderen
angeforderten Schritte vollständig abgeschlossen. Nichts veröffentlicht, bestellt, kostenpflichtig
ausgeführt oder bei KDP angemeldet.

<!--
Vorlage je Buch:

## {{Reihe}} / Band {{n}} — {{Arbeitstitel}}

Aktuelle Stufe:             {{1-8}} — {{Name}}
Letzte abgeschlossene:      {{n}} am {{JJJJ-MM-TT}}
Ergebnis der letzten Stufe: {{2-3 Sätze}}
Artefakte:
  - {{Pfad}}
Torbedingung erfüllt:       ja / nein — {{welche}}
Nächster Schritt:           {{konkret}}
Blockiert durch:            {{Nutzerfreigabe für X / fehlende Daten / keine}}
Offene Fragen an Nutzer:    {{Liste oder "keine"}}
Aktualisiert:               {{JJJJ-MM-TT}}
-->
