# Lektoratsbericht — Miros Lichterwald-Adventskalender

Geprüft: 2026-08-25. Umfang: `manuskript.md`, `seitenplan.md`, `briefing.md`. Fokus laut Auftrag:
Rechtschreibung, Eindeutigkeit und Lösbarkeit jedes Rätsels für Kinder von 3–5 Jahren.

## Rechtschreibung/Grammatik

Vollständige Durchsicht aller kindgerichteten Sätze und aller Lösungstexte — keine Rechtschreib-
oder Grammatikfehler gefunden. **Einschränkung:** Dies ist Claudes eigene Prüfung des von Claude
geschriebenen Texts, kein unabhängiges menschliches Korrektorat — bleibt laut Prüfpflicht-Tabelle in
`briefing.md` vor Veröffentlichung nötig.

## Satzlänge gegen `sprache-und-alter.md`

Die Zielspanne 3–5 Jahre überschneidet zwei Tabellenbänder (2–3 Jahre: max. 6 Wörter; 4–5 Jahre:
max. 10 Wörter). Die kindgerichteten Sätze im Manuskript liegen durchgängig bei 6–9 Wörtern — für
die obere Altersgrenze (5 Jahre) passend, für das untere Ende (3 Jahre) am oberen Rand des
Vertretbaren. **Bewertung:** vertretbar, da das Buch laut `briefing.md` durchgängig von einer
erwachsenen Person vorgelesen wird (Zielgruppe kann noch nicht selbst lesen) — die 2–3-Jahre-Grenze
gilt primär für selbstständiges Verarbeiten, nicht für vorgelesene Inhalte. **Empfehlung für das
menschliche Lektorat:** bei sehr jungen 3-Jährigen ggf. situativ weiter vereinfachen; kein
Korrekturbedarf am Manuskript selbst.

## Gefundene und korrigierte Logikfehler (Eindeutigkeit/Lösbarkeit)

Vor dieser Prüfung enthielt das Manuskript drei Klassen von Solvability-Problemen für die
Altersgruppe. Alle wurden direkt im Manuskript korrigiert (siehe `manuskript.md` für den Wortlaut):

| # | Tag(e) | Problem | Korrektur |
|---|---|---|---|
| 1 | Tag 4 | Instruktion fragte nach „Schal" (Einzahl), Lösung nannte drei verschiedene Kleidungsstücke — Widerspruch | Instruktion angepasst, Farbcode als Lösungsregel ergänzt |
| 2 | Tag 12 | Zuordnung Laternenform↔Tier ohne erkennbare Regel — für ein 3-Jähriges Kind nicht durch Schlussfolgern lösbar, nur durch Raten oder Auswendiglernen der Lösung | Farbcode-Regel ergänzt (Laterne hat Farbe des Tieres), Instruktion nennt die Regel explizit |
| 3 | Tag 20 | Zuordnung Gegenstand↔Tier implizit über Charaktereigenschaften — für die Altersgruppe zu abstrakt | Farbcode-Regel ergänzt, Story-Logik bleibt als Bonus für Vorleser erhalten |
| 4 | Tag 2, 10, 18 (Punkte verbinden) | Sternform/Baumform bei falscher Punkt-Reihenfolge (z. B. im Kreis statt im Zickzack) nicht garantiert — Illustration Brief enthielt keine Konstruktionsvorgabe | Konstruktionshinweis ergänzt: Punkte müssen in Zickzack-/Pentagramm-Reihenfolge nummeriert sein |
| 5 | Tag 8, 16 (Schattenrätsel) | Keine Vorgabe zur Unterscheidbarkeit der Silhouetten — Risiko zu feiner/ähnlicher Schatten für 3-Jährige | Solvability-Hinweis ergänzt: Größe und Umriss müssen sich stark unterscheiden |
| 6 | Tag 7, 15, 23 (Ausmalen nach Muster) | Musterregel nur als Text — für 3-Jährige ohne visuelles Vorbild nicht selbstständig ableitbar | Solvability-Hinweis ergänzt: erste 1–2 Musterglieder müssen vorgemalt sein |

Zusätzlich neu angelegt: `character-bibles/nebenfiguren.md` mit festen Farbcodes für Waldtante Rosa,
Igel und Maus — Voraussetzung dafür, dass die Farbcode-Lösungen in Tag 4/12/20 überhaupt konsistent
umsetzbar sind.

## Rätsel ohne Befund (Eindeutigkeit bereits gegeben)

Labyrinthe (Tag 1, 9, 17), Zählaufgaben (Tag 3, 11, 19), Suchbilder (Tag 5, 13, 21, 24) und
Schwungübungen (Tag 6, 14, 22) haben je genau eine richtige Lösung ohne Zusatzregel-Bedarf — bei
Schwungübungen ist laut Konzept explizit jede Ausführung „richtig" (keine Lösbarkeitsanforderung).

## Zweite Prüfrunde — nach visueller Kontrolle der generierten Rätselgrafiken (2026-08-25)

Nach Erzeugung der 24 Rätselgrafiken (`scripts/generate-raetselgrafiken.py`) wurden Stichproben visuell
geprüft. Dabei ein weiterer Fehler gefunden und behoben:

| # | Tag | Problem | Korrektur |
|---|---|---|---|
| 7 | Tag 4 | Textlabel „Roter Schal" stimmte nicht mit der tatsächlich gerenderten Farbe (türkis, Miros Schwanzspitzenfarbe) überein — Text und Grafik widersprachen sich | Label auf „Türkiser Schal" korrigiert, in `manuskript.md` und `generate-raetselgrafiken.py` synchron gehalten |

Labyrinth (Tag 1) und Punkte-verbinden (Tag 2, Pentagramm-Reihenfolge) stichprobenartig visuell
geprüft — Labyrinth hat einen eindeutigen Weg, Sternform entsteht korrekt aus der Punktreihenfolge.
**Empfehlung:** vor Druckfreigabe alle 24 generierten Grafiken einmal vollständig durchsehen (nicht nur
Stichprobe) — das ist der Sinn von Prüfpunkt „Rätselgrafiken selbst mit Lösungstext gegenprüfen" in
`illustration-briefs.md`, hier nur teilweise durchgeführt.

## Verbleibender offener Punkt

Die tatsächliche Zeichnung (Labyrinth-Wegführung, exakte Objektzahlen, Musterfolgen) existiert noch
nicht — diese Lektoratsprüfung deckt Text und Konzept ab, nicht die finale Illustration. Nach
Illustrationsproduktion: jede Rätselseite gegen ihre hier dokumentierte Lösung gegenprüfen (siehe
Prüfpunkt in `illustration-briefs.md`, Abschnitt Konsistenzprüfung).

## Ergebnis

Text- und Konzeptstufe: **lektoriert, Korrekturen angewendet.** Menschliches Korrektorat vor
Veröffentlichung weiterhin erforderlich (siehe `briefing.md`, Prüfpflicht-Tabelle).
