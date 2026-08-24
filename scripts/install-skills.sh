#!/usr/bin/env bash
#
# Installiert die KDP-Skills aus diesem Projekt als persönliche Skills
# nach ~/.claude/skills/<skill-name>/SKILL.md
#
# Vorhandene gleichnamige Skills werden VORHER gesichert nach
# ~/.claude/backups/skills-JJJJMMTT-HHMMSS/ — es wird nichts ungesichert überschrieben.
#
# Aufruf:  ./scripts/install-skills.sh
#
set -euo pipefail

PROJEKT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUELLE="$PROJEKT/.claude/skills"
ZIEL="$HOME/.claude/skills"
STEMPEL="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/.claude/backups/skills-$STEMPEL"

[ -d "$QUELLE" ] || { echo "FEHLER: $QUELLE nicht gefunden." >&2; exit 1; }
mkdir -p "$ZIEL"

gesichert=0; installiert=0

for pfad in "$QUELLE"/*/; do
  skill="$(basename "$pfad")"
  [ -f "$pfad/SKILL.md" ] || { echo "  übersprungen (kein SKILL.md): $skill"; continue; }

  if [ -e "$ZIEL/$skill" ]; then
    mkdir -p "$BACKUP"
    cp -a "$ZIEL/$skill" "$BACKUP/$skill"
    echo "  gesichert:    $skill  ->  $BACKUP/$skill"
    gesichert=$((gesichert+1))
    rm -rf "$ZIEL/$skill"
  fi

  cp -a "$pfad" "$ZIEL/$skill"
  echo "  installiert:  $skill"
  installiert=$((installiert+1))
done

echo
echo "Fertig: $installiert Skills installiert, $gesichert gesichert."
[ "$gesichert" -gt 0 ] && echo "Backup: $BACKUP"
echo "Prüfen mit:  /skills"
