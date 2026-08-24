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
set -euo pipefail

PROJEKT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BERICHTE="$PROJEKT/amazon-kdp-business/reports/trends"
PROTOKOLL="$PROJEKT/amazon-kdp-business/data/scan-protokoll.log"
HEUTE="$(date +%F)"

mkdir -p "$BERICHTE" "$(dirname "$PROTOKOLL")"

if ! command -v claude >/dev/null 2>&1; then
  echo "FEHLER: 'claude' nicht gefunden. Claude Code installieren oder PATH prüfen." >&2
  exit 1
fi

log() { printf '%s  %s\n' "$(date '+%F %T %Z')" "$1" | tee -a "$PROTOKOLL"; }

log "Start Trendscan"

VORHER="$(ls -1 "$BERICHTE"/*-kdp-trends.md 2>/dev/null | wc -l)"

cd "$PROJEKT"

# --permission-mode acceptEdits: erlaubt unbeaufsichtigtes Schreiben der Berichte,
#   ohne allgemeine Rechteumgehung (NICHT bypassPermissions).
# --allowedTools ohne Bash: der Lauf kann keine Systembefehle ausführen.
set +e
claude -p "/kdp-weekly-scan" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Skill" \
  >>"$PROTOKOLL" 2>&1
STATUS=$?
set -e

NACHHER="$(ls -1 "$BERICHTE"/*-kdp-trends.md 2>/dev/null | wc -l)"
NEUSTE="$(ls -1t "$BERICHTE"/*-kdp-trends.md 2>/dev/null | head -1 || true)"

if [ "$STATUS" -ne 0 ]; then
  log "FEHLGESCHLAGEN (Exit $STATUS) — Details im Protokoll: $PROTOKOLL"
  exit "$STATUS"
fi

if [ "$NACHHER" -gt "$VORHER" ] || [ -f "$BERICHTE/$HEUTE-kdp-trends.md" ]; then
  log "Fertig. Bericht: ${NEUSTE:-unbekannt}"
else
  log "WARNUNG: Lauf beendet, aber kein neuer Bericht gefunden. Protokoll prüfen: $PROTOKOLL"
  exit 2
fi
