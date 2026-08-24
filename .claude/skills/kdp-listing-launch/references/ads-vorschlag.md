# Amazon Ads — ausschließlich Vorschlag

## Sperre

Dieser Skill **analysiert und empfiehlt**. Er darf nicht:

- ein Werbekonto verknüpfen oder sich anmelden
- eine Kampagne anlegen, ändern oder pausieren
- ein Budget aktivieren oder erhöhen
- Gebote ändern

Jede dieser Aktionen führt der Nutzer selbst durch, nach ausdrücklicher
Entscheidung. Der Skill liefert dafür einen fertigen Vorschlag zum Abtippen.

## Voraussetzung für einen Ads-Test

Alle Punkte müssen erfüllt sein:

- [ ] Buch veröffentlicht und indexiert
- [ ] Produktseite fehlerfrei
- [ ] Mindestens eine Rezension vorhanden
- [ ] Deckungsbeitrag je Exemplar bekannt
- [ ] Der Nutzer hat ein Budget benannt, das er bereit ist zu verlieren

Ohne den letzten Punkt kein Vorschlag mit Zahlen.

## Vorschlagsstruktur

```
Kampagne 1 — automatisch, Datensammlung
  Zweck:        herausfinden, wonach tatsächlich gesucht wird
  Budget:       niedrig, vom Nutzer festzulegen
  Laufzeit:     mindestens 2 Wochen ohne Eingriff
  Auswertung:   Suchbegriffbericht

Kampagne 2 — manuell, nach Erkenntnissen aus Kampagne 1
  Keywords:     nur belegte Suchbegriffe mit Klicks
  Gebot:        abgeleitet aus Deckungsbeitrag und Conversion
  Negativ:      alles, was Klicks ohne Verkauf erzeugt hat
```

## Gebotslogik

```
Maximal vertretbarer Klickpreis = Deckungsbeitrag × erwartete Conversion
```

Beispiel als Rechenmuster: Deckungsbeitrag 3,00 EUR, Conversion 10 %
⇒ rechnerisch 0,30 EUR je Klick, um kostendeckend zu bleiben.
Die Conversion ist am Anfang **unbekannt** — sie wird gemessen, nicht angenommen.

## Abbruchkriterien vorab festlegen

| Kriterium | Handlung |
|---|---|
| {{n}} Klicks ohne Verkauf | Keyword pausieren |
| ACOS über {{x}} % über 14 Tage | Gebot senken oder pausieren |
| Budget aufgebraucht ohne Verkauf | Kampagne stoppen und auswerten |
| Kein Klick bei ausreichenden Impressionen | Cover und Titel prüfen, nicht das Gebot |

Die Schwellen legt der Nutzer fest. Ohne vorher festgelegte Abbruchkriterien
wird kein Ads-Vorschlag ausgegeben.

## Interpretation

| Beobachtung | Wahrscheinliche Ursache |
|---|---|
| Impressionen, keine Klicks | Cover oder Titel überzeugen in der Liste nicht |
| Klicks, keine Verkäufe | Produktseite, Preis oder Erwartungslücke |
| Verkäufe, aber ACOS zu hoch | Gebote zu hoch oder Marge zu dünn |
| Kaum Impressionen | Gebot zu niedrig oder Keywords zu eng |

Ein Werbeproblem ist häufig ein Cover- oder Erwartungsproblem.
Mehr Budget löst das nicht.

## Externe Ads-Werkzeuge

Der geprüfte Fremd-Skill `MarketplaceAdPros/skill-amazon-ads` wurde **nicht**
installiert: Er setzt einen externen MCP-Server voraus, an den ein Amazon-Ads-Konto
angebunden werden müsste. Eine Kontoverknüpfung ist ohne ausdrückliche Freigabe
gesperrt. Details in `docs/SICHERHEITSPRUEFUNG-FREMDSKILLS.md`.
