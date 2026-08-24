# Opportunity-Scorecard — C1 Weihnachts-Adventskalender-Rätselbuch (finaler Nachschärfungslauf)

| Feld | Wert |
|---|---|
| Ideen-ID | 2026-08-24-c1-adventskalender |
| Herkunft | Trendbericht, Chance C1; stärkste Chance im gebündelten Vergleichslauf (C3 69, C1 vorläufig 68, C7 61, C5 58) |
| Prüfdatum | 2026-08-25 (finaler Nachschärfungslauf, ersetzt den vorläufigen Stand vom 24.08.) |
| Geprüfte Wettbewerbstitel | 16 gesamt: 7 aus dem Erstlauf (Adventsgeschichten/Mitmachbücher) + 9 aus der gezielten Direktsuche `C1B` |
| Datenquelle | `research/raw/2026-08-24/live-214238/C1.json`, `research/raw/2026-08-24/live-215735/C1B.json`; Skript um Altersangabe- und Rezensionstext-Erfassung erweitert; KDP-Sätze wie C3/C5, kdp.amazon.com/help, 2026-08-24 |

## Wichtigste Korrektur gegenüber dem vorläufigen Stand

Der Erstlauf (`adventskalender buch kinder`) fand **ausschließlich Adventsgeschichten-/Mitmachbücher**
(v. a. die „Spekulatius"-Reihe, 1.532/256/9 Rez.) — **keinen einzigen echten Rätselband**. Die vorläufige
Nachfrage-Bewertung (19/25) stützte sich fälschlich auf diese Story-Buch-Zahlen. Die gezielte Direktsuche
(`C1B`, 4 neue Suchphrasen) fand die tatsächlichen Rätselbuch-Wettbewerber — mit deutlich dünnerer,
aber realer Nachfrage. Alle Kriterien wurden mit den korrekten Zahlen neu bewertet.

## Wettbewerbsanalyse — direkt vs. benachbart getrennt

### Direkte Wettbewerber (echte 24-Tage-Rätselbücher) — 5 relevante Titel

| Titel | Zielalter | Preis | Seiten | Rez. | ⌀ | Veröff. | Positionierung (Titeltext) |
|---|---|---|---|---|---|---|---|
| Mein Adventskalenderbuch — Rätselspaß mit den Wichteln | Ab 4 Jahren | 6,99 € | 96 | 21 | 4,8 | 09/2023 | Wichtel-Thema, reines Rätselheft |
| Wo versteckt sich der Elf Tino? Such- und Findebuch, 24 Rätsel | 3–9 Jahre (breit) | 10,70 € | 104 | 3 | 5,0 | 07/2026 (6 Wo. alt) | Elf-Thema, Suchbild-Schwerpunkt |
| PAPA & ICH — Adventskalender-Mitmachbuch, 24 Stift-Papier-Minispiele | Ab 6 Jahren | 16,95 € | 123 | 1 | 5,0 | 08/2026 (2 Wo. alt) | Eltern-Kind-2-Spieler-Format |
| 24× rätseln und dann ist Weihnachten! (mit Stickern) | Ab 4 Jahren | 6,95 € | 48 | 3 | 5,0 | 09/2024 | reines Rätselheft, Sticker-Bonus |
| Das kleine Böse Rätselbuch — 24 fiese Weihnachtslabyrinthe | Ab 8 Jahren | 9,95 € | 64 | **77** | 4,8 | 09/2024 | Humor/„böse"-Thema, stärkster Titel |

Ausgeschlossen als themenfremd: „Klappenbuch Erde" (Sachbuch, kein Advent), „Tagebuch eines Noobs Kriegers" (Comic, kein Advent), „Timmi Tobbsons Rätselabenteuer" (Kriminalgeschichte ab 9, kein 24-Tage-Format), „Rätselbuch für Kinder ab 6" (allgemeines Rätselbuch, nicht erkennbar als Adventskalender strukturiert).

### Benachbarte Adventsgeschichten-/Mitmachbücher (nicht Rätselbuch-Format) — 3 relevante Titel

| Titel | Preis | Seiten | Rez. | ⌀ | Anmerkung |
|---|---|---|---|---|---|
| Spekulatius, der Weihnachtsdrache — Adventsbuch in 24 Kapiteln (Klassiker) | 14 € | 192 | **1.532** | 4,8 | Dominanter Vorlesebuch-Titel, kein Rätselformat |
| Spekulatius … Lebkuchenwunder | 14 € | 192 | 256 | 4,9 | Selbe Reihe |
| Spekulatius … Klassenfahrt | 14 € | 176 | 9 | 4,9 | Selbe Reihe, neu |

Diese drei Titel dominieren die allgemeine „Adventskalenderbuch"-Suche, sind aber **keine Rätselbücher** und daher keine direkten Wettbewerber für dieses Konzept — sie erklären, warum der Erstlauf ein falsches Nachfragebild lieferte.

### Autocomplete — 7 Phrasen insgesamt

Erstlauf: „adventskalender buch kinder" → 6 echte Vorschläge (…5 jahre, …4 jahre, …ab 10, …3 jahre) — starkes generisches Signal.
Direktsuche: „adventskalender rätselbuch kinder" → 1 Vorschlag (Echo der Eingabe, kein zusätzliches Signal); die übrigen 3 gezielten Phrasen → 0.
**Ehrliche Einordnung:** Das starke Autocomplete-Signal gehört zur Oberkategorie „Adventskalenderbuch", nicht spezifisch zum Rätselbuch-Format.

### Rezensionstext-Auswertung (Punkt 3) — Datenlücke, keine erfundene Kritik

Die Skript-Erweiterung zur Erfassung von Rezensionsauszügen lief bei allen 5 direkten Wettbewerbern leer
(`rezensions_auszuege: []`) — Amazon lädt Rezensionstexte clientseitig nach dem ersten Rendern nach, der
Selektor griff nicht rechtzeitig. **Es liegt keine belastbare Auswertung wiederkehrender Kritik vor.** Die
Marktlücke unten stützt sich ausschließlich auf Struktur-/Altersdaten, nicht auf Kundenzitate — das wird
hier offen als Grenze benannt statt mit erfundenen Zitaten aufgefüllt.

## Erkennbare Alters-/Formatlücke (Punkt 2)

Altersabdeckung der 5 direkten Wettbewerber: **ab 4** (×2), **3–9 Jahre breit** (×1), **ab 6** (×1), **ab 8** (×1).
Keiner ist **eng auf 3–5 Jahre zugeschnitten** — die einzige Abdeckung dieses Bereichs ist eine breite
3–9-Spanne, die laut `sprache-und-alter.md` keine echte Zielgruppe ist („3–8 Jahre ist keine Zielgruppe").
Zusätzlich: kein einziger der 5 Titel hat eine wiederkehrende Maskottchen-Figur mit fortlaufender
Mini-Geschichte über die 24 Tage — alle sind reine Aufgabensammlungen ohne roten Faden.

## Bewertung (0–100)

| Kriterium | Max | Erreicht | Begründung |
|---|---:|---:|---|
| Nachfrage | 25 | 13 | Reale, aber dünne Direktnachfrage: 1 etablierter Titel (77 Rez., 2 Jahre am Markt), Rest sehr frisch (1–21 Rez.). Autocomplete für die exakte Rätselbuch-Phrase ist nur ein Echo der Eingabe, kein echtes Zusatzsignal. Kontinuierlicher Markteintritt neuer Anbieter 2023–2026 spricht für einen lebenden, nicht toten Markt. |
| Konkurrenzstärke | 20 | 14 | Kein Titel dominiert (max. 77 Rez.), Feld fragmentiert unter Kleinverlagen/Selfpublishern — „gemischt, ein bis zwei starke Titel, Rest angreifbar". |
| Erkennbare Marktlücke | 20 | 13 | Reale, aber nicht exklusive Lücke: enges 3–5-Format fehlt, wird aber teilweise von der breiten 3–9-Spanne mitabgedeckt. Keine Reihenfigur bei der Konkurrenz — echter, aber unbelegter (keine Rezensionstexte) Differenzierungsraum. |
| Serienpotenzial | 15 | 12 | Wiederkehrende Fuchsfigur (Markenschwerpunkt laut `kinderbuch-entwickler`-Skill) trägt eine 3-Bände-Reihe über Nutzungssituationen/Jahreszeiten hinweg — konkret planbar, siehe Reihenkonzept unten. |
| Realistische Marge | 10 | 6 | Reale KDP-Sätze: Deckungsbeitrag ≈ 2,15 €/Exemplar bei 8,99 € — unterer Rand der 2,00–3,49-€-Bandbreite. |
| Produktions- und Rechtsrisiko | 10 | 7 | Start 10, −2 (enges Saisonfenster: ~15 Wochen bis Weihnachten bei 14–18 Wochen Vorlauf, Puffer schmilzt), −1 (Ausfüllbuch-Rückläuferrisiko). |
| **Summe** | **100** | **65** | |

## Produktspezifikation & Marge (final)

Zielalter **3–5 Jahre** (eng, siehe Iron Rule „Altersgruppe eng führen"), Taschenbuch, **56 Seiten SW**
(4 Vorspann + 24 Doppelseiten Rätsel/Mini-Geschichte + 4 Nachspann), Beschnitt 21,59 × 21,59 cm,
Verkaufspreis **8,99 €** brutto (positioniert zwischen den 6,95–6,99-€-Einstiegstiteln und dem
Premiumfeld ab 10,70 €).

Netto 8,99/1,07 = 8,40 €. Tantiemestufe 50 % (Nettopreis < 9,98/9,99 €-Schwelle) — **[im echten
KDP-Konto zu bestätigen, Anmeldung laut Orchestrator-Regel gesperrt]**. Druckkosten SW, 24–110 Seiten
(56 Seiten fällt in dieses Band): 2,05 € Fixkosten, kein Seitenpreis. Tantieme = 8,40 × 0,50 − 2,05 =
**2,15 €/Exemplar**. Quelle: kdp.amazon.com/help, live abgerufen 2026-08-24.

## Konkrete Differenzierung (Punkt 4 — mehr als ein anderes Cover)

1. **Enges Zielalter 3–5 Jahre**, Aufgaben nach `sprache-und-alter.md` kalibriert (große Flächen,
   Schwungübungen, bis 10 zählen) — kein Wettbewerber bedient dieses Fenster gezielt.
2. **Wiederkehrende Fuchsfigur mit fortlaufender Mini-Geschichte**: jeden Tag ein Satz Handlung plus
   ein Rätsel, statt einer reinen Aufgabensammlung — bindet an die geplante Fuchs-Buchmarke an und
   schafft Seriengrund (siehe Reihenkonzept).
3. **„Für Erwachsene"-Anleitungsseite** im Vorspann (von keinem der 5 direkten Wettbewerber im Titeltext
   erwähnt) mit Begleit-Hinweisen je Schwierigkeit.
4. Positionierung zwischen Billig- und Premiumsegment (8,99 €) mit klar höherwertigerem Konzept als die
   6,95–6,99-€-Titel, aber ohne den Preisaufschlag der 16,95-€-Titel.

## Entscheidung

- [ ] STARTEN (≥ 70) — [x] **KONTROLLIERTES PILOTPROJEKT (65/100, Band 65–69, kein Ausschlusskriterium)** — [ ] ABLEHNEN

**Ausschlusskriterien geprüft:** Keines greift — Konkurrenz ist real, aber nicht „gering ohne Nachfrage"
(kontinuierlicher Markteintritt 2023–2026); ≥10 Titel insgesamt geprüft; keine Marken-/Lizenzrechte; Marge
positiv.

**Nutzerentscheidungsregel angewandt:** 65 liegt im Band 65–69 ohne Ausschlusskriterium → **kontrolliertes
Pilotprojekt startet**, begründet durch reale (wenn auch auf die Oberkategorie bezogene) Autocomplete-
Nachfrage und laufendes Saisonfenster. Dies ist eine **explizite Ausnahme vom Standard-Orchestrator-Tor**
(sonst zwingend ≥70 + STARTEN für Stufe 3) — angeordnet vom Nutzer für genau diesen Lauf, hier protokolliert
gemäß `statusfuehrung.md`.

**Offene Schwäche, die im Piloten beobachtet werden muss:** Die Marktlücke ist nicht durch Kundenkritik
belegt (Rezensionstext-Erfassung lief leer) — die Differenzierung beruht auf Struktur-/Altersanalyse und
Produktkonzept, nicht auf einem bestätigten „das fehlt den Leuten"-Zitat.
