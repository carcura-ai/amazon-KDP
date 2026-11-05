---
name: blender-3d
description: Baut 3D-Animationen mit Blender per Python-Skript – Objekte werden selbst konstruiert (keine gekauften Modelle), mit Material, Licht, Kamera und Render – und bereitet sie fuer Websites (Scroll-Animation, Video-Schleife, Standbild) und Reels auf. Nutzen bei 3D, 3D-Animation, Blender, Explosionsansicht, Produktanimation, Scroll-Animation, „Website beleben“, Hero-Animation, 3D fuer carcura.info oder Webdesign-Kunden.
---

# Blender-3D (Website- und Reel-Animationen)

Werkzeug: `3d-studio/` (Blender 4.0 aus Ubuntu, Cycles auf CPU, ffmpeg). Bedienung: `3d-studio/README.md`.
Vorbild: Reel memo.baut.ki (Claude Code + Blender, „Regisseur“ verteilt Form, Material, Licht, Kamera). Dessen
„94-Blender-Skill-Paket“ ist **nicht** installiert – Fremd-Skills nur nach `skill-security-auditor`.

## Ablauf (Regisseur – jede Station hat ein Ergebnis)

| Station | Ergebnis |
|---|---|
| 0 Ziel | Wo laeuft es (Seite, Abschnitt, Reel)? Was soll der Betrachter verstehen? Ein Satz. |
| 1 Form | `modelle/<name>.py`: Teile aus Grundkoerpern + Modifikatoren (Bevel immer – echte Kanten sind nie scharf), echte Proportionen |
| 2 Material | `studio.material()` mit Principled-Werten; rauscharm: Glanz niedrig (roughness ≤ 0.15) oder klar matt (≥ 0.6), mittlere Werte rauschen |
| 3 Licht | 3–4 Flaechenlichter: Hauptlicht, Streifenlicht fuer die Spiegelkante, Kante, Aufhellung. Markenfarbe nur als ein Akzent |
| 4 Kamera | `kreisfahrt()` mit Ran-/Wegfahrt; Motiv fuellt 60–80 % des Bildes, Mitte bleibt Mitte |
| 5 Probe | `render.sh <name> --vorschau --still N` fuer Anfang/Mitte/Ende (≈ 3 s pro Bild) → als ein Vergleichsbild ansehen, Regie-Notizen, nachbessern |
| 6 Render | `render.sh <name>` im Hintergrund (≈ 1 min pro Bild bei 960 px/192 Samples auf 4 Kernen), waehrenddessen Web-Einbau |
| 7 Web | `web/export.sh` erzeugt scrub.mp4, loop.mp4/.webm, poster.webp, kontakt.jpg; Einbau nach `web/keramik-schichten.html` |
| 8 Pruefung | Kontaktbogen ansehen, Seite mit Playwright auf 390 px und 1440 px scrollen und Bildschirmfotos pruefen |

## Regeln

- **Selbst gebaut:** keine gekauften oder heruntergeladenen Modelle, keine fremden Marken/Logos am Objekt.
- **Ehrlich:** Animationen erklaeren echte Leistungen. Keine erfundenen Haltbarkeiten, Haertegrade oder Testsiegel im Begleittext.
- **Text nie ins Bild rendern**, sondern als HTML daneben (scharf, uebersetzbar, SEO, barrierearm).
- **Website-Budget:** Scroll-Video ≤ 3 MB, Schleife ≤ 2 MB, Poster ≤ 150 KB. Laden erst kurz vor Sichtbarkeit.
- **Bewegung reduzieren** (`prefers-reduced-motion`): Poster + voller Text, keine Scroll-Animation.
- **Mobil zuerst denken:** quadratisches Format, Motiv mittig, Text unter dem Bild, nur der aktive Abschnitt sichtbar.
- **Live-Seite:** Einbau auf carcura.info nur nach Freigabe des Nutzers, danach die Seite nachlesen und auf dem Handy pruefen.
- **Rauschen:** Diese Blender-Version hat kein OpenImageDenoise. Gegenmittel in dieser Reihenfolge: rauscharme Materialwerte,
  mehr Samples, `export.sh` entrauscht raeumlich + zeitlich. Keine vorkompilierten Fremd-Bibliotheken nachinstallieren.

## Bausteine (`3d-studio/lib/studio.py`)

`neue_szene` · `hex_farbe` · `material` · `zuweisen` · `kanten_material` (Leuchtkante auf Seitenflaechen) · `platte` (abgerundete Platte) ·
`flaechenlicht` · `kamera` · `kreisfahrt` (Bogen + Ran-/Wegfahrt) · `weich` (Ease-in-out) · `rendern` (Vorschau/Still/Frames).
Neue wiederverwendbare Teile (Felge, Polierpad, Tropfen, Autosilhouette) als Funktion in `studio.py` ergaenzen, sobald sie zweimal gebraucht werden.

## Ideen fuer Carcura (nach Wirkung sortiert)

1. **Lackschichten mit Keramik** – gebaut (`modelle/lackschichten.py`) fuer /keramikversiegelung/
2. Polierpad dreht ueber Swirls → Hochglanz (Politur-Seite, Reel-Hook)
3. Felge mit Bremsstaub → Felgen-Keramik, Explosionsansicht Felge/Schicht
4. Scheinwerfer: vergilbt → klar mit UV-Schutzschicht (59-€-Angebot)
