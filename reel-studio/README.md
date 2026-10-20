# Carcura Reel-Studio

Code-basierte Schnitt-Pipeline für Instagram-Reels/TikTok/Shorts (1080×1920).
Rohvideos rein → fertiges Reel mit Untertiteln, Hook, Animationen, 3D-Elementen, Sounds,
Farblook und normierter Lautheit raus. Zusätzlich eine SRT-Datei zum Feinschliff in
DaVinci Resolve oder CapCut.

## Warum nicht DaVinci/CapCut direkt?

DaVinci Resolve und CapCut sind Desktop-Programme mit grafischer Oberfläche. CapCut hat keine
offizielle Schnittstelle, die Skript-Steuerung von Resolve setzt das laufende Programm voraus.
Beides lässt sich in einer Cloud-Umgebung nicht zuverlässig fernsteuern. Deshalb läuft der Schnitt
hier über **Remotion** (Videos als React-Code, inkl. Three.js für 3D) + **ffmpeg** + **Whisper**.
Ergebnis: reproduzierbar, als Vorlage wiederverwendbar, jede Änderung ist eine Zeile in `edit.json`.
Wer danach noch manuell nachschneiden will, importiert MP4 + SRT in Resolve/CapCut.

| Baustein | Aufgabe |
|---|---|
| `pipeline/analyze.py` | Transkript wortgenau (faster-whisper large-v3-turbo), Fachbegriff-Korrektur, Pausen und Füllwörter raus (Jump-Cuts), Szenenschnitte, Lautheit, Kontaktbogen |
| `pipeline/glossar.json` | Fachbegriffe und bekannte Hörfehler (z. B. „Keramikversicherung“ → „Keramikversiegelung“) |
| `projekte/<name>/edit.json` | Das Drehbuch des Schnitts: Look, Zooms, Grafiken, 3D, Sounds, CTA |
| `remotion/` | Rendering: Untertitel mit Wort-Highlight, Hook, Preis-Durchstreichung, Checkliste, CTA-Karte, 3D-Rabattmünze, 3D-Schnee |
| `pipeline/render.sh` | Rendern → Lautheit ≈ −14 LUFS, Spitzen ≤ −1,5 dBTP (Zwei-Pass) → `export/<name>_final.mp4` + `.srt` |

## Ablauf pro Reel

```bash
./setup.sh                                        # einmalig
# 1. Rohclips nach projekte/<name>/raw/ legen (Dateinamen in Reihenfolge: 01_hook.mp4, 02_...)
python3 -I pipeline/analyze.py projekte/<name>    # 2. Analyse + automatischer Rohschnitt
#    (--no-cut, wenn das Material schon geschnitten ist)
# 3. Claude liest analysis/transcript.txt + Kontaktbögen und schreibt projekte/<name>/edit.json
./pipeline/render.sh projekte/<name>              # 4. Rendern
./pipeline/render.sh projekte/<name> --still 7.5  #    Einzelbild bei 7,5 s zur Kontrolle
cd remotion && npx remotion studio                # optional: Live-Vorschau im Browser (lokal)
```

Rendern ohne Grafikkarte: ca. 1–2 Minuten pro Sekunde Video bei 3D-Elementen auf 4 Kernen.

## Dreh-Anleitung für Rohmaterial (entscheidet 70 % der Qualität)

- **Hochkant, 1080p oder 4K, 30 fps**, Licht von vorne, Mikrofon am Körper (Lavalier).
- **Keine eingebrannten Texte/Untertitel** aus CapCut/Instagram – die setzt die Pipeline.
- **Hook dreimal in Varianten** aufnehmen (Text siehe Playbook) – das beste wird genommen.
- **B-Roll mitliefern** (je 3–5 s, ruhig gefilmt): Wasser perlt ab (Zeitlupe), Glanz-Lichtkante über
  den Lack, Vorher/Nachher an derselben Stelle, Auftragen der Keramik, Detail-Makros, Schlüsselübergabe.
- Pro Satz kurz absetzen; Versprecher einfach wiederholen – Pausen und Füllwörter schneidet die Pipeline raus.

## Reel-Playbook (Kundensicht)

Der Zuschauer entscheidet in 1–2 Sekunden. Jedes Reel muss diese Fragen in dieser Reihenfolge beantworten:

1. **Was springt mich an?** Hook in den ersten 2 s: Bild + Text + Stimme sagen dasselbe Versprechen.
2. **Warum glaube ich das?** Grund für das Angebot nennen („Wir testen ein neues Produkt“), sonst denkt jeder „Wo ist der Haken?“.
3. **Was habe ich davon?** Nutzen zeigen, nicht nur sagen (B-Roll: Abperleffekt, Glanz, Vorher/Nachher).
4. **Was kostet es und was genau bekomme ich?** Preis, Umfang, Bedingung klar.
5. **Was soll ich jetzt tun?** **Ein** CTA, identisch in Video, Beschreibung und Kommentar
   (z. B. „Schreib uns KERAMIK per DM“). Mehrere Wege („anrufen, Website, DM“) senken die Abschlussquote.
6. **Warum jetzt?** Nur echte Knappheit/Frist nennen (z. B. „1 Platz“, „bis 15.11.“).

Technik-Regeln:
- Alle 2–3 s ein visueller Wechsel (Schnitt, Zoom, Grafik) gegen Wegwischen.
- Untertitel immer (viele schauen ohne Ton), max. 3 Wörter, aktives Wort hervorgehoben.
- **Sichere Zone:** wichtige Texte nicht in die oberen ~14 % und unteren ~35 % – dort liegen bei
  Reels-Anzeigen die Instagram-Bedienelemente (Meta-Richtlinie für Reels-Ads; organisch etwas weniger).
  Die Pipeline setzt Untertitel auf 61,5 % Höhe.
- Lautheit ≈ −14 LUFS, Spitzen max. −1,5 dBTP (macht `render.sh` automatisch; Demo: −14,5 LUFS).
- 3D/Effekte nur, wo sie eine Aussage verstärken (Rabatt, Winter, Glanz) – nie als Selbstzweck.

## Rechtliches (Deutschland) – vor Veröffentlichung prüfen

- **Statt-Preise** („600–700 € → 300–350 €“): Der Referenzpreis muss der tatsächlich zuvor
  regulär verlangte Preis sein, sonst Irreführung nach § 5 UWG (Abmahnrisiko). Preisliste/Rechnungen als Beleg aufbewahren.
- **Musik:** Unternehmenskonten dürfen in Reels nur kommerziell lizenzierte Musik nutzen
  (Meta Sound Collection bzw. die für Business-Konten freigegebene Auswahl). Die Pipeline nutzt nur selbst erzeugte Sounds.
- **Personen im Video:** Für Mitarbeiter schriftliche Einwilligung zur Nutzung in Werbung einholen (§ 22 KUG, Schriftform empfohlen).
- **Impressum** muss vom Instagram-Profil aus erreichbar sein (geschäftliches Profil).
- **Remotion-Lizenz:** kostenlos für Einzelpersonen und Unternehmen mit bis zu 3 Mitarbeitern,
  darüber ist eine Firmenlizenz nötig. Schriften Anton/Montserrat: SIL Open Font License (frei nutzbar).

Bei Unsicherheit zu Preiswerbung: kurze Prüfung durch einen Anwalt für Wettbewerbsrecht.
