# Story „Keramikversiegelung“ (11.11.2026)

Verkaufs-Story für Instagram (9:16, 1080 × 1920, 30 fps, unter 60 s → ein Story-Segment).
Video: `ausgabe/keramik-story.mp4` (59,2 s, 11 MB, -14,5 LUFS). **Stimme neu aufgelegt am 12.11.** (`stimme_klon.py`): gleiche Stimme wie Take 33, aber Satz für Satz gesprochen (Qwen3-TTS Base, 4 Fassungen je Satz, die deutlichste gewinnt). Nirgends wird mehr im Sprechfluss geschnitten. Tempo nur +4 %. Die Spracherkennung versteht die fertige Spur Wort für Wort richtig. „bleicht ihn“ wurde zu „bleicht den Lack“ (wurde als „ihnen“ verstanden). Der Pflegeset-Satz wird nur eingeblendet. Alles selbst erzeugt: Animation (Code), Stimme (KI), Musik und Effekte (Synthese).

## Dramaturgie (Problem → Ursache → Lösung → Beweis → Angebot → Termin)

| Teil | Gesprochen | Bild |
|---|---|---|
| Aufhänger | „Dein Handy steckt in einer Hülle. Aber dein Auto? Das steht jeden Tag draußen. Ohne extra Schutz.“ | Handy bekommt gelbe Hülle, Auto zeichnet sich als Linie |
| Gefahr | „Sonne. Regen. Streusalz. Vogelkot.“ | Lupe in den Lack; jedes Wort schlägt sichtbar ein (Trübung, Kalkflecken, Salz, Ätzfleck) |
| Problem | „Der Lack wird stumpf. Wasser hinterlässt Flecken. Und der Dreck geht kaum noch runter.“ | drei rote Hinweise, Dreck bleibt liegen, Kamera fährt heran, Musik in Moll mit Herzschlag |
| Ursache | „Das Problem sitzt ganz oben, im Klarlack. Er schützt deine Farbe. Aber wer schützt ihn?“ | Klarlack leuchtet gelb auf |
| Wende | „Genau da setzen wir an.“ | Polierlicht läuft drüber, Schäden verschwinden, Riser |
| Lösung | „Mit einer Keramikversiegelung. Eine hauchdünne, glasklare Schutzschicht, die sich fest mit deinem Lack verbindet.“ | Aufschlag: gelbe Schicht landet, Musik wechselt nach Dur |
| Nutzen | UV, Wasser, Schmutz (links ohne, rechts mit) | Sonne/Strahlen, Perlen rollen ab, Welle spült Dreck weg |
| Beweis | „Bei uns in Walterschen machen wir alles von Hand: waschen, kneten, polieren …“ + Pflegeset | 4 Schritte haken sich ab |
| Angebot | „Keramikversiegelung ab siebenhundert Euro. Schick uns einfach drei Fotos … per WhatsApp. Du weißt vorher, was es kostet.“ | Logo, Preis, WhatsApp-Knopf |
| Schluss | „Gönn deinem Lack die Hülle, die er verdient.“ | Pfeil „Termin anfragen“ → **hier den Link-Sticker setzen** |

Aussagen geprüft (UWG): keine Versprechen ohne Beleg. „bremst“ statt „verhindert“, Herstellerwert mit „laut Hersteller“, „Animation, vereinfachte Darstellung“ im Bild, Preis aus `brand/MARKE.md`.

## Beim Posten der Story

1. Video hochladen, **Link-Sticker** unter den gelben Pfeil („Termin anfragen“) setzen:
   `https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20komme%20von%20der%20Keramik-Story`
2. **„KI-Info“** einschalten (die Stimme ist KI-erzeugt).
3. Danach als Highlight „Keramik“ speichern, dann wirkt sie dauerhaft auf dem Profil.

## Technik

- Stimme, aktueller Weg: `<qwen-venv>/bin/python stimme_klon.py erzeugen 4` → `python3 stimme_klon.py waehlen` (schreibt `zeitplan.json` und `stimme_roh.wav`) → `ton.py` → `render.js`. Die Referenzstellen für die Stimme stammen aus `ausgabe/takes/take_33.wav` (nicht im Repo; neu erzeugbar mit `stimme_story.py erzeugen 33`).
- Stimme, erster Weg: `stimme_story.py` (Qwen3-TTS VoiceDesign 1.7B, Apache-2.0, entworfene Stimme). 3 Durchgänge mit verschiedenen Seeds → `bewerten` (Wortgenauigkeit per Spracherkennung, Lebendigkeit = Streuung der Tonhöhe) → bester Durchgang wird `schneiden` übergeben → `ausgabe/zeitplan.json` (Satz- und Wortzeiten) + `ausgabe/stimme_roh.wav`.
- Bild: `story.html` liest die Zeiten. Jede Animation hängt am gesprochenen Wort (z. B. „Regen“ → Regen fällt genau dann).
- Ton: `ton.py` (numpy/scipy) erzeugt Musik und Effekte auf dieselben Zeiten, senkt die Musik unter der Stimme ab und bringt alles auf -14 LUFS → `ausgabe/ton.wav`.
- Video: `node render.js video /tmp/bilder ausgabe/keramik-story.mp4 ausgabe/ton.wav`
- venvs liegen im Scratchpad (nicht im Repo): torch (CPU) von download.pytorch.org, `qwen-tts==0.1.1` von PyPI. `ton.py` läuft mit demselben venv (braucht scipy).
