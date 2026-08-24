# Prüfmatrix

## Seitenweise Prüfung

Je Seite mit Figur:

| Seite | Fell/Farbe | Augen | Kleidung | Accessoire | Proportionen | Pfoten/Hände | Textartefakte | Hintergrund | Stil | OK |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

Prüfung immer **gegen das Referenzblatt**, nicht gegen die vorherige Seite —
sonst wandert die Figur schleichend weg (Kopierfehler-Drift).

## Prüffragen je Spalte

| Spalte | Frage |
|---|---|
| Fell/Farbe | Stimmen alle Bereiche mit den Hexcodes? Nebeneinanderlegen. |
| Augen | Form, Farbe, Abstand, Pupillengröße wie im Referenzblatt? |
| Kleidung | Alle Teile da, Farbe und Schnitt identisch? |
| Accessoire | Vorhanden, richtig getragen, richtige Seite? |
| Proportionen | Kopfhöhen gleich? Beinlänge, Schwanzlänge? |
| Pfoten/Hände | Anzahl Finger/Zehen korrekt, Form plausibel? |
| Textartefakte | Keine Buchstaben, Zeichen oder Signaturen im Bild? |
| Hintergrund | Wiederkehrende Ortselemente konsistent? |
| Stil | Linienstärke, Schattierung, Detailgrad wie im Rest des Bandes? |

## Kontaktbogen

Nach der Einzelprüfung alle Seiten verkleinert nebeneinander betrachten.
Erst dort fallen Drift in Farbe, Detailgrad und Linienstärke auf.

Prüffragen: Wirkt es wie ein Buch aus einer Hand? Sticht eine Seite heraus?
Ändert sich die Figur zwischen Anfang, Mitte und Ende?

## Bandübergreifende Prüfung

Vor Produktionsstart eines neuen Bandes:

- [ ] Gleiche Referenzblatt-Version wie im Vorband? Wenn nein: bewusst entschieden?
- [ ] Figur im direkten Vergleich Band n-1 / Band n identisch?
- [ ] Accessoire unverändert?
- [ ] Farbpalette identisch (Leitfarbe des Bandes ausgenommen)?
- [ ] Stilblock wortgleich übernommen?
- [ ] Nebenfiguren unverändert?

## Umgang mit Abweichungen

| Schwere | Beispiel | Vorgehen |
|---|---|---|
| leicht | Farbton minimal daneben | neu erzeugen |
| mittel | Accessoire fehlt, Kleidung falsch | neu erzeugen |
| schwer | falsche Proportionen, falsche Figur | neu erzeugen, Prompt prüfen |
| systematisch | mehrere Seiten driften gleichartig | Prompt-Baustein prüfen, betroffenen Block neu erzeugen |

**Nie retuschieren.** Neu erzeugen ist billiger als ein Buch, dem man den Bruch ansieht.

## Ergebnis

```
FIGURENKONSISTENZ: BESTANDEN | NICHT BESTANDEN
Geprüfte Seiten: nn
Referenzblatt-Version: vn
Abweichungen: nn (Liste)
```

Ohne `BESTANDEN` gibt `kdp-quality-compliance` kein `READY FOR HUMAN APPROVAL`.
