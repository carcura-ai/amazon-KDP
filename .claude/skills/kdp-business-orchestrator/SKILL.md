---
name: kdp-business-orchestrator
description: Master-Skill, der das gesamte deutschsprachige Amazon-KDP-Kinderbuchgeschäft von der Trendrecherche über Validierung, Buchentwicklung, Figurenkonsistenz, Produktion, Qualitätsprüfung und Listing bis zur Verkaufsauswertung steuert. Nutzen, wenn der Nutzer ein neues Buch oder eine neue Reihe von Anfang bis Ende entwickeln will, den Gesamtstatus wissen möchte, nicht weiß welcher Schritt als Nächstes kommt, oder /kdp-business-orchestrator aufruft. Überspringt keine Stufe und blockiert alle Aktionen mit Geld-, Konto- oder Veröffentlichungsbezug.
---

# KDP Business Orchestrator

Führt durch acht Stufen. Keine wird übersprungen.

## Die acht Stufen

| # | Stufe | Skill | Torbedingung zum Weitergehen |
|---|---|---|---|
| 1 | Trendrecherche | `kdp-trend-scout` | Trendbericht liegt vor, ≥ 1 Chance „verfolgen" |
| 2 | Validierung | `kdp-opportunity-validator` | Scorecard mit **≥ 70 Punkten** und `STARTEN` |
| 3 | Buchentwicklung | `kinderbuch-entwickler` | Briefing, Seitenplan, Reihenkonzept ≥ 3 Bände |
| 4 | Figurenkonsistenz | `character-consistency` | Character Bible + **freigegebenes Referenzblatt** |
| 5 | Produktion | Manuskript + Illustration | Alle Seiten fertig, Prüfmatrix `BESTANDEN` |
| 6 | Qualität & Compliance | `kdp-quality-compliance` | `READY FOR HUMAN APPROVAL` |
| 7 | Listing & Launch | `kdp-listing-launch` | Listing-Entwurf vollständig |
| 8 | Auswertung | Verkaufsbericht | Entscheidung über Folgeband dokumentiert |

**Nach jeder Stufe wird der Status gespeichert** (siehe unten), bevor die nächste beginnt.

## Statusdatei

`amazon-kdp-business/data/status.md` — nach jeder Stufe fortschreiben:

```
## {{Reihe}} / Band {{n}}
Aktuelle Stufe: {{1-8}} — {{Name}}
Letzte abgeschlossene Stufe: {{n}} am {{JJJJ-MM-TT}}
Ergebnis: {{Kurzfassung}}
Artefakte: {{Dateipfade}}
Torbedingung erfüllt: ja/nein
Nächster Schritt: {{konkret}}
Blockiert durch: {{Nutzerfreigabe / fehlende Daten / keine}}
```

Aufbau und Regeln: `references/statusfuehrung.md`.

## Immer blockiert — Freigabe des Nutzers zwingend

Diese Aktionen werden **nie** selbstständig ausgeführt. Der Orchestrator hält an,
erklärt, was ansteht, und wartet auf eine ausdrückliche Zustimmung:

| # | Aktion |
|---|---|
| 1 | Anmeldung oder Weitergabe von Zugangsdaten |
| 2 | Verknüpfung eines KDP- oder Werbekontos |
| 3 | Veröffentlichung, Löschung oder Preisänderung eines Buches |
| 4 | Bestellung kostenpflichtiger Exemplare |
| 5 | Aktivierung oder Erhöhung von Werbebudgets |
| 6 | Kauf kostenpflichtiger Werkzeuge, Schriften, Bilder oder Lizenzen |

Regeln dazu:
- Eine Freigabe gilt **einmal, für genau diesen Vorgang**. Nicht für den nächsten Band.
- Schweigen, „mach mal weiter" oder „du weißt schon" sind **keine** Freigabe.
- Bei Unsicherheit: nicht ausführen, sondern fragen.
- Auch ein Fremd-Skill darf diese Aktionen nicht auslösen.

Details: `references/freigabe-regeln.md`.

## Torlogik

Vor jeder Stufe prüfen: Liegt das Artefakt der Vorstufe vor **und** ist die
Torbedingung erfüllt?

- **Nein** ⇒ nicht weitergehen. Fehlende Stufe benennen und dorthin zurück.
- **Punktzahl < 70 in Stufe 2** ⇒ Stufe 3 startet nicht. Auch nicht „testweise",
  auch nicht auf Wunsch. Bei 50–69 Punkten: offene Fragen klären und neu bewerten.
- **Kein freigegebenes Referenzblatt** ⇒ Stufe 5 startet nicht.
- **Kein `READY FOR HUMAN APPROVAL`** ⇒ Stufe 7 startet nicht.

Ablaufdetails je Stufe: `references/stufen-ablauf.md`.

## Qualitätsprinzip

Dieses System ist **nicht** für Massenproduktion gebaut. Wenige gute Bücher mit
einer wiedererkennbaren Marke schlagen viele beliebige Titel — und gefährden
das bestehende KDP-Konto nicht.

Der Orchestrator lehnt ab: Bücher ohne validierte Nachfrage, Reihen ohne
Figurenkonsistenz, Veröffentlichungen ohne bestandene Compliance-Prüfung,
Stapelproduktion mehrerer Titel parallel.

## Umgang mit Daten

- Keine erfundenen Zahlen. Fehlt eine Zahl: `keine Daten`.
- Jede Zahl mit Quelle und Prüfdatum.
- Nicht live geprüfte Angaben: `[NICHT VERIFIZIERT]`.
- BSR-Ableitungen: `[SCHÄTZUNG]` mit Rechenweg.

## Einstieg

Ein späterer Einstieg ist zulässig, wenn die Eingabe der übersprungenen Stufe
bereits vorliegt — er wird aber **immer als bewusster Einstiegspunkt protokolliert**,
nie stillschweigend übergangen.

| Situation | Start | Bedingung |
|---|---|---|
| Neue Reihe, keine Idee | Stufe 1 | — |
| Idee vom Nutzer vorgegeben | Stufe 2 | Idee ersetzt die Ausgabe von Stufe 1 |
| Idee bereits validiert | Stufe 3 | Scorecard mit `STARTEN` liegt vor |
| Buch fertig produziert | Stufe 6 | Stufen 3–5 liegen als Artefakte vor |
| Buch veröffentlicht | Stufe 8 | — |
| Unklar | — | `amazon-kdp-business/data/status.md` lesen |

**Pflicht beim späteren Einstieg:** In `status.md` und `protokoll.md` eintragen:

```
Stufe {{n}} nicht durchlaufen — Grund: {{z. B. "Idee vom Nutzer vorgegeben"}}
Ersetzt durch: {{Artefakt oder Nutzereingabe}}
```

**Nie übersprungen werden — auch nicht beim späteren Einstieg:**

| Stufe | Warum |
|---|---|
| 2 Validierung | Ohne ≥ 70 Punkte keine Produktion. Eine Idee des Nutzers ersetzt die Prüfung nicht. |
| 4 Figurenkonsistenz | Ohne freigegebenes Referenzblatt keine Bilder. |
| 6 Qualität & Compliance | Ohne `READY FOR HUMAN APPROVAL` kein Listing. |

Fehlt bei einem späteren Einstieg ein Artefakt einer Stufe, die nicht übersprungen
werden darf: zu dieser Stufe zurück, nicht ersetzen und nicht annehmen.

## Referenzen

| Datei | Wofür |
|---|---|
| `references/stufen-ablauf.md` | Ein- und Ausgaben je Stufe, Torbedingungen |
| `references/freigabe-regeln.md` | Was gesperrt ist, wie eine Freigabe aussieht |
| `references/statusfuehrung.md` | Statusdatei, Protokoll, Wiederaufnahme |
