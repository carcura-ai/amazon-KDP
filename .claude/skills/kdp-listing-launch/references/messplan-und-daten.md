# Messplan und Datenimport

## Kennzahlen

| Kennzahl | Quelle | Rhythmus | Aussage |
|---|---|---|---|
| Verkäufe je Titel | KDP-Bericht | wöchentlich | Grundnachfrage |
| Gelesene Seiten (KENP) | KDP-Bericht | wöchentlich | nur bei KDP Select |
| Tantieme | KDP-Bericht | monatlich | tatsächlicher Ertrag |
| Retouren | KDP-Bericht | monatlich | Erwartungslücke |
| Rang in Kategorie | Produktseite | wöchentlich | relative Sichtbarkeit |
| Rezensionen | Produktseite | wöchentlich | Vertrauen, Kritikmuster |
| Impressionen | Ads-Bericht | wöchentlich | nur bei aktiven Kampagnen |
| Klickrate | Ads-Bericht | wöchentlich | Cover-/Titelwirkung |
| Conversion | Ads-Bericht | wöchentlich | Produktseitenwirkung |
| Kosten / ACOS | Ads-Bericht | wöchentlich | Wirtschaftlichkeit |
| Durchverkauf Band 1 → Band 2 | eigene Rechnung | monatlich | Reihenwirkung |

## Datenimport (manuell, ohne Kontoverknüpfung)

Der Nutzer hat ein bestehendes KDP-Konto. Berichte werden **manuell** exportiert —
der Skill meldet sich nicht an und greift nicht auf das Konto zu.

1. Der Nutzer lädt den Bericht in seinem KDP-Konto herunter
2. Ablage in `amazon-kdp-business/data/kdp-berichte/JJJJ-MM/`
3. Der Skill liest die Datei lokal und wertet sie aus
4. Ergebnis nach `amazon-kdp-business/reports/sales/JJJJ-MM-auswertung.md`
   nach Vorlage `templates/08-verkaufs-und-werbeauswertung.md`

Liegt keine Datei vor: `keine Daten` schreiben. Nicht schätzen, nicht hochrechnen.

## Auswertungsregeln

- Zeiträume gleicher Länge vergleichen
- Saison berücksichtigen — Dezember gegen Februar ist kein Vergleich
- Bei kleinen Zahlen keine Prozentangaben (von 1 auf 2 Verkäufe sind keine „+100 %")
- Einzelwochen sind Rauschen; belastbar wird es ab etwa vier Wochen
- Rezensionstext ist die wertvollste Quelle für die nächste Auflage

## Entscheidung über Folgebände

| Beobachtung nach 4–8 Wochen | Ableitung |
|---|---|
| Stetige Verkäufe, gute Bewertungen | Band 2 produzieren |
| Verkäufe, aber wiederkehrende Kritik | Kritik in Band 2 einarbeiten |
| Kaum Verkäufe, gute Bewertungen | Sichtbarkeitsproblem: Cover, Titel, Keywords prüfen |
| Kaum Verkäufe, kaum Sichtbarkeit | Nische erneut validieren |
| Verkäufe mit hohen Retouren | Erwartungslücke im Listing schließen |

Die Entscheidung trifft der Nutzer. Der Skill liefert die Grundlage.
