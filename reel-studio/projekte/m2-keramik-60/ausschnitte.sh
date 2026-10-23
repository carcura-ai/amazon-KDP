#!/bin/bash
# Waehlt die besten Ausschnitte aus dem POV-Material und richtet sie aus (Drehung, Zuschnitt auf Haende/Auto, Helligkeit).
# Ergebnis: raw/<id>.mp4 (1440x2560, H.264) – danach analyze.py. Zeiten = Position im Originalclip.
# Zuschnitt: C = Bildanteil (9:16 bleibt), AX/AY = Lage 0 (links/oben) … 1 (rechts/unten).
cd "$(dirname "$0")"
Q=quelle_links
TONEMAP="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
HELL="eq=gamma=1.22:contrast=1.04:saturation=1.08"
cut(){ # id quelle start dauer filter-vorne zuschnitt(C AX AY|-) extra
  local id=$1 src=$2 ss=$3 t=$4 pre=$5 c=$6 extra=$7 vf
  if [ "$c" = "-" ]; then crop=""; else set -- $c; crop="crop=iw*$1:ih*$1:(iw-iw*$1)*$2:(ih-ih*$1)*$3,"; fi
  vf="${pre}${crop}scale=1440:2560:flags=lanczos${extra:+,$extra},format=yuv420p"
  [ -f raw/$id.mp4 ] && [ raw/$id.mp4 -nt "$0" ] && return
  nice -n 5 ffmpeg -v error -y -ss "$ss" -t "$t" -i "$Q/$src" -map 0:v:0 -map 0:a:0 -vf "$vf" \
    -c:v libx264 -preset medium -crf 15 -c:a aac -b:a 192k -ar 48000 -movflags +faststart raw/$id.mp4 && echo "ok $id"
}
mkdir -p raw
# 1 Waschen
cut b01_front  b01_182432.mp4 8.5   3.5 ""            "-"
cut b02_spruehen b01_182432.mp4 25.0 11.5 ""           "-"
cut b03_nebel  b01_182432.mp4 90.5  6.0 ""            "0.62 0.5 1"
cut b04_nebel  b01_182432.mp4 112.5 3.5 ""            "0.62 0.5 1"
cut b05_lanze  b01_182432.mp4 166.5 7.5 ""            "0.62 0.6 1"
# 2 Polieren
cut b06_maschine b03_201824.mp4 39.5 7.5 ""           "0.6 1 1"       "$HELL"
cut b07_m2     b03_201824.mp4 106.5 8.5 ""            "-"
cut b08_spiegel b03_201824.mp4 127.5 7.5 ""           "-"
cut b09_reflex b03_201824.mp4 96.5  6.5 ""            "-"
# 3 Entfetten (Clip lag kopfueber)
cut b10_spray  b05_205054.mp4 22.5  4.5 "hflip,vflip," "-"
cut b11_tuch   b05_205054.mp4 43.5  9.5 "hflip,vflip," "0.75 0 1"
cut b12_tuch2  b04_202100.mp4 3.0   5.0 ""            "0.62 0.7 1"    "$HELL"
# 4 Keramik auftragen
cut b13_auftrag b06_205634.mp4 72.5 10.5 ""           "0.55 0.75 1"
cut b14_auftrag2 b06_205634.mp4 33.5 6.5 ""           "0.55 0.6 1"
# 5 Keramik abtragen
cut b15_abtrag b07_210410.mp4 11.5  6.5 ""            "0.55 0.4 1"    "$HELL"
cut b16_abtrag2 b07_210410.mp4 107.5 9.5 ""           "0.55 0.1 1"    "$HELL"
# 6 Wassertest (iPhone, HDR -> SDR, 60 fps bleibt fuer Zeitlupe)
cut b17_wasser b08_iphone.mov 4.0 13.0 "$TONEMAP,"      "-"
