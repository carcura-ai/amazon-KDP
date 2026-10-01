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
- KI: Beleg schlecht lesbar → Prüfung statt Buchung

**Dubletten** werden erkannt: dieselbe Datei, dieselbe Rechnungsnummer (Ausgang) oder dieselbe Belegnummer beim
selben Lieferanten (Eingang), bei Belegen ohne Nummer gleicher Lieferant + Datum + Betrag.

## Kunden-Zuordnung (Ausgangsrechnungen)

Reihenfolge der Merkmale: E-Mail, Telefon, Firmenname, Vor- und Nachname, jeweils gestützt durch PLZ und Straße.
Eine abweichende PLZ spricht gegen denselben Kunden. Passen mehrere Kunden gleich gut, wird nichts automatisch
gebucht – unter **Prüfen** den richtigen Kunden wählen. Beim bestehenden Kunden werden nur **leere** Felder ergänzt
(E-Mail, Telefon, Anschrift, Firmenname); vorhandene Daten werden nie überschrieben.

## Korrigieren

- **Prüfen und übernehmen:** Werte im Formular anpassen, Kunde/Kategorie wählen, übernehmen.
- **Erneut auslesen:** z. B. nach dem Einschalten der KI.
- **Verwerfen:** Beleg wird nicht übernommen, Datei gelöscht.
- **Übernahme rückgängig machen:** entfernt die importierte Rechnung bzw. die Ausgaben; ein nur dafür angelegter
  Kunde ohne weitere Daten wird ebenfalls entfernt. Danach kann der Beleg erneut übernommen werden.
- **Importierte Rechnung stornieren:** wird hier nur als storniert gekennzeichnet. Die Stornorechnung selbst im
  Ursprungsprogramm erstellen und anschließend ebenfalls importieren.

## Datenschutz

- E-Rechnungen werden ausschließlich auf dem eigenen Server gelesen.
- Die KI-Texterkennung überträgt den Beleg (inkl. Namen/Anschriften) an Anthropic. Vor dem Einschalten:
  Auftragsverarbeitungsvertrag mit Anthropic abschließen, Datenschutzhinweise ergänzen (rechtliche Prüfung empfohlen).
  Jede Nutzung wird im KI-Nutzungsprotokoll (Datenschutz-Center) festgehalten.
- Ausgelesene Rohdaten werden 180 Tage nach Übernahme entfernt (Rechnung/Ausgabe und Beleg bleiben).
  Bei Löschung/Anonymisierung eines Kunden werden sie sofort entfernt; der Rechnungsbeleg bleibt wegen der
  Aufbewahrungspflicht erhalten.

## Hinweise zu Lexware Office

Lexware Office kann Rechnungen als PDF mit eingebetteten E-Rechnungsdaten (ZUGFeRD) oder als XRechnung ausgeben.
Mit diesen Dateien ist die Übernahme exakt und benötigt keine KI. Ob die eigenen Lexware-PDFs die eingebetteten
Daten enthalten, zeigt der Import: Spalte „Beleg“ → „E-Rechnung (ZUGFeRD)“. Steht dort „Manuell“, enthält die PDF
keine Rechnungsdaten – dann in Lexware Office den E-Rechnungs-Export (ZUGFeRD/XRechnung) verwenden.
