# Abrufprotokoll — 2026-08-24

Marktplatz: amazon.de · Sprache: Deutsch · Prüfdatum: 2026-08-24

## Wichtige Einschränkung dieses Laufs

`WebFetch` (direkter Seitenabruf) war in dieser Cloud-Umgebung für **jede**
getestete URL gesperrt — Fehlermeldung „proxy refused the connection", sowohl
bei amazon.de-Produktseiten als auch bei neutralen Testseiten (wikipedia.org)
und Google Trends. Das ist konsistent mit dem in `docs/TRENDUEBERWACHUNG.md`
dokumentierten Verhalten dieser Umgebung. Direkte BSR-Werte, exakte
Rezensionszahlen von der Live-Seite und Google-Trends-Kurven konnten daher
**nicht selbst abgerufen** werden.

Alle Angaben unten stammen aus `WebSearch` (Google-indexierte Suchergebnisse
und deren KI-Zusammenfassung), nicht aus einem direkten, selbst gerenderten
Seitenabruf. Zahlen aus Suchergebnis-Zusammenfassungen (z. B. Sternebewertung,
Rezensionsanzahl, Preis) werden im Bericht als `verifiziert: nein` geführt,
auch wenn sie plausibel und mit Quelle/Datum belegt sind — echte Verifikation
setzt einen direkten Seitenabruf voraus, der hier nicht möglich war.

## Abrufe

| Zeit (UTC) | Quelle/Zweck | Suchanfrage | Ergebnis | erfolgreich |
|---|---|---|---|---|
| 13:40 | WebFetch amazon.de Produktsuche (Test) | — | proxy refused the connection | nein |
| 13:41 | WebFetch Google Trends DE (Test) | — | proxy refused the connection | nein |
| 13:41 | WebFetch amazon.de Bestsellerliste 13694201 (Test) | — | proxy refused the connection | nein |
| 13:41 | WebFetch wikipedia.org (Kontrolltest, ob generell gesperrt) | — | proxy refused the connection | nein |
| 13:41 | WebSearch | site:amazon.de weihnachten beschäftigungsbuch kinder bestseller | 9 Treffer inkl. Bestseller-Kategorieseiten | ja |
| 13:48 | WebSearch | site:amazon.de laternenfest kinderbuch sankt martin | 8 Treffer, überwiegend Verlagstitel | ja |
| 13:48 | WebSearch | site:amazon.de herbst beschäftigungsbuch kinder | 8 Treffer | ja |
| 13:48 | WebSearch | site:amazon.de regentag beschäftigung kind buch | 7 Treffer | ja |
| 13:48 | WebSearch | site:amazon.de adventskalender buch kinder 2026 bestseller | 9 Treffer | ja |
| 13:48 | WebSearch | site:amazon.de weihnachten rätselbuch kinder ab 6 | 8 Treffer | ja |
| 13:48 | WebSearch | site:amazon.de wartezimmer kinder beschäftigungsbuch | 8 Treffer | ja |
| 13:50 | WebSearch | site:amazon.de "beschäftigungsbuch" restaurant kinder rätselspaß rezensionen | 8 Treffer | ja |
| 13:50 | WebSearch | amazon.de bestseller "Advent & Weihnachten" Kinderbücher Rezensionen Preis | 8 Treffer | ja |
| 13:50 | WebSearch | Google Trends adventskalender buch Deutschland 2026 saisonverlauf | keine echten Trends-Zahlen, nur Blogartikel | ja (aber ohne Volumendaten) |
| 13:50 | WebSearch | Verlagsvorschau Herbst Winter 2026 Kinderbuch Beschäftigungsbuch Trend | 10 Treffer, Verlagsseiten | ja |
| 13:50 | WebSearch | site:amazon.de karneval kinderbuch beschäftigungsbuch 2026 | schwache Trefferqualität, site:-Filter griff nicht zuverlässig | ja (unzureichend belastbar) |
| 13:50 | WebSearch | site:amazon.de "schwungübungen" ODER "erstes schreiben" kinder vorschule buch | 1 relevanter .de-Treffer | ja |
| 13:52 | WebSearch | site:amazon.de "Rätsel Adventskalender" kinder Bewertungen Preis | 9 Treffer, dichtes Wettbewerbsfeld | ja |
| 13:52 | WebSearch | site:amazon.de laternenfest rätselbuch beschäftigungsbuch kinder ab | 7 Treffer | ja |
| 13:52 | WebSearch | site:amazon.de "herbst rätselbuch" kinder ab | schwache .de-Trefferquote | ja (unzureichend belastbar) |
| 13:52 | WebSearch | site:amazon.de Tabea Hoffmann Rätselbuch Weihnachten Bewertungen | 6 Treffer inkl. Sternebewertungen/Rezensionszahlen laut Suchindex | ja |
| 13:54 | WebSearch | "Beschäftigungsbuch für Kinder im Restaurant" Julia Maine amazon.de Preis Taschenbuch | 3 relevante Treffer, kein Preis auffindbar | ja (Preis nicht ermittelt) |
| 13:54 | WebSearch | "Weihnachten Rätselbuch für Kinder" Tabea Hoffmann Preis Taschenbuch Seiten amazon | Preis 8,99 € für 2 von 3 Bänden laut Suchindex | ja |
| 13:54 | WebSearch | "Das knifflige Herbst Rätselbuch für Kinder ab 10 Jahren" Preis Bewertungen amazon | Zieltitel nicht bestätigt, dafür Parallelserie "Weihnachts-Rätselbuch ab 10" (Elvi Media) und "Naturrätsel im Herbst ab 4" gefunden | ja |
| 13:54 | WebSearch | "Das Laternenfest und die Geschichte von Sankt Martin" Kindermalbuch Fay's Atelier Preis Bewertungen | Titel bestätigt, Preis/Bewertung nicht auffindbar | ja (Preis/Bewertung nicht ermittelt) |

## Fortsetzung — Trendbericht-Lauf (kdp-weekly-scan)

Vorbericht geprüft: keiner vorhanden (`reports/trends/` enthält nur `.gitkeep`) ⇒ Erstlauf.
WebFetch erneut getestet (amazon.de Produktsuche) — weiterhin „proxy refused the connection".
Bestätigt die oben dokumentierte Einschränkung; alle folgenden Angaben stammen aus WebSearch
und sind `verifiziert: nein`.

| Zeit (UTC) | Quelle/Zweck | Suchanfrage | Ergebnis | erfolgreich |
|---|---|---|---|---|
| 13:55 | WebFetch amazon.de Produktsuche (erneuter Test) | — | proxy refused the connection | nein |
| 13:55 | WebSearch | site:amazon.de weihnachten rätselbuch kinder ab 6 bestseller bewertungen preis | 8 Treffer, u. a. Tabea Hoffmann Serie | ja |
| 13:55 | WebSearch | site:amazon.de adventskalender buch kinder bestseller bewertungen preis | 8 Treffer, Kategorie- und Produktseiten | ja |
| 13:55 | WebSearch | site:amazon.de laternenfest sankt martin kinderbuch bewertungen preis | 9 Treffer, fast nur klassische Bilder-/Vorlesebücher | ja |
| 13:55 | WebSearch | site:amazon.de herbst beschäftigungsbuch kinder ab bewertungen preis | 7 Treffer, überwiegend Malbücher | ja |
| 13:55 | WebSearch | site:amazon.de weihnachten beschäftigungsbuch kinder ab 4 bestseller bewertungen preis | 9 Treffer inkl. Bestsellerlisten-URL | ja |
| 13:57 | WebSearch | "Rätselspaß Weihnachten" Hoffmann amazon.de Bewertungen Sterne Preis Taschenbuch | 6 Treffer; Hoffmann-Band 8–12 J.: 4,6★/32 Rez./8,99 € laut Suchindex | ja |
| 13:57 | WebSearch | "Das große Weihnachts-Activity Buch" garant Verlag amazon.de Bewertungen Preis | Preis 57,00 € laut Suchindex — unplausibel für Aktivitätsheft, vermutlich Sammler-/Restbestandspreis eines Titels von 2015; nicht als Marktpreis verwendet | ja (Wert verworfen) |
| 13:57 | WebSearch | site:amazon.de wartezimmer kinder beschäftigungsbuch bewertungen preis | 6 Treffer, kein dediziertes Wartezimmer-Produkt | ja |
| 13:57 | WebSearch | site:amazon.de restaurant beschäftigungsbuch kinder bewertungen preis | 8 Treffer, 3 direkte Konkurrenztitel | ja |
| 13:57 | WebSearch | site:amazon.de zahnarzt kinderbuch mut machen bewertungen preis | 9 Treffer, 1 zielgenauer Konkurrenztitel (Poppins) | ja |
| 13:59 | WebSearch | site:amazon.de regentag beschäftigung kind buch bewertungen preis | 8 Treffer; Heldt-Titel 5,98 € laut Suchindex, gemischte Rezensionen | ja |
| 13:59 | WebSearch | "Rätsel Adventskalender ab 6 Jahren" Hoffmann amazon.de Bewertungen Sterne Preis | Hoffmann Adventskalender ab 6: 4,4★/6 Rez./8,99 € laut Suchindex | ja |
| 13:59 | WebSearch | "Das Laternenfest und die Geschichte von Sankt Martin" Kindermalbuch amazon.de Bewertungen Preis | Titel bestätigt, Preis/Sternezahl nicht auffindbar | ja (unvollständig) |
| 13:59 | WebSearch | Google Trends Adventskalender Buch Weihnachten Kinderbuch Deutschland Suchinteresse saisonal | keine Live-Kurve, nur allgemeiner Hinweis auf Oktober–Dezember-Peak bei "Weihnachtsgeschenke" | ja (ohne Volumendaten) |
| 13:59 | WebSearch | site:amazon.de kindergartenstart buch kinder bewertungen preis | 6 Treffer, ganzjähriges Thema, keine Preise auffindbar | ja (unvollständig) |

## Nicht erreichbare Quellen (für den Bericht)

- amazon.de Produktseiten (direkter Abruf) — WebFetch durchgehend blockiert
- amazon.de Bestsellerlisten (direkter Abruf, Live-BSR) — WebFetch durchgehend blockiert
- Google Trends (Live-Kurve DE) — WebFetch blockiert, kein Ersatz über WebSearch verfügbar
- amazon.de Autocomplete/Suchvorschläge (Live) — nicht separat abrufbar ohne WebFetch/Browser

## Fortsetzung — Lauf 2, `/kdp-weekly-scan` (Vergleichslauf, selber Kalendertag)

**Hinweis zur Aussagekraft:** Dieser zweite Lauf fand am selben Kalendertag wie der
erste (2026-08-24) statt. Reale Marktbewegung (BSR, Rezensionszahlen) ist innerhalb
weniger Stunden nicht zu erwarten und wird hier nicht unterstellt. Ziel dieses Laufs
war die Prüfung, ob sich die Einschätzung zu C1–C7 ändert, sowie eine erweiterte Suche
nach bislang nicht erfassten Chancen (Suchmuster aus `quellen-und-methode.md`, Zeilen
„Gefühl/Situation" und „Lernziel").

| Zeit (UTC) | Quelle/Zweck | Suchanfrage | Ergebnis | erfolgreich |
|---|---|---|---|---|
| 20:05 | WebFetch amazon.de Produktseite B0CMX6XB25 (erneuter Test) | — | proxy refused the connection | nein |
| 20:06 | WebSearch | site:amazon.de weihnachten rätselbuch kinder ab 6 bestseller bewertungen preis | 7 Treffer; erstmals BSR-Werte für Hoffmann (B0CMX6XB25) und Imprint Press sichtbar; 2 zusätzliche Titel (Kate Robinson, Imprint Press ab 8) gegenüber Lauf 1 | ja |
| 20:07 | WebSearch | site:amazon.de laternenfest sankt martin kinderbuch beschäftigungsbuch rätsel | 9 Treffer, inhaltlich deckungsgleich mit Lauf 1 (weiterhin nur Bilder-/Vorlesebücher) | ja |
| 20:08 | WebSearch | site:amazon.de "Rätsel Adventskalender" kinder ab 6 bewertungen preis rezensionen | 6 Treffer; 3 zusätzliche Anbieter gegenüber Lauf 1 (Emil Elf, Anna Publishing, Emilie Stein) sowie ein zweiter Hoffmann-Band (B0CKZC8K9D, ab 8) | ja |
| 20:09 | WebSearch | site:amazon.de wut kinderbuch beschäftigungsbuch ab 5 | Etabliertes Verlagssegment (Loewe/Geisler „Wohin mit meiner Wut?"), keine Beschäftigungsbuch-Lücke erkennbar | ja (keine neue Chance) |
| 20:10 | WebSearch | site:amazon.de schere schneiden üben buch kinder ab 3 | Mindestens 7 etablierte Konkurrenztitel (Kiddos Press, PRINBOOK, Rason, Massarski, BastelFreunde u. a.) — Nische bereits sehr dicht besetzt | ja (keine neue Chance) |
| 20:11 | WebSearch | site:amazon.de karneval kinderbuch beschäftigungsbuch fasching 2026 | Vorwiegend Kita-Praxisbücher für Erzieher/Eltern; ein Rätsel-/Malspaß-Titel (Crea Colorina) nur auf amazon.com gefunden, nicht bestätigt auf amazon.de; Saisonfenster laut Kalender erst ab ca. November zeitkritisch — nicht vertieft | ja (nicht vertieft, siehe Begründung) |
| 20:12 | WebSearch | site:amazon.de neue freunde finden kinderbuch beschäftigungsbuch | Gesättigtes Bilderbuch-Segment inkl. eines bereits existierenden interaktiven Titels „Mission Freunde finden" ab 5 — keine belegbare Lücke | ja (keine neue Chance) |
| 20:13 | WebSearch | site:amazon.de regentag beschäftigung kind buch bewertungen preis | 8 Treffer; „Regentage-Buch gegen Langeweile" (Heldt, ab 6, 5,98 €) mit wiederkehrender Kritik laut Suchindex-Zusammenfassung: „sehr dünn ausgefallen", „Zielgruppe verfehlt" → Lückenindikator nach `bewertungsraster.md` | ja |
| 20:14 | WebSearch | "Regentage-Buch gegen Langeweile" Heldt amazon.de Bewertungen Sterne Rezensionen Anzahl | Exakte Sternezahl/Rezensionsanzahl nicht auffindbar; ISBN-Muster (1481871048/1073189317) deutet auf älteren Titel (vermutlich vor 2018) | ja (Sternezahl/Rezensionsanzahl nicht ermittelt) |

**Ergebnis Lauf 2:** WebFetch weiterhin durchgehend blockiert — Einschränkung aus Lauf 1
unverändert. Für C1–C7 keine Änderung, die die Einschätzung (verfolgen/beobachten/
verwerfen) verschieben würde; zusätzliche Wettbewerbstitel bei C1/C2 werden als
Detailergänzung, nicht als Statuswechsel gewertet (Suchvarianz statt Marktbewegung,
siehe Hinweis oben). Eine neue Chance (Regentag-Beschäftigungsbuch, siehe Bericht C8)
wurde identifiziert.
