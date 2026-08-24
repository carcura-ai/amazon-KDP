---
name: kdp-opportunity-validator
description: Bewertet eine konkrete KDP-Buchidee datenbasiert mit 0 bis 100 Punkten und entscheidet STARTEN, WEITER PRÜFEN oder ABLEHNEN. Nutzen, wenn der Nutzer eine Buchidee, Nische oder Kategorie prüfen, validieren, bewerten oder mit dem Wettbewerb vergleichen will, oder bevor eine Produktion startet. Erzwingt mindestens zehn geprüfte Wettbewerbstitel und eine Mindestpunktzahl von 70 für die Produktionsfreigabe. Ersetzt externe Category-Research-Tools.
---

# KDP Opportunity Validator

Prüft **eine** Idee gegen den realen Wettbewerb auf amazon.de und trifft eine
nachvollziehbare Entscheidung.

## Eiserne Regeln

1. **Unter 70 Punkten gibt es keine Produktionsfreigabe.** Ohne Ausnahme.
2. **Mindestens 10 relevante Wettbewerbstitel prüfen**, sofern so viele existieren.
   Existieren weniger, wird die tatsächliche Zahl genannt und das als Signal gewertet —
   nicht als Freibrief.
3. **BSR ist kein Verkaufswert.** Jede daraus abgeleitete Zahl trägt `[SCHÄTZUNG]`
   und den Rechenweg. Nie „verkauft X Stück pro Monat" behaupten.
4. **Geringe Konkurrenz ohne belegbare Nachfrage ⇒ ABLEHNEN.** Eine leere Nische
   ist meistens leer, weil dort niemand kauft.
5. **Keine erfundenen Daten.** Nicht prüfbare Felder bleiben `keine Daten`.
6. Der Validator **entscheidet über Produktion, nicht über Veröffentlichung.**

## Punkteschema (100)

| Kriterium | Max | Kernfrage |
|---|---:|---|
| Nachfrage | 25 | Wird das nachweislich gesucht und gekauft? |
| Konkurrenzstärke | 20 | Wie schwer ist der Einstieg? (schwächere Konkurrenz = mehr Punkte) |
| Erkennbare Marktlücke | 20 | Was fehlt konkret, das wir besser machen können? |
| Serienpotenzial | 15 | Tragen mindestens drei Bände? |
| Realistische Marge | 10 | Bleibt nach Druckkosten genug übrig? |
| Produktions- und Rechtsrisiko | 10 | Was kann schiefgehen? (geringes Risiko = mehr Punkte) |

Vergabe je Kriterium nach `references/punkteschema.md` — jede Teilpunktzahl mit Begründung.

## Entscheidung

| Punkte | Entscheidung | Bedeutung |
|---|---|---|
| ≥ 70 | **STARTEN** | Freigabe für `kinderbuch-entwickler` |
| 50–69 | **WEITER PRÜFEN** | offene Fragen benennen, erneut vorlegen |
| < 50 | **ABLEHNEN** | mit Begründung |

**Ausschlusskriterien — führen unabhängig von der Punktzahl zu ABLEHNEN:**

- geringe Konkurrenz **ohne** belegbare Nachfrage
- Marken-, Lizenz- oder Persönlichkeitsrechte betroffen
- weniger als 10 prüfbare Wettbewerbstitel **und** Nachfrage unbelegt
- negative Marge bei realistischer Seitenzahl

## Ablauf

1. Idee und Quelle aufnehmen (Trendbericht oder Nutzer).
2. Wettbewerb erheben — Tabelle nach `references/wettbewerbsanalyse.md`.
3. Rezensionen der Spitzentitel auf wiederkehrende Kritik auswerten.
4. Marge rechnen — `references/margenrechnung.md`.
5. Punkte vergeben, jede Zeile begründen.
6. Entscheidung schreiben.

## Ausgabe

`amazon-kdp-business/research/validated/JJJJ-MM-TT-{{ideen-id}}.md`
nach Vorlage `amazon-kdp-business/templates/02-opportunity-scorecard.md`.

Kopf des Dokuments immer:

```
ENTSCHEIDUNG: STARTEN | WEITER PRÜFEN | ABLEHNEN
PUNKTE: nn/100
GEPRÜFTE WETTBEWERBSTITEL: nn
PRÜFDATUM: JJJJ-MM-TT
```

## Referenzen

| Datei | Wofür |
|---|---|
| `references/punkteschema.md` | Punktvergabe je Kriterium, Ankerbeispiele |
| `references/wettbewerbsanalyse.md` | Was je Wettbewerbstitel erhoben wird |
| `references/margenrechnung.md` | Druckkosten, Tantieme, Rechenweg |
