# Carcura in Walterschen – Umsetzung in Claude Code

Erstelle die vollständige Carcura-Website und liefere sie als lauffähige HTML-Website. Die Vorgaben hier haben Vorrang vor den früheren Briefings in diesem Ordner.

## Dateien
- referenz/01-Fahrzeugposition.png ist die verbindliche Fotoreferenz für die Blickrichtung und Raumaufteilung.
- referenz/02-Waschzustaende.png und referenz/Carcura_Hallen_Vorschau.html zeigen die aktuelle Paarung von Halle und Porsche, inklusive vier Waschzuständen. Die HTML-Datei enthält zusätzlich die Nahaufnahmen.
- 01-MASTERPROMPT-CLAUDE.md, 02-REFERENZ-AUDIT.md und 03-RENDER-BRIEF.md spezifizieren Seiten, Leistungsdarstellung, Gestaltung und Bewegung.
- CARCURA-DATA.json, CURRENT-URLS.json und research/ geben den dokumentierten Stand der Inhalte an. Keine neuen Preise oder Leistungsversprechen erfinden. Abgelaufene Aktionen ausblenden.
- Die Blender-Basis in assets/ ist ein separates Konzeptfahrzeug. Für die tatsächliche 3D-Porsche-Produktion braucht es ein entsprechend nutzbares Porsche-Modell mit Innenraum. Die gelieferten Porsche-Bilder sind Bildmaterial, kein 3D-Modell.

## Priorität und Abgabe
1. Baue zuerst die komplette, lokal testbare HTML-Fassung unter dist/ mit index.html, CSS, JS und lokalen Medien. Setze die bestehenden Seitenpfade soweit statisch möglich über Unterordner mit index.html um. Übernimm die Website-Texte und Medien aus dem Paket. Verwende das Layout und die Dramaturgie aus dem Briefing in eigener Carcura-Gestaltung. Montiere die Vorschau als Startseiten-Inszenierung, ergänze Leistungsdetails, Preise, Galerie, Team und die weiteren beschriebenen Seiten. Erhalte die bestehende Seitenstruktur. Leite echte Anfragen auf den bestehenden Carcura-Anfrageweg, solange kein bestätigtes Backend vorliegt. Kein Senden von Testanfragen und keine Veröffentlichung.
2. Schließe eine lauffähige Fassung mit allen vorhandenen Bildzuständen ab. Prüfe Startseite, Links, Kapitel, Vorwärts- und Rückwärtsscrollen, Bildladefehler sowie 390 × 844, 768 × 1024 und 1440 × 900 im Browser. Stelle sicher, dass die Beschriftung zur sichtbaren Szene passt. Die Totale zeigt das ganze Auto. Gib den lokalen Startbefehl und die getesteten Funktionen an.
3. Entwickle optional separat die echte Blender-Sequenz, wenn ein nutzbares Porsche-Modell vorhanden ist. Exportiere die getesteten Sequenzen für die HTML-Fassung. Weise offen aus, welche Bewegungen aus Einzelbildern und welche aus 3D-Renderings bestehen. Blockiere die HTML-Abgabe nicht durch fehlende 3D-Medien. Ein WordPress-Theme kann auf Basis der freigegebenen HTML-Fassung folgen.

## Raum, Bewegung und Schnitt
- Kamera steht in der Halle und schaut zum Rolltor. Heck und Flügel liegen hinten links vor dem Tor, die Front zeigt ins Halleninnere und zur Kamera, im Bild nach vorn rechts. Wagenachse parallel zur rechten LED-Wand und senkrecht zum Tor. Die Treppe liegt außerhalb des Bildes. Gleiche die Stellung anhand der Fliesenfugen ab.
- Verriegle die Perspektive für schmutzig, Schaum, abgespült und sauber. Prüfe Radnaben, Radaufstandspunkte, Flügel, Torfuge und LEDs nebeneinander. Skaliere bei einem digitalen Zoom Fahrzeug und Halle gemeinsam. Nutze klare Schnitte zu abweichenden Blickwinkeln, damit keine Doppelkanten am Wagen entstehen.
- Bei echter 3D-Animation bleibt die Halle in Weltkoordinaten fest. Kalibriere mit verfügbaren Maßen und dokumentiere Schätzungen. Einfahrt nur durch geöffnetes Tor, mit Kontakt der Reifen zum Boden und passender Raddrehung. Türen schwenken um die Scharniere, Kamera und Tür brauchen freie Bewegungswege. Fixiere den Wagen während der Aufbereitung.
- Wasser und Schaum folgen der Schwerkraft und den Flächen. Polierpad und Keramikapplikator berühren den Lack. Zeige Wasserperlen erst in der Schutzdemonstration. Prüfe die Reihenfolge und die Ab-Preise anhand der Daten im Paket.
- Lass zwei getrennte Prüfungen durchführen, eine für Maßstab, Ausrichtung und Blickachsen, eine für Animation, Scrollen und responsive Darstellung. Behebe konkret belegte Fehler und prüfe erneut.
