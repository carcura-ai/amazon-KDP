# Story „Keramikversiegelung“ (11.11.2026)

Verkaufs-Story für Instagram (9:16, 1080 × 1920, 30 fps). **Stand 12.11.2026:** 84,5 s, deshalb in zwei Teilen für die Story (ein Story-Abschnitt darf höchstens 60 s lang sein):

| Datei | Länge | Einsatz |
|---|---|---|
| `ausgabe/keramik-story-teil1.mp4` | 30,5 s | Story Teil 1: Aufhänger, Geschenk-Hinweis, Probleme, endet mit „Aber wer schützt ihn?“ |
| `ausgabe/keramik-story-teil2.mp4` | 54,0 s | Story Teil 2: Lösung, Nutzen, Ablauf, Angebot, Weihnachten, Schluss → hier den Link-Sticker setzen |
| `ausgabe/keramik-story.mp4` | 84,5 s | am Stück, z. B. als Reel |

Alles selbst erzeugt: Animation (Code), Stimmen (KI), Musik und Effekte (Synthese). Lautheit -14,2 LUFS.

Sprechertext (Stand 12.11.): Dein Handy steckt in einer Hülle. · Aber dein Auto? Das steht jeden Tag draußen. Ohne extra Schutz. · [Pause] Bleib kurz dran: Am Ende wartet ein Geschenk auf dich. · Die Probleme sind: Sonne, Regen, Streusalz und Vogelkot. · Und irgendwann siehst du es … · Der Lack wird stumpf. Wasser hinterlässt Flecken. Und der Dreck geht kaum noch runter. · Das Problem sitzt ganz oben, im Klarlack. Er schützt deine Farbe. Aber wer schützt ihn? · Genau da setzen wir an. · Mit einer Keramikversiegelung. · Eine hauchdünne, glasklare Schutzschicht, die sich fest mit deinem Lack verbindet. · Die Sonne bleicht den Lack langsamer aus. · Wasser perlt einfach ab. · Und Dreck findet weniger Halt. Die Wäsche geht viel leichter. · Bei uns in Walterschen, direkt bei Altenkirchen, machen wir alles von Hand: waschen, kneten, polieren. Erst dann kommt die Keramik drauf. · Keramikversiegelung ab siebenhundert Euro. · Und wenn du bis Jahresende buchst, schenken wir dir ein Waschset dazu. · Schick uns einfach drei Fotos von deinem Lack per WhatsApp. Dann bekommst du unser Angebot und weißt vorher, was es kostet. · Du hast noch kein Weihnachtsgeschenk für einen Autoliebhaber? Dann buch jetzt, auch als Gutschein. · [Weihnachtsmann: „Ho, ho, ho!“] · Gönn deinem Lack die Hülle, die er verdient.

**Aktion (von Alex am 12.11. bestätigt):** Waschset geschenkt, zusätzlich zum Pflegeset, bei Buchung bis 31.12.2026 (Termin darf später liegen). Die Bedingung steht im Bild („bei Buchung bis 31.12.2026“). **Nach dem 31.12. darf dieses Video nicht mehr laufen** (Highlight entfernen oder Fassung ohne Aktion rendern).

Stimme: Satz für Satz mit `stimme_klon.py` (gleiche Stimme wie Take 33, 4–8 Fassungen je Satz, die deutlichste gewinnt; bei „Schutz“ und „Walterschen“ zählt genau dieses Wort). Kein Beschleunigen. „Ho, ho, ho“: `hohoho.py` (eigene entworfene Stimme). Teilen: `teilen.py`.

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
