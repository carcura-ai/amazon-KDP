# Assets und Lizenzen

Jedes fremde Element wird ueber `pipeline/asset.py` geholt und automatisch in `projekte/<name>/assets/LIZENZEN.md` protokolliert.

## Rangfolge der Quellen

1. **Eigenes Material** (rechtlich am saubersten, wirkt am echtesten): Kundenauto, Produkte, Werkzeuge aus den Rohclips freistellen
   `python3 -I pipeline/asset.py freistellen projekte/<n>/raw/clip.mp4 projekte/<n> --t 3.2 --name m2`
   Tipp: Frame mit ruhigem Bild und klarer Kante waehlen; Ergebnis als `sticker` oder `lowerthird`-Icon.
2. **Microsoft Fluent Emoji 3D** (MIT-Lizenz, kommerziell frei, keine Nennung im Video noetig):
   `python3 -I pipeline/asset.py emoji Sponge projekte/<n>`
3. **Selbst gebaute 3D-Elemente** in Remotion/Three.js (`badge3d`, `snow`) – keine Fremdrechte.
4. **Openverse** (durchsucht u. a. Wikimedia Commons und Flickr), gefiltert auf CC0, gemeinfrei und CC BY:
   `python3 -I pipeline/asset.py suche "BMW M2"` → `python3 -I pipeline/asset.py hole <id> projekte/<n>`
   CC BY = Urhebernennung **in der Beschreibung** (Text steht in LIZENZEN.md).

## Nicht verwenden

- CC BY-SA, CC BY-NC, CC BY-ND (Bearbeitung/Freistellung bzw. Werbung problematisch) – das Skript laesst sie nicht zu.
- Google-Bilder, Herstellerpressefotos, Bilder von anderen Instagram-Accounts.
- Fremde Marken-Logos als Werbetraeger oder so, dass eine Partnerschaft vermutet wird (z. B. BMW-Logo gross im eigenen Angebot).
  Das Kundenfahrzeug zu zeigen und das Modell zu nennen ist dagegen unproblematisch.
- WhatsApp-/Instagram-Logos nur gemaess deren Markenrichtlinien; im Zweifel neutrales Emoji ("Mobile phone").

## Personen und Kennzeichen

- Mitarbeiter: schriftliche Einwilligung fuer Werbung (§ 22 KUG); Kunden ebenso, wenn erkennbar.
- Kennzeichen von Kundenfahrzeugen unkenntlich machen (`blur`-Overlay; Segment ohne Zoom), ausser Kunde stimmt zu.
