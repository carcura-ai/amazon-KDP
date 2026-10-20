#!/usr/bin/env bash
# Einmalige Einrichtung des Reel-Studios (Linux-Container oder eigener Rechner).
# Mac: vorher "brew install ffmpeg node python"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
command -v ffmpeg >/dev/null || { sudo apt-get update && sudo apt-get install -y ffmpeg; }
pip3 install -q faster-whisper numpy
(cd "$ROOT/remotion" && npm ci)

# Sound-Effekte synthetisch erzeugen (lizenzfrei, keine Fremdrechte)
S="$ROOT/remotion/public/sfx"; mkdir -p "$S"
ff() { ffmpeg -v error -y -f lavfi -i "$1" ${2:+-af "$2"} -ar 48000 -ac 2 "$S/$3.wav"; }
ff "aevalsrc=0.8*sin(2*PI*(500+1100*exp(-t*38))*t)*exp(-t*22):d=0.22" "" pop
ff "anoisesrc=d=0.5:c=pink:a=0.7" "highpass=f=500,lowpass=f=4000,afade=t=in:d=0.22:curve=exp,afade=t=out:st=0.22:d=0.28" whoosh
ff "aevalsrc=0.5*sin(2*PI*1318*t)*exp(-t*9)+0.25*sin(2*PI*1976*t)*exp(-t*12):d=0.6" "" ding
echo "Reel-Studio bereit."
