#!/usr/bin/env bash
# Einmalige Einrichtung des Reel-Studios (Linux-Container oder eigener Rechner).
# Mac: vorher "brew install ffmpeg node python"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
command -v ffmpeg >/dev/null || { sudo apt-get update && sudo apt-get install -y ffmpeg; }
pip3 install -q faster-whisper numpy "rembg[cpu]" gdown yt-dlp mediapipe python-dateutil
(cd "$ROOT/remotion" && npm ci)

"$ROOT/pipeline/sfx.sh"
for s in clash-display satoshi cabinet-grotesk; do python3 -I "$ROOT/pipeline/asset.py" schrift $s; done  # Fontshare (ITF FFL)
echo "Reel-Studio bereit."
