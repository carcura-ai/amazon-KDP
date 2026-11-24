# Außenwäsche (Scroll-Effekt): Stand, Prüfwerte und fehlendes Material (24.11.2026)

> **Stand nach Nutzervorgabe vom 24.11.2026:** Auf der Website gibt es kein Video mehr. Die Wäsche läuft als Scroll-Effekt ab (`src/assets/js/wash.js`, siehe `ENTSCHEIDUNGEN.md` §14).
> Ausgeliefert werden `src/assets/wash/d/0–3.webp` (1600 × 1062, 0,59 MB), `src/assets/wash/m/0–3.webp` (1080 × 717, 0,39 MB) und `src/assets/wash/field.png` (960 × 637, 0,28 MB, R = Laufkante, G = Trocknungsflecken). Neu erzeugen mit `python3 src/video/build_scroll_assets.py`.
> Die Videodateien unten liegen jetzt unter `src/video/out/` und sind nur noch Vorschau bzw. Social-Media-Material.
> **Austausch bei echtem Material:** Sind die vier Zustände echte Fotos oder Renderings mit fester Kamera, werden sie unter denselben Namen abgelegt (`0` verschmutzt, `1` Schaum, `2` gespült, `3` sauber). Bei einem echten Waschfilm ist eine Bildfolge besser: alle 3–4 Bilder als WebP, `wash.js` zeichnet dann Bild n statt der Shadermischung.

## Gelieferte Dateien (Vorschau)
| Datei | Codec | Auflösung | fps | Dauer | Größe |
|---|---|---|---|---|---|
| `src/video/out/carcura-aussenwaesche-1920x1080.mp4` | H.264 High, yuv420p, faststart | 1920 × 1080 | 30 | 13,3 s (399 Bilder) | 2,1 MB |
| `src/video/out/carcura-aussenwaesche-mobil.mp4` | H.264 High, faststart | 1080 × 718 (ganzes Bild 3:2) | 30 | 13,3 s | 1,2 MB |
| `….webm` (beide Größen) | VP9 | wie oben | 30 | 13,3 s | 1,8 / 1,2 MB |
| `…-poster.jpg` | JPEG, erster Frame | 1920 × 1080 / 1080 × 718 | – | – | 0,25 / 0,15 MB |

**Ablauf** (Sprungmarken auf der Website):
| Zeit | Phase |
|---|---|
| 0 s | verschmutzt (Ruhe) |
| 2,0 s | Schaum läuft von oben nach unten auf |
| 5,8 s | Abspülen von oben nach unten |
| 8,4 s | nass |
| 9,5 s | fleckiges Abtrocknen |
| 11,7 s | sauber |

Einzelbilder aus dem fertigen Video: `audit/video-frames/` (0,0 / 1,0 / 3,0 / 4,3 / 5,0 / 6,6 / 7,6 / 8,9 / 10,4 / 13,2 s), Übersicht `uebersicht.jpg`.

## Was die Vorschau ist und was nicht
- **Grundlage:** vier KI-Einzelbilder (762 × 506 px, gleiche Kamera), mit Lanczos auf 1920 px hochgerechnet. Sie werden mit schwerkraftgerichteten Masken ineinander überführt: Schaum und Spülwasser laufen von oben nach unten mit unregelmäßiger Kante, das Abtrocknen ist fleckig.
- **Stabil:** Halle, Kamera, Poster und Leuchten bleiben stabil, Verschiebung zwischen den Zuständen 0 px laut Phasenkorrelation.
- **Fahrzeugkontur:** Sie weicht zwischen den Zuständen um bis zu 7 px bei 762 px ab, das sind etwa 18 px bei 1920 px (Scheinwerfermitte). An der Laufkante sind dadurch leichte Versätze möglich.
- **Nicht enthalten:** echte Schaumbewegung, Wasserstrahl, Tropfenphysik, neue Bilddetails durch die Hochrechnung und ein freigegebenes Porsche-Modell.
- **Abnahme:** Die Vorschau erfüllt die Abnahme nicht in den Punkten „detailgetreue Halle“, „fotorealistisch“, „keine bloße Überblendung“ und „freigegebenes Porsche-Modell“.

## Benötigtes Material für den Endstand
1. **Porsche-Modell zur Freigabe**, zum Beispiel als GLB/FBX/BLEND mit Innenraum nicht nötig, aber mit Glas, Felgen, Bremssätteln und korrekter Lackgeometrie. Gesucht wurde am 24.11.2026:
   - Ein CC-BY-Modell des GT3 RS auf Sketchfab: Lizenz und Generation vor dem Kauf bzw. der Nutzung prüfen.
   - Kostenpflichtige 992-GT3-Modelle auf CGTrader (ab ca. 7 USD, Royalty-Free).
   - Ein freies GT3-Touring-Modell auf CGTrader darf laut Lizenz nicht kommerziell genutzt werden, also **ungeeignet**.
   - Markenrecht (Porsche-Wappen und Form in Werbung) vor der Nutzung prüfen lassen.
2. **Hallenaufnahme:** Hintergrundplatte vom Stativ im Querformat mit mindestens 1920 px, ohne Auto, in der Blickrichtung des Referenzfotos (Heck zum Rolltor, Front zur Kamera, Treppe außerhalb). Dazu eine HDRI oder Lichtmessung der LED-Röhren für korrekte Spiegelungen, und Maße von Torbreite, Raumhöhe und Fliesengröße zur Kalibrierung.
3. **Simulation:** Schaum, Wasser und Tropfen in Blender (Mantaflow/FLIP oder Partikel), Kamera fest.
4. **Alternativ eine echte Aufnahme:** ein schwarzer Porsche oder ein anderes eigenes Kundenfahrzeug wird in der Halle vom Stativ aus gewaschen, 4K, 30 fps. Das wäre glaubwürdiger als jedes Rendering und rechtlich einfacher.

## Austausch
Fertiges MP4 und WebM (nur Social Media) unter **denselben Dateinamen** in `src/video/out/` ablegen. Poster neu erzeugen mit:
`ffmpeg -i …mp4 -frames:v 1 -q:v 3 …-poster.jpg`

Für die Website gilt der Austausch im Kasten oben. Den KI-Hinweis in `wash_section()` (`src/build.py`) erst entfernen, wenn echtes Material vorliegt.
Die Vorschau lässt sich mit `python3 src/video/build_preview_video.py` reproduzieren.
