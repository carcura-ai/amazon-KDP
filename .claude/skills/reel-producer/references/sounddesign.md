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

## Regeln

- Hoechstens ein Akzent pro ~1 s; mehr wirkt billig.
- Gleichen Sound nicht dreimal hintereinander – variieren (eigene + Kenney).
- Vor einer Pointe 0,3–0,5 s Stille statt Sound.
- ASMR-Momente (Schaum, Polierer): Musik und Effekte weg, Originalton hoch (Segment `vol` 0.8).
- **Musik:** Unternehmenskonten nur mit kommerziell lizenzierter Musik. Liefert der Nutzer keinen lizenzierten Titel,
  ohne Musik exportieren und empfehlen, in der App einen Titel aus der kommerziellen Bibliothek
  (Instagram: fuer Business-Konten freigegebene Auswahl; TikTok: Commercial Music Library) leise (ca. 15–20 %) zu ergaenzen.
