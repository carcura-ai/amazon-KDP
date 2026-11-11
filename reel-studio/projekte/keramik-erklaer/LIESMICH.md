# Reel „Keramik erklärt“ (11.11.2026)

Erklär-Animation im Carcura-Design: 9:16, 1080 × 1920, 30 fps, 37 s, mit Sprecherstimme (-15,6 LUFS).
Video: `ausgabe/keramik-erklaer.mp4` (6,4 MB). Titelbild-Vorschlag: `ausgabe/vorschau.jpg` (Bild bei 2,6 s).

Idee: Vergleich mit der Handyhülle aus einem Reel von @happyvalleydetailing_925. Umsetzung, Texte und Design sind eigen.

## Ablauf

| Zeit | Inhalt |
|---|---|
| 0–3,5 s | Aufhänger: „Dein Handy hat eine Hülle. Und dein Lack?“, Lackschichten bauen sich auf |
| 3,5–6,3 s | Keramik fällt auf die rechte Hälfte: „Eine Schicht mehr. Hauchdünn und glatt.“ |
| 6,3–11,5 s | UV: links wird der Klarlack trüb, rechts deutlich weniger. „Die Keramik bremst das. Ganz aufhalten kann sie es nicht.“ |
| 11,5–16,8 s | Wasser: links flache Pfützen, rechts runde Perlen, die abrollen. „Kontaktwinkel bis 165° laut Hersteller“ |
| 16,8–21,6 s | Schmutz: Wasser spült rechts alles weg, links bleibt viel liegen. „Waschen musst du trotzdem.“ |
| 21,6–26,5 s | Logo, „Keramikversiegelung ab 700 €“, „3 Fotos vom Lack per WhatsApp“ |

Durchgehend steht „Animation, vereinfachte Darstellung“ im Bild (UWG). Herstellerwert nur mit „laut Hersteller“. Der Preis kommt aus `brand/MARKE.md`.

## Beschreibung für Instagram/TikTok

```
Dein Handy steckt in einer Hülle. Dein Lack meistens nicht.

Eine Keramikversiegelung ist eine hauchdünne Schicht auf dem Klarlack. Sie bremst, dass die Sonne den Lack stumpf macht. Wasser perlt ab, statt liegen zu bleiben. Und Dreck geht beim Waschen leichter runter. Waschen musst du trotzdem.

Bei uns ab 700 €, mit Handwäsche, Kneten und Politur. Schick uns 3 Fotos von deinem Lack per WhatsApp, dann sagen wir dir vorher, was es kostet.

📍 Walterschen, Westerwald · Link in der Bio

Kennst du jemanden, der sein Handy besser schützt als sein Auto? Schick ihm das.

#keramikversiegelung #autoaufbereitung #lackpflege #westerwald #altenkirchen
```

WhatsApp-Link für Bio oder Story (Herkunft messbar):
`https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20komme%20vom%20Keramik-Video`

Musik: in der Instagram-App eine lizenzierte, ruhige Spur wählen und leise unter die Stimme legen (Rechte).

**KI-Kennzeichnung:** Die Stimme ist computererzeugt. Beim Hochladen auf Instagram/Facebook „KI-Info“ einschalten (Meta verlangt das für realistisch klingenden, digital erzeugten Ton).

## Stimme

**Aktuell (11.11., nach Kritik „klingt österreichisch, unbetont“): Qwen3-TTS VoiceDesign 1.7B** (Alibaba Qwen, Apache-2.0, kommerziell nutzbar).
Die Stimme ist per Beschreibung entworfen („warmer, freundlicher Werbesprecher, Anfang 30, Hochdeutsch ohne Dialekt“, Text in `stimme_qwen.py`). Sie ist kein Klon einer echten Person. Der ganze Text wird in einem Durchgang gesprochen, das gibt eine gleiche Stimme und natürliche Betonung. Danach wird er per Spracherkennung in Sätze geschnitten.
Prüfung: Die Spracherkennung erkennt zu 99,7 % Deutsch, und alle Wörter stimmen.
Ablauf: `<qwen-venv>/bin/python stimme_qwen.py erzeugen` → `python3 stimme_qwen.py schneiden` → `QUELLE=fertig python3 stimme.py` → `node render.js video /tmp/bilder ausgabe/keramik-erklaer.mp4`.
venv im Scratchpad: torch (CPU) von download.pytorch.org, `qwen-tts==0.1.1` von PyPI. Das Modell kommt von huggingface.co/Qwen. Rechenzeit etwa 2,5 Minuten für 30 s Ton.

Frühere Versuche:

- Erzeugt mit `stimme.py`: Piper (Open Source, lokal) mit der Stimme **„de_DE-thorsten-medium“**. Datensatz Thorsten-Voice (CC0) und Basismodell rdh (CC0), also kommerziell nutzbar.
  „thorsten-high“ klingt etwas besser, ist aber von einem Forschungs-Datensatz (Lessac/Blizzard 2013, nur Forschungslizenz) abgeleitet → **nicht für Werbung**.
- Jeder Satz startet, wenn sein Text im Bild erscheint. Wo die Stimme mehr Zeit braucht, wird die Szene gleichmäßig gedehnt (höchstens 1,5×). Die Zeitkarte steht in `ausgabe/karte.json`.
- Geprüft per Spracherkennung (faster-whisper): Alle Sätze werden richtig erkannt. Für die Aussprache steht im Skript „Wotsäpp“ und „Hauchdünn, und glatt“.
- Bessere Stimme: eigene Aufnahme (Handy, im Auto bei geschlossenen Türen) oder ElevenLabs (kostenpflichtig, kommerzielle Nutzung erst im bezahlten Tarif, Bedingungen vorher prüfen). Für beides die Sätze aus `SAETZE` in `stimme.py` einzeln sprechen bzw. erzeugen, dann die Dateien als `ausgabe/stimme/s_00.wav` … ablegen und den Zusammenbau neu starten.

- **Besser klingende Alternative (getestet 11.11.):** Chatterbox Multilingual von Resemble AI (MIT-Lizenz, kommerziell nutzbar, Deutsch, Open Source, läuft lokal auf der CPU, etwa 5 s Rechenzeit pro 1 s Ton). Das Modell übernimmt die Stimme aus einer 10–20 s langen Referenzaufnahme. Erlaubt sind nur Stimmen mit Rechten: eigene Stimme, Richy, Thorsten-Voice (CC0) oder ein Sprecher mit schriftlicher Einwilligung. In jeder Ausgabe steckt ein unhörbares Wasserzeichen (Perth) als KI-Kennzeichen.
  Proben: `stimmproben/` (0 = Piper bisher, 1 = Chatterbox mit Thorsten-Referenz, 2 = Chatterbox-Standardstimme). Bekannte Schwäche: Gelegentlich wird ein Wort verschluckt oder am Ende etwas dazuerfunden → jeden Satz 2–3× erzeugen und den besten Durchgang per Spracherkennung auswählen.
  Installation nur im venv im Scratchpad (`torch==2.6.0` CPU von download.pytorch.org, `chatterbox-tts==0.1.7` von PyPI), nicht im Repo.

Sprechertext (14 Sätze):
Dein Handy hat eine Hülle. · Und dein Lack? · Keramik ist eine Schicht mehr. · Hauchdünn und glatt. · Sonne macht Klarlack mit der Zeit stumpf. · Die Keramik bremst das. · Ganz aufhalten kann sie es nicht. · Ohne Keramik bleibt Wasser flach liegen. · Mit Keramik perlt es ab. · Der Dreck haftet schlechter. · Beim Waschen geht er leichter runter. · Waschen musst du trotzdem. · Keramikversiegelung ab siebenhundert Euro. · Schick uns drei Fotos per WhatsApp.

## Ändern und neu rendern

- Texte, Zeiten und Farben stehen in `animation.html` (Funktion `render(t)`).
- Vorschau im Browser: `animation.html` öffnen (läuft in Schleife) oder `animation.html?t=13.7` für ein Standbild.
- Stimme neu erzeugen: `PIPER_PY=<venv>/bin/python PIPER_MODELL=<pfad>/de_DE-thorsten-medium.onnx python3 stimme.py` (Piper: `pip install piper-tts==1.8.0` in einem venv; Stimme von huggingface.co/rhasspy/piper-voices, de/de_DE/thorsten/medium)
- Neu rendern (etwa 1 Minute, nimmt `ausgabe/karte.json` und `ausgabe/stimme.wav` automatisch mit): `node render.js video /tmp/bilder ausgabe/keramik-erklaer.mp4`
- Prüfbilder: `node render.js standbilder /tmp/standbilder`
