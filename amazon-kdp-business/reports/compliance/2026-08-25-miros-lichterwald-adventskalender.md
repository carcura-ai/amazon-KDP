# Compliance-Selbstprüfung — Miros Lichterwald-Adventskalender (finaler Stand autonomer Nachtlauf)

```
STATUS: NICHT FREIGEGEBEN
Geprüft am: 2026-08-25
KDP-Regeln live geprüft: ja (2026-08-25, https://kdp.amazon.com/help/topic/G200672390,
  https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6, https://kdp.amazon.com/en_US/help/topic/G201953020)
Offene Punkte: 3
KI-Einstufung Text: AI-generated
KI-Einstufung Rätselgrafiken: AI-assisted (programmatisch von Claude erzeugter Code, keine Trainingsdaten-Ausgabe eines Diffusionsmodells — Einstufung vor Upload gegen aktuelle KDP-Definition prüfen)
KI-Einstufung Szenenillustrationen/Cover: entfällt — noch nicht produziert (siehe Blocker)
Probeexemplar geprüft: nein
```

## Fortschritt gegenüber der Vorversion (2026-08-25 Nachmittag)

Seitdem: Lektorat mit 7 behobenen Logikfehlern (siehe `lektorat.md`), 24 Rätselgrafiken produziert
und zweimal geprüft, KDP-Maße für Cover und Innenteil live verifiziert, Interior- und Cover-Entwurfs-
PDFs gebaut, Fooocus-Bildgenerierung versucht (Lizenzproblem behoben, Checkpoint geladen, Server
läuft) — an der komplexen internen API-Struktur gescheitert, siehe `druckdaten/README.md`.

## Warum weiterhin NICHT FREIGEGEBEN

1. **Szenen- und Coverillustrationen fehlen** — einziger technischer Blocker, ausführlich
   dokumentiert in `druckdaten/README.md`. Ohne sie keine Druckvorschau, keine
   Figurenkonsistenz-Prüfung, kein finales Cover.
2. **Figurenkonsistenz (Stufe 4) nicht durchgeführt** — direkte Folge von Punkt 1, kein
   Referenzbogen mit echten Bildern möglich.
3. **Kein menschliches Lektorat/Korrektorat** — Claude hat sich selbst zweimal geprüft (Text +
   visuelle Stichprobe der Grafiken), das ersetzt keine unabhängige menschliche Prüfung.

**Nicht mehr offen (seit letzter Version geschlossen):** Rätselgrafiken existieren und sind geprüft,
KDP-Maße sind live verifiziert (nicht mehr „im Vorschautool zu bestätigen"), Cover- und
Interior-Textinhalt ist final, KI-Offenlegung ist korrekt eingestuft.

## Vier Kundenqualität-Fragen (erneut ehrlich beantwortet)

1. Würde ich dieses Buch für mein eigenes Kind kaufen? — Für den Rätselteil: ja, geprüft und
   funktional. Für das Gesamtbuch: **noch nicht beurteilbar** ohne die Szenenillustrationen, die
   laut Konzept die Hälfte jeder Doppelseite ausmachen.
2. Hält das Buch, was Cover und Beschreibung versprechen? — Textlich ja, visuell noch nicht final.
3. Druckvorschau vollständig durchgeblättert? — Entwurfs-PDF (56 Seiten) liegt vor und wurde
   stichprobenartig geprüft (Ränder, Beschnitt, Textüberlauf — keine Probleme gefunden), aber
   **nicht die finale Version mit echten Illustrationen**.
4. Physisches Probeexemplar vorhanden? — Nein (kostenpflichtig, nicht angefordert).

## Nächste Schritte bis zur echten Freigabe

1. Illustrationen produzieren — siehe `druckdaten/README.md` für den empfohlenen manuellen Weg
2. Interior-/Cover-PDF mit echten Bildern neu bauen (`build-interior-pdf.py`, `build-cover.py`
   — beide unverändert einsatzbereit)
3. `character-consistency`-Stufe mit den echten Bildern durchlaufen
4. Menschliches Lektorat/Korrektorat
5. Erneute Prüfung durch `kdp-quality-compliance`
