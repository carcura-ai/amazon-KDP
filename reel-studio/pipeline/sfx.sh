#!/usr/bin/env bash
# Baut die Sound-Bibliothek in remotion/public/sfx/ auf:
#  1. eigene synthetische Sounds (keine Fremdrechte)
#  2. Kenney-Packs (CC0 / gemeinfrei): interface-sounds, impact-sounds, ui-audio
set -euo pipefail
S="$(cd "$(dirname "$0")/.." && pwd)/remotion/public/sfx"; mkdir -p "$S/kenney"
syn() { local e="${1%:d=*}" d="${1##*:d=}"; ffmpeg -v error -y -f lavfi -i "aevalsrc='$e':d=$d" ${3:+-af "$3"} -ar 48000 -ac 2 "$S/$2.wav"; }
noise() { ffmpeg -v error -y -f lavfi -i "anoisesrc=d=$1:c=pink:a=0.7" -af "$3" -ar 48000 -ac 2 "$S/$2.wav"; }

syn "0.8*sin(2*PI*(500+1100*exp(-t*38))*t)*exp(-t*22):d=0.22" pop
syn "0.5*sin(2*PI*1318*t)*exp(-t*9)+0.25*sin(2*PI*1976*t)*exp(-t*12):d=0.6" ding
syn "0.8*sin(2*PI*2500*t)*exp(-t*300):d=0.05" click
syn "0.6*sin(2*PI*(400*t+2800*t*t))*exp(-t*22):d=0.16" drop
syn "0.9*sin(2*PI*(110*exp(-t*6)+38)*t)*exp(-t*3.2)+0.35*(random(0)*2-1)*exp(-t*28):d=1.2" impact "lowpass=f=2500"
syn "0.9*sin(2*PI*(70*exp(-t*1.2)+28)*t)*exp(-t*1.6):d=1.8" subdrop
syn "0.35*sin(2*PI*(180*t+260*t*t))*t/1.4+0.25*(random(0)*2-1)*(t/1.4)^2:d=1.4" riser "highpass=f=250,afade=t=out:st=1.32:d=0.08"
syn "0.16*(sin(2*PI*2637*t)*exp(-t*6)+gt(t,0.07)*sin(2*PI*3136*t)*exp(-(t-0.07)*6)+gt(t,0.14)*sin(2*PI*3951*t)*exp(-(t-0.14)*6)+gt(t,0.21)*sin(2*PI*5274*t)*exp(-(t-0.21)*5)):d=1.1" shimmer
syn "0.4*sin(2*PI*2093*t)*exp(-t*8)+0.4*gt(t,0.09)*sin(2*PI*2637*(t-0.09))*exp(-(t-0.09)*6)+0.5*(random(0)*2-1)*exp(-t*200):d=0.8" cash
syn "(random(0)*2-1)*(exp(-t*120)+gt(t,0.07)*exp(-(t-0.07)*90))*0.7:d=0.22" shutter "bandpass=f=3500:width_type=h:w=4000"
syn "(random(0)*2-1)*exp(-mod(t,0.11)*180)*0.5:d=0.9" typing "bandpass=f=3000:width_type=h:w=3000"
noise 0.5 whoosh "highpass=f=500,lowpass=f=4000,afade=t=in:d=0.22:curve=exp,afade=t=out:st=0.22:d=0.28"
noise 0.28 whip "highpass=f=900,lowpass=f=6000,afade=t=in:d=0.1:curve=exp,afade=t=out:st=0.1:d=0.18"
noise 2.0 spray "highpass=f=2500,afade=t=in:d=0.15,afade=t=out:st=1.6:d=0.4,volume=0.5"

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
for p in interface-sounds impact-sounds ui-audio; do
  z=$(curl -sS -L -A "Mozilla/5.0" "https://kenney.nl/assets/$p" | grep -o "https://kenney.nl/media/pages/assets/$p/[^\"]*\.zip" | head -1) || true
  [ -z "$z" ] && { echo "Kenney $p nicht gefunden – uebersprungen"; continue; }
  curl -sS -L -o "$T/$p.zip" "$z" && unzip -q -o "$T/$p.zip" -d "$T/$p"
  find "$T/$p" -name "*.ogg" -exec cp {} "$S/kenney/" \;
  cp "$T/$p/License.txt" "$S/kenney/LICENSE-$p.txt"
done
echo "Sounds: $(ls "$S" | wc -l) eigene, $(ls "$S/kenney" | grep -c ogg) Kenney (CC0)"
