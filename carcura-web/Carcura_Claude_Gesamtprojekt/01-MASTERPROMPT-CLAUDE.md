# Auftrag: komplette Carcura-Website mit filmischer Detailing-Reise

Du bist für die vollständige Umsetzung verantwortlich: Webentwicklung, Bewegungsdesign, Blender-Szenenaufbau, Medienproduktion und technische Prüfung. Liefere ein ausführbares Ergebnis mit allen Dateien. Die folgenden Anforderungen sind konkret umzusetzen, nicht nur zu beschreiben.

## Ziel und Prioritäten

Baue die gesamte Website von Carcura auf der gestalterischen Grundlage dieser tatsächlich geprüften Referenz:

https://detailingcarstudio.framer.website/

Das gewünschte Erscheinungsbild: dieselbe dichte Verbindung aus realistischen Fahrzeugmotiven, schmalen großen Überschriften, schwebender Glasnavigation, Studiolicht im Hintergrund, hell/dunkel wechselnden Abschnitten und übereinanderschiebenden Leistungskarten. Verwende ausschließlich Carcura-Markenfarben und echte Carcura-Inhalte. Ergänze den Waschablauf um Innenraumreinigung, Politur und Keramik am gleichen Fahrzeug.

Prioritäten in dieser Reihenfolge:

1. Realistische und konsistente Bildsprache, insbesondere im Einstieg.
2. Gestaltung nahe an den dokumentierten Proportionen, Schriftformen und Bewegungen der Referenz.
3. Vollständige Seiten und echte funktionierende Anfragewege.
4. Sehr gute mobile Bedienbarkeit und kontrollierte Ladezeiten.
5. Einfach änderbare Inhalte, Preise und Medien.

Eine vereinfachte 3D-Autoform aus Quadern, ein schwebendes Auto auf schwarzer Leere oder ein austauschbarer Kartenbaukasten erfüllt diesen Auftrag nicht. Verwende das vorhandene detaillierte Modell oder ein qualitativ besseres, rechtmäßig nutzbares Modell. Arbeite eigenständig weiter, bis die Abnahme erfüllt ist. Bereits beauftragte lokale Arbeiten benötigen keine weitere Rückfrage. Kostenpflichtige Käufe sind nicht beauftragt; nutze vorhandene und frei nutzbare Quellen.

## Zuerst lesen und prüfen

Lies alle Dateien im Paket, insbesondere:

- `02-REFERENZ-AUDIT.md`
- `03-RENDER-BRIEF.md`
- `CARCURA-DATA.json`
- `CURRENT-URLS.json`
- `ASSET-MANIFEST.json`
- die öffentlich bezogenen Carcura-Inhalte unter `research/`

Prüfe die Referenz im Browser, sofern möglich: Start, Leistungen, Preise, Über uns, Team, Kontakt und Leistungsdetails. Vergleiche echte Screenshots bei Beginn, Mitte und Ende der Waschsequenz sowie beim Kartenstapel. Wenn kein Browser verfügbar ist, arbeite anhand des Audits und kennzeichne diese Prüflücke. Behaupte keine durchgeführten visuellen Tests ohne tatsächlichen Test.

Prüfe Dateien und Modellhierarchie. `CarConcept.glb` enthält ein Interieur und Türknoten. `Carcura_Studio_Base.blend` ist eine Startszene mit Studiolicht und Keyframes, keine fertige Reinigungsproduktion. Kontrolliere Kamera, Türen und Materialzuordnung, bevor du einen längeren Renderlauf startest. Der beigefügte Vorschaurender ist nur eine technische Vorschau und nicht automatisch der endgültige Startseiten-Hero.

## Marke und Inhalte

Geschäft: Carcura GbR, Fahrzeugaufbereitung in Walterschen im Westerwald. Persönliche Ansprechpartner sind Alexander Fuchs und Richy Schumacher. Nutze das beigelegte Original-Logo. Kontaktdaten, Preise und Öffnungszeiten kommen zentral aus `CARCURA-DATA.json`.

Verbindliche Farben:

```css
:root {
  --cc-bg: #07070a;
  --cc-bg-soft: #0d0d11;
  --cc-panel: #15151a;
  --cc-accent: #e8f320;
  --cc-text: #f2f1ee;
  --cc-muted: #cfd0d4;
  --cc-subtle: #8f9096;
  --cc-warm: #cbbf94;
  --cc-light-surface: #f2f1ee;
  --cc-dark-ink: #07070a;
  --cc-border: rgb(242 241 238 / .14);
}
```

Orange aus der Vorlage wird zu Gelbgrün. Warmes Beige nur als sparsamer Zusatzton, nicht als dominierende neue Markenfarbe. Hellere Abschnitte bekommen das warme Carcura-Weiß und dunkle Schrift. Die dunkle Studioästhetik bleibt der Schwerpunkt.

Schriften lokal ausliefern: Big Shoulders für schmale fette Überschriften, Geist für Fließtext und UI, Geist Mono für technische Labels. Fontlizenzen beilegen. Nutze echte `@font-face`-Definitionen; später auf WOFF2 komprimieren, sofern der Konverter verfügbar ist. Keine Fonts von externen Google-Servern zur Laufzeit laden.

Text auf Deutsch, kurze klare Sätze, für Privatkunden per Du und für Firmenkunden passende Sie-Ansprache. Keine erfundenen Bewertungen, Mitarbeiter, Zertifikate, vier Waschboxen, garantierten Antwortzeiten oder Herstellerzusagen übernehmen. Renderbilder beschreiben keine tatsächlich ausgeführten Kundenarbeiten; in der Galerie nur echte Carcura-Ergebnisse verwenden. Symbolische CGI bei Bedarf als Illustration kennzeichnen.

Verwende die aktuellen Websitepreise, nicht ältere Erinnerungen: Innenreinigung ab 90 €, Handwäsche inkl. Felgen ab 69 €, Basic innen/außen ab 145 €, einstufige Politur ab 349 €, Keramik inkl. einstufiger Politur ab 700 €. Die früher genannten 60 € waren ein Beispiel. Keine Preisänderung daraus ableiten. Preisangaben an einer zentralen Stelle pflegen und überall konsistent formatieren.

Bei Basis-Innenreinigung ab 90 € nicht automatisch Nassreinigung, Fleckenentfernung, Tierhaare oder Ozon versprechen. Details und Aufpreise aus den aktuellen Leistungsinhalten übernehmen. Wenn eine Reinigungsanimation eine optionale Tiefenreinigung zeigt, direkt am zugehörigen Leistungsangebot kennzeichnen.

## Globale Gestaltung

### Navigation

Schwebende, horizontal zentrierte Glaspille, ca. 64 px hoch, 20 px Abstand zum oberen Bildschirmrand, große Rundung. Dunkle transparente Füllung, feine helle Kontur und etwa 20 px Backdrop-Blur. Bei langen deutschen Links die Breite passend erhöhen, ohne die luftige Wirkung zu verlieren. Kein zweiter Header darunter.

Links: Original-Logo; Leistungen, Preise, Galerie, Über uns; bei Bedarf Mehr-Menü für Holservice, Firmenkunden, Partner und Team. Rechts gelbgrüner Button „Termin anfragen“. Alle Seiten aus dem Footer erreichbar. Aktive Seite kennzeichnen. Hover-Textwechsel mit zwei Zeilen in einem geclippten Container, 200–280 ms; zweite Zeile für Screenreader ausblenden.

Mobil kompakte Pille mit Logo, Anfragebutton und Menütaste. Tastaturbedienbares Menü mit Escape, Fokusführung und Rückgabe des Fokus an den Auslöser. Berührflächen mindestens 44 × 44 px. Kein textlich abgeschnittener deutscher Menüpunkt.

### Typografie, Raster und Oberflächen

Desktop-Startwerte: Seitentitel bis ca. 120 px/800, Abschnittstitel bis ca. 72 px/800, Kartentitel 32–56 px. Keine künstliche horizontale Streckung. Zeilenhöhe für große Titel ca. .9–1.0; deutsche Wörter dürfen kontrolliert umbrechen, aber niemals rechts verschwinden.

Fließtext 16–18 px und 1.5–1.65 Zeilenhöhe. Regelmäßig gelesene Labels mindestens 14 px. Ein Inhaltsraster mit maximal etwa 1200 px Breite, bei großen Desktops großzügigen Außenrändern, auf Mobil 20–24 px Seitenabstand. Abschnittsabstände Desktop etwa 100–140 px, Mobil 64–88 px. Das sind Startwerte, am Referenzvergleich fein abstimmen.

Glaskarten: 24–28 px Radius, 1 px halbtransparente helle Kontur, dunkle Füllung 35–55 %, weiche Unschärfe. Foto und Text bekommen eigene Flächen, nicht nur Text auf beliebigem Gradienten. Badges, Mikroetiketten und Trennlinien gezielt einsetzen. Keine dauernd leuchtenden Umrandungen.

### Hintergrundlicht über die gesamte Website

Implementiere eine gemeinsame Komponente `StudioLightBackground` für dunkle Bereiche. Sie erzeugt große weiche Lichtreflexionen wie hinter Studioglas: eine kühle weiße Hauptreflexion, eine zweite schwächere und ein sehr zurückhaltender gelbgrüner Reflex. Langsame Drift, optional minimale Mausparallaxe; große Schwarzanteile erhalten.

Bevorzugt ein einzelner kleiner WebGL-Canvas mit eigenem einfachen Shader oder ein vergleichbar wirkender CSS-Gradientenaufbau. Kein externer Framer-Runtimecode. Nicht pro Karte einen Renderer erzeugen. Auf einfachen Geräten CSS-Fallback mit nahezu gleichem Farbeindruck. Hintergrund darf Lesbarkeit nicht verändern und keine Inhalte blockieren.

Bewegung 15–25 Sekunden pro langsamer Phase, nur sichtbare Bereiche animieren, bei verborgenem Tab pausieren. Bei `prefers-reduced-motion: reduce` statische Reflexionen. Hintergrundoberfläche mit `pointer-events:none` und `aria-hidden=true`. Beim Kartenstapel bleibt sie hinter den Karten an den Viewport gebunden.

## Startseite: zusammenhängende Fahrzeugreise

Das Auto steht in einer dunklen realistischen Studiohalle. Es bleibt dasselbe Fahrzeug mit denselben Proportionen, Felgen, Scheiben und Innenraumdetails. Scrollen steuert den Fortschritt, Zurückscrollen führt reproduzierbar zurück. Text und Preise bleiben echtes HTML.

Nutze zwei Medientypen gezielt: deckungsgleiche Zustandsbilder für lokale Vorher-/Nachher-Übergänge; vorberechnete Blender-Einzelbildsequenzen für Perspektivänderungen, Türöffnungen und Kamerafahrten. Echtzeit-3D ist für diese filmische Erzählung optional, nicht Voraussetzung. Keine aufwendige Flüssigkeitssimulation im Browser erzwingen.

### Reihenfolge und Erzählung

| Abschnitt | Visuelle Handlung | HTML-Text / Angebot |
|---|---|---|
| Einstieg | Verschmutztes Auto in Seiten-/Dreiviertelansicht, Studio geht dezent ins Licht | „Glanz ist Handarbeit.“ / Fahrzeugaufbereitung im Westerwald |
| Außenwäsche | Schmutz → Schaum → abgespült → sauber, sichtbar gerichtete Übergangskante | „Außen sauber. Bis ins Detail.“ / Handwäsche inkl. Felgen ab 69 € |
| Felgen | Kamera kurz an dieselbe Felge, Reiniger und Bremsstaub werden abgespült | Im Umfang der gewählten Handwäsche erklären |
| Innenraum | Fahrertür öffnet sich am Scharnier, Scheibe und Spiegel bewegen sich mit; Kamera fährt ins Fahrzeug | „Wieder gerne einsteigen.“ / Innenreinigung ab 90 € |
| Reinigung innen | Sand, Staub und Krümel verschwinden entlang einer plausiblen Sauger-/Tornadorbewegung, Oberflächen werden matt sauber | Basisumfang klar von optionaler Polster-Tiefenreinigung trennen |
| Politur | Kamera zurück zum Lackdetail; gerichtetes Prüflicht zeigt Swirls; Polierpad fährt über die Fläche, dahinter klarere Reflexion | „Mehr Klarheit. Mehr Tiefenglanz.“ / Politur ab 349 € |
| Keramik | Applikator, kurzes Ablüften und Auspolieren; anschließend nachvollziehbarer Wasservergleich mit Tropfen und Ablauf | „Geschützt. Und leichter sauber.“ / Keramik inkl. Politur ab 700 € |
| Ergebnis | Kamera zurück zur Ganzansicht, Tür zu, ruhige saubere Studioreflexionen | „Dein Auto. Wieder Carcura-sauber.“ / Termin anfragen |

Kein sofortiges Reinspringen in den Innenraum. Keine sichtbare Reinigung des gesamten Innenraums allein durch eine leuchtende Linie ohne plausiblen Arbeitsschritt. Keine Darstellung, dass Politur tiefe Lackschäden oder Keramik Kratzer entfernt.

### Länge und Steuerung

Die originale Außenwäsche umfasst ca. 400vh. Für die erweiterte Reise zunächst insgesamt etwa 900–1200svh auf Desktop ansetzen, danach anhand realer Benutzung kürzen. Mobil etwa 650–850svh als Ausgangspunkt, nicht blind dieselbe Pixelstrecke erzwingen. Wenn das zu zäh wirkt, Filmübergänge kürzen, aber die vier Leistungen vollständig behalten.

Nutze eine gemeinsame Fortschrittsquelle. Für jedes Kapitel gibt es `start`, `end`, Medienzuordnung und Textphase. Keine unabhängigen Scrollhandler, die unterschiedliche Ergebnisse liefern. CSS `position:sticky` und GSAP ScrollTrigger verwenden; nicht gleichzeitig verschachtelte Pin-Systeme auf denselben Container legen. Normales Scrollen erhalten.

Kapitelsteuerung gut sichtbar: Außen, Innen, Politur, Keramik. Klick auf ein Kapitel scrollt an die richtige Position; „Direkt zu Leistungen“ ist immer verfügbar. Texte brauchen kurze Ruhephasen mit weitgehend stabiler Kamera.

Bei Bildmasken: identische Bildabmessungen und `object-fit/object-position`, feste Geometrie und Beleuchtung. Horizontale Clipkante plus schmaler weißer Sprühreflex für die Wäsche. Politurmaske folgt dem Padweg. Innenmaske bleibt auf betroffene Oberflächen begrenzt. Keramik nutzt eine reale Wasser-/Tropfendarstellung statt eines pauschalen Helligkeitsfilters.

### Aufbau unterhalb der Reise

1. Großes Carcura-Statement in hellem Abschnitt, rechts kurzer persönlicher Text.
2. Laufband mit Innenreinigung / Handwäsche / Politur / Keramik / Felgen, abwechselnd Voll- und Outline-Schrift.
3. Asymmetrisches Raster mit vier Leistungswelten vor Studiolicht.
4. Drei echte Carcura-Einstiegsangebote: Basic 145 €, Familienpaket 169 €, Keramik inkl. Politur 700 €, jeweils ab-Preis und genauer Umfang. Keine fiktive „meistgebucht“-Behauptung.
5. Große sticky Leistungskarten: Handwäsche, Innenraum, Politur, Keramik; weitere aktuelle Leistungen verlinken.
6. Echte Vorher-/Nachher-Beispiele aus Carcura-Fotos.
7. Alexander und Richy mit Originalfoto, kurzer Hinweis auf persönliche Betreuung.
8. Produkt-/Partnerabschnitt zu belegten Partnern, keine erfundene Shopbestellfunktion.
9. Hol- und Bringservice mit Anfrageoption.
10. Kompakte dreistufige Anfrage; gleicher Datensatz wie auf der Kontaktseite.
11. Das interaktive Waschspiel aus der Referenz als eigenständiger, nachgeladener Zusatz: Schaum / Spülen / Drehen / Reset. Detailliertes vorhandenes GLB, eigene Implementation. Touch-Scrollen außerhalb aktiver Werkzeugbewegungen erhalten. Auf schwachen Geräten stattdessen ein einfacher Bildvergleich. Keine falsche Gleichsetzung mit dem fotorealistischen Hero.
12. Großer Abschluss mit Logo/Wortmarke, Kontakt, Seitenlinks und Rechtlichem.

## Alle Seiten vollständig umsetzen

### `/leistungen/`

Referenzartiger großer Titel und kurze Erklärung, bildstarke Karten, Kategorien und alle aktuellen Leistungen. Jede Karte führt zur passenden vorhandenen Detailseite oder einem eindeutig benannten Abschnitt. Preise aus zentraler Datei. Keine ungeprüfte Übernahme der acht amerikanischen Referenzleistungen.

### Leistungsdetails

Bestehende URLs erhalten, insbesondere `/auto-innenreinigung/`, `/autopolitur/`, `/keramikversiegelung/`, `/autositz-reinigen-flecken/`, `/tierhaare-auto-entfernen/`, `/geruch-im-auto-entfernen/`, `/scheinwerfer-aufbereiten/`, `/spezialreinigung-auto/`, `/leasingrueckgabe-aufbereitung/`, `/wohnmobil-aufbereitung/`.

Layout: zurück zu Leistungen; großes H1; kurzer Nutzen, Ab-Preis, enthalten/nicht enthalten, Anfragebutton; passende animierte Leistungsszene; breites echtes Foto; Ablauf; realistische Grenzen; Fragen; passende weitere Leistungen; Footer. Innenraum, Politur und Keramik verwenden die jeweiligen hochwertigen Zustands- oder Rendersequenzen erneut, damit die Bildsprache konsistent bleibt.

### `/preise/`

Neue ergänzende Preisübersicht im Referenzstil mit drei hervorgehobenen echten Paketen, anschließend kategorisierten Einzelpreisen und Pflege-Abos. Leistungsumfang und Aufpreise sichtbar. Einheitliche Angaben zu Ab-Preisen und Kleinunternehmerstatus nach aktuellem Inhalt. Keine neue Vertragsbedingung oder Stornoregel erfinden. Bestehende Texte und Bedingungen übernehmen, Konflikte dokumentieren.

### `/ueber-uns/` und `/team/`

Referenzaufbau mit großem Titel, echtem Hallen-/Teamfoto, Geschichte und drei Werten. Nur zwei tatsächliche Gründer. Teamseite im gleichen Stil mit vorhandenen Informationen; wenn Einzelporträts fehlen, gemeinsames Foto sauber einsetzen, keine KI-Gesichter erfinden. Keine offene Stelle behaupten.

### `/galerie/`

Filterbare echte Carcura-Arbeiten, Vorher-/Nachher-Schieber, Lightbox mit Tastaturbedienung, vorhandene Videos nur mit gültiger Datei und Poster. Renderbilder nicht als Kundenreferenzen ausgeben. Kein kaputtes Bild in der fertigen Galerie.

### `/hol-und-bringservice/`

Gemeinsames Design, Ablauf und vorhandener Rechner: bis 10 km kostenlos, danach 2 € pro weiterem Kilometer der einfachen Straßenentfernung; Hin- und Rückfahrt sind damit abgegolten. Keine doppelte Multiplikation. Formel `max(0, km - 10) * 2`. Beispiele und Grenzen aus aktuellen Inhalten übernehmen.

### `/firmenkunde/`

Händler, Verkaufsaufbereitung und Fuhrparks; sachlichere Ansprache, echte Halle/Fahrzeugfotos, Ablauf, Anfragefelder zu Fahrzeugzahl und Rhythmus. Keine erfundenen pauschalen Händlerpreise.

### `/partner/`

Belegte Partner aus aktueller Website, z. B. Nanolex und HF Reifenservice. Logo-/Markennutzung nur mit vorhandener Grundlage. Kein Vertrieb eigener Produkte behaupten, wenn nicht angeboten.

### `/anfragen/`

Drei visuell klar getrennte Schritte im Stil der Referenz: 1. Leistungen und Fahrzeug; 2. Wunschtag, ungefähres Zeitfenster und Holservice; 3. Name und ein passender Kontaktkanal, optional Nachricht/Fotos. Leistungen aus Ziel-URLs wie `?service=keramik` korrekt vorauswählen, mehrfache Auswahl ermöglichen, Extras nicht doppelt berechnen.

Das ist eine Terminanfrage, keine automatisch garantierte Buchung. Erfolg erst nach bestätigter serverseitiger Annahme anzeigen. Fehlerzustand behält Eingaben und zeigt Rückfallwege Telefon/WhatsApp. Ohne Backend niemals „Anfrage gesendet“ simulieren. Vorhandene Contact-Form-7-/SMTP-Verbindung bevorzugt kompatibel weiterverwenden; keine unbekannte Formular-ID oder geheime Zugangsdaten erfinden. Backend-Anbindung lokal über klaren Adapter kapseln und mit Testkonfiguration prüfen. Produktiv keine Testnachricht ohne ausdrücklichen Versandauftrag absenden.

### Weitere bestehende Seiten

Alle in `CURRENT-URLS.json` erfassten Orts-/Ratgeber-/Gutschein-/Vertragsseiten übernehmen und mit der bestehenden Sitemap ergänzen. Bisherige Slugs erhalten, bestehende Inhalte serverseitig ausgeben und im neuen globalen Design darstellen. Rechtliche Seiten nicht mit einer langen Animation verzögern. Cookie-/Datenschutzeinstellungen, Kündigungsweg und Abo-Bedingungen zugänglich halten.

## Technische Zielarchitektur

Das bestehende Zielsystem ist WordPress mit Kubio. Liefere ein eigenständiges installierbares WordPress-Theme `carcura-studio`, das vollständige serverseitige HTML-Seiten erzeugt. Ein neuer Komplettentwurf darf in einem eigenständigen Theme liegen; vorhandene Inhalte bleiben in WordPress erhalten. Kein Theme live aktivieren und keine alten Inhalte überschreiben.

Kernaufbau:

```text
carcura-studio/
  style.css                  # gültiger Themeheader
  functions.php              # WordPress hooks, Menüs, Assets, Datenadapter
  header.php
  footer.php
  front-page.php
  page.php                   # bestehende Seiten als sicherer Fallback
  404.php
  templates/                 # Übersicht, Details, Preise, Team, Galerie, Anfrage
  template-parts/            # Navigation, Studio-Licht, Story, Cards, Footer
  inc/                      # Daten, Routing, Anfrageadapter
  assets/css/               # Tokens, Layout, Komponenten, responsive Stile
  assets/js/                # Scrollstory, Reveal, Licht, Menü, Galerie, Formular
  assets/fonts/
  assets/images/
  assets/frames/
  assets/models/
  data/                     # zentrale Inhalte/Preise/Medienzuordnung
  README-INSTALLATION.md
  THIRD-PARTY-NOTICES.md
```

Klare Module, keine React-Pflicht und kein unnötiger Runtime-Baukasten. Nutze PHP für SEO-relevante Inhalte und Vanilla JS mit GSAP für Bewegung. Bei Bedarf Vite nur als lokales Buildwerkzeug, fertige Assets mitliefern. Der Benutzer darf zum Hochladen des Themes nicht erst einen Build auf dem Webserver ausführen müssen.

WordPress-Standards einhalten: `wp_head`, `wp_footer`, `body_class`, Menüs, `wp_enqueue_*`, sicheres Escaping und Nonce-/Servervalidierung für Formulare. Keine API-Schlüssel im Browser. Rank-Math-Metadaten nicht doppelt ausgeben. Keine pauschale globale `overflow:hidden`-Regel als Reparatur für Layoutfehler.

Liefere außerdem eine lokale HTML/CSS/JS-Vorschau derselben Komponenten mit denselben Daten und Medien. Sie muss über einen kleinen lokalen Server ohne WordPress aufrufbar sein. Eine HTML-Datei darf Medien referenzieren; alle großen Dateien gehören in das Paket und nicht als Base64 in das HTML.

## Medienproduktion und Ladeverhalten

Befolge `03-RENDER-BRIEF.md`. Produziere zunächst Kontrollbilder für Außen, Innen, Lack und Wasser. Korrigiere sichtbare Fehler, bevor alle Frames gerendert werden. Renderjobs müssen exit codes und Dateien prüfen; ein gestarteter Blender-Prozess ist kein fertiges Asset.

Erster sichtbarer Herozustand als optimiertes Poster, zügig laden. Weitere Medien kapitelweise und adaptiv nachladen. Nicht alle Frames als vollständige RGBA-Bitmaps gleichzeitig decodieren. Eine einzige decodierte Full-HD-Grafik kann rund 8 MB belegen; verwende eine begrenzte Decode-/LRU-Cachegröße und niedrigere mobile Auflösungen.

Mobile Bildserien und Desktopserien separat ausgeben. Bei fehlenden Frames nicht den Canvas leeren, sondern den letzten gültigen Frame oder das Poster halten. Ein defektes Kapitel darf die restliche Website nicht blockieren. Preis und CTA müssen auch ohne Animation erreichbar bleiben.

Keine Zusage, dass ein 400-Frame-Paket automatisch klein sei. Berechne reale Transfergrößen, komprimiere WebP/AVIF nach Sichtprüfung und dokumentiere den gemessenen Wert. Wähle Frameanzahl und Auflösung anhand sichtbarer Qualität und Gerätelast. Langes Rendern ist erlaubt; falls die Umgebung es technisch verhindert, liefere den tatsächlich lauffähigen Renderauftrag und benenne exakt die fehlenden Assets. Fehlende Animationen nicht als fertig melden.

## Responsive Verhalten und Zugänglichkeit

Orientierung an den Referenzbreakpoints: Desktop ab 1200 px, Tablet 810–1199 px, Mobil bis 809 px. Prüfe zusätzlich mindestens 360, 390, 768, 1024 und 1440 px Breite. Keine abgeschnittenen Titel, Buttons, Preise oder Formularfelder. Auto darf in bewusst komponierten Nahaufnahmen angeschnitten sein, auf Ganzansichten müssen die relevanten Teile sichtbar bleiben.

Mobile Ausschnitte eigenständig gestalten. Inhalt und Buttons nicht mit dem Auto überlagern. Bei niedriger Viewporthöhe sticky Karten in normale Stapel umwandeln, bevor ein Button außerhalb des erreichbaren Bereichs landet. `svh`/`dvh` passend einsetzen, Browserleistenwechsel berücksichtigen.

Bei reduzierter Bewegung statische saubere Bilder und normale inhaltliche Abschnitte. Ein H1 pro Seite, nachvollziehbare Headinghierarchie, Fokus sichtbar, Kontraste gut, Formulare beschriftet. Dekorative Titelduplikate und Canvasflächen für Screenreader ausblenden, inhaltliche Preis- und Leistungsangaben nicht im Bild verstecken.

## Arbeitsfolge und Lieferumfang

1. Dateien und Referenz prüfen, Unterschiede und fehlende Medien konkret in einer Arbeitsdatei festhalten.
2. Markenfarben, Schriften und globale Komponenten anlegen.
3. Blender-Grundszene kontrollieren und hochwertige Zustände/Kamerasequenzen produzieren.
4. Zuerst Außenwäsche und ein Leistungsdetail vollständig implementieren und visuell mit der Referenz vergleichen; danach das gleiche System auf den gesamten Umfang anwenden, ohne dafür eine neue Freigabe abzuwarten.
5. Vollständige Reise, alle Seiten und vorhandenen Inhaltspfade implementieren.
6. Anfrageweg, Galerie, Menü, Preiszuordnung und responsive Zustände funktional prüfen.
7. Alle Tests/Prüflücken dokumentieren und fertige Theme-ZIP sowie lokale Vorschau mit sämtlichen benötigten Assets liefern.

Gib vollständige Dateien statt unvollständiger Snippets oder „Rest analog“. Wenn die Antwort zu lang wird, arbeite direkt in Projektdateien und verpacke den vollständigen Stand. Keine stillschweigend fehlenden Unterseiten. Keine Screenshots als Ersatz für eine ausführbare Website.

## Abnahme: erst danach fertig melden

- Alle Zielseiten und vorhandenen URL-Pfade sind implementiert oder nachvollziehbar zugeordnet, keine Dummy-Links.
- Referenzähnliche Schrift, Proportionen, Navigation, Hell-Dunkel-Rhythmus, Lichtflächen und sticky Karten sind tatsächlich vorhanden.
- Außenwäsche zeigt mindestens die vier konsistenten Zustände und eine gerichtete räumliche Freilegung.
- Tür und Kamerafahrt funktionieren ohne Durchdringen von Geometrie; Innenraumreinigung verwendet dasselbe Fahrzeug.
- Politur macht unter demselben Licht den Unterschied zwischen Swirls und korrigiertem Lack sichtbar.
- Keramik zeigt eine nachvollziehbare Applikation und Wasserreaktion, ohne unzutreffende Wirkversprechen.
- Jede Leistung hat passenden Preis, tatsächlichen Umfang und Anfragebutton.
- Menü, Formularvalidierung, Galerie und Vorauswahl funktionieren; keine simulierte erfolgreiche Übermittlung.
- Alle benötigten Bild-, Modell-, Font- und Frame-Dateien sind vorhanden; kaputte Quellen werden ersetzt oder ehrlich dokumentiert.
- Bei 360/390 px keine horizontale Inhaltsverschiebung und keine unerreichbaren CTAs.
- Reduced-Motion und Fehlerzustände sind benutzbar.
- Kein dauerhaft laufender verdeckter WebGL-Renderer; keine mehrfach gestarteten Animationloops nach Navigation.
- Visuelle Screenshots der tatsächlich gebauten Version und ausgeführte Checks sind dokumentiert. Keine behaupteten Lighthousewerte ohne Messung.
- Installation, Datenänderung, Renderreproduktion und Assetnachweise sind erklärt.

Beginne jetzt mit der tatsächlichen Umsetzung im Arbeitsordner. Ziel ist ein überprüfbares vollständiges Projekt, das Carcura in der beschriebenen Referenzqualität zeigt.
