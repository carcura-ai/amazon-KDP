---
name: reel-producer
description: Produziert aus Rohvideos und Sprachaufnahmen hochwertige Instagram-Reels, TikToks und YouTube Shorts fuer Carcura (Schnitt, Voiceover, Untertitel, Effekte, 3D-Sticker, Sounddesign) und liefert zu jedem Video Upload-Beschreibungen und einen konkreten Werbeplan (Meta, TikTok, WhatsApp-CTA, Leads). Nutzen bei Reel, Video schneiden, Rohmaterial, Voiceover, Untertitel, Social-Media-Video, TikTok, Werbeanzeige fuer ein Video, Boost, Referenz-Reel analysieren.
---

# Reel-Producer

Ziel: Videos, die Aufmerksamkeit erzeugen, die Marke Carcura staerken und Anfragen bringen – auf Agentur-Niveau.
Werkzeug: `reel-studio/` (Remotion + ffmpeg + faster-whisper + rembg). Bedienung: `reel-studio/README.md`.

## Effizienz-Regeln (wenig Credits, volle Qualitaet)

1. Setup nur, wenn `reel-studio/remotion/node_modules` fehlt: `reel-studio/setup.sh` (einmal pro Container).
2. Analyse genau einmal. Danach nur `analysis/transcript.txt` und `analysis/uebersicht-*.jpg` ansehen (8 Clips pro Bild). Keine Einzelframes ohne Grund.
3. Schnittplan nur ueber `edit.json` mit **Wort-Ankern** (`"t:Salz"`) und `auto`-Funktionen – keine Sekunden von Hand rechnen.
4. Rendern im Hintergrund; waehrenddessen Beschreibung und Werbeplan schreiben.
5. QA: ein Kontaktbogen mit 8–12 Bildern aus dem fertigen Video (ein Bildaufruf). Hoechstens eine Korrekturrunde, ausser bei echten Fehlern.
6. Keine Grundlagenrecherche pro Video – das Wissen steht in `references/`. Websuche nur fuer neue Plattformfunktionen oder Unklarheiten, dann Erkenntnis in `references/` nachtragen.

## Ablauf pro Video

0. **Briefing** aus Nachricht oder `projekte/<name>/notes.md`: Leistung, Fahrzeug, Angebot/Preis, Ziel (Reichweite / Anfragen / Website), CTA-Kanal, Frist. Fehlendes als Annahme kennzeichnen, nur bei Ergebnis-relevanten Luecken fragen.
1. **Material** nach `reel-studio/projekte/<name>/raw/` (Videos) und `voice/` (Sprache). Uebergabewege: `references/material-uebergabe.md`.
2. `python3 -I pipeline/analyze.py projekte/<name>` (bei bereits geschnittenem Material `--no-cut`). Bausteine: A = Sprecher im Bild, V = Voiceover, B = B-Roll.
3. **Story planen** mit `references/stil-handbuch.md`: Format waehlen, Hook festlegen, beste Takes, B-Roll-Zuordnung zum gesprochenen Wort, 3D-/Sticker-Ideen.
4. **Assets** (immer mit Lizenzprotokoll): `pipeline/asset.py emoji|suche|hole|freistellen` – Regeln in `references/assets-und-lizenzen.md`.
5. **edit.json** schreiben (Schema unten), dann `./pipeline/render.sh projekte/<name>` im Hintergrund.
6. **Sounddesign** pruefen/ergaenzen nach `references/sounddesign.md` (auto-Sounds sind die Basis, Akzente manuell).
7. **QA-Checkliste** (unten) gegen den Kontaktbogen und die Lautheitsmessung.
8. **Lieferung**: MP4 + SRT + `BESCHREIBUNG.md` nach `references/lieferung-vorlage.md` inkl. Werbeplan aus `references/werbung.md`. Dateien per SendUserFile senden.
9. `edit.json`, `notes.md`, `BESCHREIBUNG.md`, `assets/LIZENZEN.md` committen (keine Videos).

## edit.json – Kurzreferenz

```json
{
  "fps": 30,
  "brand": {"accent": "#FFD60A", "dark": "#0B0F14", "handle": "@_carcura_"},
  "look": {"grade": "contrast(1.06) saturate(1.1)", "vignette": 0.35},
  "timeline": [
    {"a": "A1"},
    {"v": "V1", "b": ["B2", {"id": "B4", "from": 1.5, "rate": 0.5}], "bvol": 0.15},
    {"b": [{"id": "B3", "dur": 2.0}], "vol": 0.8, "tin": "flash"},
    {"b": [{"img": "assets/foto.jpg", "dur": 2}]}
  ],
  "captions": {"y": 0.615, "maxWords": 3, "maxChars": 18, "hide": [["t:seg5", "t:end"]]},
  "music": {"src": "musik/track.mp3", "vol": 0.16, "duck": 0.05},
  "auto": {"zoom": true, "transitions": true, "sfx": true},
  "overlays": [ ... ],
  "sfx": [{"at": "t:Preis", "name": "impact", "vol": 0.35}]
}
```

Zeitanker: `t:Wort`, `t:Wort.e` (Ende), `t:Wort#2`, `t:für den Winter` (Phrase), `t:seg3`, `t:seg3.e`, `t:end`, Versatz `t:Wort-0.2`.
Segment-Optionen: `tin` (zoom|whip|flash|none), `zoom` [von, bis], `bvol` (B-Roll-Ton unter VO), `vvol`, `pad`.

| Overlay `type` | Zweck | Wichtige Felder |
|---|---|---|
| `hook` | Titel in den ersten 2–3 s | line1, line2, y |
| `title` | Kapitel-Karte | kicker, text, y |
| `lowerthird` | Fahrzeug/Leistung einblenden | title, sub, icon (Asset), y |
| `sticker` | 3D-Emoji oder Freisteller, schwebend | src, x, y, size (oder w + h bei Hochformat), label, enter (pop/drop/slide), tilt, rot |
| `badge3d` | echte 3D-Muenze (Rabatt, Zahl) | text, x, y, size |
| `price` | Preis durchstreichen → neuer Preis | old, new, strikeAt, newAt, why, whyKicker, whyAt, y |
| `checklist` | Vorteile synchron abhaken | title, items [{t, at}], y |
| `compare` | Vorher/Nachher-Wischer | before/after ({id, from} oder {src}), wipeAt, wipeDur |
| `snow` | 3D-Schneefall (Winter) | label, sub, y |
| `cta` | Handlungsaufforderung | kicker, main, sub, alt, urgency, mainAt, altAt, urgencyAt, y |
| `blur` | Kennzeichen/Gesichter unkenntlich | x, y, w, h (0..1), r – Segment mit `"zoom": [1, 1]` |

Jedes Overlay: `from`, `to`; optional `"sfx": "name"` oder `false`.
Positionen: x/y als Anteil der Bildbreite/-hoehe. Sichere Zone: wichtige Inhalte zwischen y 0.15 und 0.63.

## QA-Checkliste (vor Lieferung, alles muss passen)

- [ ] Hook in 0–2 s: Bild, Text und Stimme versprechen dasselbe
- [ ] Untertitel fehlerfrei (neue Hoerfehler in `pipeline/glossar.json` eintragen), nichts verdeckt Gesichter
- [ ] Alle 2–3 s ein visueller Wechsel; keine toten Pausen > 0,5 s
- [ ] Texte in der sicheren Zone; Schrift auf dem Handy lesbar (≥ 32 px bei 1080 Breite)
- [ ] Lautheit ≈ −14 LUFS, Spitze ≤ −1 dBTP; Stimme immer klar ueber Musik und Sounds
- [ ] Ein einziger CTA, identisch in Video, Beschreibung und angepinntem Kommentar
- [ ] Preise als Endpreise inkl. MwSt.; Statt-Preise und Leistungsversprechen belegbar
- [ ] Lizenzen in `assets/LIZENZEN.md`; CC-BY-Nennungen in der Beschreibung; keine fremden Logos als Werbetraeger
- [ ] Kennzeichen/Gesichter Dritter ohne Einwilligung unkenntlich

## Lernschleife

- Nach Veroeffentlichung Kennzahlen in `reel-studio/LERNLOG.md` festhalten (Nutzer liefert Insights-Screenshots oder Zahlen). Wiederkehrende Muster ins Stil-Handbuch uebernehmen.
- Referenz-Reels, die dem Nutzer gefallen: `python3 -I pipeline/referenz.py <url>` (Instagram, TikTok, YouTube) → Schnittfrequenz, Hook, Texte, Kontaktbogen → Erkenntnisse in `references/stil-handbuch.md` unter „Gelernt aus Referenzen“.
