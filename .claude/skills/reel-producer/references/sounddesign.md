# Sounddesign

Grundsatz: Jeder Sound gehoert zu einem sichtbaren Ereignis. Stimme hat immer Vorrang.

## Pegel (Lautstaerke-Werte `vol` in edit.json)

| Ebene | vol | Hinweis |
|---|---|---|
| Stimme (A-Roll, Voiceover) | 1.0 | in analyze.py veredelt und auf −16 LUFS gebracht |
| Akzent-Sounds | 0.2–0.35 | Impact/Sub-Drop bis 0.5 |
| Musikbett | 0.12–0.2 | `duck` 0.04–0.06 = automatisch leiser unter Sprache |
| B-Roll-Originalton (ASMR) | 0.6–0.9 ohne Sprache, 0.1–0.2 unter VO (`bvol`) | Schaum, Spruehen, Polierer |

Master: render.sh normalisiert auf ≈ −14 LUFS, Spitzen ≤ −1,5 dBTP.

## Bibliothek (`remotion/public/sfx/`)

Eigene (synthetisch, ohne Fremdrechte): `pop` Text/Sticker · `whoosh` Uebergang · `whip` schneller Schwenk ·
`click` UI/Haekchen · `ding` Vorteil/Erfolg · `cash` Preis/Ersparnis · `impact` Schlagwort/Reveal ·
`subdrop` Hook/grosser Moment · `riser` Spannung vor Reveal (1,4 s) · `shimmer` Glanz/Sauber ·
`drop` Wassertropfen · `shutter` Vorher/Nachher-Foto · `typing` Text tippt sich ein · `spray` Spruehflasche

Kenney (CC0, `kenney/<name>.ogg`, Name mit Endung angeben): z. B. `kenney/confirmation_001.ogg`,
`kenney/glass_002.ogg` (Glas-Klirr fuer Glanz), `kenney/impactMetal_heavy_000.ogg`, `kenney/impactSoft_medium_001.ogg`,
`kenney/switch_002.ogg`, `kenney/drop_002.ogg`, `kenney/maximize_004.ogg` (Swoosh hoch), `kenney/minimize_004.ogg`,
`kenney/glitch_001.ogg`, `kenney/footstep_concrete_000.ogg`. Liste: `ls remotion/public/sfx/kenney`.

## Zuordnung (auto.sfx macht die Basis)

| Ereignis | Sound | Timing |
|---|---|---|
| Hook-Titel | subdrop (+ impact) | auf dem ersten Frame |
| Uebergang Zoom/Whip | whoosh/whip | Mitte des Uebergangs = Clipstart |
| Text, Sticker, Bauchbinde | pop / whip | auf Erscheinen |
| Haekchen, Vorteil | ding oder click | auf dem gesprochenen Wort |
| Preis faellt / neuer Preis | whoosh / cash | auf Durchstreichen / Erscheinen |
| Vorher/Nachher fertig | shimmer (+ shutter beim Start) | Ende des Wischers |
| Grosser Reveal | riser 1,4 s vorher → impact + flash | Reveal-Frame |
| Wasser perlt ab | drop (2–3 Stueck versetzt) | auf sichtbare Tropfen |
| Winter/Schnee | shimmer leise | Einblendung |

## Carcura-Musikstil (Nutzervorgabe)

**Musik-DNA aus der Nutzer-Playlist „526“** (100 Titel, ausgewertet am 20.10.2026):
- Deutscher Strassenrap: KITSCHKRIEG/SFR/Trettmann, Gzuz, Bonez MC, RAF Camora, Luciano, Olexesh, Haftbefehl, Kolja Goldstein („Audi Bande“)
- Phonk / Drift-Phonk: DRAGONMANE, ZODIVK („Tokyo Drift“), RAIZHELL, „BRAZILIAN DANÇA PHONK“, Undagroundmane („Burnin' Tires“)
- Cloud-Rap / Underground: BONES (Top-Artist), $uicideboy$, Night Lovell
→ dunkel, bassig, cool-aggressiv. Auto-Montagen = Phonk; Story/Sprecher = Dark Hip-Hop oder Strasse; ruhig/Premium = Cloud.

Quellen in dieser Reihenfolge (alle rechtssicher):
1. **Eigene Beats** `python3 -I pipeline/beatgen.py projekte/<n> --stil phonk|cloud|strasse --dauer <s> --seed <n>`
   (keine Lizenz/Nennung, exaktes Beat-Raster; Seed variiert Tonart/Muster). Nutzerbewertung der Stile im LERNLOG festhalten.
2. **ccMixter (CC BY)** `asset.py ccmixter "phonk"` → `ccmixterhole <id>`: bewaehrt „Red Eyed Beast“ (Phonk), „Mr. Wozzie“ (Dark Hip-Hop),
   „Spheres“ (chill). Auswahl: Bass ≥ 35 %, Gesang 0 % bei Montagen.
3. Kevin MacLeod nur fuer Nicht-Auto-Themen.
Playlist-Songs selbst nie einbauen (Urheberrecht) – nur ueber die App-Bibliothek, falls dort vorhanden.

**Echte Sounds (Freesound, nur CC0):** `asset.py sound "water splash"` → `freesound/<datei>.mp3`; Katalog `pipeline/daten/sfx-freesound.md`.
Vorhanden: Wasserspritzer, Spruehflasche, Autotuer, Hochdruckreiniger, Motorstart/Rev, Poliermaschine. In edit.json mit `"dur"` begrenzen.

## Musik nach Stimmung (Pflicht in jedem Video)

| Stimmung (`asset.py musik`) | Einsatz | Referenz |
|---|---|---|
| transformation | Vorher/Nachher, Aufbau zum Reveal | „Halfway Down“-Prinzip (kienobifilms) |
| motivierend / energie | Prozess-Montagen, Beat-Schnitt 110–130 bpm | „Now or Never“-Prinzip |
| episch | Zeitlupe, Weite, Hero-Shot | „Interstellar“-Prinzip |
| spannung / dramatisch | Hook, Problem zeigen | „New Computers“-Prinzip |
| entspannt / chill / luxus | Innenraum, Abholung, Premium | „Daisies“-Prinzip |
| froehlich | Blooper, Behind the Scenes | |

Quelle: Kevin MacLeod (incompetech.com, CC BY 4.0, Nennung in der Beschreibung). Charts-Songs aus Referenzen nur ueber die
App-Bibliothek fuer Unternehmenskonten. Musik startet im energiereichsten Abschnitt (`music.from` aus `musikhole`).

## Sound-Paare (Uebergang/Aktion → Sound)

Zoom-out/Pull → tiefer whoosh · Whip → whip · Flash/Reveal → riser davor + impact · Text erscheint → pop/click ·
Chat-Nachricht → pop · Geld/Preis → cash · Glanz → shimmer/`kenney/glass_*.ogg` · Wasser → drop · Foto/Vorher-Nachher → shutter ·
UI/Tippen → typing. Schichten wie bei via.masi: Riser → Aktion → Pop, nie mehr als ein Akzent pro ~0,5 s.

## Regeln

- Hoechstens ein Akzent pro ~1 s; mehr wirkt billig.
- Gleichen Sound nicht dreimal hintereinander – variieren (eigene + Kenney).
- Vor einer Pointe 0,3–0,5 s Stille statt Sound.
- ASMR-Momente (Schaum, Polierer): Musik kurz stark absenken (eigenes Segment, `music.duck`-Prinzip), Originalton hoch (`vol` 0.8).
- **Musik ist Pflicht** (Nutzervorgabe): ohne Sprache traegt sie das Video, mit Sprache leise darunter (vol 0.16, duck 0.05).
  Quelle standardmaessig Kevin MacLeod (CC BY 4.0, Nennung in der Beschreibung); Trend-Sounds nur zusaetzlich ueber die App-Bibliothek
  fuer Unternehmenskonten (TikTok: Commercial Music Library).
