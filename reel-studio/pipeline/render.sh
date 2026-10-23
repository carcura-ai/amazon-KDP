#!/usr/bin/env bash
# Rendert ein Reel-Projekt komplett: Props -> Remotion -> Lautheit -14 LUFS -> fertige MP4 + SRT
# Aufruf: ./pipeline/render.sh projekte/<name> [--still <sekunde>]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
P="$(cd "$1" && pwd)"; NAME="$(basename "$P")"
PUB="$ROOT/remotion/public/projekte/$NAME"
mkdir -p "$PUB" "$P/export"
# Medien bereitet analyze.py auf; hier nur Projekt-Assets und Musik spiegeln
mkdir -p "$ROOT/remotion/public/brand" && cp -u "$ROOT"/brand/*.png "$ROOT/remotion/public/brand/"
for d in assets musik; do [ -d "$P/$d" ] && mkdir -p "$PUB/$d" && cp -u "$P/$d"/* "$PUB/$d"/; done
python3 -I "$ROOT/pipeline/props.py" "$P"

CHROME=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1 || true)
FLAGS=(--props="$P/export/props.json" --gl=swangle ${CHROME:+--browser-executable="$CHROME"})
cd "$ROOT/remotion"

if [[ "${2:-}" == "--still" ]]; then  # Einzelbild zur Kontrolle
  npx remotion still src/index.ts Reel "$P/export/still_$3.png" --frame="$(python3 -c "print(round($3*30))")" "${FLAGS[@]}"
  exit 0
fi

npx remotion render src/index.ts Reel "$P/export/render.mp4" --codec=h264 --crf=17 --concurrency=4 "${FLAGS[@]}"
# Nutzer legt Musik selbst an ("lautheit": false in edit.json): nur Effekt-Spur, Spitzen auf -6 dBFS, plus Fassung ohne Ton
if python3 -c "import json,sys; sys.exit(0 if json.load(open('$P/edit.json')).get('lautheit', True) is False else 1)"; then
  PK=$(ffmpeg -i "$P/export/render.mp4" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  ffmpeg -v error -y -i "$P/export/render.mp4" -c:v copy -af "volume=$(python3 -c "print(round(-6-($PK),2))")dB" \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$P/export/${NAME}_final.mp4"
  ffmpeg -v error -y -i "$P/export/render.mp4" -c:v copy -an -movflags +faststart "$P/export/${NAME}_ohne_ton.mp4"
  rm "$P/export/render.mp4"
  echo "Fertig (Effekt-Spur, Musik legt der Nutzer an): $P/export/${NAME}_final.mp4 + ${NAME}_ohne_ton.mp4"
  exit 0
fi
# Lautheit in zwei Durchgaengen (linear, ohne Pumpen): Ziel -14 LUFS, Spitzen max. -1,5 dBTP
M=$(ffmpeg -hide_banner -i "$P/export/render.mp4" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -v error -y -i "$P/export/render.mp4" -c:v copy -af "$LN" \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$P/export/${NAME}_final.mp4"
rm "$P/export/render.mp4"
# Qualitaetssicherung: Pegel je 0,5 s direkt aus den Audiodaten; >= 1,5 s unter -45 dB = Stille-Luecke (fehlende Musik?)
ffmpeg -v error -i "$P/export/${NAME}_final.mp4" -ac 1 -ar 8000 -f s16le - | python3 -c "
import sys, numpy as np
a = np.frombuffer(sys.stdin.buffer.read(), np.int16).astype(np.float32) / 32768
w = a[: len(a) // 4000 * 4000].reshape(-1, 4000)
db = 20 * np.log10(np.sqrt((w ** 2).mean(1)) + 1e-9)
gaps, k = [], 0
while k < len(db):
    j = k
    while j < len(db) and db[j] < -45: j += 1
    if j - k >= 3: gaps.append(f'{k / 2:.1f}-{j / 2:.1f}s')
    k = j + 1
print('WARNUNG Stille-Luecke: ' + ', '.join(gaps) if gaps else 'Ton-Check ok: keine Stille-Luecken')"
echo "Fertig: $P/export/${NAME}_final.mp4"
