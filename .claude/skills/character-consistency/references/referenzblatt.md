# Referenzblatt

Das Referenzblatt ist die verbindliche Bildvorlage. Alles Spätere richtet sich danach.

## Pflichtansichten

| # | Ansicht | Zweck |
|---|---|---|
| 1 | Vorderansicht, neutral stehend | Proportionen, Farben, Kleidung |
| 2 | Seitenansicht | Schnauzen-/Profillinie, Schwanzansatz, Körpertiefe |
| 3 | Rückansicht | Schwanz, Rückenmuster, Kleidung hinten |
| 4 | Ausdruck fröhlich | Mund-, Augen-, Ohrenstellung |
| 5 | Ausdruck traurig | dito |
| 6 | Ausdruck neugierig | dito |
| 7 | Ausdruck erschrocken | dito |
| 8 | Größenvergleich mit Begleitfigur | Verhältnis über die Reihe konstant |

Ergänzend hilfreich: Hand-/Pfotenblatt (greifend, winkend, zeigend) und
ein Gangbild — beides sind die häufigsten Fehlerquellen.

## Anforderungen an das Blatt

- Alle Ansichten auf **einem** Blatt, gleiche Bildhöhe der Figur
- Neutraler Hintergrund
- Farbfelder mit `#RRGGBB` daneben
- Maßhilfslinien: Kopfhöhe, Gesamthöhe, Augenlinie
- Datum und Versionsnummer

## Freigabeprozess

1. Blatt erzeugen und dem Nutzer vorlegen.
2. Der Nutzer bestätigt **ausdrücklich**. Schweigen ist keine Freigabe.
3. In der Character Bible eintragen:
   `Status: REFERENZBLATT FREIGEGEBEN` + Name + Datum.
4. Ab hier gilt: Änderungen an der Figur nur über eine neue Version
   mit erneuter Freigabe. Laufende Bände behalten ihre Version.

## Versionierung

```
character-bibles/
├── fuchs-{{name}}.md
└── referenz/
    ├── fuchs-{{name}}-v1.png
    └── fuchs-{{name}}-v2.png
```

Version je Band notieren. Ein Band wird nie mitten in der Produktion auf eine
neue Figurenversion umgestellt.
