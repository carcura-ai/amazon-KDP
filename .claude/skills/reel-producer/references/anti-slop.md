# Anti-Slop-Regelwerk – damit ein Edit nicht nach KI aussieht

Quelle: XDA Developers, „How I humanized Claude's video editing skills…“ (Oktober 2026), Regelwerk aus dem
Plugin „A-Roll Studio“ (Screenshots im Artikel). Für Carcura übersetzt und angepasst. Geprüft wird automatisch
mit `pipeline/qc.py` (läuft in `render.sh`).

**Grundsatz:** Claude nimmt den kürzesten Weg zum Ziel – und der kürzeste Weg ist der Durchschnitt, also
genau das, was nach KI aussieht. Deshalb: Abkürzungen sperren, Optionen zeigen, Budget einhalten.

**Test für jedes Element:** Wenn ich es lösche, verliert der Zuschauer dann Bedeutung, Rhythmus oder Gefühl?
Wenn nicht: löschen.

## 1. Was die besten Creator messbar gemeinsam haben
- Stille und Stillstand sind Werkzeuge. Ein gehaltenes Bild ohne Grafik nach einem starken Satz lässt ihn wirken.
  6–12 Frames Schwarz vor einer Enthüllung sind lauter als jeder Riser.
- Layout-Wechsel wirken stärker als Schnitte. Die Untertitel wandern mit dem Layout mit.
- Untertitel auf zwei Ebenen: ruhiger Erzähltext in einer festen Spur, dazu **ein** Betonungsmittel pro Satz.
- Beweis schlägt Stimmung: das echte Ergebnis (Lack im Streiflicht, Messwert, Kundenchat) statt einer Behauptung.
- Ein Objekt, das sich verändert, schlägt neue Folien. Ein wiederkehrendes Element trägt die Identität
  (bei Carcura: das Pad, der Lichtbalken, das Logo am Ende).
- Beschriftungen kommen in dem Moment, in dem das Wort gesagt wird. Erst das Ergebnis zeigen, dann erklären.
  Die letzte Einstellung reimt sich auf die erste.
- Zurückhaltung ist ein Stil. Zwei Schnitte und eine Textzeile können der ganze Edit sein.

## 2. Zurückhaltungs-Budget (`"richtung"` in edit.json)

| | ruhig | ausgewogen (Standard) | energisch |
|---|---|---|---|
| Grafik-Ereignisse pro 10 s (ohne Untertitel) | 1–2 | 2–3 | 3–4 |
| Gleichzeitige Textblöcke (ohne Untertitel) | 1 | 1–2 | 2 |
| Wörter in einem Titel/Label | ≤ 5 | ≤ 7 | ≤ 7 |
| Zooms (Punch-ins) pro Minute | 3–6 | 6–10 | 10–16 |
| Sounds pro 10 s | 0–1 | 1–2 | 2–4 |
| Harte Flashes/Glitches im ganzen Video | 0 | 0–1 | ≤ 3 |
| Animationsstile in einem Edit | 2 | 2–3 | 3 |

Wer das Budget überschreitet, schreibt eine Begründung in das Feld `"note"` des Overlays. `qc.py` meldet alles andere.
**Carcura-Erfahrung:** Das „50 % Keramik“-Reel (ca. 6 Aufträge) lag über dem Budget. Das Budget ist eine
Startregel, kein Gesetz: neue Reels als ausgewogene Fassung bauen, die energische Variante als Test dagegen
und die Ergebnisse in `LERNLOG.md` festhalten.

## 3. Bewegung, die nach Hand aussieht
- **Fast immer Ease-out.** Was hereinkommt, bremst ab (`out-expo`, `out-quint`); was geht, beschleunigt weg (`in-cubic`).
  Linear wirkt maschinell, symmetrisches ease-in-out wirkt wie PowerPoint – außer bei Kamerafahrten.
- **Ausgänge sind kürzer als Eingänge** (≈ 0,35–0,5×). Niemand schaut zu, wie etwas verschwindet.
- **Dauer nach Weg und Masse:** kleine UI-Elemente 0,25–0,45 s, Textblöcke 0,5–0,8 s, Vollbildbewegungen 0,8–1,4 s.
- **Versatz mit Variation:** Wort-/Buchstaben-Versatz 30–60 ms mit ±15 % Zufall. Perfekte Regelmäßigkeit wirkt generiert.
- **Überlappende Aktionen:** Der Text eines Labels landet 100–150 ms nach dem Öffnen der Pille. Eins führt, der Rest folgt.
- **Überschwingen ist Würze:** höchstens ein- bis zweimal pro Video, bei etwas, das Leben verdient.
- **Bewegung folgt der Stimme:** Enthüllung auf der betonten Silbe, nicht am Satzanfang.
- **Halten:** Ist der Text da, steht er still. Dauerndes Wackeln ist das Merkmal Nummer 1. Erlaubt sind 1–3 % Skalierung oder 10–20 px Drift über mehrere Sekunden.
- **Stop-Motion als Gegenmittel:** Grafiken (Sticker, Notizen) mit 12 Bildern pro Sekunde laufen lassen statt butterweich.

## 4. Typografie, die gesetzt aussieht
- Höchstens zwei Schriftfamilien (dazu eine Mono-Schrift für Zahlen und Labels). Kontrast entsteht über die Rolle:
  eine ruhige Grotesk für den Text, ein Gewichtssprung für das eine Wort, auf das es ankommt.
- Ein Off-White wie `#F3EEE6` statt `#FFFFFF`, ein Fast-Schwarz statt `#000000`. Reine Werte wirken aufgeklebt.
- Keine dicken Konturen. Lesbarkeit kommt aus Platzierung, Größe, weichem Schatten oder einem Verlaufs-Scrim.
- Enger Zeilenabstand bei Titeln (0,95–1,05), negative Laufweite bei großen Größen (−0,02 bis −0,035 em),
  positive bei kleinen Labels (+0,06 bis +0,12 em).
- Zeilen nach Sinn umbrechen, nicht nach Breite („Der Lack / war nie sauber“).
- Satzschreibung als Standard. VERSALIEN nur für kurze Kicker.
- Zahlen in Tabellenziffern (`tabular-nums`), deutsche Schreibweise: „1.299 €“, „50 %“ mit schmalem Leerzeichen.

## 5. Bildaufbau
- Das Gesicht respektieren: Text kreuzt nie Augen oder Mund. Freie Flächen nutzen (über dem Kopf, neben der Schulter, Brustband).
- In der titelsicheren Zone der Plattform gestalten (sichere Zone: y 0,15–0,63). Der 3:4-Ausschnitt in der Mitte
  (Raster-Vorschau im Profil) muss den Hook-Text enthalten.
- Bewusst ausrichten: zentriert für einzelne Aussagen, linksbündig mit festem Rand für Listen.
- Ein Blickpunkt pro Moment. Kommt eine Grafik, abdunkeln oder entfernen, was vorher da war.

## 6. Finish, das die Nähte versteckt
- Filmkorn über alles (Video und Grafik), so dass man es spürt, nicht sieht (`look.grain` 0,05–0,1).
  Es verbindet digitale Schrift mit dem Bild und verhindert Banding nach der Plattform-Kompression.
- Leichter Glow auf Lichtern, auch auf weißem Text.
- Vignette dezent (0,12–0,25), etwas über der Mitte.
- **Grafikfarben aus dem Bild nehmen** (Lackfarbe, Hallenwand, Carcura-Akzent), nicht aus einer Standardpalette.
  Warmer Look → warmes Off-White.
- Mit Startwerten variieren (Drift, Korn, Sound): nichts wiederholt sich identisch.

## 7. Nie tun (außer der Nutzer verlangt es ausdrücklich)
- Zoom auf jedem Schnitt mit gleicher Stärke und gleichem Timing.
- Wort-für-Wort-Pop-in-Untertitel in Gelb/Grün mit dicker Kontur und Emoji.
- Zufällige Emoji, Pfeile, Feuer-Icons, „🤯“, Abo-Animationen.
- Glitch, RGB-Split oder Wackeln als Dekoration.
- Stock-Whoosh auf jedem Element, Riser vor jedem Satz, Bass-Drops ohne musikalischen Grund.
- Voll gesättigtes Teal-Orange, abgesoffene Schwärzen, ausgefressene Lichter, Plastikhaut.
- Text in der Plattform-UI oder kürzer sichtbar als die Lesezeit (≈ 0,5 s + 0,25 s pro Wort).
- Mehr als eine Idee gleichzeitig im Bild.
- Typische KI-Design-Standards: Inter überall, kursive Serifen-Akzente, Milchglas-Karten, identisches Easing.
