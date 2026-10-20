#!/bin/bash
# Foley fuer die Schritte ohne brauchbaren Mikro-Ton (Entfetten, Keramik auf-/abtragen, Wassertest).
# Quellen: Freesound CC0 (Katalog pipeline/daten/sfx-freesound.md). pipeline/foley.py reiht nur die aktiven Stellen
# aneinander (durchgehend, keine Ton-Loecher) und bringt alles auf RMS -37 dBFS wie den Originalton von Waesche/Politur.
cd "$(dirname "$0")"
FS=../../remotion/public/sfx/freesound; OUT=../../remotion/public/sfx/m2; mkdir -p $OUT
F="python3 -I ../../pipeline/foley.py"
FEIN=$FS/light_material_on_light_material_light_f.mp3     # feines Tuch auf glatter Flaeche (hell, durchgehend)
$F $FEIN 4.8 $OUT/tuch_entfetten.wav --schwelle 26
$F $FS/4_strokes_on_a_fabric_desk_mat_by_franck.mp3 9.5 $OUT/auftrag_striche.wav --schwelle 26 --ziel -38 --bett $FEIN --bett-von 1 --bett-db -14
$F $FS/rubbing_cloth_by_vandale.mp3 6.4 $OUT/tuch_abtragen.wav --schwelle 26 --bett $FEIN --bett-von 1.6 --bett-db -10
$F $FS/pouring_water_into_a_glass_bowl_wav_by_t.mp3 11.6 $OUT/wasser_giessen.wav --von 26 --bis 40 --schwelle 30 --ziel -34 \
   --bett $FS/trickling_water_5_by_yoyodaman234.mp3 --bett-von 2 --bett-db -12
