# Video „Keramikversiegelung – Ablauf“ (18.11.2026)

Erklärvideo 16:9, 3840 × 2160, 25 fps, 35,2 s, mit Sprecher, Untertiteln (Wort für Wort) und Effekt-Ton (-14,9 LUFS). Gebaut mit dem Skill `motion-design`. Alles aus Code, keine KI-Bilder.
Dateien: `out/Keramik-Ablauf-4K-mit-Ton.mp4` (fertig), `out/Keramik-Ablauf-4K-stumm.mp4` (Bild ohne Ton, nicht versioniert), `out/ton.wav` (Tonspur für den Schnitt).

| Szene | Inhalt (nur Aussagen der Website) |
|---|---|
| 1 | Titel „Was passiert bei einer Keramikversiegelung?“ |
| 2 | Waschen und dekontaminieren: Handwäsche, Flugrost- und Teerentfernung, Kneten |
| 3 | Polieren: 1-stufig für Glanz, 2-stufig bei Waschkratzern |
| 4 | Versiegeln: hauchdünne, glasklare Schicht, Wasser perlt ab |
| 5 | Aushärten: in der Halle, erste 12 Stunden unter Prüflicht |
| 6 | Übergabe: Pflegeanleitung, Nachkontrolle nach 6 Monaten kostenlos |
| 7 | Logo, ab 700 €, bis 31.12.2026 Waschset geschenkt, „Schick uns Fotos, wir machen dir ein faires Angebot“ |

Im Bild: „Animation, vereinfachte Darstellung“. Kein Preis-Wert für das Waschset (Beleg fehlt), kein Festpreis-Versprechen, kein Pflegeset.
**Nach dem 31.12.2026 darf die Zeile „Waschset geschenkt“ nicht mehr laufen** (Fassung ohne Aktion neu rendern: Zeile in `seite.html`, Funktion `endcard`).

Stimme: Qwen3-TTS (Apache-2.0), „Kumpel“, KI-erzeugt, kein Klon einer echten Person. **Beim Hochladen „KI-Info“ einschalten.** Untertitel stehen im Bild, das Video funktioniert auch ohne Ton.

## Neu erzeugen
1. `<qwen-venv>/bin/python stimme.py erzeugen 3` → `stimme.py waehlen` (Spracherkennung wählt die deutlichste Fassung, schreibt `stimme/zeitplan.json`)
2. Beats und Szenenlängen passen sich der Sprechzeit an (`seite.html`, Funktion `plan`).
3. `node scripts/render.mjs events seite.html out/events.json` → `python3 ton.py` → `node scripts/render.mjs video seite.html out/<name>.mp4 --fps 25 --scale 2` → Ton dazumuxen:
   `ffmpeg -i stumm.mp4 -i out/ton.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k final.mp4`
`scripts/render.mjs` ist die Kopie aus dem Skill, nur mit `--no-sandbox` ergänzt (Container läuft als root); `CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
Venv: torch (CPU, download.pytorch.org) + torchaudio-CPU + `qwen-tts==0.1.1` + `faster-whisper`; liegt im Scratchpad, nicht im Repo.
