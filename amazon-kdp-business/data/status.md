# Projektstatus

> Wird von `kdp-business-orchestrator` nach **jeder** Stufe fortgeschrieben.
> Vor jeder Stufe lesen. Nie aus dem Gedächtnis fortsetzen.
> Aufbau und Regeln: `.claude/skills/kdp-business-orchestrator/references/statusfuehrung.md`

## Systemstatus

| Feld | Wert |
|---|---|
| Eingerichtet am | 2026-08-24 |
| Marktplatz | amazon.de |
| KDP-Konto | vorhanden (nicht verknüpft, keine Zugangsdaten gespeichert) |
| Aktive Bücher | 2 (beide Stufe 2, WEITER PRÜFEN — noch keine Produktionsfreigabe) |
| Aktive Reihen | 0 |
| Letzter Trendbericht | 2026-08-24 (Lauf 2) — 8 Chancen; C3 live verifiziert und an Validator übergeben (65/100), übrige 7 „beobachten" |

## Stufe 1 — Trendrecherche

Letzter Lauf:               2026-08-24, Lauf 2 (unbeaufsichtigt über `scripts/kdp-weekly-scan.sh`, Exit 0)
Ergebnis:                   8 Chancen erhoben, alle mit Einschätzung „beobachten",
                            alle mit `verifiziert: nein`.
                            Vergleich gegen Lauf 1: C1–C7 unverändert, C8 (Regentag-
                            Beschäftigungsbuch) neu. Zeitkritisch bleibt allein C3
                            (Laternenfest, Vorlauf 8–10 Wochen, Fenster läuft bereits).
                            Lauf 1 archiviert unter `reports/trends/archiv/`.
Artefakte:
  - amazon-kdp-business/reports/trends/2026-08-24-kdp-trends.md
  - amazon-kdp-business/reports/trends/2026-08-24-kdp-trends.csv
  - amazon-kdp-business/research/raw/2026-08-24/abrufprotokoll.md
Torbedingung erfüllt:       **nein** — verlangt ≥ 1 Chance mit „verfolgen", erreicht: 0.
Grund:                      `WebFetch` in dieser Umgebung für amazon.de und Google Trends
                            gesperrt. Ohne Autocomplete, Live-Preise, Rezensionszahlen und
                            BSR reicht die Beleglage nach `bewertungsraster.md` nur für
                            „beobachten". Das ist die vorgesehene Reaktion, kein Fehler.
Nächster Schritt:           Lauf auf einem Rechner mit Zugriff auf amazon.de wiederholen,
                            oder eine Chance gezielt mit manuell gelieferten Daten vertiefen.
Blockiert durch:            fehlende Daten (Netzsperre der Einrichtungsumgebung)
Aktualisiert:               2026-08-24

## Bücher

## Ohne Reihenname / Band 1 — Beschäftigungsbuch Autofahrt 5–7

Aktuelle Stufe:             2 — Validierung
Letzte abgeschlossene:      2 am 2026-08-24
Ergebnis der letzten Stufe: Scorecard erstellt, 63/100, WEITER PRÜFEN. Nachfrage über 12 real existierende Wettbewerbstitel belegt, aber Preis/Rezensionen/BSR/Druckkosten mangels Live-Zugriff auf amazon.de und kdp.amazon.com (Proxy blockiert beide Domains in dieser Sitzung) nicht verifizierbar und daher `keine Daten`.
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-beschaeftigungsbuch-auto-5-7.md
Torbedingung erfüllt:       nein — ≥70 Punkte und STARTEN nicht erreicht (63/100, WEITER PRÜFEN). Stufe 3 startet nicht.
Nächster Schritt:           Offene Fragen mit Nutzer klären (Wettbewerbsdaten und KDP-Druckkosten nachziehen), dann Scorecard erneut bewerten.
Blockiert durch:            fehlende Daten (Live-Zugriff amazon.de/kdp.amazon.com in dieser Sitzung nicht möglich)
Offene Fragen an Nutzer:
  1. Wettbewerbsprüfung mit echtem amazon.de-Zugriff wiederholen oder Nutzer liefert Preise/Rezensionen/BSR der 12 gelisteten Titel manuell?
  2. Margenrechnung nachziehen, sobald KDP-Druckkostenrechner erreichbar ist oder Nutzer aktuelle Sätze mitteilt?
Aktualisiert:               2026-08-24

**Einstieg:** Stufe 1 (Trendrecherche) nicht durchlaufen — Grund: Idee vom Nutzer vorgegeben. Ersetzt durch: Nutzereingabe „Beschäftigungsbuch für Kinder von 5 bis 7 Jahren auf langen Autofahrten". Einstieg direkt in Stufe 2, wie im Orchestrator-Skill unter „Einstieg" vorgesehen und hier protokolliert.

**TESTLAUF-Hinweis:** Auf ausdrücklichen Wunsch des Nutzers endet dieser Lauf nach Stufe 2. Es wurde nichts veröffentlicht, bestellt oder verknüpft — es bestand dazu ohnehin kein Anlass, da Stufe 2 keine dieser Aktionen umfasst.

## Ohne Reihenname / Band 1 — C3 Laternenfest/Sankt-Martin-Beschäftigungsbuch

Aktuelle Stufe:             2 — Validierung
Letzte abgeschlossene:      2 am 2026-08-24
Ergebnis der letzten Stufe: Live-Verifizierung mit echtem Browser (Playwright/Chromium, lokal, sichtbar) durchgeführt, 7 Wettbewerbstitel erhoben. Opportunity-Scorecard erstellt: 65/100 — WEITER PRÜFEN. Formatlücke bestätigt (alle 7 Titel Bilder-/Vorlesebücher, kein Rätsel-/Beschäftigungsformat), Nachfrage über Jahre belegt (3 Titel mit dreistelligen Rezensionszahlen), aber Autocomplete-Signal aktuell 0, nur 7 statt 10 Titel geprüft, Marge unverifiziert (kein Zugriff auf KDP-Druckkostenrechner in dieser Sitzung).
Artefakte:
  - amazon-kdp-business/research/validated/2026-08-24-c3-laternenfest.md
  - amazon-kdp-business/research/raw/2026-08-24/live-210533/ (C3.json, wettbewerb.csv, zusammenfassung.json)
Torbedingung erfüllt:       nein — ≥70 Punkte und STARTEN nicht erreicht (65/100, WEITER PRÜFEN). Stufe 3 startet nicht.
Nächster Schritt:           Offene Fragen aus der Scorecard klären (weitere Wettbewerbstitel, Autocomplete näher am Saisonfenster erneut prüfen, Marge mit aktuellem KDP-Druckkostenrechner nachziehen), dann erneut bewerten.
Blockiert durch:            fehlende Daten (Marge unverifiziert, unter 10 Wettbewerbstitel geprüft)
Offene Fragen an Nutzer:
  1. Weitere Wettbewerbstitel erheben (zusätzliche Suchbegriffe), um auf ≥10 geprüfte Titel zu kommen?
  2. Autocomplete-Prüfung näher am Saisonfenster (September/Oktober) wiederholen?
  3. Marge mit aktuellen KDP-Druckkostensätzen nachziehen?
Aktualisiert:               2026-08-24

<!--
Vorlage je Buch:

## {{Reihe}} / Band {{n}} — {{Arbeitstitel}}

Aktuelle Stufe:             {{1-8}} — {{Name}}
Letzte abgeschlossene:      {{n}} am {{JJJJ-MM-TT}}
Ergebnis der letzten Stufe: {{2-3 Sätze}}
Artefakte:
  - {{Pfad}}
Torbedingung erfüllt:       ja / nein — {{welche}}
Nächster Schritt:           {{konkret}}
Blockiert durch:            {{Nutzerfreigabe für X / fehlende Daten / keine}}
Offene Fragen an Nutzer:    {{Liste oder "keine"}}
Aktualisiert:               {{JJJJ-MM-TT}}
-->
