# Installation auf Ihrem Rechner

## Voraussetzungen

- Claude Code (getestet mit 2.1.241)
- Git
- Optional für Coverdateien: Python 3 mit `reportlab` und `Pillow`

## Einrichten

```bash
git clone https://github.com/carcura-ai/amazon-KDP.git
cd amazon-KDP
git checkout claude/amazon-kdp-kinderbuch-setup-374xk0

./scripts/install-skills.sh
```

Das Skript kopiert die Skills nach `~/.claude/skills/<name>/SKILL.md`.
**Gleichnamige vorhandene Skills werden vorher nach
`~/.claude/backups/skills-JJJJMMTT-HHMMSS/` gesichert** — es wird nichts
ungesichert überschrieben.

## Prüfen

```bash
claude
> /skills
```

Erwartet werden: `kdp-business-orchestrator`, `kdp-trend-scout`,
`kdp-opportunity-validator`, `kinderbuch-entwickler`, `character-consistency`,
`kdp-quality-compliance`, `kdp-listing-launch`, `ebook-publishing`
sowie der Befehl `/kdp-weekly-scan`.

## Zwei Wege, die Skills zu nutzen

| Weg | Wirkung |
|---|---|
| `./scripts/install-skills.sh` | persönliche Skills — überall verfügbar |
| Projekt öffnen | die Skills unter `.claude/skills/` werden im Projekt automatisch erkannt |

Beides parallel ist möglich. Bei Änderungen an den Skills gilt: Das Repository ist
die Quelle. Nach einer Änderung `./scripts/install-skills.sh` erneut ausführen.

## Erster Lauf

```bash
claude
> /kdp-business-orchestrator
```

Ohne vorhandene Idee beginnt er bei Stufe 1 (Trendrecherche).
Mit einer Idee beginnt er bei Stufe 2 (Validierung) und protokolliert den Einstieg.

## Verkaufsdaten einlesen

Sie haben ein bestehendes KDP-Konto. Das System meldet sich **nicht** an.
Berichte werden manuell exportiert:

1. Bericht im KDP-Konto herunterladen
2. Ablegen unter `amazon-kdp-business/data/kdp-berichte/JJJJ-MM/`
3. Claude bitten: „Werte die KDP-Berichte für {{Monat}} aus."

Siehe `amazon-kdp-business/data/kdp-berichte/LIESMICH.md`.

## Was das System nie selbst tut

Anmeldung · Kontoverknüpfung · Veröffentlichung · Löschung · Preisänderung ·
Bestellung kostenpflichtiger Exemplare · Werbebudgets · Käufe.

Es hält bei diesen Punkten an, erklärt die Wirkung und wartet auf Ihre
ausdrückliche Zustimmung für genau diesen Vorgang.

## Fehlerbehebung

| Problem | Ursache und Lösung |
|---|---|
| `/skills` zeigt die Skills nicht | `./scripts/install-skills.sh` ausführen, Claude Code neu starten |
| „Quelle nicht erreichbar" im Bericht | Netzsperre oder Proxy. Der Bericht vermerkt das korrekt und schätzt nicht. |
| Wochenscan läuft nicht | Erst von Hand testen: `./scripts/kdp-weekly-scan.sh`, dann `amazon-kdp-business/data/scan-protokoll.log` lesen |
| `claude: command not found` im Zeitplan | Absoluten Pfad zu `claude` im Skript oder in der PATH-Umgebung des Zeitplans setzen |
