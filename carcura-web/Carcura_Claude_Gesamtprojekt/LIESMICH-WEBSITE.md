# Carcura Website · lokale Fassung (Stand 24.11.2026)

## Starten
```bash
cd carcura-web/Carcura_Claude_Gesamtprojekt/dist
python3 -m http.server 8080
```
Dann im Browser http://localhost:8080/ öffnen. Die Seite braucht einen Server, weil alle Pfade absolut sind (/assets/…). Ein Doppelklick auf die Datei reicht nicht.

## Ändern und neu bauen
- Preise, Kontakt, Öffnungszeiten, Aktion: `CARCURA-DATA.json`
- Texte und Seiten: `src/build.py`
- Danach `python3 src/build.py` (erzeugt dist/ neu) und `python3 src/check.py` (prüft Links, Anker, Preise, H1, Titel, Canonicals, Sitemap).
- Design und Skripte: `src/assets/` (css, js, fonts, img, wash, film). Der Build kopiert sie nach `dist/assets/`, Änderungen nur in `src/assets/` vornehmen.
- Startseite, Außenwäsche beim Scrollen: `src/assets/js/wash.js` mit den Bausteinen in `src/assets/wash/` (vier Zustände + Verlaufskarte, erzeugt mit `python3 src/video/build_scroll_assets.py`). Kein Video, keine Bedienelemente. Der Zeitplan steht oben in `wash.js` (`T`, `LBL`). Austausch und fehlendes Material: `audit/FILM-MATERIAL.md`.
- Die Aktion „Waschset zur Keramik“ verschwindet nach dem 31.12.2026 automatisch, beim nächsten Build und im Browser.

## Aufbau
- 31 Seiten unter `dist/` (alle bestehenden Pfade plus Impressum, Datenschutz, Cookie-Richtlinie, Widerruf), 404.html, sitemap.xml, robots.txt.
- 4 Weiterleitungs-Platzhalter (/preise/, /team/, /firmenkunde-werden/, /https-carcura-info-leistungen/). In Produktion als echte 301 einrichten, siehe `audit/URL-MAPPING.csv`.
- Anfragen gehen an den bestehenden Endpunkt `/wp-json/ccrr/v1/lead`. Das funktioniert nur auf carcura.info. Lokal zeigt das Formular ehrlich den Fehlerfall mit Telefon, WhatsApp und E-Mail.

## Medien
- **Film:** 15 Einzelbilder aus der Hallenvorschau, 762 px breit, KI-generiert und als Inszenierung gekennzeichnet. Übergänge:
  - Gleiche Blickachse (Waschzustände, Innenraum, Politur) wird mit einer Clip-Kante freigelegt.
  - Abweichende Blickwinkel werden hart geschnitten.
  - Es gibt keine echte 3D-Animation, keine Tür- oder Kamerafahrt und keine Blender-Renderings.
- **Fotos:** echte Carcura-Fotos aus `assets/photos`.
- **Offen:** Die Bilder sind für große Desktops zu klein (762 px). Für ein scharfes Ergebnis ab 1440 px braucht es Neurenderings in mindestens 1920 px. Die Blender-Szene mit dem Konzeptauto ist kein Porsche-Modell.
