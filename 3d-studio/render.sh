#!/usr/bin/env bash
# 3D-Modell rendern und fuer die Website aufbereiten.
# Aufruf: 3d-studio/render.sh <modell> [--vorschau] [--still N] [--frames A-B]
#   --still N   nur Bild N (Kontrolle von Licht/Kamera, schnell)
#   --vorschau  halbe Aufloesung, 24 Samples
# Ergebnis: 3d-studio/out/<modell>/ (frames/, still_*.png) und nach vollem Lauf web/ (siehe export.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
M="$1"; shift
OUT="$ROOT/out/$M"
BLENDER="${BLENDER:-blender}"
command -v "$BLENDER" >/dev/null || { echo "Blender fehlt: sudo apt-get install -y blender"; exit 1; }
"$BLENDER" -b --factory-startup -noaudio --python "$ROOT/modelle/$M.py" -- --out "$OUT" "$@" \
  | grep -E "^Fra:.*(Sample [0-9]+/|Finished)|Saved|Error|Traceback" | grep -vE "Sample [0-9]*[1-9]/" || true
case " $* " in *" --still "*) exit 0;; esac
"$ROOT/web/export.sh" "$OUT"
