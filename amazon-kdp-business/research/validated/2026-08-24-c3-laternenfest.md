# Opportunity-Scorecard — C3 Laternenfest/Sankt-Martin-Beschäftigungsbuch

| Feld | Wert |
|---|---|
| Ideen-ID | 2026-08-24-c3-laternenfest |
| Herkunft | Trendbericht `reports/trends/2026-08-24-kdp-trends.md`, Chance C3 |
| Prüfdatum | 2026-08-24 |
| Marktplatz | amazon.de |
| Geprüfte Wettbewerbstitel | 7 (Ziel: ≥ 10) — weniger als Zielwert, siehe Begründung |
| Datenquelle | Live-Verifizierung mit echtem Browser (Playwright/Chromium), sichtbar ausgeführt, `scripts/live-verifikation.mjs --chancen C3 --sichtbar`, Rohdaten `amazon-kdp-business/research/raw/2026-08-24/live-210533/` |

## Bewertung (0–100)

| Kriterium | Max | Erreicht | Begründung mit Quelle |
|---|---:|---:|---|
| Nachfrage | 25 | 15 | 3 von 7 Titeln mit dreistelligen Rezensionszahlen (200, 158, 79), Titel erscheinen durchgehend seit 2008 bis 2025 (jüngster Titel 08/2025, 3 Rezensionen) — belegt eine über Jahre wiederkehrende Nachfrage nach dem Thema. Aber: Amazon-Autocomplete-API (`completion.amazon.de`) liefert für alle 4 getesteten Suchphrasen ("laternenfest kinderbuch", "sankt martin kinderbuch", "laternenfest beschäftigungsbuch", "sankt martin basteln kinder buch") **0 Vorschläge**, ohne Fehler — d. h. aktuell (24.08., ca. 11 Wochen vor dem 11. November) kein messbares Sofort-Suchsignal für diese Formulierungen. Kein Trends-Datenpunkt verfügbar (Google Trends laut `LIVE-VERIFIZIERUNG.md` nicht automatisierbar, nicht nachgeliefert). |
| Konkurrenzstärke (niedriger Druck = mehr Punkte) | 20 | 13 | Rezensionsspanne 3–200. Ein bis zwei etablierte Titel (200 Rez. / BSR-Rang 20.417 gesamt; 158 Rez.), Rest angreifbar (3–79 Rez., teils über 10 Jahre alt). Kein Titel mit dreistelligem BSR-Rang oder Verlagsdominanz über die gesamte Nische. |
| Erkennbare Marktlücke | 20 | 14 | Alle 7 gefundenen Titel sind laut Titeltext Bilder-/Vorlesebücher ("Bilderbuch", "Geschichten und Lieder", "Mini-Bilderbuch", interaktives Soundbuch) — keiner nennt ein Rätsel-/Beschäftigungsformat. Bestätigt den Lückenbefund aus dem Trendbericht erstmals mit Live-Daten statt Suchmaschinen-Zusammenfassung. Abzug: Reviewtexte wurden nicht erhoben (Skript liest nur Strukturdaten), daher keine belegte "wiederkehrende Kritik" — die Lücke stützt sich auf Titel-/Formatvergleich, nicht auf Kundenkritik. |
| Serienpotenzial | 15 | 12 | Saisonale Beschäftigungsbuch-Reihe (Sankt Martin, Weihnachten [C2], Herbst [C4], Regentag [C8] — alle bereits im selben Trendbericht als eigenständige Chancen geführt) — mindestens 3 Bände klar planbar unter einer wiedererkennbaren Marke. |
| Realistische Marge | 10 | 4 | Nur 4 von 7 Preisen bekannt (22 €, 16 €, 10 €, 16 €) — Wettbewerbsspanne 10–22 €. Kein Zugriff auf den aktuellen KDP-Druckkostenrechner in dieser Sitzung (nicht Teil des Live-Verifizierungslaufs, kostenpflichtige/kontobezogene Schritte ausdrücklich nicht ausgeführt) — Deckungsbeitrag bleibt `keine Daten`. Nach `margenrechnung.md`: unbeantwortete Plausibilitätsfrage ⇒ Marge ≤ 5 Punkte. |
| Produktions- und Rechtsrisiko (geringes Risiko = mehr Punkte) | 10 | 7 | Start 10, Abzug −2 (sehr enges Saisonfenster: 11 Wochen bis 11. November bei 8–10 Wochen Vorlauf, Fenster läuft bereits), Abzug −1 (Ausfüllbuch-Rückläuferrisiko bei geplantem Aktivitätsformat). Kein Abzug für Marken-/Lizenzrecht (keine Lizenzfiguren in der Nische). Sankt Martin ist gelebte, nicht geschützte Kulturtradition — Umsetzung sollte dennoch religiös/kulturell sensibel bleiben. |
| **Summe** | **100** | **65** | |

## Wettbewerbsanalyse (Live-Daten, 2026-08-24)

| # | Titel | Preis | Seiten | Rezensionen | ⌀ Sterne | BSR (roh, [SCHÄTZUNG] keine Ableitung) | Veröffentlicht | Format (Titeltext) |
|---|---|---|---|---|---|---|---|---|
| 1 | Herbstleuchten und Laternenfest | 22,00 € | 64 | 79 | 4,3 | Nr. 216.949 gesamt | 31.08.2018 | Geschichten/Lieder (Vorlesebuch) |
| 2 | Lumina | 16,00 € | 36 | 70 | 4,8 | Nr. 333.218 gesamt | 01.09.2008 | Bilderbuch |
| 3 | Wer hat die schönste Laterne? | 10,00 € | 14 | 3 | 5,0 | Nr. 57.805 gesamt | 01.08.2025 | Malbuch/Bilderbuch |
| 4 | Der kleine Hase und die Laterne | keine Daten | 16 | 158 | 4,5 | Nr. 606.691 gesamt | 01.09.2020 | Soundbuch |
| 5 | Laterne, Laterne — Bilderbuch ab 2 | keine Daten | 24 | 39 | 4,6 | Nr. 117.154 gesamt | 01.07.2021 | Bilderbuch |
| 6 | Conni und das Laternenfest | keine Daten | 32 | 46 | 4,4 | Nr. 386.946 gesamt | 01.09.2016 | Mini-Bilderbuch |
| 7 | Die schönste Laterne der Welt | 16,00 € | 32 | 200 | 4,7 | Nr. 20.417 gesamt | 13.09.2019 | Bilderbuch |

Quelle: `amazon-kdp-business/research/raw/2026-08-24/live-210533/wettbewerb.csv`, `C3.json`.
BSR ist **kein** Verkaufswert — hier nur zur Konkurrenzeinordnung genannt, keine Verkaufszahl abgeleitet.

## Marge (keine Zusage — unverifiziert)

| Position | Wert |
|---|---|
| Verkaufspreis brutto | keine Daten (kein Live-Zugriff auf KDP-Druckkostenrechner in dieser Sitzung) |
| Nettopreis / Druckkosten / Tantieme / Deckungsbeitrag | keine Daten |

Vor einer Produktionsentscheidung: aktuellen KDP-Druckkostenrechner mit realistischer Seitenzahl (Wettbewerb: 14–64 Seiten, Median ~32) und geplantem Preis (Wettbewerbsspanne 10–22 €) prüfen und mit Datum dokumentieren.

## Entscheidung

- [ ] STARTEN (≥ 70 Punkte)
- [x] **WEITER PRÜFEN** (50–69 Punkte)
- [ ] ABLEHNEN (< 50 Punkte oder Ausschlusskriterium)

**Ausschlusskriterien geprüft:** Keines greift zwingend — Konkurrenz ist nicht „gering ohne belegbare Nachfrage" (7 real existierende, teils langjährig verkaufte Titel), keine Marken-/Lizenzrechte betroffen, negative Marge nicht belegt (nur unverifiziert). Die Kombination „< 10 Titel" **und** „Nachfrage unbelegt" liegt nicht vollständig vor, da eine schwache, aber reale Nachfrage (Rezensionszahlen über Jahre) besteht — daher Punktentscheidung statt Ausschluss.

**Begründung:** 65/100 verfehlt die Produktionsschwelle von 70 knapp. Stärkstes Argument ist die belegte, über 17 Jahre wiederkehrende Nachfrage nach dem Thema und eine über Live-Daten bestätigte Formatlücke (kein Rätsel-/Beschäftigungsbuch unter den 7 gefundenen Titeln). Schwächste Punkte sind das fehlende Autocomplete-Signal für aktivitätsbuch-spezifische Suchphrasen, nur 7 statt der geforderten 10 geprüften Titel und eine komplett unverifizierte Marge. Keine Produktionsfreigabe — Stufe 3 startet **nicht**.

**Offene Fragen an den Nutzer:**
1. Sollen 3+ weitere Wettbewerbstitel erhoben werden (z. B. mit weiteren Suchbegriffen wie „martinsumzug kinderbuch", „laterne basteln kinderbuch"), um auf ≥ 10 geprüfte Titel zu kommen?
2. Soll die Autocomplete-Prüfung näher am Saisonfenster (z. B. Ende September/Oktober) wiederholt werden, um das aktuell fehlende Suchsignal erneut zu testen?
3. Soll die Marge mit aktuellen KDP-Druckkostensätzen nachgezogen werden (Zugriff auf kdp.amazon.com/kdp-druckkosten in einer späteren Sitzung)?
