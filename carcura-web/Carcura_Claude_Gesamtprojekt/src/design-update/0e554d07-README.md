# Carcura Design-Update

Dieses Paket baut auf dem fertigen Claude-Projekt auf. Benötigt wird dessen vollständiger dist-Ordner, insbesondere dist/leistungen/index.html und die bestehenden Filmdateien. Die gelieferte einzelne index.html verweist darauf, enthält sie aber nicht.

```bash
python3 apply-finish.py /pfad/zum/carcura-projekt/dist
```

Danach dist lokal starten. Für eine dauerhafte Übernahme in Claudes Quellcode die Änderungen in die Startseiten- und Leistungstemplates übertragen und die beiden CSS- und JS-Dateien in den Build aufnehmen. Ein erneuter Build kann sonst die direkt geänderten HTML-Dateien überschreiben.

## Änderungen

- Der Porsche-Film steht direkt im Einstieg. Überschrift, Preise und WhatsApp bleiben ohne Abspielen erreichbar. Beschriftete Kapitelwahl und Film-Steuerung gehören zum Einstieg.
- Kontinuierliche Wischbewegungen verbinden übereinstimmende Kameraeinstellungen. Bei einer anderen Perspektive gibt es einen sauberen Schnitt. Basis sind weiterhin die vorhandenen Einzelbilder. Türschwenk, Wasserstrahl und echte Kamerafahrt benötigen zusätzliche zusammenhängende Filmaufnahmen oder Renderings.
- Abgedunkeltes Glas für Navigation und Bedienelemente, feinere Konturen sowie weich verlaufende Hintergrundlichter im Preisbereich.
- Bilder und leere Foto-Container aus dem Hauptinhalt der Leistungsübersicht entfernen. Das Logo und Bilder auf anderen Seiten bleiben erhalten. Im tatsächlichen Leistungstemplate zusätzlich CSS-Hintergrundbilder und zurückgebliebene Bildunterschriften prüfen.
- Prüfe bei 360, 390, 768 und 1440 Pixeln, dass Preis- und Anfragebuttons sichtbar sind, die Navigation bedienbar bleibt und Bilder sowie Überschrift korrekt sitzen. Prüfe Desktop, Hochformat-Tablet, Mobilansicht, reduzierte Bewegung und schnelle Kapitelwechsel.
- Keine Änderungen am Anfrage-Backend. CTA-Ziele, Preise, Texte, Metadaten und restliche Unterseiten stammen aus Claudes Build.
