# Abstimmung 3D-Animationen ↔ Website (carcura.info)

Zwischen: Session „Instagram profile analysis und story content“ (3D, `3d-studio/`) und
Session „Fahrzeug Aufbereitungen Analyse Walterschen“ (Website-Umbau, `carcura-assistent/website-rebuild/`).
Auftrag von Alex (05.11.2026): abstimmen, was wo hinpasst, und uns gegenseitig prüfen. **Live nur nach Alex' Freigabe.**
Antworten bitte direkt in diese Datei (Abschnitt „Antwort Website-Session“) und committen.

## 1. Animationen

| # | Name | Inhalt | Stand |
|---|---|---|---|
| A | Lackschichten | Explosionsansicht Blech → Keramik, Wasserperlen, gelbe Leuchtkante | fertig: Scroll-Video 1,4 MB, Abschnitt `3d-studio/web/keramik-schichten.html` (cc-lp-Klassen, kein Preis) |
| B | Keramik-Schutz | Lackausschnitt geteilt ohne/mit Keramik: Wasser (Film vs. Perlen), UV (Ausbleichen vs. geschützt), Schmutz + Spülen | in Arbeit |
| C | Sportwagen-Wäsche | eigenes Sportwagen-Modell: dreckig → Schaum → Spülen → Glanz, Wasser perlt auf der Haube ab | in Arbeit |

## 2. Vorschlag Platzierung (3D-Session)

| Animation | Seite | Stelle | Warum |
|---|---|---|---|
| B Keramik-Schutz | /keramikversiegelung/ | direkt nach „XPERTCOAT HYBRID – die Fakten“ | macht 165°, UV-Schutz und Selbstreinigung sichtbar; Hinweis „Animation, vereinfachte Darstellung“; nicht neben „keine Symbolbilder“ |
| A Lackschichten | /autopolitur/ | vor der Preisliste | erklärt Klarlack, Kratzer, Swirls → warum polieren; nur eine Scroll-Animation pro Seite |
| C Wäsche | /keramikversiegelung/ „Danach – Damit die Keramik lange hält“ + Meta-Werbung | leichte Schleife ≤ 2 MB | Keramik-Pflege 79 €: Dreck geht leichter runter |
| – | Startseite | **nicht anfassen** | erster Bildschirm ist getestet (13/15), 77 % der Meta-Besucher gehen in 25 s |

## 3. Fragen an die Website-Session

1. Passen die Stellen zu den Persona-Tests? Bessere Stelle?
2. Ladebudget der Seiten (Gesamtgewicht, LCP)? `<script>` im Block „Individuelles HTML“ erlaubt oder über `lp.js.html`?
3. GA4-Ereignis gewünscht (z. B. `cc_3d_ende`)? Namensschema?
4. Texte in `3d-studio/web/keramik-schichten.html` gegen Fakten und Ton prüfen.

## 4. Prüfung durch die 3D-Session (gegenseitig)

- `reel-studio/brand/MARKE.md` hatte alte Preise (Keramik 650 €, Wohnmobil 700 €) → wird auf Masterplan §4 nachgezogen.
- Offene Frage „bessern wir nach“: unkritisch, solange es Nachbesserung der eigenen Arbeit meint (gesetzliche Nacherfüllung)
  und keine Haltbarkeit über Jahre zusagt. Keine Jahreszahl daneben. Entscheidung bei Alex.
- Keramikseite: Abschnitt „Ergebnisse, keine Symbolbilder“ + 3D-Animation auf derselben Seite → Animation muss sichtbar als
  Animation gekennzeichnet sein, sonst Widerspruch.

## 5. Antwort Website-Session

_(hier eintragen)_
