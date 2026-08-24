---
name: character-consistency
description: Legt pro Hauptfigur eine Character Bible mit Farbcodes, Proportionen, Ansichten und Prüfmatrix an und hält Figuren über alle Seiten und Bände einer Kinderbuchreihe optisch identisch. Nutzen bei wiederkehrenden Figuren, Figurenkonsistenz, Referenzblättern, Stilvorgaben für Illustrationen, KI-Bildgenerierung von Figuren oder wenn eine Figur zwischen Seiten unterschiedlich aussieht.
---

# Character Consistency

Eine Figur muss auf Seite 3 und auf Seite 87 dieselbe sein — und in Band 3 auch noch.
Kinder erkennen Abweichungen sofort.

## Harte Regel

**Ohne freigegebenes Referenzblatt startet keine Buchproduktion.**

Ablauf: Character Bible schreiben → Referenzblatt erzeugen → dem Nutzer vorlegen →
Freigabe abwarten → Status auf `REFERENZBLATT FREIGEGEBEN` setzen → erst dann Seiten produzieren.

## Ablauf

1. **Character Bible anlegen** je Hauptfigur nach
   `amazon-kdp-business/templates/04-character-bible.md`.
   Ablage: `amazon-kdp-business/character-bibles/{{figur}}.md`.
2. **Farbcodes festschreiben.** Jede Farbe als `#RRGGBB`. „Orange" ist keine Festlegung.
3. **Referenzblatt erzeugen**: Vorder-, Seiten-, Rückansicht, vier Gesichtsausdrücke,
   Größenvergleich mit Begleitfigur. Details in `references/referenzblatt.md`.
4. **Freigabe einholen** — ausdrücklich, vom Nutzer.
5. **Prompt-Baustein fixieren** — `references/prompt-bausteine.md`.
6. **Jede Seite prüfen** — `references/pruefmatrix.md`.
7. **Bandübergreifend prüfen** vor jedem neuen Band.

## Was festgelegt wird

| Bereich | Beispiele |
|---|---|
| Grundmerkmale | Art, Alterseindruck, Proportionen in Kopfhöhen |
| Farben | Fell, Bauch, Schwanzspitze, Ohrinnenseite, Nase, Augen — je `#RRGGBB` |
| Gesicht | Augenform, Pupillengröße, Nasenform, Mundbreite, Augenbrauen |
| Kleidung | Teile, Farben, Schnitt, immer sichtbar ja/nein |
| Accessoires | genau eines als Markenzeichen, mit Funktion in der Handlung |
| Unveränderlich | Liste der Merkmale, die auf jedem Bild identisch sind |
| Zulässig variabel | Ausdruck, Pose, Blickrichtung |
| Unzulässig variabel | Farben, Proportionen, Kleidungsform, Stil |
| Stil | Linien, Schattierung, Farbauftrag, Detailgrad, Hintergrundtiefe |

## Verbote

- Kein Stil, der einen benennbaren lebenden Künstler imitiert
- Keine geschützten Figuren als Vorlage oder Vergleich
- Keine Marken, Logos oder Produktformen im Design
- Keine Fotorealismus-Darstellung von Kindern

## Bei KI-Bildgenerierung

Immer mitgeben: fixer Prompt-Baustein, Referenzbilder, Farbcodes, Stilbeschreibung.
Danach Prüfmatrix anwenden. Typische Fehlerquellen: Pfoten und Hände,
Augenabstand und Pupillengröße, Kleidungsdetails, Körperproportionen,
Schriftartefakte im Bild, wechselnde Hintergrundelemente, Anzahl der Gliedmaßen.

**Abweichung ⇒ Bild neu erzeugen, nicht nachbessern.** Retusche erzeugt einen
zweiten, leicht abweichenden Stand — genau das soll verhindert werden.

Jede KI-Bildnutzung wird in `amazon-kdp-business/data/ki-einstufung.md` vermerkt.

## Referenzen

| Datei | Wofür |
|---|---|
| `references/referenzblatt.md` | Aufbau, Ansichten, Freigabeprozess |
| `references/prompt-bausteine.md` | fixer Textblock, Aufbau, Fehlerquellen |
| `references/pruefmatrix.md` | Seitenprüfung, bandübergreifende Prüfung |
