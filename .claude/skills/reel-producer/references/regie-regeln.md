# Regie-Regeln (der Geschmack des Nutzers – die „25 %“)

Prinzip aus der Referenz (miftahul_islam_efaz): Der Skill ist der Regisseur. Jede Rueckmeldung des Nutzers wird **sofort**
hier als Regel eingetragen (mit Datum) und gilt ab dann fuer jedes Video. Vor jedem Regie-Durchgang diese Liste pruefen.

## Musik und Ton
1. **Nie ohne Musik.** Ohne Sprache traegt Musik das Video; bei Sprache leise darunter (Ducking). (20.10.2026)
   **Ausnahme ASMR:** Hat der Nutzer mit Mikro aufgenommen und sagt „keine Musik“, traegt der Originalton das Video –
   nur dezente Sounds auf Einblendungen, Clip-Ton ohne Knackser (Ein-/Ausblenden), Pegel je Clip angleichen. (20.10.2026)
   Klarstellung Nutzer: **Soundeffekte ausdruecklich erwuenscht** (Uebergaenge, Einblendungen, Akzente) – nur keine durchgehende Musik. (20.10.2026)
   **Ausnahme Nutzer-Musik:** Sagt der Nutzer „Musik lege ich selbst an“ → `"lautheit": false` (nur Effekt-Spur, Spitzen −6 dB,
   zusaetzlich Fassung ohne Ton). In Anzeigen nur lizenzierte Musik (Meta Sound Collection), nie Instagram-Bibliothek. (21.10.2026)
2. **Musik cool: Phonk, Trap, Rap, Cloud** – Stil der Playlist „526“, keine Bibliotheks-Pop-Musik. (20.10.2026)
3. Jeder Uebergang und jede Einblendung bekommt einen passenden Sound; Whooshes nie lauter als vol 0.3. (20.10.2026)
4. Lautheit −14 LUFS, render.sh muss „Ton-Check ok“ melden. (20.10.2026)

## Bild und Text
5. Untertitel immer, fehlerfrei; Zahlen bleiben beim Wort („Tag 1“). (20.10.2026)
6. Kein Text darf angeschnitten sein – bei breiten Schriften (Clash Display) Groesse reduzieren. (20.10.2026)
7. Text hinter dem Auto muss lesbar bleiben: nur die Unterkante verschwindet hinter dem Objekt. (20.10.2026)
8. Effekte, 3D und Sticker nur, wo sie eine Aussage verstaerken – hochwertig, modern, nie billig. (20.10.2026)
9. Kennzeichen von Kundenautos unkenntlich oder nicht im Bild. (20.10.2026)

## Schnitt und Dramaturgie
10. Hook in 0–2 s, visuelle Reels 10–15 s, Sprecher-/Story-Reels 30–45 s. (20.10.2026)
11. Montagen im Beat schneiden; Uebergaenge (Glitch/Whip/Zoom) nur an Kapitelwechseln. (20.10.2026)
12. **Ende einen Beat laenger halten** (`"ende_halten": true`); Ende moeglichst als Loop zum Anfang. (20.10.2026)
12a. **Nur sehr gute Ausschnitte:** man sieht genau, was gemacht wird; nie Kamera aufbauen/verstellen, Gesicht, leere Wand.
    POV mit zu viel Wand auf Haende/Auto zuschneiden (`ausschnitte.sh`), schiefe/kopfueber Clips drehen. (20.10.2026)

## Angebot und CTA
13. Ein CTA pro Video: organisch Kommentar-Stichwort, in Anzeigen WhatsApp-Button. (20.10.2026)
14. Preise = Website (`brand/MARKE.md`), als Endpreis – Kleinunternehmer, nie „inkl. MwSt.“. (20.10.2026)

## Arbeitsweise
15. Wenig Credits: Kontaktbogen statt Einzelbilder, hoechstens zwei Regie-Runden, Wissen aus `references/` statt neuer Recherche. (20.10.2026)
16. Ehrlich bleiben: nichts als erledigt melden, was nicht gemessen/gesehen wurde; was ich nicht hoeren kann, bewertet der Nutzer. (20.10.2026)
