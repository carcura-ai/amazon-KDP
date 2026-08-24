---
description: Erstellt einen neuen KDP-Trendbericht für amazon.de, vergleicht ihn mit dem Vorbericht und hebt nur neue oder deutlich veränderte Chancen hervor.
allowed-tools: Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Skill
---

# Wöchentlicher KDP-Trendscan

Führe den Skill `kdp-trend-scout` aus. Zusätzlich gilt für diesen Lauf:

## 1 Vorbericht laden

Suche die jüngste Datei in `amazon-kdp-business/reports/trends/` nach dem Muster
`JJJJ-MM-TT-kdp-trends.md`. Lies sie vollständig, bevor du recherchierst.
Existiert keine: Das ist der Erstlauf — vermerke das im Bericht.

## 2 Recherchieren

Nach `kdp-trend-scout` und dessen `references/quellen-und-methode.md`.
Schwerpunkt: deutschsprachige Kinder-, Lern-, Beschäftigungs- und Rätselbücher
auf amazon.de.

Berücksichtige das Saisonfenster: Prüfe im Saisonkalender, welche Themen
**jetzt** Vorlauf brauchen — nicht, welche gerade aktuell sind.

## 3 Vergleichen — das Kernstück dieses Laufs

Ordne jede Chance einer dieser Klassen zu:

| Klasse | Bedeutung |
|---|---|
| **NEU** | war im Vorbericht nicht enthalten |
| **STÄRKER** | Nachfrageindikatoren verbessert oder Wettbewerb schwächer geworden |
| **SCHWÄCHER** | Wettbewerb gewachsen oder Nachfragesignal verloren |
| **UNVERÄNDERT** | keine wesentliche Änderung |
| **WEGGEFALLEN** | im Vorbericht enthalten, jetzt nicht mehr tragfähig |

**Deutlich verändert** heißt: Ein Indikator hat sich so geändert, dass sich die
Einschätzung (verfolgen / beobachten / verwerfen) ändert. Kleine Schwankungen
in Rang oder Rezensionszahl sind **keine** Veränderung — BSR schwankt täglich.

## 4 Bericht schreiben

Nach Vorlage `amazon-kdp-business/templates/01-trendbericht.md` nach
`amazon-kdp-business/reports/trends/JJJJ-MM-TT-kdp-trends.md`, plus CSV.

Der Bericht beginnt mit einem Abschnitt **„Das ist neu"**:

```
## Das ist neu

NEU:          {{Liste oder "keine"}}
STÄRKER:      {{Liste oder "keine"}}
SCHWÄCHER:    {{Liste oder "keine"}}
WEGGEFALLEN:  {{Liste oder "keine"}}

Handlungsempfehlung: {{ein Satz — oder "kein Handlungsbedarf"}}
```

Ist nichts Wesentliches neu, schreibe das deutlich hin. Ein Bericht ohne
Veränderung ist ein gültiges Ergebnis und besser als erfundene Bewegung.

## Grenzen dieses Laufs

- **Nur Recherche und lokale Berichte.** Keine Anmeldung, keine Kontoverknüpfung,
  keine Veröffentlichung, keine Werbeaktion, keine Bestellung, kein Kauf.
- **Keine erfundenen Zahlen.** Nicht erreichbare Quellen kommen unter
  „Nicht erreichbare Quellen" in den Bericht.
- **Keine Produktionsentscheidung.** Punkte und Freigabe kommen ausschließlich
  von `kdp-opportunity-validator`. Dieser Lauf sammelt und vergleicht nur.
