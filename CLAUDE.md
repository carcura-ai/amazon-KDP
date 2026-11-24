# Arbeitsmodi — immer aktiv

Vier Modi als Skills in `.claude/skills/`: `godmode`, `l99`, `ooda`, `ghost`.
Claude wählt sie bei **jeder** Aufgabe selbst — auch beim Programmieren —
und kombiniert sie, wenn sinnvoll. Der Nutzer kann einen Modus mit `/name` erzwingen.

| Situation | Modi |
|---|---|
| Faktenfrage, Status, kurze Rückfrage | godmode |
| Strategie, Kalkulation, Preis, Recht, Steuer, Geschäftsmodell | l99 in godmode-Form |
| Entscheidung zwischen Optionen, Priorisierung, Krise, Verzettelung | ooda + l99 |
| Kundensichtbarer Text (Website, E-Mail, WhatsApp, Caption, Anzeige, Listing) | ghost, bei Verkaufstexten + l99 |
| Programmieren | godmode in der Kommunikation · l99 bei Architektur, Sicherheit, Review · ooda bei Fehlersuche in Produktion · ghost für UI-Texte · immer `karpathy-guidelines` |
| Rechner, Dashboard, Prototyp, interaktive Übersicht | Artifact (eingebaut) + passender Modus für den Inhalt |
| Design: Animation, Motion Graphic, Produktfilm, Reel-/Anzeigen-Video, Logo-Animation, Scroll-/Hero-Animation, Webdesign mit Bewegung | `motion-design` (vom Nutzer am 18.11.2026 verlangt: bei **jedem** Design anwenden). Video: ganzer 7-Stufen-Ablauf. Website/UI: die Regeln aus `references/style-rules.md` (Formverwandlung statt Überblendung, Subjekt mittig, immer etwas in Bewegung, schnell dann langsam, Wort-für-Wort-Texte, ein Licht, ruhige Tiefe) zusätzlich zu `impeccable`/`premium` |

- **Grundeinstellung ist godmode-Form**: Antwort zuerst, dicht, ehrlich.
- Bei umfangreichen Antworten den gewählten Modus in der ersten Zeile nennen
  (z. B. `Modus: OODA + L99`), bei kurzen nicht.
- **Vor größeren Investitionen oder neuen Geschäftsfeldern:** `business-investment-advisor`
  für die Zahlen, danach `challenge` (Pre-Mortem) auf den gewählten Plan.
- **Neue Fremd-Skills:** erst `skill-security-auditor`, dann vollständig lesen,
  dann dokumentieren in `docs/SICHERHEITSPRUEFUNG-FREMDSKILLS.md`.
- **`caveman` nur auf Zuruf** (`/caveman`), nie automatisch: Er bleibt bis
  „stop caveman" aktiv und verträgt sich nicht mit ghost, l99 und der
  Abschlussstruktur. Solange er läuft, entfällt diese Abschlussstruktur.
- Die Modi ändern nie die Regeln dieses Projekts: keine erfundenen Zahlen,
  harte Tore im KDP-Prozess, KI-Angabepflicht gegenüber KDP, Freigaben beim Menschen.

## Programmierregeln (karpathy-guidelines)

Gilt bei jedem Code, jeder Website-Änderung und jedem Review:

1. **Erst denken:** Annahmen offen nennen. Bei mehreren Deutungen kurz aufzeigen.
   Rückfrage nur, wenn die Antwort das Ergebnis wesentlich ändert – sonst
   Annahme kennzeichnen und weiterarbeiten. Einfacheren Weg ansprechen.
2. **Einfach zuerst:** Nur was verlangt ist. Keine Zusatzfunktionen, keine
   Abstraktion für Einmal-Code, keine Fehlerbehandlung für Unmögliches.
3. **Chirurgisch ändern:** Nur anfassen, was nötig ist; vorhandenen Stil
   übernehmen. Nur selbst verursachte Reste entfernen, fremden toten Code melden
   statt löschen. Jede geänderte Zeile muss auf die Aufgabe zurückgehen.
4. **Zielgeführt:** Prüfbares Erfolgskriterium festlegen (`Schritt → Prüfung`),
   erst melden, wenn geprüft. Live-Änderungen an carcura.info nach dem Schreiben
   immer nachlesen.

Wirkt, wenn Diffs kleiner werden, weniger nachgebessert wird und Rückfragen vor
der Umsetzung kommen statt nach Fehlern.

## Carcura – Auftragsannahme (vom Nutzer festgelegt, 02.11.2026)

Alexander und Richy arbeiten beide noch Vollzeit; Carcura läuft nebenbei und ist
nicht ausgelastet. Deshalb gilt, **bis der Nutzer ausdrücklich meldet, dass die
Kapazität voll ist:** Jeder Auftrag ist wichtig, auch wenn der Stundensatz unter
dem Ziel (60 €/h) liegt. Nicht von Aufträgen abraten, nur weil sie die eigene
Zeit nicht voll bezahlen. Bewertet wird nach Deckungsbeitrag (Umsatz minus
Sprit und Material, Beitrag zu 1.040 € Fixkosten/Monat). Weiterhin offen
nennen: Untergrenze knapp über den direkten Kosten, besserer Auftrag am selben
Termin hat Vorrang, Billigpreise zeitlich begrenzen, Anzahlung bei großen Aufträgen.

## Carcura – Werbeanzeigen (Meta, Google) (vom Nutzer festgelegt, 24.11.2026)

- **Standort immer: 35 km Umkreis um die Halle in Walterschen** (50.685111, 7.561778),
  Einstellung „Personen, die dort wohnen“, automatische Standorterweiterung aus.
  Nie ganz Deutschland oder ein ganzes Bundesland. Grund: Kunden kamen schon
  aus Siegburg, Olpe und Düsseldorf.
- Im 35-km-Radius liegen Altenkirchen, Siegburg, Bonn und Neuwied. Siegen (39 km), Olpe (43 km),
  Köln (51 km) und Düsseldorf (82 km) liegen außerhalb. Einzelne Orte nur auf
  ausdrücklichen Wunsch als Zusatz-Standort aufnehmen.
- Nachrichten-Anzeigen: Button „Nachricht senden“ oder „WhatsApp-Nachricht
  senden“, nie „Jetzt buchen“. Begrüßung mit Antippfragen hinterlegen.
- Platzierungen: Feeds und Instagram Stories; Facebook Reels und Marketplace
  nur nach Test, da dort viele Fehlklicks entstehen.
- Budget erhöhen nur nach Freigabe des Nutzers.
- Ablauf und weitere Regeln: Skill `meta-werbung` (`/meta-werbung` oder „Werbung: …“).
  Ziel nur Instant-Formular oder Chat, nie Profilbesuche, Interaktionen oder Videoaufrufe.

## Erinnerungen (vom Nutzer festgelegt, 24.11.2026)

- **Jede Erinnerung ohne Rückfrage eintragen.** Der Nutzer hat das dauerhaft erlaubt.
- Ziel ist immer der **Apple Kalender** auf dem iPhone des Nutzers (TimeTree nicht, auf Wunsch des Nutzers):
  1. Termin in den Abo-Kalender „Carcura Erinnerungen“ eintragen. Ablauf: `carcura-web/kalender/LIESMICH.md`.
  2. Muss Claude selbst etwas tun (z. B. Anzeige pausieren), außerdem `send_later` in dieser Sitzung.
  3. Für Erinnerungen am selben Tag zusätzlich PushNotification, weil Abo-Kalender verzögert laden.
- Titel beginnt mit „Carcura:“, Text sagt in einem Satz, was zu tun ist.
- **Nur ein Tag, keine Uhrzeit genannt:** Eintrag immer **18:00–19:00 Uhr** (eine Stunde), damit er beim Durchsehen auffällt.
- **Private Erledigungen** gehören in den eigenen Kalender „Privat“ (blau, `termine-privat.json`),
  nie ins Auftragsbuch. Neutral formulieren, keine Diagnosen, Beträge oder Zugangsdaten.
- **Kundenaufträge** („Freitag 10 Uhr Golf Innenreinigung“): ohne Rückfrage in den Abo-Kalender
  (ohne Namen, Telefon, Kennzeichen; Hinweis 60 Min. vorher) **und** ins Auftragsbuch
  `carcura-web/auftraege/AUFTRAEGE.md`. Fehlt etwas (Preis, Dauer), sinnvoll annehmen und kennzeichnen.
  Bei Fragen zu Auslastung, Umsatz oder „was steht an“ zuerst das Auftragsbuch lesen.
