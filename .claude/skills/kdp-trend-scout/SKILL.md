---
name: kdp-trend-scout
description: Findet und belegt neue Themen, Suchbegriffe und saisonale Chancen für deutschsprachige Amazon-KDP-Kinderbücher, Lernbücher, Beschäftigungs- und Rätselbücher. Nutzen, wenn der Nutzer nach Buchideen, Nischen, Trends, Suchbegriffen, Marktchancen, Saisonthemen oder einem wöchentlichen KDP-Trendbericht fragt, oder /kdp-weekly-scan aufruft. Erzeugt einen datierten Trendbericht mit maximal zehn belegten Chancen plus CSV.
---

# KDP Trend Scout (amazon.de)

Findet Chancen für **deutschsprachige** Kinder- und Lernbücher. Belegt jede Aussage
oder markiert sie als unbelegt. Erfindet nichts.

## Eiserne Regeln

1. **Keine erfundenen Zahlen.** Jede Zahl braucht Quelle + Prüfdatum.
2. **Nicht live geprüft ⇒ `[NICHT VERIFIZIERT]`.** Wissen aus dem Training ist keine
   aktuelle Quelle und wird nie als solche ausgegeben.
3. **Quelle nicht erreichbar ⇒ so berichten.** Blockierte oder fehlgeschlagene Abrufe
   kommen unter „Nicht erreichbare Quellen" in den Bericht. Nie durch Schätzung ersetzen.
4. **Deutscher Markt getrennt bewerten.** amazon.de-Ergebnisse und deutsche Suchabsicht
   niemals aus englischsprachigen Daten ableiten. US-Trends sind höchstens eine Hypothese.
5. **Regelkonform recherchieren.** Nutzungsbedingungen, robots.txt und Zugriffssperren
   werden respektiert. Kein Umgehen von Sperren, kein aggressives Scraping,
   keine Anmeldung mit Nutzerkonten, keine hohe Abruffrequenz.
6. **Maximal zehn Chancen** je Bericht. Lieber vier belegte als zehn vermutete.

## Ablauf

1. **Rahmen klären** — Marktplatz `amazon.de`, Sprache Deutsch, Prüfdatum = heute.
2. **Vorbericht laden** — jüngste Datei in `amazon-kdp-business/reports/trends/`.
3. **Recherchieren** — siehe `references/quellen-und-methode.md`.
   Rohdaten und Abrufprotokoll nach `amazon-kdp-business/research/raw/JJJJ-MM-TT/`.
4. **Bewerten** — Nachfrageindikatoren, Wettbewerbsdichte, Saisonfenster, Risiken
   je Chance nach `references/bewertungsraster.md`.
5. **Vergleichen** — gegen Vorbericht: neu / stärker / schwächer / weggefallen.
6. **Schreiben** — Vorlage `amazon-kdp-business/templates/01-trendbericht.md`.

## Ausgabe

| Datei | Inhalt |
|---|---|
| `amazon-kdp-business/reports/trends/JJJJ-MM-TT-kdp-trends.md` | Bericht, max. 10 Chancen |
| `amazon-kdp-business/reports/trends/JJJJ-MM-TT-kdp-trends.csv` | strukturierte Fassung |
| `amazon-kdp-business/research/raw/JJJJ-MM-TT/` | Rohdaten + Abrufprotokoll |

CSV-Spalten (feste Reihenfolge):

```
id,thema,kategorie,zielalter,format,saison,nachfrage_indikator,quelle_url,
prueferdatum,wettbewerb_titel_geprueft,preis_min,preis_max,risiken,
status_vs_vorbericht,einschaetzung,verifiziert
```

`verifiziert` ist `ja` nur bei live abgerufener Quelle, sonst `nein`.

## Grenzen

- Der Scout **bewertet nicht abschließend**. Punktzahl und Produktionsfreigabe
  kommen ausschließlich von `kdp-opportunity-validator`.
- Der Scout **loggt sich nirgends ein** und verknüpft keine Konten.
- Bei weniger als drei belegbaren Chancen: das offen berichten, statt aufzufüllen.

## Referenzen

| Datei | Wofür |
|---|---|
| `references/quellen-und-methode.md` | Quellen, erlaubte Abrufe, Suchmuster, Saisonkalender |
| `references/bewertungsraster.md` | Nachfrage-, Wettbewerbs- und Risikoindikatoren |
