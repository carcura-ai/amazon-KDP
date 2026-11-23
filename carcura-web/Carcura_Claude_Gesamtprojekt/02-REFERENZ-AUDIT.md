# Referenzprüfung: Detailing Car Studio

Datum: 23.11.2026. Die Startseite, Leistungsübersicht, eine Innenraum-Detailseite, Preise, Über uns, Team und Kontakt wurden im Browser geöffnet. Politur- und Keramik-Detailseiten wurden zusätzlich anhand ihrer öffentlich ausgelieferten Seiteninhalte geprüft. Die Gestaltung wurde bei ungefähr 1363 × 936 CSS-Pixeln untersucht. Mobile Ansichten wurden nicht separat in einem mobilen Viewport visuell getestet; die ausgelieferten CSS-Breakpoints wurden gelesen. Unten genannte mobile Werte sind Umsetzungsvorgaben, keine gemessenen Mobilwerte.

## 1. Was den Eindruck der Vorlage tatsächlich ausmacht

Es ist eine Verbindung aus realistischen Fotomotiven, sehr großer schmaler Typografie, großzügigen Abständen und wenigen wiederkehrenden Animationen. Eine komplette Echtzeit-3D-Szene ist nicht für den Startbereich nötig. Das 3D-Waschspiel weiter unten ist ein eigenes Element.

### Hero

- Fahrzeug in fast vollständiger Seitenansicht, niedrige Kameraposition, dunkle professionelle Halle, große helle Deckenpaneele und vertikale Inspektionslichter an den Wänden.
- Der gesamte Einstieg ist im Desktop-DOM 400 Viewporthöhen lang. Im untersuchten Browser waren das 3744 px bei 936 px Höhe.
- Innerhalb davon bleibt ein 100vh hoher Bildbereich oben stehen (`position: sticky; top: 0`).
- Vier absolut deckungsgleiche Bilder liegen übereinander: Schmutz, Schaum, abgespült, fertig sauber. Die untersuchten Quelldateien hatten dieselbe nominale Bildgröße 1938 × 811.
- Der DOM zeigt für die Folgebilder animierte `clip-path: inset(...)`-Masken. Es wird also horizontal ein neuer Bildzustand freigelegt; es ist kein automatisch ablaufender Film im Hero.
- An den Übergängen liegen eigene Sprüh- und Lichtkanten. Eine untersuchte Sprühfläche nutzt einen horizontalen Verlauf von transparent nach halbtransparentem Weiß und wieder transparent.
- Je Phase erscheint eine andere große Überschrift am unteren Bildrand. Darunter eine schmale technische Phasenleiste und ein Fortschrittsstrich.
- Ein dunkler Scrim schafft den nötigen Kontrast. Das Auto bleibt der Hauptdarsteller.

### Navigation

- Oben mittig schwebende Pillenleiste, ungefähr 20 px vom oberen Rand entfernt; im Screenshot rund 736 px breit und 64 px hoch.
- Eigene äußere Navigationshülle ist über die Seitenbreite fixiert; die sichtbare Pille sitzt innen mittig.
- Abgelesen: 999px Eckenradius, 20px Hintergrundunschärfe, dunkler Hintergrund mit etwa 55 % Deckkraft, feine helle Kontur, weicher Schatten 0 12px 32px bei 25 % Schwarz.
- Kleine Wortmarke links, fünf Links in der Mitte, auffälliger Terminbutton rechts.
- Links enthalten zwei übereinanderliegende Textebenen für einen vertikalen Hover-Wechsel. Das ist ein kurzer Textwechsel, kein großes Menü-3D.
- Der Originalbutton hat einen kleinen runden Marker. Für Carcura kann dieser als rein dekoratives Merkmal erhalten bleiben.

### Schrift

Tatsächlich über berechnete Stile gelesen:

| Verwendung | Schrift | Beobachtete Größe/Gewicht |
|---|---|---|
| Große Seitentitel / Manifest | Big Shoulders | 120 px / 800 |
| Hero-Sätze und große Abschnittstitel | Big Shoulders | 72 px / 800 |
| Kleine Kartentitel | Big Shoulders | 32 px / 700 |
| Wortmarke in der Navigation | Big Shoulders | 20 px / 800 |
| Navigationslinks | Geist | 14 px / 500, etwa 20 px Zeilenhöhe |
| Technische Abschnittslabels | Geist Mono | 12 px, Versalien |

Für die Carcura-Umsetzung werden normale Labels auf mindestens 14 px angehoben. Große Titel behalten die enge, hohe Anmutung und bekommen mobile `clamp()`-Werte. Der Originalfont ist keine beliebige breite Standardschrift.

### Farbrhythmus und Layout

- Die Vorlage wechselt bewusst zwischen beinahe schwarzen Studioabschnitten und hellen kühlen Grauabschnitten. Nicht jede Sektion ist dunkel.
- Die ursprünglichen Orangeakzente werden für Carcura durch das vorhandene Gelbgrün ersetzt.
- Im untersuchten Desktop hatten viele Inhaltsbereiche ca. 1104 px Breite, ungefähr 120 px Außenabstand.
- Titel stehen oft links groß, die kurze Erklärung rechts in einer schmaleren Spalte mit viel Freiraum.
- Fotos haben häufig abgerundete Ecken und werden teilweise entsättigt eingesetzt.
- Die besondere Wirkung entsteht auch durch Ruhe zwischen den Animationen. Nicht jeder Text schwebt dauerhaft.

### Hintergrundeffekt

- Hinter den Leistungsbereichen befindet sich ein Studio-Lichtshader. Im DOM war ein Shader-Container mit Canvas sichtbar.
- Der Hintergrund besteht visuell aus weichen, unscharfen weißen und warmen Lichtflächen auf dunklem Grund. Diese wirken wie Reflexionen und streifendes Studiolicht hinter Glas.
- Hinter dem Kartenstapel bleibt eine Lichtfläche an den Viewport gebunden. Ein eigener Container ist sticky mit `top: 0`.
- Das ist ein anderer Effekt als der feste Bildhintergrund der Wasch-Hero-Szene.
- Für Carcura: helle Reflexionen plus sehr zurückhaltendes Gelbgrün, dunkler Grund. Kein Regenbogen, keine allgegenwärtigen Neonränder.

### Leistungsbereiche

Zuerst ein asymmetrisches Raster aus vier Studiobereichen: eine breite Karte links oben, eine hohe Karte rechts, zwei kleine Karten links darunter. Technische Etiketten und Chips, teils sehr große Outline-Schrift als dekoratives Element.

Später ein eigener Stapel großer Leistungskarten. Gelesene Eigenschaften: `position: sticky; top: 120px`, 28 px Radius, `backdrop-filter: blur(28px)`, dunkle Füllung mit ungefähr 38 % Deckkraft. Karten teilen sich in Text links und großes Bild rechts. Die nächste Karte schiebt sich über die vorige. Die Bildhälfte ist ein echtes Motiv, kein abstraktes Icon.

### Weitere wiederkehrende Elemente

- Laufband mit abwechselnd gefüllter und konturierter großer Schrift.
- Drei Preiskarten, eine deutlich hervorgehoben.
- Bildkarten für Team und Produkte.
- Große Abschlussaufforderung, mehrspaltige Kontaktdaten und eine übergroße Wortmarke im Footer.
- Terminformular mit drei klar bezeichneten Stufen: Leistungen; Wunschtag/Zeitfenster; Kontakt und Rückmeldeweg. Das Formular ist kein Beleg für live geprüfte Kalenderverfügbarkeit.
- Eigenständiges 3D-Waschspiel mit den Werkzeugmodi Schaum, Abspülen und Drehen sowie Reset und Reinigungsfortschritt. Dieses Spiel ist vom fotorealistischen Hero getrennt.

## 2. Seitenfamilien der Referenz und Übertragung

| Referenz | Beobachteter Aufbau | Carcura-Ziel |
|---|---|---|
| `/` | Wasch-Hero, Statement, Laufband, Studio-Raster, Preise, Kartenstapel, Team, Produkte, Anfrage, Waschspiel, Footer | `/` mit zusätzlicher zusammenhängender Reise zu Innenraum, Politur und Keramik |
| `/services` | Großer Titel, Erklärung, verlinkte Leistungskarten, Beratungs-CTA | `/leistungen/` |
| `/services/[slug]` | Zurücklink, großer Leistungstitel, Zeitbadge, Beschreibung und CTAs; breites Foto; enthaltene Schritte; weitere Leistungen | Bestehende Carcura-Leistungs-URLs behalten |
| `/pricing` | Seitentitel, drei Pakete, Preishinweise, Fragen | `/preise/` als neue ergänzende Übersicht; vorhandene Preisteile ebenfalls erhalten |
| `/about` | Großer Titel, Hallenbild, Geschichte, Kennzahlen, drei Grundsätze, Team-CTA | `/ueber-uns/` |
| `/team` | Großer Titel, vier Porträts, Karriereabschnitt | `/team/` mit ausschließlich Alexander und Richy; keine erfundenen Mitarbeiter oder Stellen |
| `/contact` | Großer Titel, dreistufiges Formular, Kontaktdaten rechts, Footer | `/anfragen/` |

Die Referenz hat acht Leistungseinträge: Handwäsche, Innenraum, Lackdekontamination, Politur, Keramik, Felgen/Bremssättel, Scheinwerfer, Motorraum. Diese sind keine automatische Carcura-Leistungsliste. Es werden nur tatsächlich bei Carcura angebotene Leistungen und vereinbarte Umfänge übernommen.

Zusätzlich müssen Galerie, Hol- und Bringservice, Firmenkunden, Partner, Pflege-Abos, vorhandene Ratgeber-/Ortsseiten und rechtliche Seiten von Carcura im gemeinsamen Design erhalten bleiben. Die 27 erfassten Startseiten-Links sind in `CURRENT-URLS.json` verzeichnet.

## 3. Was gegenüber der Vorlage neu produziert werden muss

- Ein einheitlicher Fahrzeugdatensatz mit Türfunktion, Außenansicht und nutzbarem Innenraum.
- Türöffnung mit tatsächlich anschließender Kamerafahrt; die vier Hero-Bilder allein können keine Perspektivänderung erzeugen.
- Innenraumzustände mit unveränderter Sitzgeometrie und Beleuchtung.
- Lokale Politurwirkung mit Waschkratzern und spiegelnder Oberfläche.
- Keramikdarstellung als Applikation, Auspolieren und anschließender Wasservergleich. Keine physisch sichtbare dicke Schutzhaut.
- Konsistente Kameras und ein gleichbleibender Raum zwischen allen Renderzuständen.

## 4. Grenzen der Prüfung

Der originale Projekteditor wurde nicht geöffnet, kein Templatekonto angelegt und kein Formular abgesendet. Aussagen zu unsichtbaren Backends, mobilem Laufzeitverhalten, vollständiger Kalenderanbindung oder universellen Leistungswerten lassen sich daraus nicht ableiten. Die Umsetzung ist an eigenen Desktop-, Tablet- und Mobiltests zu messen.

Die kompletten Originaltexte, Originalbilder und Framer-Bundles werden nicht als eigenes Template weitergegeben. Die beschriebenen Komponenten sollen eigenständig implementiert werden.
