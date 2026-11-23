# Medienproduktion: Carcura Scrollstory

## Ausgangspunkt und tatsächlicher Status

Vorhanden sind ein detailliertes Konzeptauto als GLB, eine Studio-HDRI, echte Carcura-Fotos und eine editierbare Blender-Startszene. Das GLB enthält Außenhaut, Glas, Felgen, Innenraum und separat hierarchisch aufgebaute Türen. Es ist noch kein fertiges schmutziges/sauberes Fahrzeugset.

Die Grundszene erstellt eine dunkle Halle, weiße Inspektionsstreifen, Flächenlichter und einen gelbgrünen Bodenakzent. Ein eigener Lackshader hat die Regler `DIRT` und `FOAM`. Diese sind Ausgangsmaterialien, keine fertige realistische Schaum- oder Schmutzsimulation. Kamerastationen und eine Türbewegung sind angelegt. Das Projekt ist vor einer Serienproduktion visuell zu überarbeiten und zu kontrollieren.

Wiederaufbau aus dem Paketordner:

```bash
blender -b -t 8 --python tools/build_blender_scene.py -- --preview
```

Bei einem Blender-Build mit Denoising-Unterstützung darf OpenImageDenoise eingeschaltet werden. Der bereitgestellte Aufbau deaktiviert Denoising, weil die hier installierte Blender-Version keine entsprechende Unterstützung hatte. Der Shader und die Lichtsetzung sind unabhängig davon editierbar.

## 1. Einheitliche Bildregeln

- Ein Fahrzeug, ein Raum, feste reale Größen, gleichbleibender Lack und gleiche Felgen.
- Für Zustandspaare exakt dieselbe Kamera, Brennweite, Geometrie, Lichtpositionen und Belichtung. Zwischen zwei Zuständen werden nur Schmutz/Wasser/Pflegezustand verändert.
- Tiefenwirkung durch reale Reflexionsquellen und Flächenlichter, Kontakt zum Boden, zurückhaltende Tiefenschärfe und hochwertige Materialdetails.
- Neutralweiße Inspektionslichter bleiben weiß. Carcura-Gelbgrün ist ein Akzent, kein grüner Vollraumfilter.
- Raum und Fahrzeug werden gemeinsam gerendert. Dadurch passen Bodenreflexionen, Schmutzablagerungen und Kontaktschatten zusammen.
- Keine Texte, Preise oder Websitebuttons ins Renderbild einbacken.
- Alle Unterschiede mit einer Differenzansicht prüfen: Fahrzeugkanten dürfen im Zustandspaar nicht springen.
- Finales Ausgangsmaterial vorzugsweise 1920 × 1200 oder 1920 × 1080; mobile Kamera eigenständig im Hochformat komponieren. Kein blindes Ausschneiden des Desktopbilds.

## 2. Außenwäsche: vier deckungsgleiche Zustände

### Schmutzig

Erdiger Straßenfilm im unteren Karosseriedrittel, realistische Spritzrichtung hinter Rädern, feiner Staub auf horizontalen Flächen, Bremsstaub in Felgenvertiefungen. Kein zufälliger brauner Farbverlauf über alle Materialien. Fenster, Gummi und Lack reagieren unterschiedlich.

Schmutz mit Texture-Paint, Decals oder prozeduralen Masken aus Höhe, Oberflächennormalen und Noise aufbauen. Die Maske muss an Bauteilen plausibel sitzen. Verschmutzungsgrad kräftig genug für den Übergang, ohne dass die Fahrzeugform verloren geht.

### Eingeschäumt

Weißlicher dichter Schaum auf oberen Flächen, dünnere Abdeckung an vertikalen Flächen, erkennbare nach unten laufende Strukturen. Kleine Blasen nur in Nahaufnahmen sichtbar. Material mit feinem Bump, passenden Roughnesswerten und sanfter Farbvariation. Kein weiß lackiertes Auto als Schaum ausgeben.

Für die Standbilder reicht eine überzeugend modellierte/texturierte Schaumschicht. Für tatsächliches Herunterlaufen vorberechnete Geometrie-/Partikelsimulation oder bewusst gestaltete animierte Masken in Blender, danach als Frames rendern. Kein Flüssigkeitsbake ohne überprüften Speicher- und Zeitbedarf starten.

### Abgespült / nass

Schaum größtenteils weg, nasse dunklere Flächen, kleine Restspuren in Spalten, Wasserfilm und Tropfen, nachvollziehbar nasser Boden. Kein Sprung der Umgebungsbeleuchtung gegenüber dem vorherigen Bild.

### Sauber / trocken

Sauberer Lack mit realistischer klarer Reflexion, ordentliche Felgen, natürliches Reifendressing, trockenerer Eindruck. Hier erfolgt noch keine übertriebene Lackkorrektur: leichte Waschkratzer dürfen für die spätere Politur unter Prüflicht sichtbar bleiben.

Die Website legt die Zustände über eine seitlich fortschreitende Maske frei. Eine schmale Sprühfahne liegt genau an der Maske. Sprayoverlay muss räumlich zum Fahrzeug passen, darf aber als separate transparente Ebene eingebaut werden.

## 3. Türöffnung und Weg in den Innenraum

Den Hierarchieast der gewählten Tür am vorgesehenen Pivot drehen, nicht jeden Türteil einzeln um dessen Meshmitte. Im Originalmodell heißen relevante Knoten z. B. `BodyDoorLColor1` mit darunterliegenden Fenster-, Spiegel- und Innenverkleidungsteilen. Das Modell wird über eine glTF-Koordinatentransformation importiert; lokale Y-Achse kann einer vertikalen Weltachse entsprechen. Deshalb die Bewegungsrichtung am realen importierten Objekt prüfen.

Die in der Startszene vorbereitete Türanimation ist ein Ausgangspunkt. Kontrolliere mindestens: Anfang geschlossen, halb geöffnet, vollständig geöffnet; Spiegel bleibt an Tür, Fenster folgt, keine Überschneidung mit Kotflügel und Kamera.

Kamerafahrt zunächst als kurze Preview mit einfacher Beleuchtung rendern. Blick von der Außenseite durch die freie Türöffnung, dann Richtung Sitzfläche/Teppich und Mittelkonsole. Nicht durch geschlossene Scheiben, Dach, A-Säule oder Sitzlehne fahren. Nahe Clippingebene etwa 0,02–0,05 m, Brennweite im Innenraum vorsichtig weitwinklig wählen. Keine extreme Fischaugenverzerrung.

## 4. Innenraum: Reinigung mit nachvollziehbarer Ursache

Mindestens diese deckungsgleichen Zustände anlegen:

1. Staub, Krümel und Sand auf Sitz/Teppich; genutzte, aber nicht beschädigte Oberflächen.
2. Gesaugt/Tornador, Oberflächen gereinigt, natürlich matter sauberer Zustand.
3. Optional eigenes Paar für Polster-Tiefenreinigung mit gezieltem Fleck, nur bei entsprechendem Angebot.

Krümel und Haare sind eigene Geometrie-/Instanzgruppen, die entlang eines Werkzeugwegs verschwinden. Ein Sauger liegt plausibel auf dem Material; Schmutz verschwindet nur hinter seinem Kontaktbereich. Tornador- oder Pinselbewegung kann als kurzer Einsatz auf Fugen dargestellt werden. Innenraum wird nicht spiegelglänzend, Leder erhält keine unrealistische nasse Plastikoberfläche.

Die Basissequenz wird mit „Innenreinigung ab 90 €“ verbunden. Eine sichtbare Nasspolsterbehandlung bekommt einen gesonderten Hinweis mit dem richtigen Zusatzpreis. Vorher/Nachher darf keine geänderte Polsterfarbe oder völlig andere Sitze zeigen.

## 5. Politur: sichtbare Korrektur bei identischem Prüflicht

Zwei Bilder einer Lackfläche rendern, am besten Motorhaube oder Tür. Ein langes weißes Inspektionslicht macht den Oberflächenunterschied sichtbar. Ausgangszustand mit feinen kreisenden Swirls und leichter Trübung; Endzustand mit reduzierten Swirls und klarerem Spiegelbild. Deep scratches nicht vollständig verschwinden lassen.

Die Materialveränderung besteht aus passenden Roughness-/Normalmapänderungen. Nur die Helligkeit zu erhöhen genügt nicht. Ein Exzenterpad bewegt sich mit Kontakt an der Oberfläche; Schrägstellung, Padkante und Griff dürfen nicht durch den Lack schneiden. Eine Maske in UV-/Objektkoordinaten folgt dem Pad, sodass die Änderung am Bauteil bleibt.

Optional ein separater transparent gerenderter Polierer vor einem festen Zustandspaar. Bei einer bewegten Kamera muss er jedoch Teil der gleichen 3D-Szene sein, damit Perspektive und Kontakt stimmen. Die Webseite zeigt „Politur ab 349 €“; die Animation soll keine Garantie auf vollständige Kratzerentfernung suggerieren.

## 6. Keramik: Anwendung und Wasserverhalten

Am bereits gereinigten und polierten Lack arbeiten. Applikator bewegt sich in kurzen überlappenden Bahnen über das Bauteil. Ein vorübergehender feiner Film/Flash kann sichtbar sein, danach weiches Auspolieren mit Mikrofasertuch. Keine dicke Glasplatte, keine sichtbare leuchtende Panzerhaut und kein pauschal dauerhafter Regenbogeneffekt.

Für den Wasservergleich dieselbe Kamera und dieselbe Wassermenge verwenden. Auf der Referenzfläche breiterer Film bzw. flachere Tropfen; auf der illustrierten versiegelten Fläche kompaktere Tropfen. Auf geeigneter geneigter Fläche nachvollziehbar ablaufende Tropfen. Unterschiede nicht allein mit einer veränderten Lichtquelle vortäuschen. Das ist eine Illustration, keine exakte physikalische Leistungszusage für jedes Produkt.

Für die Produktion reichen kleine instanzierte Tropfen mit Glas-/Wassermaterial und gezeichneten Ablaufwegen oft aus. In Nahaufnahme Kontaktwinkel und Tropfenbasis plausibel gestalten, nicht lauter schwebende perfekte Kugeln. Wasser IOR ungefähr 1,333; das ist ein Materialstartwert, keine vollständige Fluidsimulation.

Preis: ab 700 € inklusive der auf der aktuellen Website beschriebenen einstufigen Politur. Keramik ersetzt in der Darstellung nicht die Politur.

## 7. Geforderte Ausgabedateien

```text
public/media/
  exterior/desktop/dirty.webp
  exterior/desktop/foam.webp
  exterior/desktop/rinsed.webp
  exterior/desktop/clean.webp
  exterior/mobile/...
  interior/desktop/dirty.webp
  interior/desktop/clean.webp
  interior/mobile/...
  polish/desktop/before.webp
  polish/desktop/after.webp
  polish/mobile/...
  ceramic/desktop/application.webp
  ceramic/desktop/beading.webp
  ceramic/mobile/...
  transitions/door-interior/desktop/frame-0001.webp ...
  transitions/interior-paint/desktop/frame-0001.webp ...
  transitions/finale/desktop/frame-0001.webp ...
  transitions/.../mobile/...
  posters/...
  media-manifest.json
```

Diese Struktur beschreibt zu erzeugende Medien; die Dateien existieren im Ausgangspaket noch nicht. Der implementierte Medienloader darf sie erst nach Dateiprüfung als vorhanden behandeln. Der Masterprompt fordert ihre Herstellung während der Umsetzung.

`media-manifest.json` muss echte Dateipfade, Abmessungen, Framezahlen, Seitenverhältnisse und Bytegrößen enthalten. Nach dem Rendern die tatsächlichen Zahlen eintragen, nicht vorher erfinden.

Websitezitate, Modell- und Fontnachweise separat in `THIRD-PARTY-NOTICES.md`. Das Konzeptauto ist CC BY 4.0 mit gesonderten Markenhinweisen. Sichtbare Fremdlogos nach Prüfung entfernen/ersetzen und die Änderung mit Urhebernachweis dokumentieren. Die beigelegte GLB-Originaldatei enthält noch das originale Materialset.

## 8. Produktionsabnahme

- Vier Zustandsbilder nebeneinander und per Überblendung prüfen: kein Geometriesprung.
- Tür- und Kamerafahrt in geringer Auflösung vollständig abspielen.
- Kontaktpunkte von Werkzeugen an mindestens drei Zeitpunkten kontrollieren.
- Innenraum vor/nachher mit unveränderter Kamera und Beleuchtung vergleichen.
- Politur vor/nachher am selben Prüflicht vergleichen.
- Wasserreaktion in Vorwärts- und Rückwärts-Scrubbing prüfen.
- Erst danach finale Bildgrößen und Sequenzen rendern.
- Fertige WebP-Dateien nicht nur zählen, sondern decodieren und Stichproben visuell prüfen.
- Große Quellbilder nicht als versteckte Mobilfallbacks mitschicken.
- Blender-Projekt und Bakes/Textures so speichern, dass der Render ohne fremde absolute Pfade wiederholbar ist.
