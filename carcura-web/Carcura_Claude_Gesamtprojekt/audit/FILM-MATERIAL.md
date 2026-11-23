# Startseitenfilm: Szenen, Vorschau-Material und fehlende Aufnahmen (23.11.2026)

**Stand der Vorschau:** Alle 15 Zustände sind KI-generierte Einzelbilder mit 762 px Breite (Politur 1118 px). Sie basieren auf der Hallenvorschau.
- **Bewegung zwischen den Zuständen:**
  - Bei gleicher Kamera entsteht sie aus Einzelbildern mit einer gerichteten Freilegekante (`wipe`).
  - Bei anderem Blickwinkel gibt es einen harten Schnitt (`cut`).
- **Was es in der Vorschau nicht gibt:** echte Tür-, Wasser-, Schaum-, Pad- oder Applikatorbewegung und keine Kamerafahrt.
- **Hochformat:** Es gibt keine eigene Hochformat-Fassung. Mobil wird die 3:2-Totale vollständig gezeigt (Front und Heck sichtbar), die Karte steht darunter.
- **Halle:** Die echte Carcura-Halle (Rolltor, LED-Wand, Balken, Klickfliesen) ist in den KI-Bildern nur nachempfunden. Aus Originalfotos zusammengesetzt ist nichts.

## Szenen
| Szene | Karte | Inhalt (Vorschau) | Übergang | Quelle jetzt | Benötigtes Material |
|---|---|---|---|---|---|
| 00-dreckig | – (keine Karte) | Totale, verschmutzt. Ruhephase ohne Text. | wipe | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Totale 1920×1080 (Desktop) und 1080×1350 (Hochformat): Porsche verschmutzt in der echten Halle, Heck zum Rolltor, Treppe außerhalb des Bildes. |
| 01-schaum | Außenwäsche inklusive Felgen | Schaum aufgetragen. | wipe | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Zusammenhängende Aufnahme/Rendering aus derselben Kamera: Schaum wird aufgetragen und läuft der Schwerkraft nach ab (24–48 Bilder). |
| 02-gespuelt | Außenwäsche inklusive Felgen | Abgespült, nass. | wipe | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Sequenz Abspülen von oben nach unten, gleiche Kamera, Wasserablauf am Schweller. |
| 03-sauber | Außenwäsche inklusive Felgen | Sauber, trocken. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Endzustand sauber, gleiche Kamera, korrekte Spiegelung von LED-Wand, Balken und Tor im Lack. |
| 04-seite | – (keine Karte) | Seitenansicht vor der Tür. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Kamerafahrt Totale → Fahrerseite (oder sauberer Schnitt), Reifenkontakt sichtbar. |
| 05-tuer | – (keine Karte) | Fahrertür offen. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Türöffnung um das Scharnier als Sequenz (24–36 Bilder), Scheibe und Spiegel bewegen sich mit. |
| 06-innen-vorher | Innenraumreinigung | Fußraum und Sitz verschmutzt. | wipe | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Innenraum: Sauger/Tornador nimmt Sand und Krümel sichtbar auf (Sequenz, gleiche Kamera). |
| 07-innen-nachher | Innenraumreinigung | Fußraum und Sitz sauber. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Endzustand Innenraum, gleiche Kamera; zusätzlich Cockpit-Einstellung. |
| 08-politur-vorher | Lackpolitur | Swirls, Polierpad am Lack. | wipe | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Prüflicht auf Lackfläche, Polierpad läuft sichtbar mit Kontakt über die Fläche (Sequenz). |
| 09-politur-nachher | Lackpolitur | Klarere Spiegelung. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Dieselbe Fläche nach der Politur, identisches Licht. |
| 10-keramik-auftrag | Keramikversiegelung | Applikator auf dem Lack. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Applikator mit Lackkontakt, Kreuzgang-Bewegung (Sequenz). |
| 11-keramik-abnehmen | Keramikversiegelung | Überschuss abnehmen. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Mikrofasertuch nimmt Überschuss ab, gleiche Kamera wie Auftrag. |
| 12-wasser | Keramikversiegelung | Wasser auf dem Lack. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Wasserstrahl auf versiegelte Fläche, Ablauf als Sequenz. |
| 13-perlen | Keramikversiegelung | Wasserperlen. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Perlen formen sich und laufen ab (Sequenz, gleiche Kamera wie Wasser). |
| 14-ergebnis | – (keine Karte) | Totale, sauber. | cut | Vorschau: KI-Einzelbild, 762 px (Politur 1118 px) | Totale sauber, Tür zu, gleiche Kamera wie Szene 00. |

## Allgemeine Anforderungen an neues Material
- **Desktop:** mindestens 1920 × 1080, WebP oder AVIF, pro Bild ≤ 250 KB anstreben.
- **Hochformat (Handy):** 1080 × 1350, pro Bild ≤ 120 KB.
- **Eine feste Kamera pro Einstellung:** Halle in Weltkoordinaten fix, Reifen mit Bodenkontakt, Spiegelungen von LED-Wand, Balken und Tor passend zur Kameraposition.
- **Sequenzen:** 24–48 Bilder pro Arbeitsschritt reichen für flüssiges Scrollen. Mehr erhöht nur die Ladezeit.
- **Echte Fotos der Halle:** Grundlage für Rolltor, LED-Wand, Balken und Fliesen sind die Hallenfotos (z. B. `referenz/01-Fahrzeugposition.png`). Den Porsche hineinzusetzen braucht ein 3D-Modell mit Innenraum oder echte Aufnahmen, beides liegt nicht vor.

## Einbinden, pro Szene
1. Dateien nach `src/assets/film/<szene>/` legen, z. B. `src/assets/film/01-schaum/0001.webp` usw., optional `.../mobil/0001.webp`.
2. In `src/film-szenen.json` bei der Szene eintragen:
   - `"sequenz": ["/assets/film/01-schaum/0001.webp", …]`
   - optional `"mobil_sequenz": [...]`
   - oder für ein besseres Einzelbild nur `"desktop"` bzw. `"mobil"` ersetzen.
3. Übergang prüfen: `wipe` nur, wenn die nächste Szene exakt dieselbe Kamera hat. Sonst `cut`.
4. `python3 src/build.py && python3 src/check.py` ausführen, danach den Film bei 390, 768 und 1440 px vor und zurück scrollen.

Der Film-Code (`src/assets/js/film.js`) muss dafür nicht geändert werden. Sequenzen werden innerhalb des Scroll-Anteils (`gewicht`) der Szene abgespielt. Die Karte richtet sich nach dem tatsächlich angezeigten Bild.
