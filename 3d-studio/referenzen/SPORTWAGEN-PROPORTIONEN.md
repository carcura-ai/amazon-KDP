# Sportwagen-Proportionen (Messung 07.11.2026)

Referenzfotos nur lokal angesehen, **nicht im Repo** (fremde Urheberrechte). Quellen (Wikimedia Commons):
- „Green huracan (20744807015).jpg“ – Lamborghini Huracán, Seitenansicht, CC BY-SA 2.0 → Hauptmessung
- „2017 Lamborghini Huracán LP 610-4 Coupe (30568496017).jpg“ – 3/4 vorn, CC BY 2.0
- „Audi R8 V10 Plus (side).jpg“, „Audi R8 (side 01).jpg“ – CC BY-SA 4.0
- „FIA Porsche Supercup Austria 2021 Nr. 911 Fassbender (side).jpg“ – CC BY-SA 4.0

**Grundsatz:** Proportionen und Formensprache der Klasse „Mittelmotor-Supersportwagen“ übernehmen, **kein** bestimmtes
Modell nachbauen, keine Logos/Markenzeichen (Design- und Markenschutz, Irreführung über Herkunft).

## Messwerte (Seitenansicht, 208 px/m, Achsen auf Radstand skaliert)

| Merkmal | Wert | im Modell |
|---|---|---|
| Länge / Höhe | 4,46 m / 1,15 m | 4,35 m / 1,15 m |
| Radstand | 2,62–2,68 m | 2,62 m |
| Überhang vorn / hinten | 1,0 m / 0,76 m | 1,0 m / 0,73 m |
| Raddurchmesser | 0,66 m (≈ 57 % der Höhe) | 0,67 m, 20-Zoll-Felge |
| Nasenspitze oben | 0,39–0,42 m | 0,42 m |
| Haube über Vorderachse / Kotflügel | 0,64–0,66 / 0,75 m | 0,655 / 0,75 m |
| Fuß A-Säule | ~1,35 m hinter der Nase, 0,83 m hoch | x = 0,94, 0,835 m |
| Dachspitze | ~2,5 m hinter der Nase, 1,15 m | x = −0,135, 1,15 m |
| Heckdeck / Heckoberkante | 0,88 / 0,83 m | 0,875 / 0,78–0,84 m |
| Breite max. (Achsen) / Taille (Türen) | 1,93 / ~1,80 m | 1,93 / 1,80 m |

## Prüfverfahren

`modelle/sportwagen_abgleich.py` rendert eine orthografische Seitenansicht (200 px/m); der Umriss wird per ffmpeg
(edgedetect) rot über das gespiegelte, gleich skalierte Referenzfoto gelegt (Achsen deckungsgleich). Abweichung
> 3 cm an Dach, Haube, Nase oder Heck = nachbessern.
