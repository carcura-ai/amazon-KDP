# Amazon-KDP-System — deutschsprachige Kinderbücher

Ein Arbeitssystem für hochwertige deutschsprachige Kinder-, Lern-, Beschäftigungs-,
Rätsel- und Arbeitsbücher auf amazon.de. Es prüft Ideen datenbasiert, entwickelt
Reihen mit konsistenten Figuren, hält die KDP-Regeln ein und bereitet druckfertige
Dateien und Listings vor.

**Es ist ausdrücklich kein System für massenhaft erzeugte KI-Bücher.**

## Schnellstart

```bash
# Skills als persönliche Skills installieren (mit Backup gleichnamiger Skills)
./scripts/install-skills.sh

# Gesamtprozess starten
claude
> /kdp-business-orchestrator

# Wöchentlicher Trendbericht
> /kdp-weekly-scan
# oder unbeaufsichtigt:
./scripts/kdp-weekly-scan.sh
```

## Die acht Stufen

```
1 Trendrecherche      kdp-trend-scout            → Trendbericht + CSV
2 Validierung         kdp-opportunity-validator  → Scorecard, ≥ 70 Punkte für STARTEN
3 Buchentwicklung     kinderbuch-entwickler      → Briefing, Seitenplan, Reihenkonzept
4 Figurenkonsistenz   character-consistency      → Character Bible + Referenzblatt
5 Produktion          (Text + Illustration)      → Manuskript, Bilder, Druckdateien
6 Qualität/Compliance kdp-quality-compliance     → READY FOR HUMAN APPROVAL
7 Listing & Launch    kdp-listing-launch         → Listing-Entwurf, Preis, Messplan
8 Auswertung          (Verkaufsbericht)          → Entscheidung über Folgebände
```

Keine Stufe wird stillschweigend übersprungen. Die Stufen 2, 4 und 6 sind
harte Tore und werden nie übersprungen.

## Drei Regeln, die alles tragen

**1 Keine erfundenen Zahlen.** Jede Zahl trägt Quelle und Prüfdatum.
Nicht live geprüft ⇒ `[NICHT VERIFIZIERT]`. BSR-Ableitungen ⇒ `[SCHÄTZUNG]`
mit Rechenweg. Fehlt eine Zahl, steht dort `keine Daten` — nichts wird aufgefüllt.

**2 Unter 70 Punkten keine Produktion.** Ohne Ausnahme, auch nicht testweise.

**3 Sechs Aktionen bleiben beim Menschen.** Anmeldung und Zugangsdaten ·
Kontoverknüpfung · Veröffentlichung, Löschung, Preisänderung · kostenpflichtige
Exemplare · Werbebudgets · Käufe. Details:
`.claude/skills/kdp-business-orchestrator/references/freigabe-regeln.md`

## Ordner

```
amazon-kdp-business/
├── research/raw/         Rohdaten und Abrufprotokolle je Recherche
├── research/validated/   Scorecards mit Entscheidung
├── books/series/         Reihen, Bände, Manuskripte, Listings
├── character-bibles/     Figurendefinitionen und Referenzblätter
├── templates/            8 Vorlagen
├── reports/trends/       Trendberichte
├── reports/compliance/   Prüfberichte vor Veröffentlichung
├── reports/sales/        Verkaufs- und Werbeauswertungen
└── data/                 status.md · protokoll.md · ki-einstufung.md · kdp-berichte/
```

## Skills

| Skill | Aufgabe |
|---|---|
| `kdp-business-orchestrator` | steuert alle Stufen, führt Status, blockiert gesperrte Aktionen |
| `kdp-trend-scout` | Themen, Suchbegriffe, Saisonchancen — belegt oder als unbelegt markiert |
| `kdp-opportunity-validator` | 100-Punkte-Bewertung, ≥ 10 Wettbewerbstitel, Entscheidung |
| `kinderbuch-entwickler` | Konzept, Seitenplan, Text, Illustration Briefs, Reihe ab 3 Bänden |
| `character-consistency` | Character Bible, Referenzblatt, Prüfmatrix je Seite |
| `kdp-quality-compliance` | letzte Prüfstufe, KI-Angaben, Rechte, Druckdaten |
| `kdp-listing-launch` | Titel, Beschreibung, 7 Keywords, Preis, Startplan, Messplan |
| `ebook-publishing` | Fremd-Skill (MIT), Nachschlagewerk — US-lastig, undatiert |

## Erster Schwerpunkt

Deutschsprachige Kinderbuchmarke mit einer wiederkehrenden **eigenen Fuchsfigur**:

- Beschäftigungsbücher für Autofahrt, Reise, Restaurant, Regentag, Urlaub
- Vorschul- und Lernbücher mit eng definierter Altersgruppe
- Geschichten zu Kindergartenstart, Zahnarzt, Freundschaft, Selbstvertrauen, Angst, Wut
- regionale Abenteuer in Westerwald, Oberbergischem Kreis, Köln
- zusammenhängende Reihen, jeder Band eigenständig lesbar

## KI-Angabe gegenüber KDP

Amazon verlangt die Angabe KI-**generierter** Inhalte auch dann, wenn sie danach
stark bearbeitet wurden. KI-**unterstützte** Ideenfindung oder Korrektur eines
selbst erstellten Inhalts wird getrennt behandelt.

Die geltenden Regeln werden vor **jeder** Veröffentlichung live geprüft:
- https://kdp.amazon.com/help/topic/G200672390
- https://kdp.amazon.com/en_US/help/topic/G7BBN68RYX5UMDZF

Laufende Dokumentation: `amazon-kdp-business/data/ki-einstufung.md`

## Weitere Dokumente

| Datei | Inhalt |
|---|---|
| `docs/SICHERHEITSPRUEFUNG-FREMDSKILLS.md` | Prüfung aller fünf Fremdquellen mit Befund |
| `docs/TRENDUEBERWACHUNG.md` | Startbefehl und optionaler Wochenplan |
| `docs/INSTALLATION.md` | Einrichtung auf einem neuen Rechner |
