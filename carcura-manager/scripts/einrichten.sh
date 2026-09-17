#!/usr/bin/env bash
# Automatische Einrichtung (siehe einrichten.mjs). Der Manager muss laufen.
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec node scripts/einrichten.mjs "$@"
