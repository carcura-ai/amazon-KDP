# Wöchentliche Trendüberwachung

## Aktueller Stand — ehrlich

| | |
|---|---|
| `/kdp-weekly-scan` (Slash-Befehl) | **eingerichtet und erkannt** |
| `scripts/kdp-weekly-scan.sh` (Startbefehl) | **eingerichtet, Syntax geprüft, nicht-interaktiver Aufruf getestet** |
| Automatischer Lauf montags 09:00 | **NICHT aktiv** |

**Warum keine aktive Automatisierung:** Diese Einrichtung lief in einer
kurzlebigen Cloud-Umgebung. Dort ist `cron` nicht installiert (`crontab: command
not found`), die Zeitzone ist `Etc/UTC` statt `Europe/Berlin`, und der Container
wird nach Ende der Sitzung samt allen Zeitplänen verworfen.

Eine dort eingerichtete Automatisierung wäre bereits morgen verschwunden.
Deshalb wird hier **nicht** behauptet, eine Automatisierung sei aktiv.
Stattdessen: **ein** geprüfter Startbefehl, den Sie auf Ihrem eigenen Rechner
ausführen — und wenn Sie möchten, dort in einen Zeitplan hängen.

## Der Startbefehl

```bash
cd /pfad/zu/amazon-KDP
./scripts/kdp-weekly-scan.sh
```

Das ist alles. Das Skript:

1. sucht den letzten Trendbericht,
2. startet Claude Code nicht-interaktiv mit `/kdp-weekly-scan`,
3. schreibt den neuen Bericht nach `amazon-kdp-business/reports/trends/`,
4. protokolliert nach `amazon-kdp-business/data/scan-protokoll.log`,
5. meldet einen Fehler, wenn kein Bericht entstanden ist.

### Warum das sicher ist

| Schutz | Umsetzung |
|---|---|
| Keine Systembefehle | `--allowedTools` enthält **kein** `Bash` |
| Keine Rechteumgehung | `--permission-mode acceptEdits` — **nicht** `bypassPermissions` |
| Keine Zugangsdaten | Das Skript kennt und speichert keine |
| Keine Kontoverknüpfung | Technisch nicht möglich mit diesen Werkzeugen |
| Keine Veröffentlichung, kein Kauf, keine Werbung | dito |
| Nur lokale Schreibvorgänge | Berichte und Protokoll im Projektordner |

Erlaubt sind ausschließlich: `Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Skill`.

## Optional: Wochenplan auf Ihrem Rechner

**Nicht durch mich aktiviert.** Sie entscheiden, ob Sie das einrichten.

### Linux / macOS — cron

```bash
crontab -e
```

Zeile einfügen (montags 09:00 Ortszeit):

```
0 9 * * 1 cd /pfad/zu/amazon-KDP && ./scripts/kdp-weekly-scan.sh >> amazon-kdp-business/data/cron.log 2>&1
```

cron nutzt die Zeitzone des Systems. Prüfen mit `timedatectl` bzw. `date`.
Steht dort nicht `Europe/Berlin`, zuerst die Systemzeitzone korrigieren.

### macOS — launchd (Alternative, überlebt Ruhezustand besser)

`~/Library/LaunchAgents/de.kdp.weeklyscan.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>de.kdp.weeklyscan</string>
  <key>ProgramArguments</key>
  <array><string>/pfad/zu/amazon-KDP/scripts/kdp-weekly-scan.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer>
        <key>Hour</key><integer>9</integer>
        <key>Minute</key><integer>0</integer></dict>
  <key>WorkingDirectory</key><string>/pfad/zu/amazon-KDP</string>
</dict></plist>
```

```bash
launchctl load ~/Library/LaunchAgents/de.kdp.weeklyscan.plist
```

### Windows — Aufgabenplanung

```powershell
$A = New-ScheduledTaskAction -Execute "bash" `
     -Argument "-lc './scripts/kdp-weekly-scan.sh'" `
     -WorkingDirectory "C:\pfad\zu\amazon-KDP"
$T = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
Register-ScheduledTask -TaskName "KDP Trendscan" -Action $A -Trigger $T
```

### Vor dem Einrichten testen

**Immer zuerst von Hand ausführen.** Ein Zeitplan, der einen kaputten Befehl
startet, meldet sich nicht — er schweigt.

```bash
./scripts/kdp-weekly-scan.sh
ls -lt amazon-kdp-business/reports/trends/ | head -3
```

Entsteht ein Bericht mit heutigem Datum, funktioniert es.

## Was der Scan liefert

Jeder Lauf erzeugt einen Bericht mit einem Abschnitt **„Das ist neu"**:

```
NEU:          {{Liste oder "keine"}}
STÄRKER:      {{…}}
SCHWÄCHER:    {{…}}
WEGGEFALLEN:  {{…}}
Handlungsempfehlung: {{ein Satz oder "kein Handlungsbedarf"}}
```

Nur **neue oder deutlich veränderte** Chancen werden hervorgehoben. „Deutlich
verändert" heißt: Die Einschätzung ändert sich. Tägliche BSR-Schwankungen zählen
nicht als Veränderung.

Ein Bericht ohne Veränderung ist ein gültiges Ergebnis.

## Netzzugriff beachten

Beim Einrichtungstest war in der Cloud-Umgebung **jeder** direkte Seitenabruf
(`WebFetch`) gesperrt — auch `amazon.de` und `kdp.amazon.com`. Nur `WebSearch`
funktionierte.

Auf Ihrem eigenen Rechner besteht diese Sperre voraussichtlich nicht, und der
Scan liefert deutlich belastbarere Daten. Sollte etwas nicht erreichbar sein,
schreibt der Bericht das unter „Nicht erreichbare Quellen" — er füllt die Lücke
nicht mit Schätzungen.
