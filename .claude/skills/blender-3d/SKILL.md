---
name: blender-3d
description: Baut 3D-Animationen mit Blender per Python-Skript – Objekte werden selbst konstruiert (keine gekauften Modelle), mit Material, Licht, Kamera und Render – und bereitet sie fuer Websites (Scroll-Animation, Video-Schleife, Standbild) und Reels auf. Arbeitet nach einem Perfektionismus-Protokoll mit Form-, Look-, Bewegungs- und Kritikerdurchgang. Nutzen bei 3D, 3D-Animation, Blender, Explosionsansicht, Produktanimation, Auto-Animation, Waesche-/Keramik-Animation, Scroll-Animation, „Website beleben“, Hero-Animation, 3D fuer carcura.info oder Webdesign-Kunden.
---

# Blender-3D (Website- und Reel-Animationen)

Werkzeug: `3d-studio/` (Blender 4.0 aus Ubuntu, Cycles auf CPU, ffmpeg). Bedienung: `3d-studio/README.md`.
Fremd-Skills (z. B. „94-Blender-Skill-Paket“) sind **nicht** installiert – nur nach `skill-security-auditor`.

## Perfektionismus-Protokoll (jede Station hat ein pruefbares Ergebnis)

| # | Durchgang | Werkzeug | Fertig, wenn |
|---|---|---|---|
| 0 | **Wahrheit** | Fakten aus `docs/WEBSITE-REBUILD-MASTERPLAN.md` §5, Abstimmung `docs/ABSTIMMUNG-3D-WEBSITE.md` | Jede Aussage der Animation ist belegt („laut Hersteller“) oder als vereinfacht gekennzeichnet |
| 1 | **Drehbuch** | Kopf des Modell-Skripts | Akte mit Bildnummern, eine Botschaft je Akt, Ende haelt ≥ 0,7 s |
| 2 | **Form** | `modelle/<x>_form.py` mit Workbench (Ton-Modell, 4 Ansichten, ~20 s) | Silhouette stimmt aus 3/4 vorn, Seite, oben, 3/4 hinten; nichts schwebt, nichts ragt raus |
| 3 | **Look** | ein Standbild in voller Qualitaet (`--still N`, ~40–60 s) | Material und Licht ueberzeugen bei 100 % Ansicht |
| 4 | **Bewegung** | `--schritt 6` → Kontaktbogen | Timing, Reihenfolge, kein Springen, kein Aufploppen |
| 5 | **Final** | Render im Hintergrund, danach `web/export.sh` | Kontaktbogen sauber, Schwarz = Seitenfarbe, Dateigroessen im Budget |
| 6 | **Kritiker** | unabhaengiger Agent prueft Bilder, Fachlichkeit, Werberecht, Einbau | Kritische Punkte behoben oder begruendet verworfen |
| 7 | **Web** | Playwright 390 px + 1440 px, „Bewegung reduzieren“ | keine Fehler, kein seitliches Scrollen, CTA erreichbar |

Je Durchgang hoechstens 3 Runden; jede Runde schreibt Regie-Notizen (was falsch aussieht → welcher Wert aendert sich).
Einmal pro Runde selbst fragen: **Was verraet „billiges 3D“?** – und genau das zuerst beheben.

## Gelernte Regeln (aus echten Durchgaengen)

**Form**
- Auto aus Querschnitten (`lib/sportwagen.py`): Keilform, Guertellinie steigt nach hinten, Kotfluegel ueber den Achsen breiter als die Tueren, Crease auf Schulter- und Guertellinie. Erst Ton-Modell beurteilen, nie am schwarzen Lack.
- Details, die schlechter aussehen als ihr Fehlen, weglassen (Spiegel als Ei, Splitter als Bodenplatte, aufgemalte Lufteinlaesse).
- Reifen = gestreckter Torus (innen offen), sonst verdeckt der Deckel die Felge. Radhaus = offene Roehre + Deckel innen.

**Material**
- Schwarzlack: Basis sehr dunkel, Specular ≤ 0,15, kein Metallic, Glanz nur aus Coat (Rauheit ~0,012). Sonst grauer Schleier.
- Rauscharm: Rauheit ≤ 0,15 oder ≥ 0,6; Werte dazwischen rauschen ohne Denoiser.
- Wasser: Transmission 1, IOR 1,33. **Mit Keramik**: Perle z = 0,86–0,9 (rund, rollt). **Ohne**: flacher Tropfen z ≈ 0,36, breiter, bleibt kleben. Keine „Filme“ aus flachen Kugeln – wirken wie Glasschalen.
- Schaum: viele kleine Instanzen (Radius 1–2,6 cm, ~5000/m²), leicht nach aussen versetzt; grosse Kugeln = Popcorn.
- Strassenschmutz: grauer Staub (≈ 0,1) mit senkrechten Laufspuren (Mapping Z 0,22), unten dichter; braune Wolken = Tarnfarbe.

**Licht + Kamera**
- Nahaufnahme Lack: Farbe von einem Licht hinter der Kamera (spiegelt sich nicht), Glanz von einem fernen Lichtband am Horizont. Keine sichtbaren Rechtecke im Lack.
- Auto im Studio: 3 Deckenstreifen, ein schmales Seitenband auf der Schulterlinie, 2 Kantenlichter, Markenfarbe nur als eine Akzentlinie.
- Glanz-Fahrt am Ende: Licht per Light-Linking nur aufs Auto (`light_linking.receiver_collection`), sonst Lichtfleck am Boden.
- Motiv fuellt 70–85 % der Breite; Kamera knapp ueber Dachhoehe.

**Animation + Steuerung**
- Ablaeufe ueber „Fronten“ (Empties, `lib/waesche.py`): Shader und Geometry Nodes lesen die Front-Position – ein Keyframe-Paar steuert Schmutz, Schaum, Tropfen gleichzeitig.
- Objekte, die erst spaeter erscheinen: Skalierung 0 bis 1 Bild vor dem Auftritt halten, sonst schweben sie vorher sichtbar.
- Nicht umkehrbare Geschichten (Waesche): Export mit `MODUS=vor` (vorwaerts, halten, weich ein-/ausblenden), `POSTER=<bild>`.

**Technik + Budget**
- Headless: Cycles CPU geht immer; Workbench braucht `libegl1 libegl-mesa0 libgl1-mesa-dri` (surfaceless EGL).
- Rechenzeit auf 4 Kernen: ~40–55 s je Bild (960 px, 96 Samples, Auto mit Schaum). Renders nacheinander einreihen; Proben waehrend eines Renders verdoppeln dessen Zeit.
- Kein OpenImageDenoise im Ubuntu-Blender: rauscharme Werte + `export.sh` (nlmeans + hqdn3d). Keine vorkompilierten Fremd-Bibliotheken.
- Innenraum-Standbilder ohne Denoiser: Diffus-/Glanz-/Transmissionspaesse rendern, nur die indirekten Anteile mit
  kantenerhaltendem A-Trous filtern (Normale, Tiefe, Albedo) und neu zusammensetzen – 48 Samples wirken sauber
  (`modelle/wohnzimmer.py`, `zusammensetzen()`; braucht `apt install python3-numpy`). Fensterglas = Transparent +
  Glossy, in jede Oeffnung ein Portal-Licht. Handyfoto-Look: 22 mm auf 36-mm-Sensor, Hochformat, Tageslicht +2 EV.
- Website-Budget: Scroll-Video ≤ 3 MB, Schleife ≤ 2 MB, Poster ≤ 150 KB; laden erst kurz vor Sichtbarkeit.

## Ehrlichkeit (UWG) und Website

- Text nie ins Bild rendern, sondern als HTML daneben. Animation sichtbar als „Animation, vereinfachte Darstellung“ kennzeichnen,
  besonders auf Seiten mit „keine Symbolbilder“. Herstellerwerte immer „laut Hersteller“.
- Keine absoluten Versprechen („Dreck perlt komplett ab“, „UV-sicher“), sondern „leichter“, „besser geschuetzt“.
- Einbau nur in cc-lp-Seiten mit deren Klassen; kein eigener Preis im Abschnitt. Live erst nach Freigabe des Nutzers, danach nachlesen.

## Bausteine

`lib/studio.py` (Szene, Material, Licht, Kamera, Rendern; `--vorschau`, `--still N`, `--frames A-B`, `--schritt N`) ·
`lib/sportwagen.py` (eigener Sportwagen) · `lib/studio_auto.py` (Studio + Auto-Materialien) ·
`lib/waesche.py` (Fronten, Schmutz-Shader, Schaum + Tropfen per Geometry Nodes, Spruehstrahl) ·
Modelle: `lackschichten`, `sportwagen_form`, `sportwagen_look`, `sportwagen_waesche`, `keramik_schutz`.

## Ideen fuer Carcura (nach Wirkung)

1. Lackschichten (fertig) · 2. Sportwagen-Waesche (fertig) · 3. Keramik-Schutz Wasser/UV/Schmutz (fertig)
4. Polierpad entfernt Swirls (Politur) · 5. Felgen-Keramik mit Bremsstaub · 6. Scheinwerfer vergilbt → klar
