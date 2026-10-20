#!/bin/bash
# Foley fuer die Schritte ohne brauchbaren Mikro-Ton (Entfetten, Keramik auf-/abtragen, Wassertest).
# Quellen: Freesound CC0 (Katalog pipeline/daten/sfx-freesound.md). Alle Stuecke auf denselben Pegel (RMS -37 dBFS)
# wie der Originalton von Waesche/Politur gebracht, mit weichen Blenden. Ziel: remotion/public/sfx/m2/
cd "$(dirname "$0")"
FS=../../remotion/public/sfx/freesound; OUT=../../remotion/public/sfx/m2; mkdir -p $OUT
stueck(){ # name quelle start dauer [ziel-dB]
  local tmp=$OUT/_$1.wav
  ffmpeg -v error -y -ss $3 -t $4 -i "$FS/$2" -ac 2 -ar 48000 -af "highpass=f=90,afade=t=in:d=0.08,afade=t=out:st=$(echo "$4-0.25" | bc):d=0.25" $tmp
  local rms=$(ffmpeg -v error -i $tmp -ac 1 -f s16le - | python3 -c "import sys,numpy as np;a=np.frombuffer(sys.stdin.buffer.read(),dtype=np.int16).astype(np.float32)/32768;print(20*np.log10(np.sqrt(np.mean(a**2))+1e-9))")
  local g=$(python3 -c "print(round(${5:--37}-($rms),2))")
  ffmpeg -v error -y -i $tmp -af "volume=${g}dB" $OUT/$1.wav && rm $tmp && echo "$1: ${4}s, Gain ${g} dB"
}
stueck tuch_entfetten   wiping_hands_on_towel_wav_by_taya_yelton.mp3 1.4 2.8
stueck tuch_entfetten2  wiping_hands_on_towel_wav_by_taya_yelton.mp3 18.4 2.3
stueck auftrag_striche  swiping_glass_flac_by_qubodup.mp3            2.2 9.4 -38
stueck tuch_abtragen    wiping_hands_on_towel_wav_by_taya_yelton.mp3 9.0 6.4
stueck wasser_giessen   pouring_water_into_a_glass_bowl_wav_by_t.mp3 2.0 11.5 -34
