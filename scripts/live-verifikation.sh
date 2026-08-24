#!/usr/bin/env bash
#
# Live-Verifizierung der Trendchancen auf amazon.de mit echtem Browser.
#
# Prüft zuerst, ob amazon.de überhaupt erreichbar ist, und startet erst dann
# die Erhebung. So scheitert der Lauf nicht erst nach Minuten.
#
# Aufruf:
#   ./scripts/live-verifikation.sh                 # alle Chancen
#   ./scripts/live-verifikation.sh --chancen C3    # nur C3 (Laternenfest)
#   ./scripts/live-verifikation.sh --sichtbar      # mit Browserfenster
#
set -uo pipefail

PROJEKT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJEKT" || exit 3

echo "== 1/3  Erreichbarkeit prüfen =="
# Wichtig: curl-Fehlertext NICHT in die Variable lassen (2>/dev/null) und den
# Exit-Code getrennt auswerten. Sonst landet "curl: (56) CONNECT tunnel failed"
# im Ergebnis und die Prüfung meldet fälschlich Erfolg.
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://www.amazon.de/ 2>/dev/null)"
CURL_RC=$?
if [ "$CURL_RC" -ne 0 ] || [ -z "$CODE" ] || [ "$CODE" = "000" ] || [ "$CODE" = "403" ] || [ "$CODE" = "503" ]; then
  echo
  echo "amazon.de ist von diesem Rechner aus nicht erreichbar."
  echo "  curl-Exit-Code: $CURL_RC   HTTP-Status: ${CODE:-keiner}"
  echo
  echo "Mögliche Ursachen:"
  echo "  - Netzwerk-/Proxy-Richtlinie blockiert die Verbindung"
  echo "  - kein Internetzugang"
  echo
  echo "Ein Browser umgeht das nicht — die Sperre greift vor der Seite."
  echo "Auf einem Rechner mit normalem Internetzugang erneut ausführen."
  exit 4
fi
echo "amazon.de erreichbar (HTTP $CODE)"

echo "== 2/3  Browser vorbereiten =="
if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  echo "Playwright fehlt — installiere lokal..."
  npm install playwright --no-audit --no-fund --loglevel=error || { echo "npm install fehlgeschlagen."; exit 3; }
fi

# Vorinstalliertes Chromium bevorzugen, sonst Playwright selbst laden lassen.
BIN="$(find "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" -maxdepth 3 -type f -name chrome 2>/dev/null | head -1)"
if [ -n "$BIN" ]; then
  export CHROMIUM_BIN="$BIN"
  echo "Chromium: $BIN"
else
  echo "Kein vorinstalliertes Chromium gefunden — lade Browser..."
  npx playwright install chromium || { echo "Browser-Installation fehlgeschlagen."; exit 3; }
fi

echo "== 3/3  Erhebung starten =="
node scripts/live-verifikation.mjs "$@"
STATUS=$?

if [ "$STATUS" -eq 0 ]; then
  echo
  echo "Fertig. Rohdaten liegen in amazon-kdp-business/research/raw/"
  echo "Nächster Schritt in Claude Code:"
  echo "  > Werte die Live-Daten aus research/raw/ aus und bewerte die Chancen neu"
fi
exit "$STATUS"
