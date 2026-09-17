#!/usr/bin/env bash
# Erstinstallation (macOS/Linux): Abhängigkeiten, Chromium für PDFs, Build, .env anlegen.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js fehlt: https://nodejs.org (LTS 22 oder neuer)"; exit 1; }
node -e "const v=process.versions.node.split('.').map(Number); if (v[0] < 22) { console.error('Node.js 22 oder neuer erforderlich, gefunden ' + process.version); process.exit(1); }"
[ -f .env ] || cp .env.example .env
echo "Abhängigkeiten installieren …"; npm install --no-audit --no-fund
echo "Chromium für PDF-Erzeugung …"; npx playwright install chromium || echo "Hinweis: Chromium konnte nicht geladen werden – alternativ CHROMIUM_PATH in .env auf ein installiertes Chrome/Edge setzen."
echo "Anwendung bauen …"; npm run build
echo
echo "Fertig. Start mit:  bash scripts/start.sh   →  http://127.0.0.1:${PORT:-4800}"
