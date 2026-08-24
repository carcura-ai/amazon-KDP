# Prompt-Bausteine für Bildgenerierung

## Grundsatz

Ein **wortgleicher** Textblock für alle Bilder eines Bandes. Nur der Szenenteil ändert sich.
Jede Umformulierung des Stilblocks erzeugt Abweichungen.

## Aufbau

```
[1 FIGURENBLOCK — unveränderlich, aus der Character Bible]
Art, Alterseindruck, Proportionen in Kopfhöhen,
Fellfarben mit Hexcodes je Körperbereich,
Augenform/-farbe, Pupillengröße,
Kleidung mit Hexcodes, Accessoire.

[2 STILBLOCK — unveränderlich]
Linienart und -stärke, Farbauftrag, Schattierung,
Detailgrad, Hintergrundtiefe, Gesamtstimmung.

[3 SZENENBLOCK — variiert je Doppelseite]
Ort, Tageszeit, Wetter, Pose, Ausdruck, Perspektive,
Bildaufbau, Textfreiraum.

[4 VERBOTSBLOCK — unveränderlich]
Keine Schrift im Bild. Keine Marken oder Logos.
Keine realen Personen. Keine geschützten Figuren.
Kein Stil eines benennbaren lebenden Künstlers.
Kein Fotorealismus.
```

## Beispielgerüst (Platzhalter ersetzen)

```
Ein {{Art}}, wirkt wie {{Alter}} Jahre, {{n}} Kopfhöhen hoch.
Fell {{#RRGGBB}}, Bauch und Brust {{#RRGGBB}}, Schwanzspitze {{#RRGGBB}},
Ohrinnenseite {{#RRGGBB}}. Augen {{Form}}, {{#RRGGBB}}, Pupillen {{Größe}}.
Trägt {{Kleidungsstück}} in {{#RRGGBB}} und {{Accessoire}}.

Stil: {{Linienart}}, {{Farbauftrag}}, {{Schattierung}},
{{Detailgrad}}, {{Hintergrundtiefe}}.

Szene: {{…}}

Nicht darstellen: Schrift im Bild, Marken, Logos, reale Personen,
geschützte Figuren, Künstlerimitation, Fotorealismus.
```

## Referenzbilder

Wo das Werkzeug es zulässt, immer das freigegebene Referenzblatt mitgeben.
Textbeschreibung allein hält Figuren über 40+ Bilder nicht stabil.

## Häufige Fehlerquellen

| Fehler | Gegenmaßnahme |
|---|---|
| Farbe driftet über die Bilder | Hexcodes in jedem Prompt, Kontaktbogen prüfen |
| Pfoten/Hände falsch | Pfotenblatt mitgeben, Pose einfach halten |
| Augen ändern Größe/Abstand | Pupillengröße als Verhältnis angeben |
| Accessoire verschwindet | im Figurenblock als „immer sichtbar" markieren |
| Schrift erscheint im Bild | Verbotsblock, danach prüfen |
| Hintergrund wechselt | wiederkehrende Elemente je Ort festschreiben |
| Proportionen kippen | Kopfhöhen im Prompt nennen |
| Stil ändert sich zur Buchmitte | Stilblock wortgleich, nie „verbessern" |

## Protokoll

Je Bild festhalten: Prompt-Version, Werkzeug, Datum, Seite, Prüfergebnis.
Ablage `amazon-kdp-business/books/series/{{reihe}}/band-{{n}}/bildprotokoll.md`.
Das ist zugleich die Grundlage für die KI-Angabe gegenüber KDP.
