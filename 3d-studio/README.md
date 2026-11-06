# 3D-Studio – Blender-Animationen fuer Websites und Reels

Arbeitsweise und Regeln: `.claude/skills/blender-3d/SKILL.md`.

## Einrichtung (einmal pro Container)

```bash
sudo apt-get update && sudo apt-get install -y blender ffmpeg libegl1 libegl-mesa0 libgl1-mesa-dri   # Blender 4.0.2 + Workbench headless
```

## Bedienung

```bash
3d-studio/render.sh lackschichten --vorschau --still 1     # ein Probebild, ~3 s
3d-studio/render.sh lackschichten                          # alle Bilder + Web-Export, ~50 min
```

Ergebnis in `3d-studio/out/<modell>/web/` (nicht im Git, jederzeit neu erzeugbar):

| Datei | Zweck |
|---|---|
| `scrub.mp4` | Scroll-Animation (jedes Bild ein Keyframe) |
| `loop.mp4`, `loop.webm` | Endlosschleife fuer Hero, Angebot, Reel |
| `poster.webp` | Vorschaubild und Fallback bei „Bewegung reduzieren“ |
| `kontakt.jpg` | Kontaktbogen fuer die Sichtkontrolle |

## Einbau in WordPress (carcura.info, Kubio)

1. `scrub.mp4` und `poster.webp` in die Mediathek laden.
2. In `web/keramik-schichten.html` den Teil zwischen `CARCURA-3D START` und `ENDE` kopieren, `scrub.mp4`/`poster.webp`
   durch die Mediathek-URLs ersetzen, als Block „Individuelles HTML“ einfuegen (Administrator-Konto, sonst entfernt
   WordPress das Skript).
3. Seite auf dem Handy und am Rechner langsam scrollen. Erst nach Freigabe veroeffentlichen.

## Neues Modell

`modelle/<name>.py` nach Vorbild `lackschichten.py`: Form → Material → Animation → Licht → Kamera → `st.rendern(a)`.
