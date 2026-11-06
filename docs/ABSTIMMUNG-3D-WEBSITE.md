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

_06.11.2026, auch per Nachricht an die 3D-Session geschickt._

**1. Platzierung:** Alle drei Stellen passen. Die Startseite bleibt unberührt.
- **B Keramik-Schutz** nach „Die Fakten“ erklärt, warum die Keramik 700 € kostet. Genau das war der Haupteinwand in den Tests. Die Kennzeichnung „Animation, vereinfachte Darstellung“ ist Pflicht, weil die Seite „keine Symbolbilder“ verspricht.
- **A Lackschichten** auf /autopolitur/ (Seite 1113): ok. Der CTA dort braucht eigene Politur-Angaben:
  - WhatsApp-Text für Politur
  - `data-wa-service="Politur"`
  - `/anfragen/?leistung=Politur`

  Den Keramik-Link aus `keramik-schichten.html` nicht übernehmen.
- **C Wäsche:** ok. Meta-Anzeigen erst nach Alex' „ok“, höchstens 5 €/Tag je Kampagne und 10 €/Tag insgesamt.

**2. Ladebudget und Technik:**
- Höchstens 2 MB Animation pro Seite.
- Poster als WebP, höchstens 60 KB, mit `width` und `height`.
- Video mit `preload="none"`, `muted`, `playsinline`. Start per IntersectionObserver. Bei `prefers-reduced-motion` nur das Poster zeigen.
- Keine CDN-Bibliotheken.
- `<script>` im wp:html-Block ist erlaubt, aber **ohne „&“**, weil WordPress es umwandelt. Deine Datei enthält zweimal „&&“: bitte durch verschachtelte ifs ersetzen.
- Die Startseite liegt im Kubio-Template Post 28.
- Einbau macht die Website-Session: Du lieferst Snippet und Medien im Repo, wir laden hoch, bauen ein und prüfen live (360 px, JS-Fehler, LCP). Live erst nach Alex' Freigabe.
- Der Plesk-nginx-Cache verzögert Änderungen. Zum Prüfen `?v=<zufall>` anhängen.

**3. GA4:**
- `cc_3d_start`: zu 50 % sichtbar und gestartet.
- `cc_3d_ende`: bis zum Ende gesehen.
- Parameter: `cc_page` (Pfad) und `cc_anim` (`keramik_schichten` | `lackschichten` | `sportwagen_waesche`).
- Senden über gtag, ohne gtag über `dataLayer.push`.

**4. Texte in `keramik-schichten.html`:**
- „Fünf Schichten Lack“ stimmt fachlich nicht: Blech und Keramik sind kein Lack. Vorschlag: „Vier Schichten über dem Blech. Die Keramik schützt die oberste.“ „Eine schützt alle“ verspricht zu viel, denn gegen Steinschlag hilft Keramik nicht.
- „laut Hersteller bis 1,5 µm“ nur mit Datenblatt als Beleg, sonst nur „hauchdünn“. Dasselbe gilt für jede Schichtdicke in µm.
- „KTL und Füller ab Werk“: ok.
- Der CTA-Text „Drei Fotos reichen“: ok.

**Zu Abschnitt 4:**
- **MARKE.md:** Der Abgleich passt. Drei Kleinigkeiten:
  - Wohnmobil „ab 800 €“ und „ab 245 €“ (bisher ohne „ab“).
  - Notfall auf der Website = Erbrochenes. Getränke und Essen laufen über Fleck/Polster.
  - Leder-Versiegelung = +40 € zur Lederreinigung, die in „detailliert“ schon enthalten ist.
- **„bessern wir nach“:** Alex hat entschieden: ersetzt durch „Für unsere Arbeit gilt die gesetzliche Gewährleistung“ plus die kostenlose Nachkontrolle nach 6 Monaten. Grund ist UWG Anhang Nr. 10: Gesetzliche Rechte darf man nicht als Besonderheit bewerben. Deshalb auch nicht in Reels verwenden.
- **Handy-Review von Startseite und Keramik:** gern. Befunde bitte als Liste mit URL, Breite und Stelle.
