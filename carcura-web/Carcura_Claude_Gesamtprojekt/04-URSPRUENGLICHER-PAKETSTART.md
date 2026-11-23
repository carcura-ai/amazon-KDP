# Carcura – Umsetzungspaket für Claude

Stand: 23. November 2026. Gewählter Lieferumfang: detaillierter Umsetzungsauftrag, recherchierte Marken- und Inhaltsgrundlagen, heruntergeladene Ausgangsdateien und eine editierbare Blender-Grundszene. Die komplette Website und die fertigen Reinigungssequenzen sind noch zu produzieren.

## So verwendest du das Paket

1. ZIP entpacken und den Ordner in Claude Code öffnen. Für ein Claude-Projekt im Browser die Markdown- und JSON-Dateien hochladen; die großen 3D-Dateien müssen zusätzlich im Arbeitsordner eines ausführbaren Projekts liegen.
2. Folgenden Auftrag senden:

> Lies zuerst `01-MASTERPROMPT-CLAUDE.md`, anschließend `02-REFERENZ-AUDIT.md`, `03-RENDER-BRIEF.md`, `CARCURA-DATA.json`, `CURRENT-URLS.json` und `ASSET-MANIFEST.json`. Setze den Auftrag vollständig um. Nutze die vorhandenen Dateien unter `assets/`. Beginne mit dem Referenzabgleich und der Medienproduktion. Baue danach alle Seiten als installierbares WordPress-Theme und liefere zusätzlich eine lokale HTML-Vorschau. Befolge die Abnahmekriterien; melde fehlende Medien oder fehlgeschlagene Renderjobs konkret. Arbeite bis zum lokal geprüften Ergebnis. Veröffentliche und aktiviere nichts auf der bestehenden Website.

## Enthalten

- `01-MASTERPROMPT-CLAUDE.md`: ausführlicher Auftrag mit Seitenumfang, Designspezifikation, Animationen, Architektur und Abnahme.
- `02-REFERENZ-AUDIT.md`: Beobachtungen aus der tatsächlich aufgerufenen Vorlage, Abstände, Schriftarten, Glasnavigation, vier Bildzustände, Lichtshader und Kartenstapel.
- `03-RENDER-BRIEF.md`: genaue Produktion der Zustände für Wäsche, Politur, Keramik und Innenraum sowie Tür- und Kamerabewegungen.
- `CARCURA-DATA.json`: aktuelle Kontaktdaten, Markenfarben und wichtige Preise aus carcura.info.
- `CURRENT-URLS.json`: 27 auf der aktuellen Startseite verlinkte interne URLs. Das ist eine erfasste URL-Basis, keine Garantie für eine vollständige Sitemap.
- `research/carcura-*.json`: öffentlich gelesene Inhalte von 29 aktuellen Carcura-Seiten einschließlich Leistungsdetails und rechtlichen Seiten; zur inhaltlichen Übernahme und Prüfung.
- `assets/brand/`: aktuelles weißes Carcura-Logo und euer gemeinsames Teamfoto.
- `assets/photos/`: vorhandene, erfolgreich heruntergeladene Aufbereitungsfotos von eurer Website.
- `assets/fonts/`: Big Shoulders, Geist und Geist Mono inklusive Lizenzen.
- `assets/models/CarConcept.glb`: detailliertes Konzeptfahrzeug mit Innenraum und Türhierarchie, etwa 11,8 MB.
- `assets/environment/`: Studio-HDRI für Licht und Reflexionen.
- `assets/blender/Carcura_Studio_Base.blend`: tatsächlich erzeugte Blender-Grundszene mit Modell, Studiolicht, Materialreglern, Kamera- und Tür-Keyframes.
- `tools/build_blender_scene.py`: reproduzierbarer Aufbau dieser Grundszene mit optionalem Vorschaurender.
- `tools/convert_frames.py`: Konvertierung fertiger Renderbilder in responsive WebP-Sequenzen.
- `ASSET-MANIFEST.json`: Herkunft, Status, Größe und Lizenzhinweise der bezogenen Ausgangsdateien.

## Verbindliche Einordnung

Die vorhandene Blender-Datei ist eine technische Startszene. Schaumfluss, Wasserstrahlen, Poliermaschinenkontakt, Wasserperlen und die detaillierten Schmutzmasken für den Innenraum sind darin noch nicht fertig ausgearbeitet. Die Kamera- und Türbewegungen brauchen vor endgültigen Renderläufen eine visuelle Kontrolle.

Das vorhandene Auto ist ein Konzeptfahrzeug, kein Mercedes aus der Referenz. Für exakt dieses Fahrzeug wäre ein passendes lizenziertes Modell nötig. Der gleiche Eindruck lässt sich mit dem beigelegten Auto gestalten, aber die Fahrzeugform wird anders sein.

Die Originalbilder und der proprietäre Framer-Projektcode der Referenz sind nicht als eigene Dateien beigelegt. Der Auftrag beschreibt einen eigenständigen Nachbau der Gestaltung und Abläufe. Ein offizieller kostenloser Framer-Remix ist auf der Vorlagenseite verlinkt; sein Nutzungsumfang richtet sich nach dessen Lizenz.

Die bisher beispielhaft genannten 60 Euro für die Außenwäsche sind nicht der aktuelle Websitepreis: Dort stehen 69 Euro. Der Auftrag verwendet standardmäßig die ermittelten aktuellen Preise. Alle Werte sind in einer Datei änderbar.

## Quellen

- Referenz: https://detailingcarstudio.framer.website/
- Vorlagenseite: https://www.framer.com/marketplace/templates/detailing-car-studio/
- Carcura: https://carcura.info/
- Modell: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
- Umgebung: https://polyhaven.com/a/studio_small_09
- Scrollsteuerung: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

Keine Live-Änderung an carcura.info wurde durchgeführt. Kein Kontaktformular wurde abgesendet.
