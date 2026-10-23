# Lernprotokoll: 31 Referenz-Reels (Runde 1, 20.10.2026)

Ausgewertet: 28 Videos (Bild, Ton, Transkript, Schnitttempo, Lautheit) + 3 nur ueber Beschreibung (Einbettung gesperrt).
Fremde Videos liegen nur lokal in `referenzen/runde1/raw/` und werden nicht verwendet oder veroeffentlicht.

## Was jedes Reel zeigt – und was wir uebernehmen

| # | Account · Aufrufe | Gezeigt / gesagt | Uebernommen |
|---|---|---|---|
| 1 | jayantcreates.ai · 145 Tsd. | 7 Schritte „Video mit Claude schneiden“, Editorial-Typo, Kommentar-CTA „EDIT“ (11 Tsd. Kommentare) | Kommentar-Stichwort-CTA; genau unser Arbeitsweg |
| 2 | via.masi · 204 Tsd. | Sound-Schichtung Riser → Gear → Marker → Klick → Papier → Pop, Text „wait for last!“ | gestaffelte Sounds, Neugier-Text |
| 4 | xzecreative · 3 Tsd. | Motion-Design per Claude-Prompt (nur Beschreibung) | – |
| 5 | kienobifilms · 328 Tsd. | Musik nach Wirkung: Spannung, episch (Zeitlupe/Weite), motivierend, **Transformation**, chaotisch, nostalgisch | Musik-Stimmungen in `asset.py musik` |
| 6 | zweiachterblende_ · 19 Tsd. | J-Cut / L-Cut erklaert (Ton vor/nach dem Bild) | Voiceover-Segmente laufen ueber Bildwechsel |
| 7 | qfroost · 117 Tsd. (18,7 % Likes) | Kino-Perspektiven: Treppe, Vogelperspektive, Klon-Effekt, Rahmen durch Architektur | Drehplanung: Perspektiven-Baukasten |
| 9 | ai.withphil · 73 Tsd. | 30 s komplett von Claude gebaut, „jedes Wort auf dem Beat“ (nur Beschreibung) | Schnitt auf Beat (`"schnitt": "beat"`) |
| 10 | render.au.vision · 49 Tsd. | Immobilie: Kino-Balken, Textur-Details, Lifestyle, Frage „Would you live here?“ | Kino-Balken (`letterbox`), Frage-Hook |
| 11 | buyrabass_ · 30 Tsd. | Chat-Blase „Sorry, we found another videographer“ → Auto-Kinoshots, „Send this to your client“ | Chat-Overlay, Teilen-CTA |
| 12 | lemonadsstudio · 3 Tsd. | 65-s-Werbesprecher fuer Ad-Flatrate | Gegenbeispiel: lange Werbung ohne Hook = kaum Reichweite |
| 13 | lukdonttrip · 24 Tsd. (19,5 %) | „Day 32/50“, Motivations-Text auf Schwarz, Kino-Balken | Serienformat mit Zaehler |
| 14 | fonzicaars · 50 Tsd. (**25 %**) | Fiat 124: Kamera 90° gedreht, Gegenlicht, Dunst, langsame Fahrten | gekippte Perspektiven, Gegenlicht |
| 15 | harrisonniap · 75 Tsd. | Sound-Namen zu Aktionen (Klick, Shutter, Riser, Impact), Silhouetten-Uebergang | jeder Sound an eine sichtbare Aktion |
| 16 | fabian.glck · 16 Tsd. | Tier-Liste Schnittprogramme (Claude Code: „fuer Schnitt ueberhypt, Motion gut“) | Tier-Liste als Diskussionsformat |
| 17 | _k.elsie · 114 Tsd. | Maklerin + B-Roll, Nutzen der Lage, „comment Mooresville“ | Dienstleister-Format + Kommentar-CTA (passt 1:1 auf Carcura) |
| 18 | slateacademy_ · 87 Tsd. | 3D-Handy-Mockup, 3D-Kinetik-Typo | spaeter: 3D-Handy mit Carcura-Profil |
| 19 | aaun.ceo · 154 Tsd. | Sounds fuer Immobilien: Tippen, UI, Riser, Fingerschnipsen, Woosh | Sound-Zuordnung fuer Dienstleistungs-Reels |
| 20 | clicksanket · 399 Tsd. | Supra im Feld, Schnitt-Timeline sichtbar, 10 s | kurze Auto-Kinoreels 10–12 s |
| 21 | motionloved · 181 Tsd. | Laptop auf Spiegelflaeche, Motion-Clips | Spiegelflaechen = Premium |
| 22 | kreatively.ke · 222 Tsd. | UI-Kundenweg: Suche → Buchen → „Project Completed ✓“ | Kundenweg als Chat/Buchung zeigen |
| 23 | kimitdom · 14 Tsd. | KI-Video-API (nur Beschreibung) | – |
| 25 | topb0y · 120 Tsd. | „Make your life look like a TV show“, Titelkarte „a recap of AUGUST“ | Serien-Intro „Carcura – Folge X“ |
| 26 | kienobifilms · 332 Tsd. | „Use this transition with this sound“: Zug-Woosh, Glitch zu Riss | Uebergang + passender Sound als Paar |
| 27 | motionthekx · 109 Tsd. | Minimal-Typo, animierter „Folgen“-Button | Folgen-CTA als Animation (geplant) |
| 28 | justdodani · 57 Tsd. | „Car Sandwich“ in DaVinci: Speed-Ramps, Auto zwischen Ebenen, Keyframes auf dem Beat | Speed-Ramp (`"ramp": true`), Text hinter Auto |
| 29 | jacky.editz1 · 142 Tsd. (22,4 %) | Reise-Intro: Kino-Balken, **Text hinter Gebaeude**, schnell | `textbehind` |
| 30 | cal1star · **618 Tsd.** | Collage „moving postcards from SWITZERLAND“, Kommentar-CTA | `collage` |
| 31 | maxcreates.mp4 · 165 Tsd. | Songs nach Vibe: motivierend, Storytelling, hoffnungsvoll, happy, dramatisch | Musik-Stimmungen |

## Die 10 wichtigsten Regeln daraus

1. **Musik immer.** Ohne Sprache traegt Musik das Video; mit Sprache leise darunter (Ducking). Musik nach Wirkung waehlen.
2. **Kurz gewinnt:** visuelle Reels 10–15 s (meiste Aufrufe), Erklaer-/Sprecher-Reels 30–45 s.
3. **Hook = ungewoehnliches Bild + kurzer Text** (Text hinter Objekt, gekippte Kamera, Frage, Chat-Blase).
4. **Schnitt auf den Beat**, Zeitlupe/Speed-Ramp fuer den Hoehepunkt.
5. **Jeder Sound gehoert zu einer Aktion**; Uebergang und Sound als Paar.
6. **Kommentar-Stichwort-CTA** erzeugt um ein Vielfaches mehr Kommentare (Reichweite) und ist gleichzeitig ein Lead.
7. **Serienformate** (Tag X/50, Folge X, Rueckblick) holen Zuschauer zurueck.
8. **Kino-Look:** Kino-Balken, Gegenlicht, Details/Texturen, Spiegelungen.
9. **Lautheit −14 LUFS** – alle 28 Referenzen liegen zwischen −14 und −15,5.
10. **Dienstleister-Muster (Makler):** Person + B-Roll + Nutzen + Kommentar-CTA – direkt auf Carcura uebertragbar.

## Runde 2 (20.10.2026): rabinn.fx – „5 websites pro editors use“ (159 Tsd. Aufrufe)

| Werkzeug im Reel | Erkannt | Umgesetzt |
|---|---|---|
| 500.000 echte Soundeffekte, kostenlos | Freesound | `asset.py sound` (nur CC0), 12 Sounds geladen |
| Kostenlose 3D-Modelle | Modell-Viewer (Name nicht lesbar) | offen (Three.js kann GLB laden) |
| ASCII/Dither-Retro im Browser | nicht lesbar | – (passt nicht zum Carcura-Stil) |
| Echtes Filmkorn Super 8/16 mm | Free Film Grain Overlays | `look.grain` (animiertes Korn) |
| 100 Schriften mit Kombinationen | Fontshare (Satoshi, Clash Display, Cabinet Grotesk …) | `asset.py schrift`, `brand.fontHead/fontBody` |
Format selbst: weisser Editorial-Look, rote Akzente, Kommentar-CTA „TOOLS“.

Nutzer-Playlist „526“ ausgewertet → Musik-DNA (Strassenrap, Phonk, Cloud-Rap) in `sounddesign.md`.

## Runde 3 (20.10.2026): miftahul_islam_efaz – „Skill = Regisseur“ (75 Tsd. Aufrufe, 15 Tsd. Kommentare)

Gesagt: Kein magischer Prompt – ein Regisseur. Seine Regie steckt in einer Skill-Datei (Drehbuch, Storyboard, Animation,
Untertitel, Voiceover, Sounddesign, Endmischung). Sechs Versionen pro Video mit Notizen wie „Uebergang fixen, Whoosh leiser,
Ende einen Beat laenger“. Skill = 75 %, Idee/Geschmack/Notizen des Nutzers = 25 %.
Gezeigt: kinetische Typografie synchron zur Stimme (Serif-kursiv-Akzente + fette Grotesk, rote Schluesselwoerter),
Pixel/Glitch-Uebergaenge, Maskottchen-Figuren, Zaehler, Kommentar-CTA als UI-Karte, Serie „1/3“.
Umgesetzt: Regie-Modus mit 7 Stationen + Regie-Durchgang (SKILL.md), `references/regie-regeln.md` (alle Nutzer-Notizen als Regeln),
Untertitel-Stil `kinetik` (Instrument Serif, OFL), Uebergang `glitch` mit Sound, `ende_halten`. Offen: Maskottchen fuer Carcura.

## Runde 4 (21.10.2026): claudetipsandtricks – „Claude can't generate video. It can still edit yours.“ (Karussell, 6 Folien)

Gezeigt: Schnitt als Code (eine Zeile ändern = ein Shot), HTML-Szenen + Playwright-Bildschleife, Remotion/HyperFrames für Motion
Graphics, Voiceover per TTS über MCP mit Wort-Zeitstempeln, Grobschnitt aus dem Transkript, Selbstkontrolle des Renders,
ffmpeg für H.264 + Ton; Grenzen: echte Aufnahmen für Gesichter/Tiere.
Abgleich: Remotion, ffmpeg, Transkript-Schnitt (Whisper, Füllwörter raus), Wort-Anker, Render-Selbstkontrolle (Kontaktbogen,
Lautheit, Stille) sind bei uns umgesetzt. Offen: KI-Stimme (TTS mit Wort-Zeitstempeln) – nur für Erklär-/Varianten-Videos,
für Vertrauen bleibt die echte Stimme von Alex/Richy erste Wahl.

## Runde 5 (21.10.2026): riverisbuilding – „OpenFilm“ (32,6 Tsd. Aufrufe, 3,1 Tsd. Likes, **484 Kommentare**)

Gesagt/gezeigt: Open-Source-Videoagent (MIT, github.com/openfilm/openfilm, aktiv gepflegt): Agent schreibt den Film als
`film.html` (Szenen = Webseiten mit `frame(t)`), „Studio“ im Browser zum Selbst-Nachbessern (Text/Farbe/Position/Schnitt per Klick),
Export als MP4 und als Timeline fuer DaVinci Resolve/Premiere/Final Cut; KI-Stimme/Musik nur mit eigenen API-Schluesseln.
Einschaetzung: gleiche Idee wie unsere Remotion-Pipeline; echter Mehrwert = **Selbst-Nachbessern + DaVinci-Export** –
lohnt sich erst, wenn Claude lokal auf dem Laptop des Nutzers laeuft (Studio braucht einen Browser auf dem Rechner).
Uebernommen fuers Format: Kommentar-CTA „Was soll ich als Naechstes machen? Top-Kommentar setze ich um“ (1,5 % Kommentarquote)
→ fuer Carcura: „Welches Auto sollen wir als Naechstes zeigen? Top-Kommentar drehen wir“ (ohne Gewinn = kein Gewinnspielrecht noetig);
witziger Folgen-CTA („Early-Investor-Zertifikat“), Notizzettel-Moodboard als Uebergang.
