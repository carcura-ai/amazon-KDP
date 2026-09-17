#!/usr/bin/env bash
# Startskript (macOS/Linux): startet den Manager und reagiert auf Neustart (Exit 75)
# und Update (Exit 76), die aus der Oberfläche unter Einstellungen → System ausgelöst werden.
set -u
cd "$(dirname "$0")/.."
export CM_LAUNCHER=1
export NODE_ENV="${NODE_ENV:-production}"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ ! -f server/dist/index.js ]; then echo "Build fehlt – führe scripts/install.sh aus."; exit 1; fi
while true; do
  node server/dist/index.js
  code=$?
  case $code in
    75) echo "Neustart angefordert …"; sleep 1 ;;
    76) echo "Update angefordert …"; bash scripts/update.sh --no-backup || echo "Update fehlgeschlagen – vorherige Version wird gestartet."; sleep 1 ;;
    *) echo "Manager beendet (Code $code)."; exit $code ;;
  esac
done
