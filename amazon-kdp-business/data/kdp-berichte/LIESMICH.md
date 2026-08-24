# KDP-Berichte ablegen

Hier kommen die **manuell** aus Ihrem KDP-Konto exportierten Berichte hinein.
Es findet keine automatische Anmeldung und keine Kontoverknüpfung statt.

## So geht es

1. In Ihrem KDP-Konto den gewünschten Bericht herunterladen
   (Tantiemenbericht, Bestellbericht, KENP-Bericht).
2. Datei hier ablegen, nach Monat sortiert:
   `amazon-kdp-business/data/kdp-berichte/JJJJ-MM/dateiname.xlsx`
3. Claude bitten: „Werte die KDP-Berichte für {{Monat}} aus."

Ergebnis landet in `amazon-kdp-business/reports/sales/JJJJ-MM-auswertung.md`
nach Vorlage `templates/08-verkaufs-und-werbeauswertung.md`.

## Wichtig

- Liegt keine Datei vor, wird `keine Daten` geschrieben — **nicht** geschätzt.
- Diese Dateien enthalten Geschäftszahlen. Ob sie in Git gehören, entscheiden Sie;
  standardmäßig sind sie in `.gitignore` ausgenommen.
