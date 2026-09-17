#!/usr/bin/env bash
# Update (macOS/Linux): Sicherung → Code aktualisieren → Abhängigkeiten → Build.
# Aufruf ohne laufenden Server: bash scripts/update.sh   (das Startskript ruft es mit --no-backup auf,
# weil die Anwendung vorher selbst gesichert hat).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ "${1:-}" != "--no-backup" ]; then
  if [ -f server/dist/cli.js ]; then node server/dist/cli.js backup pre-update; else echo "Kein Build vorhanden – Sicherung übersprungen."; fi
fi
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Code aktualisieren (git pull) …"
  git pull --ff-only
else
  echo "Kein Git-Arbeitsverzeichnis: bitte neue Version manuell entpacken, danach erneut ausführen."
fi
echo "Abhängigkeiten installieren …"
npm install --no-audit --no-fund
echo "Anwendung bauen …"
npm run build
echo "Update abgeschlossen. Version: $(node -p "require('./server/package.json').version")"
