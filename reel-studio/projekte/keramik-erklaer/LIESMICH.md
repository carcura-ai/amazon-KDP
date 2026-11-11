# Reel „Keramik erklärt“ (11.11.2026)

Erklär-Animation im Carcura-Design: 9:16, 1080 × 1920, 30 fps, 26,5 s, ohne Ton.
Video: `ausgabe/keramik-erklaer.mp4` (4,4 MB). Titelbild-Vorschlag: `ausgabe/vorschau.jpg` (Bild bei 2,6 s).

Idee: Vergleich mit der Handyhülle aus einem Reel von @happyvalleydetailing_925. Umsetzung, Texte und Design sind eigen.

## Ablauf

| Zeit | Inhalt |
|---|---|
| 0–3,5 s | Aufhänger: „Dein Handy hat eine Hülle. Und dein Lack?“, Lackschichten bauen sich auf |
| 3,5–6,3 s | Keramik fällt auf die rechte Hälfte: „Eine Schicht mehr. Hauchdünn und glatt.“ |
| 6,3–11,5 s | UV: links wird der Klarlack trüb, rechts deutlich weniger. „Die Keramik bremst das. Ganz aufhalten kann sie es nicht.“ |
| 11,5–16,8 s | Wasser: links flache Pfützen, rechts runde Perlen, die abrollen. „Kontaktwinkel bis 165° laut Hersteller“ |
| 16,8–21,6 s | Schmutz: Wasser spült rechts alles weg, links bleibt viel liegen. „Waschen musst du trotzdem.“ |
| 21,6–26,5 s | Logo, „Keramikversiegelung ab 700 €“, „3 Fotos vom Lack per WhatsApp“ |

Durchgehend steht „Animation, vereinfachte Darstellung“ im Bild (UWG). Herstellerwert nur mit „laut Hersteller“. Der Preis kommt aus `brand/MARKE.md`.

## Beschreibung für Instagram/TikTok

```
Dein Handy steckt in einer Hülle. Dein Lack meistens nicht.

Eine Keramikversiegelung ist eine hauchdünne Schicht auf dem Klarlack. Sie bremst, dass die Sonne den Lack stumpf macht. Wasser perlt ab, statt liegen zu bleiben. Und Dreck geht beim Waschen leichter runter. Waschen musst du trotzdem.

Bei uns ab 700 €, mit Handwäsche, Kneten und Politur. Schick uns 3 Fotos von deinem Lack per WhatsApp, dann sagen wir dir vorher, was es kostet.

📍 Walterschen, Westerwald · Link in der Bio

Kennst du jemanden, der sein Handy besser schützt als sein Auto? Schick ihm das.

#keramikversiegelung #autoaufbereitung #lackpflege #westerwald #altenkirchen
```

WhatsApp-Link für Bio oder Story (Herkunft messbar):
`https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20komme%20vom%20Keramik-Video`

Musik: in der Instagram-App eine lizenzierte, ruhige Spur wählen, nicht im Video einbauen (Rechte).

## Ändern und neu rendern

- Texte, Zeiten und Farben stehen in `animation.html` (Funktion `render(t)`).
- Vorschau im Browser: `animation.html` öffnen (läuft in Schleife) oder `animation.html?t=13.7` für ein Standbild.
- Neu rendern (etwa 1 Minute): `node render.js video /tmp/bilder ausgabe/keramik-erklaer.mp4`
- Prüfbilder: `node render.js standbilder /tmp/standbilder`
