# Stufenablauf im Detail

## Stufe 1 — Trendrecherche

| | |
|---|---|
| Skill | `kdp-trend-scout` |
| Eingabe | Marktplatz, Sprache, ggf. Themenrichtung, Vorbericht |
| Ausgabe | `reports/trends/JJJJ-MM-TT-kdp-trends.md` + `.csv`, Rohdaten in `research/raw/` |
| Torbedingung | Bericht liegt vor, mindestens eine Chance mit „verfolgen" |
| Scheitert wenn | keine belegbare Chance ⇒ ehrlich berichten, nicht auffüllen |

## Stufe 2 — Validierung

| | |
|---|---|
| Skill | `kdp-opportunity-validator` |
| Eingabe | eine Chance aus Stufe 1 oder eine Idee des Nutzers |
| Ausgabe | `research/validated/JJJJ-MM-TT-{{id}}.md` |
| Torbedingung | **≥ 70 Punkte** und `ENTSCHEIDUNG: STARTEN`, ≥ 10 geprüfte Wettbewerbstitel |
| Scheitert wenn | < 70 Punkte, oder ein Ausschlusskriterium greift |

Bei 50–69: offene Fragen benennen, Daten nachziehen, erneut bewerten.
Bei < 50: ablehnen und zu Stufe 1 zurück.

## Stufe 3 — Buchentwicklung

| | |
|---|---|
| Skill | `kinderbuch-entwickler` |
| Eingabe | Scorecard mit `STARTEN` |
| Ausgabe | `books/series/{{reihe}}/reihenkonzept.md`, `band-{{n}}/briefing.md`, `seitenplan.md` |
| Torbedingung | Briefing vollständig, Seitenplan je Doppelseite, Reihenkonzept ≥ 3 Bände, Prüfpflicht-Tabelle ausgefüllt |

## Stufe 4 — Figurenkonsistenz

| | |
|---|---|
| Skill | `character-consistency` |
| Eingabe | Figurenentwurf aus Stufe 3 |
| Ausgabe | `character-bibles/{{figur}}.md` + Referenzblatt |
| Torbedingung | Status `REFERENZBLATT FREIGEGEBEN` durch den Nutzer |
| Blockiert | Ohne ausdrückliche Freigabe des Referenzblatts geht es nicht weiter |

## Stufe 5 — Produktion

| | |
|---|---|
| Skills | `kinderbuch-entwickler` (Text) + `character-consistency` (Bilder) |
| Eingabe | Seitenplan, Character Bible, Illustration Briefs |
| Ausgabe | `manuskript.md`, Bilddateien, `bildprotokoll.md`, Druckdateien |
| Torbedingung | alle Seiten fertig, `FIGURENKONSISTENZ: BESTANDEN`, KI-Einstufung in `data/ki-einstufung.md` |

Reihenfolge: Text fertigstellen → Referenzblatt freigegeben → Bilder je Doppelseite
→ Prüfmatrix je Seite → Kontaktbogen → Satz → Druckdatei.

Kostenpflichtige Schriften, Bilder oder Werkzeuge ⇒ **Freigabe des Nutzers**.

## Stufe 6 — Qualität & Compliance

| | |
|---|---|
| Skill | `kdp-quality-compliance` |
| Eingabe | fertige Druckdateien, Metadatenentwurf, Bildprotokoll |
| Ausgabe | `reports/compliance/JJJJ-MM-TT-{{titel}}.md` |
| Torbedingung | `STATUS: READY FOR HUMAN APPROVAL` |
| Pflicht | KDP-KI-Regeln am Prüftag live aufrufen; wenn nicht möglich: `NICHT FREIGEGEBEN` |

Probeexemplar ist kostenpflichtig ⇒ **Freigabe des Nutzers**.
Ohne Probeexemplar höchstens `READY FOR HUMAN APPROVAL — Probeexemplar ausstehend`.

## Stufe 7 — Listing & Launch

| | |
|---|---|
| Skill | `kdp-listing-launch` |
| Eingabe | Compliance-Bericht mit `READY FOR HUMAN APPROVAL` |
| Ausgabe | `books/series/{{reihe}}/band-{{n}}/listing.md` |
| Torbedingung | Titelvarianten, Beschreibung, 7 Keywords, Kategorien, Preisrechnung, Startplan, Messplan vollständig |
| Blockiert | Veröffentlichung, Preisfestlegung, Werbebudget — alles nur durch den Nutzer |

Der Orchestrator übergibt hier an den Nutzer und hält an.

## Stufe 8 — Auswertung

| | |
|---|---|
| Eingabe | manuell exportierte KDP-Berichte in `data/kdp-berichte/`, Produktseite, ggf. Ads-Bericht |
| Ausgabe | `reports/sales/JJJJ-MM-auswertung.md` |
| Torbedingung | Entscheidung über Folgeband dokumentiert und begründet |
| Zeitpunkt | frühestens 4 Wochen nach Veröffentlichung, sinnvoll nach 8 Wochen |

Ergebnis führt zurück zu Stufe 3 (nächster Band) oder Stufe 1 (neue Nische).
