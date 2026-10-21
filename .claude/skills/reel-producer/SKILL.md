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

0. **Markendaten** stehen in `reel-studio/brand/MARKE.md` (Kontakt, WhatsApp, Website, Preise, Farben, Logo) – nie erneut erfragen; Farben/Handle kommen automatisch aus `brand/brand.json`.
   **Briefing** aus Nachricht oder `projekte/<name>/notes.md`: Leistung, Fahrzeug, Angebot/Preis, Ziel (Reichweite / Anfragen / Website), CTA-Kanal, Frist. Fehlendes als Annahme kennzeichnen, nur bei Ergebnis-relevanten Luecken fragen.
1. **Material** nach `reel-studio/projekte/<name>/raw/` (Videos) und `voice/` (Sprache). Uebergabewege: `references/material-uebergabe.md`.
1a. **Lange Rohclips (POV, Daueraufnahmen):** erst sichten (Kontaktbogen 1 Bild/s, Pegel je Sekunde), dann nur die besten Stellen als
   Ausschnitte nach `raw/` schneiden – mit Drehung, Zuschnitt auf Haende/Auto und Aufhellung (Vorlage: `projekte/m2-keramik-60/ausschnitte.sh`).
   Spart 90 % Aufbereitungszeit. Stummes Mikro (< −55 dB) → CC0-Foley synchron zur Bewegung: `pipeline/foley.py` reiht nur aktive Stellen aneinander (keine Ton-Loecher), dem Nutzer offen sagen.
   Rendern ohne Filmkorn ist doppelt so schnell (`look.grain` nur bei sauberem Material).
2. `python3 -I pipeline/analyze.py projekte/<name>` (bei bereits geschnittenem Material `--no-cut`). Bausteine: A = Sprecher im Bild, V = Voiceover, B = B-Roll.
3. **Musik waehlen (Pflicht, Auto-Content = Phonk/Trap/Hip-Hop von ccMixter, siehe `references/sounddesign.md`):** `python3 -I pipeline/asset.py musik "<stimmung>" --bpm 100-130` → `musikhole "<Titel>" projekte/<name>` (Beats + bester Abschnitt → `music.from`). Ohne Sprache vol 0.5–0.6, mit Sprache vol 0.16 / duck 0.05. Nur ohne Musik liefern, wenn der Nutzer es verlangt.
   **Story planen** mit `references/stil-handbuch.md`: Format waehlen, Hook festlegen, beste Takes, B-Roll-Zuordnung zum gesprochenen Wort, 3D-/Sticker-Ideen.
4. **Assets** (immer mit Lizenzprotokoll): `pipeline/asset.py emoji|suche|hole|freistellen` – Regeln in `references/assets-und-lizenzen.md`.
5. **edit.json** schreiben (Schema unten), dann `./pipeline/render.sh projekte/<name>` im Hintergrund.
6. **Sounddesign** pruefen/ergaenzen nach `references/sounddesign.md` (auto-Sounds sind die Basis, Akzente manuell).
7. **QA-Checkliste** (unten) gegen den Kontaktbogen und die Lautheitsmessung.
8. **Lieferung**: MP4 + SRT + `BESCHREIBUNG.md` nach `references/lieferung-vorlage.md` inkl. Werbeplan aus `references/werbung.md`. Dateien per SendUserFile senden.
9. `edit.json`, `notes.md`, `BESCHREIBUNG.md`, `assets/LIZENZEN.md` committen (keine Videos).

## Regie-Modus (immer – nach der Referenz „Skill = Regisseur“)

Sieben Stationen, jede mit Ergebnis, in dieser Reihenfolge:

| Station | Ergebnis |
|---|---|
| 1 Drehbuch | Hook (≤ 2 s), Story-Beats, ein CTA; Saetze ≤ 8 Woerter |
| 2 Storyboard | `projekte/<n>/STORYBOARD.md`: Zeit · Bild (Baustein-ID) · Text/Grafik · Sound · Musik-Moment – **vor** edit.json |
| 3 Animation | Overlays in edit.json (Grafik nur, wo sie die Aussage traegt) |
| 4 Untertitel | Stil waehlen: `standard` (Wort-Highlight) oder `kinetik` (Satz baut sich auf, betonte Woerter kursiv/Serif/Akzent) |
| 5 Voiceover | A-Roll/Sprachmemo; Musik automatisch geduckt |
| 6 Sounddesign | Sound-Paare, Glitch/Whip/Whoosh, echte Sounds (Freesound) |
| 7 Endmischung | −14 LUFS, „Ton-Check ok“, Stimme klar vor Musik |

Danach **Regie-Durchgang** (Pflicht, hoechstens 2 Runden): Kontaktbogen + Pegelprofil pruefen und konkrete Notizen in
`projekte/<n>/REGIE.md` schreiben wie ein Regisseur („Uebergang bei 6,4 s haerter“, „Whoosh bei 9 s leiser“, „Ende einen Beat
laenger“, „Text bei 2 s angeschnitten“) → umsetzen → neu rendern. Vorher `references/regie-regeln.md` abgleichen.
**Jede Rueckmeldung des Nutzers wird sofort eine neue Regel in `references/regie-regeln.md`.**

## edit.json – Kurzreferenz

```json
{
  "fps": 30,
  "brand": {"fontHead": "Clash Display", "fontBody": "Satoshi"},
  "look": {"grade": "contrast(1.06) saturate(1.1)", "vignette": 0.35, "grain": 0.07},
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

Schriften: Titel `Anton` (Standard, schmal) · `Clash Display` / `Cabinet Grotesk` (modern, breiter – Titel kuerzer/kleiner) · Text `Montserrat` / `Satoshi` (Fontshare, ITF FFL).
`look.grain` 0.05–0.1 = analoges Filmkorn (Kino-Textur). Sound-Eintraege mit `"dur"` begrenzen.

Untertitel-Stil: `"captions": {"style": "kinetik", "betonen": ["tag", "1", "halle"], "y": 0.6}` · Uebergang `tin: "glitch"` · `"ende_halten": true`.
Zeitanker: `t:Wort`, `t:Wort.e` (Ende), `t:Wort#2`, `t:für den Winter` (Phrase), `t:seg3`, `t:seg3.e`, `t:end`, Versatz `t:Wort-0.2`.
Segment-Optionen: `tin` (zoom|whip|flash|none), `zoom` [von, bis], `bvol` (B-Roll-Ton unter VO), `vvol`, `pad`, `schnitt` (hart|beat), bei `a`: `von`/`bis`.
B-Roll-Element: `{"id", "from", "dur", "rate", "vol", "ramp": true}` (Speed-Ramp normal → Zeitlupe → normal).

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
| `textbehind` | grosser Titel hinter dem Auto (Hook) | text, src (`freistellen --voll` vom selben ruhigen Shot), y, size – Segment `zoom` [1, 1], `tin` none |
| `chat` | Kunden-Chat als Hook oder CTA | messages [{who: kunde/wir, text, at}], y, title |
| `letterbox` | Kino-Balken | h (Anteil, 0.1) |
| `collage` | 2–4 Clips/Bilder als Postkarten | items [{id, from} oder {src}, at], w |
| `timer` | Zeit + Fortschrittsbalken oben („in 60 Sekunden“) | label, total (60), y (0.1), countdown, offset |
| `step` | 3D-Schrittkarte mit Zahlenkachel | nr (ohne = nur Kicker), of, kicker, text (\n = Zeilenumbruch), size, y, fx: glanz \| spray (setzt sich wie Nebel ab) \| wisch (wird weggewischt) |
| `polishreveal` | Start: stumpfer Lack mit Swirls + Problem-Woertern, Pad-Ring poliert frei | x, y (Pad-Mitte), start, dur, lines [..], y0, size |
| `lichtbalken` | Ende: LED-Lichtbalken legt Endkarte frei (Chrom-Titel, Preis, CTA, Logo) | over, kicker, pre, price, sub, cta, site, logo, y, sweep |
| `callout` | Hinweis-Linie vom Objekt zur Beschriftung | x, y (Punkt), lx, ly (Beschriftung), text, sub |
| `glint` | diagonaler Glanz-Streifen ueber das Bild | – (Dauer = from/to) |
Musik legt der Nutzer selbst an → `"lautheit": false` (Effekt-Spur + Fassung ohne Ton).

Jedes Overlay: `from`, `to`; optional `"sfx": "name"` oder `false`.
Positionen: x/y als Anteil der Bildbreite/-hoehe. Sichere Zone: wichtige Inhalte zwischen y 0.15 und 0.63.

## QA-Checkliste (vor Lieferung, alles muss passen)

- [ ] Hook in 0–2 s: Bild, Text und Stimme versprechen dasselbe
- [ ] Untertitel fehlerfrei (neue Hoerfehler in `pipeline/glossar.json` eintragen), nichts verdeckt Gesichter
- [ ] Alle 2–3 s ein visueller Wechsel; keine toten Pausen > 0,5 s
- [ ] Texte in der sicheren Zone; Schrift auf dem Handy lesbar (≥ 32 px bei 1080 Breite)
- [ ] Lautheit ≈ −14 LUFS, Spitze ≤ −1 dBTP; Stimme immer klar ueber Musik und Sounds
- [ ] Musik durchgehend hoerbar – render.sh meldet „Ton-Check ok“ (sonst Stille-Luecke pruefen)
- [ ] Ein einziger CTA, identisch in Video, Beschreibung und angepinntem Kommentar
- [ ] Preise = Website-Preise aus `brand/MARKE.md`, als Endpreis (Kleinunternehmer – nie „inkl. MwSt.“); Statt-Preise und Versprechen belegbar
- [ ] Lizenzen in `assets/LIZENZEN.md`; CC-BY-Nennungen in der Beschreibung; keine fremden Logos als Werbetraeger
- [ ] Kennzeichen/Gesichter Dritter ohne Einwilligung unkenntlich

## Drehplanung

Nennt der Nutzer einen Auftrag (Fahrzeug, Leistung), antworte mit einem Drehzettel nach `references/drehplanung.md` (Hook, Shotliste mit Perspektive/Bewegung/Dauer/fps, Sprechtext, Musik-Stimmung) und schlage eine Reel-Idee vor, die zu Ziel und Saison passt.

## Referenzen lernen

Neue Referenz-Links: `python3 -I pipeline/referenzen.py referenzen/<runde> <urls…>` → `sichten.py referenzen/<runde>/raw` → Inhalte (gezeigt/gesagt) auswerten → `reel-studio/referenzen/LERNPROTOKOLL.md` und Stil-Handbuch ergaenzen → neue Techniken als Werkzeug bauen und an einem Test-Reel pruefen.

## Archiv sichten

Ganze Ordner (z. B. Drive-Link mit vielen Videos): `gdown --folder <link> -O projekte/<name>/raw` → `python3 -I pipeline/sichten.py projekte/<name>/raw` → `sichtung/sichtung.md` + `sichtung/seite-*.jpg` (6 Videos pro Bild) lesen → Bericht nach Vorbild `projekte/lernphase/BERICHT.md`. Clips fuer ein Projekt per Symlink mit Praefix `a_`/`b_` uebernehmen (legt die Rolle fest; Dateinamen mit Leerzeichen einzeln verlinken).

## Lernschleife

- Nach Veroeffentlichung Kennzahlen in `reel-studio/LERNLOG.md` festhalten (Nutzer liefert Insights-Screenshots oder Zahlen). Wiederkehrende Muster ins Stil-Handbuch uebernehmen.
- Referenz-Reels, die dem Nutzer gefallen: `python3 -I pipeline/referenz.py <url>` (Instagram, TikTok, YouTube) → Schnittfrequenz, Hook, Texte, Kontaktbogen → Erkenntnisse in `references/stil-handbuch.md` unter „Gelernt aus Referenzen“.
