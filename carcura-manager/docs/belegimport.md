# Belegimport: Rechnungen hochladen und automatisch erfassen

Menü **Belege importieren** (sichtbar mit dem Recht „Rechnungen bearbeiten“ und/oder „Finanzen bearbeiten“).

## Zwei Bereiche

| Bereich | Wofür | Ergebnis |
|---|---|---|
| **Ausgangsrechnungen** | eigene Rechnungen aus einem anderen Programm, z. B. **Lexware Office** | Rechnung unter „Rechnungen“ mit Originalnummer, Positionen und Beträgen; Kunde zugeordnet oder neu angelegt; Originalbeleg im Kundenprofil |
| **Eingangsrechnungen** | Rechnungen von Händlern und Lieferanten, Kassenbons | Ausgabe(n) unter „Finanzen → Ausgaben“ mit Lieferant, Belegnummer, Datum, Fälligkeit, Netto/MwSt./Brutto (je Steuersatz), Kategorie; Beleg angehängt |

Erlaubt: PDF, Fotos (JPG, PNG, WebP), E-Rechnungen als XML. Mehrere Dateien gleichzeitig per Ziehen und Ablegen;
auf dem Smartphone zusätzlich „Foto aufnehmen“. Max. 25 MB je Datei.

## Wie die Daten gelesen werden

1. **E-Rechnung (ohne KI, exakt):** PDFs mit eingebetteten Rechnungsdaten (ZUGFeRD/Factur-X – Lexware Office erzeugt
   diese) und XRechnung-Dateien (CII oder UBL). Alle Werte werden 1:1 übernommen.
2. **Texterkennung (KI, optional):** Fotos und PDFs ohne Rechnungsdaten. Nur wenn unter „Belege importieren“ die
   KI-Texterkennung eingeschaltet **und** unter Einstellungen → Integrationen ein Anthropic-API-Key hinterlegt ist.
   Ohne KI landen solche Belege in **Prüfen** und werden dort im Formular neben der Belegansicht erfasst.

## Automatische Prüfung

Übernommen wird nur, wenn alles zusammenpasst. Sonst steht der Beleg unter **Prüfen** mit dem Grund:

- Pflichtangaben vorhanden (Datum, Betrag, Rechnungsnummer bei Ausgangsrechnungen, Kunde bzw. Lieferant)
- Netto + MwSt. = Brutto; Summe der Positionen passt zum Nettobetrag (Abweichung = Hinweis)
- Richtung plausibel (eine an Carcura gerichtete Rechnung im Bereich „Ausgangsrechnungen“ wird erkannt)
- Währung EUR, Datum nicht in der Zukunft
- Steueraufteilung passt zu den Summen; Steuersatz eindeutig (19 %, 7 % oder 0 %)
- Rechnungskorrekturen (Typ 384) werden nie automatisch gebucht
- KI: Beleg schlecht lesbar → Prüfung statt Buchung; eigene Ausgangsrechnungen aus der Texterkennung werden nur bei
  sicherer Erkennung automatisch gebucht, der Zahlstatus wird dabei nie aus der Texterkennung übernommen

**Dubletten** werden erkannt: dieselbe Datei, dieselbe Rechnungsnummer (Ausgang) oder dieselbe Belegnummer beim
selben Lieferanten (Eingang), bei Belegen ohne Nummer gleicher Lieferant + Datum + Betrag.

## Kunden-Zuordnung (Ausgangsrechnungen)

Automatisch zugeordnet wird nur bei einem **starken Merkmal**: gleiche E-Mail, gleiche Telefonnummer oder gleicher
Name bzw. Firmenname **und** gleiche PLZ/Straße. Firmen werden nur über den Firmennamen (ohne Rechtsform) verglichen,
nie über den Ansprechpartner. Eine abweichende PLZ spricht gegen denselben Kunden.
- Nur über den Namen erkannt → **Prüfen** mit vorgeschlagenem Kunden (bestätigen oder neu anlegen).
- Mehrere gleich gute Treffer → **Prüfen**, Kunde muss gewählt werden.
- Beim bestehenden Kunden werden nur **leere** Felder ergänzt (E-Mail, Telefon, Anschrift); vorhandene Daten,
  Kundentyp und Firmenname werden nie verändert.

## Korrigieren

- **Prüfen und übernehmen:** Werte im Formular anpassen, Kunde/Kategorie wählen, übernehmen.
- **Erneut auslesen:** z. B. nach dem Einschalten der KI.
- **Verwerfen:** Beleg wird nicht übernommen, Datei gelöscht.
- **Übernahme rückgängig machen:** entfernt die importierte Rechnung bzw. die Ausgaben; ein nur dafür angelegter
  Kunde wird nur entfernt, wenn es zu ihm sonst nichts gibt (keine Notizen, Termine, Fahrzeuge, Dateien …).
  Nicht möglich, sobald Zahlungen erfasst, die Rechnung aus der Software versendet oder storniert wurde.
  Der Beleg steht danach wieder unter **Prüfen**.
- **Zwei gleiche Kassenbons ohne Nummer** (gleicher Händler, Tag, Betrag): der zweite wird als mögliche Dublette
  angehalten und kann mit „Kein Duplikat – trotzdem erfassen“ übernommen werden.
- **Storno aus Lexware Office:** die Stornorechnung/Gutschrift einfach importieren. Verweist sie auf die ursprüngliche
  Rechnungsnummer und entspricht dem vollen Betrag (gleicher Kunde), wird die Rechnung automatisch als storniert
  verknüpft; beide zählen dann nicht mehr zum Umsatz. Ohne Bezugsnummer wird nur verknüpft, wenn genau eine bereits
  als storniert gekennzeichnete Rechnung desselben Kunden über denselben Betrag existiert. Umgekehrt: Wird eine
  importierte Rechnung als storniert gekennzeichnet und gibt es genau eine passende, noch nicht zugeordnete
  importierte Gutschrift, wird diese verknüpft. So wird der Umsatz nie doppelt gemindert. Teilgutschriften werden
  nicht verknüpft (Hinweis am Beleg).
- **Falsch verknüpfte Gutschrift:** Übernahme der Gutschrift rückgängig machen – die Rechnung erhält ihren vorherigen
  Status zurück. (Die Rechnung selbst kann erst danach zurückgenommen werden.)
- **Mehrere Steuersätze:** im Prüfformular „MwSt.-Satz → mehrere Sätze“ wählen und die Aufteilung (Satz, Netto, MwSt.)
  erfassen; Netto, MwSt. und Brutto ergeben sich daraus. Die befristeten Sätze 16 %/5 % (Juli–Dezember 2020) werden
  erkannt. Ausländische Umsatzsteuer auf Eingangsbelegen: 0 % wählen (Bruttobetrag als Kosten) – im Zweifel mit
  dem Steuerberater klären.

## Datenschutz

- E-Rechnungen werden ausschließlich auf dem eigenen Server gelesen.
- Die KI-Texterkennung überträgt den Beleg (inkl. Namen/Anschriften) an Anthropic. Vor dem Einschalten:
  Auftragsverarbeitungsvertrag mit Anthropic abschließen, Datenschutzhinweise ergänzen (rechtliche Prüfung empfohlen).
  Jede Nutzung wird im KI-Nutzungsprotokoll (Datenschutz-Center) festgehalten.
- Ausgelesene Rohdaten werden 180 Tage nach Übernahme entfernt (Rechnung/Ausgabe und Beleg bleiben). Verworfene
  Belege und Dubletten werden nach 180 Tagen samt Datei gelöscht. **Offene Belege** (Prüfen, Fehler, zurückgenommen)
  bleiben samt Original erhalten, bis sie übernommen oder verworfen werden – sie können aufbewahrungspflichtig sein.
  Bei Löschung/Anonymisierung eines Kunden werden seine Importdaten sofort entfernt – auch aus Ausgangsrechnungs-
  Belegen in der Prüfung, deren Empfänger eindeutig dieser Kunde ist (gleiche E-Mail, Telefonnummer, vollständiger
  Name oder Firmenname); der Rechnungsbeleg selbst bleibt wegen der Aufbewahrungspflicht erhalten.

## Hinweise zu Lexware Office

Lexware Office kann Rechnungen als PDF mit eingebetteten E-Rechnungsdaten (ZUGFeRD) oder als XRechnung ausgeben.
Mit diesen Dateien ist die Übernahme exakt und benötigt keine KI. Ob die eigenen Lexware-PDFs die eingebetteten
Daten enthalten, zeigt der Import: Spalte „Beleg“ → „E-Rechnung (ZUGFeRD)“. Steht dort „Manuell“, enthält die PDF
keine Rechnungsdaten – dann in Lexware Office den E-Rechnungs-Export (ZUGFeRD/XRechnung) verwenden.

## Sicherheit

E-Rechnungen werden mit einem eigenen, abgesicherten Leser verarbeitet (keine externen Verweise/DTD, Grenzen für
Größe, Verschachtelung und Laufzeit). PDFs werden vor dem Speichern geprüft: erlaubt sind nur eingebettete
Rechnungs-XML-Dateien; jeder Anhang-Verweis (auch indirekt) muss auf eine solche Rechnungs-XML zeigen. Skripte,
Startaktionen und sonstige Anhänge – auch versteckt oder maskiert – werden abgewiesen. PDFs, deren Inhalt sich nicht
vollständig prüfen lässt (passwortgeschützt/verschlüsselt, beschädigt, übergroße komprimierte Bereiche), werden mit
Hinweis abgewiesen: ungeschützt speichern („Drucken → Als PDF speichern“) oder als Foto hochladen.
Geprüft u. a. mit echten Beispielrechnungen (ZUGFeRD 1.0/2.x, XRechnung CII/UBL der KoSIT).
