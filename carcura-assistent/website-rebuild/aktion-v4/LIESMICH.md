# Aktion „Keramik buchen. Waschset geschenkt.“, Version 4 (19.11.2026)

Interaktive Produktinszenierung: Wascheimer mit Deckel, Klick öffnet, fünf Produkte kommen aus der Eimeröffnung, Info je Produkt.
Stand: **live auf carcura.info (Startseite, Template-Teil 28), 19.11.2026.** Das bisherige Banner ist nur ausgeblendet (`#aktion-alt`, `display:none`), nicht gelöscht.
Sicherung der Startseite davor: `sicherung-startseite-vor-einbau.html`.

## Dateien
| Datei | Zweck |
|---|---|
| `index.html` | Vorschau, ganze Seite, three.js über Netz (nur zum Ansehen) |
| `wp-block.html` | Einbau-Block für Kubio: Stil, Markup, Skript, alles unter `.cxa` gekapselt. Erzeugt mit `build.py` |
| Mediathek `cxa-aktion.js` (ID 1797) | Das Skript liegt als Datei in der Mediathek, weil WordPress `&&` im Inline-Skript zu `&#038;&#038;` verfälscht und das Skript bricht. Im Block steht nur `<script src=…cxa-aktion.js?v=1 defer>`. Bei Änderung neu hochladen und `?v=` hochzählen. Im Block bleibt ein inaktiver Rest (`type="text/plain" id="cxa-inaktiv"`), der beim Rückbau mit entfernt wird |
| Mediathek `three-r128.min_.js` (ID 1794) | three.js r128 von der eigenen Domain |

## Technik
- three.js r128 (WebGL). Wird erst geladen, wenn die Sektion sichtbar wird (`CXA_THREE_SRC` oben im Skript).
- three.js kommt von der eigenen Domain (kein Fremd-Netz, DSGVO).
- Schrift: Systemschrift (eigene Schriftdateien lassen sich auf der Website nicht hochladen).
- Zustand: ein reversibler Fortschrittswert `p` (0 = zu, 1 = offen). Öffnen dauert 2,2 s, Schließen 1,6 s. Schnelle Klicks drehen die Bewegung an jeder Stelle sauber um.
- Produktbahnen: kubische Kurve, senkrecht aus dem Eimer, im Bogen zum Platz, senkrecht gelandet, gestaffelt 0,14 s.
- Zeiten, Plätze, Texte und Produkte stehen zentral oben im Skript (`CFG`, `DATA`).
- Countdown rechnet aus `data-ende` (`2027-01-01T00:00:00`). Nach dem Enddatum blendet sich die Sektion selbst aus.
- WhatsApp-Links und `data-wa-service` sind aus dem bisherigen Banner übernommen (Tracking bleibt erhalten).

## Bedienung
Eimer klicken oder per Tab + Enter, danach über ein Produkt fahren, antippen oder in der Reihe „Das steckt im Set“ wählen. Esc schließt zuerst die Info, dann den Eimer. „Eimer schließen“ oben rechts. Ohne WebGL oder bei reduzierter Bewegung gibt es eine funktionsgleiche ruhige Darstellung (reduzierte Bewegung: sofort offen).

## Platzhalter (bitte ersetzen, sobald verfügbar)
- **Produktformen und Etiketten sind vereinfacht und tragen kein Markenlogo.** Für die echten Nanolex-Produkte werden Fotos oder Modelle gebraucht.
- Texte: Eimer (Schmutzsieb, Deckel, Set) und Scrubpad nach dem Nanolex-Shop (shop.nanolex.de), Shampoo nach nanolexcarcare.com, jeweils sinngemäß mit Quelle. Scheiben- und Reifenreiniger, Quick Detailer und Scrubpad sind aus allgemeinen Herstellerangaben zusammengefasst, **das genaue Produkt je Teil ist noch zu bestätigen.**
- Kein Wert des Sets genannt (Beleg fehlt).

## Nach dem 31.12.2026
Sektion blendet sich selbst aus. Block (`<div id="aktion">` samt Skript) am 02.01.2027 aus der Startseite entfernen, altes Banner `#aktion-alt` ebenfalls und Google-Ads-Texte zurücksetzen.
