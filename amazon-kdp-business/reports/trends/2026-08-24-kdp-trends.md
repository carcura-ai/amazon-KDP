# Trendbericht KDP — 2026-08-24

> **Regel:** Keine Zahl ohne Quelle. Keine Quelle ohne Prüfdatum.
> Nicht live geprüfte Angaben werden als `[NICHT VERIFIZIERT]` markiert.

## Das ist neu

```
NEU:          C3 Laternenfest/Sankt-Martin-Beschäftigungsbuch, C6 Wartezimmer-Beschäftigungsbuch
              (dedizierte Positionierung), C7 Zahnarzt-Kinderbuch „Mut machen" — alle NEU nur in
              dem Sinne, dass es der erste Bericht ist (siehe „Vorheriger Bericht" unten)
STÄRKER:      keine (kein Vorbericht zum Vergleich)
SCHWÄCHER:    keine (kein Vorbericht zum Vergleich)
WEGGEFALLEN:  keine (kein Vorbericht zum Vergleich)

Handlungsempfehlung: Erstlauf ohne Vergleichsbasis — kein Vergleichs-Handlungsbedarf. Inhaltlich
priorisiert wegen Vorlauf: C3 (Laternenfest, 8–10 Wochen Vorlauf, muss jetzt starten) und C1
(Weihnachts-Adventskalender-Rätselbuch, 14–18 Wochen Vorlauf, Fenster ist bereits eng) an
`kdp-opportunity-validator` übergeben, sofern der Nutzer eine dieser Ideen weiterverfolgen will.
```

## Prüfrahmen

| Feld | Wert |
|---|---|
| Marktplatz | amazon.de |
| Sprache | Deutsch |
| Prüfdatum | 2026-08-24 |
| Geprüfte Quellen | WebSearch (Google-Index über amazon.de-Produkt- und Kategorieseiten, site:amazon.de-Filter); WebSearch allgemein (Verlagsvorschauen, Saisonhinweise) |
| Nicht erreichbare Quellen | amazon.de Produktseiten (direkter Live-Abruf), amazon.de Bestseller-/Neuerscheinungslisten (Live-BSR), amazon.de Autocomplete/Suchvorschläge, Google Trends (Live-Kurve DE) — `WebFetch` liefert für jede getestete amazon.de- und Google-Trends-URL durchgehend „proxy refused the connection" (zuletzt erneut geprüft 2026-08-24, siehe `research/raw/2026-08-24/abrufprotokoll.md`) |
| Vorheriger Bericht | keiner — Erstlauf. `reports/trends/` enthielt bei Prüfbeginn nur `.gitkeep`. |

**Wichtige technische Einschränkung dieses Laufs:** Da `WebFetch` in dieser Umgebung für
amazon.de und Google Trends durchgängig blockiert ist, stammen alle Preise, Sternebewertungen,
Rezensionszahlen und Ränge unten aus der KI-Zusammenfassung von `WebSearch`-Treffern
(Google-Index), nicht aus einem selbst gerenderten Live-Seitenabruf. Sie werden deshalb
durchgehend als `verifiziert: nein` geführt, auch wenn Quelle und Prüfdatum angegeben sind.
Autocomplete-Vorschläge (das in `references/quellen-und-methode.md` vorgesehene primäre
Nachfragesignal) konnten in dieser Umgebung gar nicht erhoben werden — als Ersatz dienen
Trefferdichte und Produktexistenz über `site:amazon.de`-Suchen.

## Chancen (7)

### C1 — Weihnachts-Adventskalender-Rätselbuch, engere Altersnische

| Feld | Wert |
|---|---|
| Kategorie / Nische | Beschäftigungs-/Rätselbuch, Format „24 Tage bis Weihnachten" |
| Zielalter | Lücke bei ab-3-/Vorschul-Ausführung; belegte Konkurrenz bei 4, 6, 8, 8–12 Jahre |
| Format | Taschenbuch, vermutlich 21,59 × 27,94 cm o. ä., analog zu Wettbewerb |
| Saison / Zeitfenster | Weihnachten/Advent — Vorlauf lt. Saisonkalender **14–18 Wochen**. Ab 2026-08-24 gerechnet reicht das Fenster bis Ende Dezember nur noch knapp; sofortiger Start nötig. |
| Nachfrageindikatoren | Mindestens 3 Anbieter mit exakt diesem Adventskalender-Rätselbuch-Format gefunden (Tabea Hoffmann: ab 4/ab 6/ab 8; Lidia Lins: ab 8–12; Education4Life: ab 4–8). Hoffmann „Rätsel Adventskalender ab 6 Jahren": 4,4★ bei 6 Rezensionen laut WebSearch-Zusammenfassung, `[NICHT VERIFIZIERT]`. Mehrere unabhängige Anbieter im selben engen Format deuten auf tragfähige Nachfrage hin. |
| Preisspanne Wettbewerb | 8,99 € (Hoffmann-Adventskalender, laut Suchindex) `[NICHT VERIFIZIERT]` |
| Rezensionslage | 6 Rezensionen bei 4,4★ für den geprüften Hoffmann-Titel laut Suchindex; keine Kritikpunkte im Volltext auswertbar (nur Snippet) |
| Risiken | Enges Saisonfenster, Vorlauf bereits sehr knapp; Nische durch eine sehr aktive Selfpublisherin (Hoffmann) über mehrere Alterssegmente bereits stark besetzt — echte Differenzierung nötig (z. B. Kleinkind-Ausführung ab 3, oder Themenkombination); Ausfüllbuch-Rückläuferrisiko |
| Quellen | amazon.de/dp/B0CKZHH7WK (Hoffmann, ab 6, Prüfdatum 2026-08-24, via WebSearch); amazon.de/dp/B0CLZVSDW3 (Lins, ab 8–12); amazon.de/dp/B08NS9HYXZ (Education4Life, ab 4–8) |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — Nachfrage belegt, aber Nische bei den gängigen Altersstufen bereits dicht besetzt durch eine dominante Anbieterin; ohne verifizierte Preis-/Margendaten und ohne klare Lücke bei einer konkreten Altersstufe zu dünn für „verfolgen" |

### C2 — Weihnachten Rätsel-/Beschäftigungsbuch (Einzelband, keine Adventskalender-Form)

| Feld | Wert |
|---|---|
| Kategorie / Nische | klassisches Weihnachts-Rätselbuch, keine 24-Tage-Struktur |
| Zielalter | 4–6, 6–8, 8–12 Jahre — durchgehend belegt |
| Format | Taschenbuch |
| Saison / Zeitfenster | Weihnachten — Vorlauf **14–18 Wochen**, ab jetzt knapp |
| Nachfrageindikatoren | Mindestens 6 unabhängige Titel gefunden (Hoffmann-Serie, FactoryVerlag, Imprint Press, garant Verlag u. a.); Hoffmann „ab 8–12 Jahre": 4,6★ bei 32 Rezensionen, 9,99 € laut Suchindex — höchste Rezensionszahl aller in diesem Lauf geprüften Titel |
| Preisspanne Wettbewerb | 9,99 € (Hoffmann ab 8–12, laut Suchindex) `[NICHT VERIFIZIERT]`; ein Ausreißer von 57,00 € (garant Verlag, vermutlich Sammler-/Restbestandspreis eines 2015er-Titels) wurde verworfen, siehe Abrufprotokoll |
| Rezensionslage | 32 Rezensionen bei 4,6★ für Hoffmann ab 8–12 laut Suchindex — stärkstes Nachfragesignal im gesamten Bericht |
| Risiken | Sehr dichtes Wettbewerbsfeld inkl. Verlagstiteln; enges Saisonfenster, Vorlauf bereits sehr knapp; Ausfüllbuch-Rückläuferrisiko |
| Quellen | amazon.de/dp/B0CMX6XB25 (Hoffmann 6-8), Hoffmann 8-12-Band (Preis/Rezensionen laut WebSearch-Zusammenfassung, genaue ASIN in dieser Suche nicht eindeutig, Prüfdatum 2026-08-24); amazon.de/dp/3735910513 (garant Verlag) |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — höchstes belegtes Nachfragesignal des Berichts, aber Konkurrenzdichte (mind. 6 Titel, davon 3 einer einzigen Serie) macht Markteintritt ohne klare Differenzierung riskant |

### C3 — Laternenfest/Sankt-Martin-Beschäftigungsbuch (Rätsel-/Aktivitätsformat statt Vorlesebuch)

| Feld | Wert |
|---|---|
| Kategorie / Nische | Beschäftigungs-/Rätselbuch zum Laternenfest/Sankt Martin — bislang fast nur als Bilder-/Vorlesebuch besetzt |
| Zielalter | Lücke bei 5–8 Jahre (Aktivitätsformat); vorhandene Titel sind Bilderbücher ab 2–3 |
| Format | Taschenbuch, SW-Innenteil möglich |
| Saison / Zeitfenster | Laternenfest/Sankt Martin (11. November, regional stark im Rheinland) — Vorlauf lt. Saisonkalender **8–10 Wochen**. Ab 2026-08-24 gerechnet: spätester sinnvoller Produktionsstart ist **jetzt**. |
| Nachfrageindikatoren | 8 von 9 Treffern bei „site:amazon.de laternenfest sankt martin kinderbuch" sind klassische Bilder-/Vorlesebücher (u. a. Loewe/Ravensburger-Titel wie „Laterne, Laterne", „Die Geschichte von Sankt Martin"), teils seit Jahren im Sortiment. Nur ein Titel (Fay's Atelier, Kindermalbuch Band 2) geht in Richtung Aktivität, ist aber ein reines Malbuch, kein Rätsel-/Beschäftigungsbuch. Kein Titel im geprüften Suchfeld kombiniert Laternenfest mit dem in anderen Nischen (Auto, Weihnachten, Restaurant) erfolgreichen Rätsel-/Beschäftigungsbuch-Format. |
| Preisspanne Wettbewerb | keine Daten — Preise der gefundenen Titel über WebSearch nicht auffindbar |
| Rezensionslage | keine belastbaren Zahlen auffindbar; Fay's Atelier-Titel nur mit unspezifischem positivem Snippet („wunderschöne Malvorlagen") |
| Risiken | Regionales Thema (Rheinland/katholisch geprägte Regionen stärker als andere Bundesländer) — kleinere Zielgruppe als bundesweite Themen; religiöser Bezug (Heiligenlegende) erfordert sensible, altersgerechte Umsetzung; sehr enges und bereits laufendes Saisonfenster — Vorlauf realistisch nur bei sofortigem Start; Marktgröße unbelegt, da kein Vergleichstitel im Zielformat existiert (Lücke könnte auch bedeuten: keine Nachfrage) |
| Quellen | amazon.de/dp/B0DL423GX8 (Fay's Atelier, Prüfdatum 2026-08-24, via WebSearch); amazon.de/dp/3473325856 (Loewe, „Laterne, Laterne"); amazon.de/dp/3522304853 (Beutler/Schulze) |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — echte Format-Lücke plausibel, aber die Lücke selbst ist der einzige Beleg; keine Nachfrageindikatoren im Zielformat vorhanden (nur im artverwandten Bilderbuch-Segment). Vor Übergabe an den Validator sollte die Nachfrage nach dem Aktivitätsformat zusätzlich geprüft werden (z. B. Autocomplete, sobald Live-Zugriff möglich ist) |

### C4 — Herbst-Rätsel-/Beschäftigungsbuch, altersspezifisch

| Feld | Wert |
|---|---|
| Kategorie / Nische | Herbst-Beschäftigungsbuch, altersgenau statt allgemein |
| Zielalter | 6–8 Jahre — im geprüften Feld nicht dediziert besetzt |
| Format | Taschenbuch |
| Saison / Zeitfenster | Herbst — Vorlauf **8–10 Wochen**, ab jetzt eng, sollte kurzfristig starten |
| Nachfrageindikatoren | Gefundene Titel sind überwiegend Malbücher (Karl Print „Herbst Malbuch", Miray Bozdemir) oder allgemeine Jahreszeiten-/Kita-Fachbücher (Bezdek, Lehner), keiner davon ein altersgenau zugeschnittenes Rätsel-/Beschäftigungsbuch nach dem in C1/C2 erfolgreichen Muster. Ein Montessori-Aktivitätsbuch (3–7 Jahre) existiert, laut Suchindex „Top 17.500" der Beschäftigungsbücher-Kategorie — schwaches Ranking als Hinweis auf geringe Verkaufsdynamik `[NICHT VERIFIZIERT]`. |
| Preisspanne Wettbewerb | keine Daten |
| Rezensionslage | keine belastbaren Zahlen auffindbar |
| Risiken | Vorlauf bereits eng; Thema weniger geschenkgetrieben als Weihnachten ⇒ vermutlich geringeres Preis-/Mengenpotenzial; Marktgröße unsicher, da Vergleichstitel im Zielformat fehlen |
| Quellen | amazon.de/dp/B09M5B6HZL (Ananda Store, Montessori Herbst); amazon.de/dp/B0BF2ZR4PY (Karl Print); Prüfdatum 2026-08-24, via WebSearch |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — Lücke plausibel, Nachfragesignal aber schwach belegt (kein Vergleichstitel im Zielformat mit Rezensionsdaten) |

### C5 — Restaurant-Beschäftigungsbuch für Kinder

| Feld | Wert |
|---|---|
| Kategorie / Nische | Beschäftigungsbuch für die Tischzeit im Restaurant |
| Zielalter | 3 Jahre (2 Titel) und 6–8 Jahre (1 Titel) bereits besetzt |
| Format | Taschenbuch |
| Saison / Zeitfenster | ganzjährig, kein Saisonfenster |
| Nachfrageindikatoren | 3 direkte Konkurrenztitel identifiziert (Julia Maine „für kleine Feinschmecker" 6–8 J.; Martin Hunger ab 3; Flora Vero ab 3). Ein Kundenrezensions-Snippet zu Maine: „6-jähriger Sohn liebt das Buch" (positiv, aber Einzelmeinung, keine Zahl). |
| Preisspanne Wettbewerb | keine Daten — Preise nicht auffindbar |
| Rezensionslage | keine Zahlen auffindbar, nur ein positives Snippet ohne Sternebewertung |
| Risiken | Nische bereits mehrfach besetzt in genau den naheliegenden Altersgruppen (3 und 6–8); geringe Differenzierungsmöglichkeit; Ausfüllbuch-Rückläuferrisiko |
| Quellen | amazon.de/dp/B0F9435583 (Maine); amazon.de/dp/B0F5VXKGGD (Hunger); amazon.de/dp/B0C8RCQ1MH (Vero); Prüfdatum 2026-08-24, via WebSearch |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — Themenexistenz und Situationsbezug bestätigt, aber bereits von mindestens 3 Anbietern in den naheliegenden Altersgruppen besetzt; keine belegte Lücke |

### C6 — Wartezimmer-Beschäftigungsbuch für Kinder (dedizierte Positionierung)

| Feld | Wert |
|---|---|
| Kategorie / Nische | Beschäftigungsbuch, exklusiv auf „Wartezimmer" positioniert (Arzt/Zahnarzt) |
| Zielalter | noch offen — kein Vergleichstitel mit dieser exklusiven Positionierung |
| Format | Taschenbuch |
| Saison / Zeitfenster | ganzjährig, kein Saisonfenster |
| Nachfrageindikatoren | „Wartezimmer" taucht in mehreren Titeln nur als einer von mehreren Nutzungsorten auf (neben Auto, Reise, zu Hause — z. B. „Bildschirm aus!" von Sandra Schiffner, „Grimm und Möhrchen"), kein Titel ist exklusiv darauf zugeschnitten wie „Beschäftigungsbuch für Kinder im Restaurant" es für die Restaurant-Situation ist. Kein eigenständiges Nachfragesignal für die enge Positionierung gefunden — das Muster „Situations-Beschäftigungsbuch" funktioniert nachweislich (Restaurant, Auto), Wartezimmer ist davon aber nur eine Randerwähnung. |
| Preisspanne Wettbewerb | keine Daten |
| Rezensionslage | keine Daten für die enge Positionierung; die Mehrzweck-Titel selbst wurden nicht im Detail geprüft |
| Risiken | Unklar, ob „Wartezimmer" allein als Kaufanlass trägt oder nur als Zusatznutzen in einem Mehrzweck-Titel funktioniert — Hauptrisiko ist eine zu enge Positionierung ohne eigenständige Nachfrage |
| Quellen | amazon.de/dp/B0H5WVWPQ9 (Schiffner); amazon.de/dp/342371929X (Schneider/Scharnberg); Prüfdatum 2026-08-24, via WebSearch |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — zu dünn belegt für „verfolgen"; vor einer erneuten Prüfung sollte insbesondere Autocomplete geprüft werden, sobald Live-Zugriff möglich ist |

### C7 — Zahnarzt-Kinderbuch „Mut machen", altersspezifische Fortsetzung

| Feld | Wert |
|---|---|
| Kategorie / Nische | Mut-/Beschäftigungsbuch gegen Zahnarztangst |
| Zielalter | ab 4 Jahre bereits besetzt (Poppins); Lücke bei 6–8 Jahre mit vergleichbarem Mut-Konzept |
| Format | Taschenbuch, Malbuch-Anteil |
| Saison / Zeitfenster | ganzjährig, kein Saisonfenster |
| Nachfrageindikatoren | Ein zielgenauer Konkurrenztitel gefunden: „Zähne zeigen! Das Mut-Malbuch für Kinder vorbeugend gegen Zahnarztangst" (Fiona Poppins, ab 4 Jahre) mit Belohnungssystem (Mutsterne, Zahnheld-Urkunde) — spezifisches, differenziertes Konzept, das über reine Wissensvermittlung hinausgeht (Abgrenzung zu DK-Verlag-Sachbüchern). Nur ein direkter Wettbewerber im Mut-Segment gefunden, alle anderen Treffer sind klassische Aufklärungs-/Sachbücher (DK Verlag, Was ist was mini) ohne den Mut-Ansatz. |
| Preisspanne Wettbewerb | keine Daten |
| Rezensionslage | keine Zahlen auffindbar |
| Risiken | Thema ist pädagogisch/emotional sensibel (Kinderangst) — Fachprüfung durch Menschen vor Veröffentlichung sinnvoll; nur ein Vergleichstitel gefunden ⇒ Nachfrage-Beleg dünn, könnte auch auf geringe Marktgröße hindeuten statt auf Lücke |
| Quellen | amazon.de/dp/B0F47VV5XY (Poppins); amazon.de/dp/383104757X (DK Verlag, zum Vergleich); Prüfdatum 2026-08-24, via WebSearch |
| Neu / verändert / unverändert | Erstlauf — kein Vorbericht |
| Vorläufige Einschätzung | **beobachten** — evergreen und geringes Saisonrisiko, aber nur ein Vergleichstitel gefunden; vor „verfolgen" weitere Nachfragebelege nötig |

## Veränderungen gegenüber dem Vorbericht

| Chance | Status | Was hat sich geändert |
|---|---|---|
| — | — | Kein Vorbericht vorhanden — Erstlauf. Vergleichstabelle wird ab dem nächsten Bericht (2. Lauf) befüllt. |

## Nicht belegbare Beobachtungen

Vermutungen ohne Datenbeleg — ausdrücklich **nicht** zur Produktionsentscheidung geeignet.

- Karneval (Januar–Februar, regional stark im Rheinland) wurde in diesem Lauf **nicht** untersucht:
  Vorlauf 8–10 Wochen bedeutet sinnvollen Produktionsstart erst ab ca. November 2026 — für den
  aktuellen Bericht (24.08.) noch nicht zeitkritisch.
- Einschulung/Schulstart (Juni–August) wurde **nicht** untersucht: Das diesjährige Fenster ist
  bereits vorbei, ein sinnvoller Vorlauf (12–16 Wochen) für 2027 beginnt frühestens Anfang 2027.
- Die WebSearch-Zusammenfassung zu „Das große Weihnachts-Activity Buch" (garant Verlag) nannte
  57,00 € als Preis — das erscheint für ein 128-seitiges Aktivitätsheft unplausibel hoch
  (vermutlich Sammler-/Restbestandspreis eines Titels von 2015) und wurde **nicht** als
  Wettbewerbspreis in C2 übernommen.
- Ohne Live-Zugriff auf amazon.de-Autocomplete konnte für keine der sieben Chancen das in
  `references/bewertungsraster.md` als primär vorgesehene Nachfragesignal („Autocomplete-Vorschlag
  existiert") erhoben werden. Alle Nachfrageindikatoren oben stützen sich ersatzweise auf
  Trefferdichte und Produktexistenz über `site:amazon.de`-Suche — das ist ein schwächerer Beleg
  als vorgesehen und sollte im Bericht-Vergleich entsprechend vorsichtig gewichtet werden.

## Nächster Schritt

Keine der sieben Chancen erreicht in diesem Lauf die Einschätzung „verfolgen" — die
Nachfragebelege sind durchgehend durch die fehlende Live-Verifizierung (WebFetch blockiert)
geschwächt. Empfehlung an den Nutzer:

1. Falls eine der Chancen (insbesondere **C3 Laternenfest**, jetzt zeitkritisch, oder
   **C2 Weihnachten Einzelband**, stärkstes Rezensionssignal) trotzdem an
   `kdp-opportunity-validator` übergeben werden soll: Das ist möglich, aber die Scorecard wird
   analog zum bereits laufenden Fall „Beschäftigungsbuch Autofahrt 5–7" (siehe
   `amazon-kdp-business/data/status.md`) bei Preis/Rezensionen/BSR/Marge `keine Daten` ausweisen
   und kann ohne zusätzliche verifizierte Daten kaum 70 Punkte erreichen.
2. Alternativ: Live-Zugriff auf amazon.de wiederherstellen (andere Sitzung/Umgebung) oder Nutzer
   liefert Preise/Rezensionen/BSR der oben gelisteten Titel manuell nach — danach lässt sich
   dieser Bericht mit echten Zahlen nachschärfen, ohne die Recherche zu wiederholen.
3. Beim nächsten `/kdp-weekly-scan`-Lauf: diesen Bericht als Vorbericht laden und gezielt prüfen,
   ob sich bei C1–C7 die Einschätzung geändert hat, und ob Karneval (ab November zeitkritisch)
   neu aufgenommen werden muss.
