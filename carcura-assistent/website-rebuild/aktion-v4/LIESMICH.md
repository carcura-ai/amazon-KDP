# Aktion „Keramik buchen. Waschset geschenkt.“, Version 4 (19.11.2026)

Interaktive Produktinszenierung: Wascheimer mit Deckel, Klick öffnet, fünf Produkte kommen aus der Eimeröffnung, Info je Produkt.
Stand: **Entwurf, nicht live auf carcura.info.** Die Live-Seite zeigt weiter das bisherige Banner.

## Dateien
| Datei | Zweck |
|---|---|
| `index.html` | Vorschau, ganze Seite, three.js über Netz (nur zum Ansehen) |
| `wp-block.html` | Einbau-Block für Kubio („Eigener HTML-Code“): Stil, Markup, Skript, alles unter `.cxa` gekapselt |

## Technik
- three.js r128 (WebGL). Wird erst geladen, wenn die Sektion sichtbar wird (`CXA_THREE_SRC` oben im Skript).
- **Vor dem Livegang:** eine eigene Kopie von `three.min.js` (r128) auf dem eigenen Server ablegen und `CXA_THREE_SRC` darauf zeigen lassen. Ein Fremd-Netz überträgt sonst die IP der Besucher (DSGVO). Hochladen über die WordPress-Mediathek ist für .js oft gesperrt, dann per FTP in den Plugin-Ordner.
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
- Texte: Shampoo nach Angaben von Nanolex (sinngemäß, mit Quelle). Scheiben- und Reifenreiniger, Quick Detailer und Scrubpad sind aus allgemeinen Herstellerangaben zusammengefasst, **das genaue Produkt je Teil ist noch zu bestätigen.**
- Kein Wert des Sets genannt (Beleg fehlt).

## Nach dem 31.12.2026
Sektion blendet sich selbst aus. Block am 02.01.2027 aus der Startseite entfernen und Google-Ads-Texte zurücksetzen.
