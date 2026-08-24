#!/usr/bin/env bash
#
# Wöchentlicher KDP-Trendscan — nur Recherche, schreibt nur lokale Berichte.
#
# Ausdrücklich NICHT möglich mit diesen Rechten:
#   keine Shell-Befehle, keine Anmeldung, keine Kontoverknüpfung,
#   keine Veröffentlichung, keine Preisänderung, keine Bestellung,
#   keine Werbeaktion, kein Kauf.
#
# Aufruf:  ./scripts/kdp-weekly-scan.sh
#
# Exit-Codes: 0 = Bericht erstellt · 1 = claude fehlgeschlagen
#             2 = gelaufen, aber kein Bericht · 3 = Voraussetzung fehlt
#
set -uo pipefail

PROJEKT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BERICHTE="$PROJEKT/amazon-kdp-business/reports/trends"
PROTOKOLL="$PROJEKT/amazon-kdp-business/data/scan-protokoll.log"
HEUTE="$(date +%F)"

mkdir -p "$BERICHTE" "$(dirname "$PROTOKOLL")"

log() {
  printf '%s  %s\n' "$(date '+%F %T %Z')" "$1" >>"$PROTOKOLL"
  printf '%s  %s\n' "$(date '+%F %T %Z')" "$1"
}

# Jeder Abbruch wird gemeldet — auch ein unerwarteter. Ein Zeitplan, der
# stillschweigend scheitert, ist schlimmer als gar keiner.
ABGESCHLOSSEN=0
trap 'rc=$?; [ "$ABGESCHLOSSEN" -eq 1 ] || log "ABGEBROCHEN (Exit $rc) — unerwartetes Ende. Protokoll: $PROTOKOLL"' EXIT

if ! command -v claude >/dev/null 2>&1; then
  log "FEHLER: 'claude' nicht gefunden. Claude Code installieren oder PATH prüfen."
  ABGESCHLOSSEN=1; exit 3
fi

log "Start Trendscan"

VORHER="$(ls -1 "$BERICHTE"/*-kdp-trends.md 2>/dev/null | wc -l)"

cd "$PROJEKT" || { log "FEHLER: Wechsel nach $PROJEKT nicht möglich."; ABGESCHLOSSEN=1; exit 3; }

# stdin ausdrücklich schließen: Ohne </dev/null wartet claude auf eine Eingabe,
#   die es unbeaufsichtigt (Zeitplan, Skriptaufruf) nie gibt.
# --permission-mode acceptEdits: erlaubt unbeaufsichtigtes Schreiben der Berichte,
#   ohne allgemeine Rechteumgehung (NICHT bypassPermissions).
# --allowedTools ohne Bash: der Lauf kann keine Systembefehle ausführen.
claude -p "/kdp-weekly-scan" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Skill" \
  </dev/null >>"$PROTOKOLL" 2>&1
STATUS=$?

log "claude beendet mit Exit-Code $STATUS"

if [ "$STATUS" -ne 0 ]; then
  log "FEHLGESCHLAGEN. Letzte Ausgabe:"
  tail -5 "$PROTOKOLL" | sed 's/^/    /'
  log "Hinweis: Bei 'API Error: Connection lost' den Lauf wiederholen."
  ABGESCHLOSSEN=1; exit 1
fi

NACHHER="$(ls -1 "$BERICHTE"/*-kdp-trends.md 2>/dev/null | wc -l)"
NEUSTE="$(ls -1t "$BERICHTE"/*-kdp-trends.md 2>/dev/null | head -1)"

if [ "$NACHHER" -gt "$VORHER" ] || [ -f "$BERICHTE/$HEUTE-kdp-trends.md" ]; then
  log "Fertig. Bericht: ${NEUSTE:-unbekannt}"
  ABGESCHLOSSEN=1; exit 0
fi

log "WARNUNG: Lauf beendet, aber kein neuer Bericht gefunden. Protokoll prüfen: $PROTOKOLL"
ABGESCHLOSSEN=1; exit 2
