# Stil-Handbuch: Story, Schnitt, Effekte

## 1. Formate, die fuer Aufbereitung/Detailing funktionieren

| Format | Aufbau | Wann |
|---|---|---|
| **Transformation** | Schlimmster Zustand (1 s) → Prozess-Zeitraffer/ASMR → Vorher/Nachher-Wischer → Ergebnis-Glanzkante → CTA | Standard fuer jedes Fahrzeug |
| **Angebot/Aktion** | Hook mit Zahl → Grund fuer das Angebot → Beweis-B-Roll → Preis-Animation → Knappheit → CTA | Rabatte, Saison, freie Termine |
| **Fehler-Liste** | „3 Fehler, die deinen Lack ruinieren“ → je Fehler B-Roll + Loesung → CTA | Reichweite, Expertenstatus |
| **Mythos vs. Fakt** | Behauptung (durchgestrichen) → Wahrheit mit Beweis | Vertrauen, Shares |
| **POV / Kundensicht** | „POV: Du holst dein Auto nach der Keramik ab“ → Reaktion, Abperleffekt | Emotion, Wunsch |
| **Preis-Transparenz** | „Was kostet eine Keramikversiegelung wirklich?“ → Aufschluesselung | Leads mit Kaufabsicht |
| **Prozess-ASMR** | Kaum Sprache, Originalton (Schaum, Spruehen, Polierer), Untertitel-Stichworte | Watchtime, Loops |
| **Kundenstimme** | Kunde 5–8 s O-Ton + Ergebnis-B-Roll | Social Proof (Einwilligung!) |

## 2. Hooks (erste 1,5–3 s)

Bild, Text und Stimme sagen dasselbe. Muster:
- Zahl + Nutzen: „Keramik fuer den halben Preis – nur fuer ein Auto.“
- Schock/Zustand: „So sah dieser M2 nach 3 Jahren Waschanlage aus.“ (schlimmstes Bild zuerst)
- Fehler: „Hoer auf, dein Auto so zu waschen.“
- Neugier-Luecke: „Das hier passiert mit Wasser auf versiegeltem Lack …“ (Abperl-Zeitlupe)
- Direkte Ansprache der Zielgruppe: „Du faehrst einen BMW und parkst draussen?“
Visuell: Bewegung im ersten Frame (kein Standbild), Close-up, Punch-In, 3D-Element oder Vorher-Zustand. Ton: Sub-Drop/Impact auf dem ersten Schlagwort.

## 3. Schnitttechniken (Werkzeug in Klammern)

- **Jump-Cuts** ohne Pausen und Fueller (analyze.py automatisch), Sprecher-Zoom wechselt je Satz (auto.zoom).
- **Punch-In** auf Schluesselwort (Segment `zoom`, z. B. [1.15, 1.2]) – max. alle 3–4 s.
- **J-/L-Cut**: Voiceover laeuft ueber den Bildwechsel (VO-Segmente machen das automatisch).
- **Speed-Ramp/Zeitlupe** fuer Abperleffekt, Schaum, Glanz (`rate` 0.4–0.6; Material mit 60/120 fps).
- **Vorher/Nachher-Wischer** immer, wenn beides gefilmt ist (`compare`), Shimmer-Sound beim Abschluss.
- **Whip-/Zoom-Uebergaenge** zwischen B-Roll-Szenen (auto.transitions), **Weissblitz** nur fuer den grossen Reveal (`tin: flash`).
- **Match-Cut**: gleiche Bewegung/Position in zwei Clips (z. B. Hand wischt → Schnitt auf sauberen Lack).
- **Loop-Ende**: letzter Frame passt zum ersten (gleiche Einstellung oder Satz, der in den Hook fuehrt) → Mehrfachwiedergabe.
- **Pause vor der Pointe**: 0,3–0,5 s Stille vor dem Reveal, nie laenger als ~1 s.
- **Ein Gedanke pro Einstellung**; Einstellungen 1–3 s, Sprecher bis 4 s.

## 4. Untertitel und Text

- Wort-fuer-Wort, max. 3 Woerter, aktives Wort in Akzentfarbe (Standard der Pipeline), y = 0.615.
- Schluesselzahlen und Nutzen zusaetzlich als Grafik (price, checklist, lowerthird) – nicht doppelt als Untertitel, wenn die Grafik dasselbe sagt (`captions.hide`).
- Keine Saetze ueber 6 Woerter als Einblendung. Lesbar = mind. 32 px, Kontrast durch Glas-Karte oder Kontur.
- Sichere Zone: Text zwischen 15 % und 63 % Bildhoehe, seitlich 60 px Rand.

## 5. Look

- Farblook: leicht mehr Kontrast und Saettigung (`look.grade`), Vignette 0.3–0.4 fuer Fokus.
- Dunkle Szenen: `grade`-Bereich mit `brightness(1.2–1.3)`.
- Akzentfarbe Gelb #FFD60A + Schwarz; Schriften Anton (Titel) und Montserrat (Text).
- Hochkant 1080×1920, 30 fps; Zeitlupen aus 60/120-fps-Material.

## 6. 3D und Sticker – Ideenkatalog (sinnvoll, nie als Selbstzweck)

| Thema im Video | Visuelles Element | Quelle |
|---|---|---|
| Fahrzeugmodell genannt (z. B. BMW M2) | **Freisteller des echten Kundenautos** als Bauchbinde oder Sticker | `asset.py freistellen` aus eigenem Clip |
| Sauberkeit, Waesche | Schwamm, Seifenblasen, Glitzern | emoji Sponge, Bubbles, Sparkles |
| Abperleffekt, Wasser | Wassertropfen | emoji Droplet |
| Schutz, Versiegelung | Schild | emoji Shield |
| Winter, Streusalz | 3D-Schnee, Schneeflocke, Thermometer | `snow`, emoji Snowflake, Thermometer |
| Sommer, UV | Sonne | emoji Sun |
| Preis, Rabatt, Ersparnis | 3D-Muenze, Geldsack, Euro-Schein | `badge3d`, emoji "Money bag", "Euro banknote" |
| Zeit, Frist, Termin | Sanduhr, Kalender, Wecker | emoji "Hourglass done", Calendar, "Alarm clock" |
| Kratzer, Swirls finden | Lupe | emoji "Magnifying glass tilted left" |
| Glanz, Premium | Diamant, Krone | emoji "Gem stone", Crown |
| Kontakt, Anfrage | Handy, Sprechblase | emoji "Mobile phone", "Speech balloon" |
| Ergebnis, Qualitaet | Pokal, 100 Punkte | emoji Trophy, "Hundred points" |

Emoji-Namen = englischer Unicode-Name wie im Ordner von github.com/microsoft/fluentui-emoji/tree/main/assets.
Platzierung: neben dem Gesicht, nie darueber; Groesse 220–320 px; erscheint exakt auf dem Wort (`from: "t:Wort-0.1"`), bleibt 1,5–3 s.

## 7. Gelernt aus Referenzen

(Hier Erkenntnisse aus `pipeline/referenz.py`-Analysen eintragen: Quelle, Schnitte pro Sekunde, Hook-Typ, Effekte, was wir uebernehmen.)
