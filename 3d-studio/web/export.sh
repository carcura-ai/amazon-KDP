#!/usr/bin/env bash
# Gerenderte Einzelbilder fuer die Website aufbereiten (wird von render.sh aufgerufen).
# Aufruf: 3d-studio/web/export.sh <out-ordner>   (enthaelt frames/f_0001.png …)
# Ergebnis in <out-ordner>/web/:
#   scrub.mp4   jedes Bild ein Keyframe → beim Scrollen sofort an jede Stelle springen
#   loop.mp4 / loop.webm   Endlosschleife hin und zurueck (Hero, Reel, Angebot)
#   poster.webp  letztes Bild (Explosionsansicht) – Vorschaubild und Fallback bei „Bewegung reduzieren“
#   kontakt.jpg  Kontaktbogen fuer die Sichtkontrolle
set -euo pipefail
OUT="$(cd "$1" && pwd)"
FPS="${FPS:-24}"
W="$OUT/web"; DN="$OUT/entrauscht"
mkdir -p "$W" "$DN"
q() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# 1) Entrauschen: raeumlich (nlmeans) + zeitlich (hqdn3d) – ersetzt den fehlenden OpenImageDenoise.
#    Danach Schwarz anheben: Render-Hintergrund (Ecke von Bild 1) → Seitenfarbe, sonst sieht man einen dunklen Kasten.
SEITE="${SEITE:-9 9 10}"   # carcura.info: #09090A
read -r HR HG HB < <(ffmpeg -hide_banner -loglevel error -i "$OUT/frames/f_0001.png" -vf "crop=8:8:4:4,scale=1:1" \
  -f rawvideo -pix_fmt rgb24 - | od -An -tu1)
read -r SR SG SB <<< "$SEITE"
hebe() { echo "clip($2+(val-$1)*(255-$2)/(255-$1),0,255)"; }
LUT="lutrgb=r='$(hebe "$HR" "$SR")':g='$(hebe "$HG" "$SG")':b='$(hebe "$HB" "$SB")'"
q -framerate "$FPS" -i "$OUT/frames/f_%04d.png" -vf "nlmeans=s=3:p=7:r=13,hqdn3d=0:0:4:4,$LUT" "$DN/d_%04d.png"
N=$(ls "$DN" | wc -l)

# 2) Scroll-Video: alle Bilder Keyframes
q -framerate "$FPS" -i "$DN/d_%04d.png" -c:v libx264 -preset slow -crf 22 -g 1 -pix_fmt yuv420p \
  -movflags +faststart -an "$W/scrub.mp4"

# 3) Schleife: vor – halten – zurueck – halten (MODUS=vor: nur vorwaerts, Ende halten, weich ab- und einblenden –
#    fuer Ablaeufe, die rueckwaerts keinen Sinn ergeben, z. B. eine Waesche)
PP="[0]split[a][b];[a]tpad=stop_mode=clone:stop_duration=1.2[f];[b]reverse,tpad=stop_mode=clone:stop_duration=0.8[r];[f][r]concat=n=2:v=1"
if [ "${MODUS:-pingpong}" = "vor" ]; then
  D=$(awk "BEGIN{print $N/$FPS + 1.2}")
  PP="[0]tpad=stop_mode=clone:stop_duration=1.2,fade=t=in:st=0:d=0.35:color=0x09090A,fade=t=out:st=$(awk "BEGIN{print $D-0.45}"):d=0.45:color=0x09090A"
fi
q -framerate "$FPS" -i "$DN/d_%04d.png" -filter_complex "$PP" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -movflags +faststart -an "$W/loop.mp4"
q -framerate "$FPS" -i "$DN/d_%04d.png" -filter_complex "$PP" -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -an "$W/loop.webm"

# 3b) Einmal abspielen (Website mit Pause-/Nochmal-Knopf): kein Ausblenden, Ende 1,2 s halten.
#     WEB_BREITE (z. B. 720) verkleinert fuer das 2-MB-Budget je Seite, WEB_CRF regelt die Qualitaet.
q -framerate "$FPS" -i "$DN/d_%04d.png" -vf "tpad=stop_mode=clone:stop_duration=1.2,scale=${WEB_BREITE:-960}:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf "${WEB_CRF:-25}" -pix_fmt yuv420p -movflags +faststart -an "$W/einmal.mp4"

# 4) Standbild + Kontaktbogen (POSTER=<bildnummer> waehlt ein anderes Standbild als das letzte)
q -i "$DN/$(printf 'd_%04d.png' "${POSTER:-$N}")" -c:v libwebp -quality "${POSTER_Q:-74}" "$W/poster.webp"
q -framerate "$FPS" -i "$DN/d_%04d.png" -vf "select='not(mod(n\,$(( (N + 11) / 12 ))))',scale=240:-1,tile=6x2:padding=4" -frames:v 1 "$W/kontakt.jpg"

echo "Web-Dateien ($N Bilder):"
ls -l "$W" | awk 'NR>1 {printf "  %-12s %6.0f KB\n", $9, $5/1024}'
