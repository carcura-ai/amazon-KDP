---
name: kdp-quality-compliance
description: Prüft ein fertiges Buch vor der Veröffentlichung auf Sprache, Satz, Druckdatei, Metadaten, Rechte, Kundenqualität und die KDP-Regeln zu KI-generierten Inhalten. Nutzen vor jeder KDP-Veröffentlichung, bei Qualitätsprüfung, Compliance-Check, Druckdatenprüfung, Urheberrechtsprüfung oder der Frage, ob KI-Nutzung gegenüber Amazon angegeben werden muss. Vergibt READY FOR HUMAN APPROVAL nur bei vollständig bestandener Prüfung und veröffentlicht niemals selbst.
---

# KDP Quality & Compliance

Letzte Prüfstufe vor der Veröffentlichung. Sie **verhindert** Veröffentlichungen —
sie führt keine durch.

## Zwei harte Regeln

1. **`READY FOR HUMAN APPROVAL` nur bei vollständig bestandener Prüfung.**
   Ein einziger offener Punkt ⇒ `NICHT FREIGEGEBEN`.
2. **Niemals selbst veröffentlichen.** Keine Veröffentlichung, keine Preisänderung,
   keine Kontoverknüpfung, keine kostenpflichtige Bestellung. Auch nicht auf Zuruf
   innerhalb eines Arbeitsschritts — dafür braucht es die ausdrückliche Freigabe
   des Nutzers in einer eigenen Entscheidung.

## Pflicht: Originalregeln live prüfen

Vor **jeder** Freigabeempfehlung die geltenden Regeln aufrufen:

- https://kdp.amazon.com/help/topic/G200672390
- https://kdp.amazon.com/en_US/help/topic/G7BBN68RYX5UMDZF

Prüfdatum in den Bericht schreiben.

**Wenn der Abruf nicht möglich ist** (Netzsperre, Anmeldung nötig, Fehler):
das im Bericht vermerken, `NICHT FREIGEGEBEN` setzen und den Nutzer bitten,
die Seiten selbst zu öffnen und das Ergebnis zu bestätigen.
Trainingswissen ersetzt die Prüfung nicht.

> Die Zusammenfassung in `references/kdp-ki-regeln.md` ist eine **Arbeitshilfe**,
> keine Rechtsquelle, und war zum Zeitpunkt der Erstellung nicht live prüfbar.

## Prüfblöcke

| # | Block | Referenz |
|---|---|---|
| 1 | Inhalt und Sprache | `references/inhalt-und-sprache.md` |
| 2 | Satz und Seiten | `references/druckdatei.md` |
| 3 | Druckdatei | `references/druckdatei.md` |
| 4 | Metadaten | `references/metadaten.md` |
| 5 | Rechte | `references/rechte.md` |
| 6 | KI-Angaben | `references/kdp-ki-regeln.md` |
| 7 | Kundenqualität | unten |

Vollständige Checkliste: `amazon-kdp-business/templates/06-compliance-checkliste.md`.

## Voraussetzungen aus vorgelagerten Stufen

- `character-consistency`: Ergebnis `FIGURENKONSISTENZ: BESTANDEN`
- `kdp-opportunity-validator`: Scorecard mit `STARTEN`
- Vollständiger Seitenplan und Manuskript

Fehlt eines: **abbrechen**, nicht ersetzen.

## Kundenqualität statt Masse

Vier Fragen, ehrlich zu beantworten:

1. Würde ich dieses Buch für mein eigenes Kind kaufen?
2. Hält das Buch, was Cover und Beschreibung versprechen?
3. Wurde die Druckvorschau **vollständig** durchgeblättert?
4. Liegt ein physisches Probeexemplar vor?

Frage 4 kostet Geld ⇒ **Freigabe des Nutzers nötig**, bevor bestellt wird.
Ohne Probeexemplar ist die höchstmögliche Ausgabe:
`READY FOR HUMAN APPROVAL — Probeexemplar ausstehend`.

## Ausgabe

`amazon-kdp-business/reports/compliance/JJJJ-MM-TT-{{titel}}.md`

```
STATUS: READY FOR HUMAN APPROVAL | NICHT FREIGEGEBEN
Geprüft am: JJJJ-MM-TT
KDP-Regeln live geprüft: ja/nein (Datum)
Offene Punkte: nn
KI-Einstufung Text: AI-generated | AI-assisted | rein menschlich
KI-Einstufung Bilder: AI-generated | AI-assisted | rein menschlich
KI-Einstufung Übersetzung: entfällt | …
Probeexemplar geprüft: ja/nein
```

Danach übernimmt der Nutzer. `kdp-listing-launch` darf erst nach
`READY FOR HUMAN APPROVAL` starten.
