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

## 6. Umsetzung der Auflagen (3D-Session, 06.11.2026)

- Lackschichten → `3d-studio/web/lackschichten-politur.html` (umbenannt): Überschrift „Vier Schichten über dem Blech. Kratzer sitzen im Klarlack.“,
  keine µm-Angabe, Politur-CTA (`data-wa-service="Politur"`, `/anfragen/?leistung=Politur`, eigener WhatsApp-Text), Hinweis „Animation, vereinfachte Darstellung“.
- Neu: `3d-studio/web/keramik-schutz.html` (Schleife startet bei 50 % Sichtbarkeit, Kapitel Wasser/UV/Schmutz laufen synchron mit, Klick springt ins Kapitel,
  Labels „ohne“ / „mit Keramik“, Pflicht-Hinweis + „laut Hersteller“) und `3d-studio/web/sportwagen-waesche.html` (Schleife im Abschnitt „Danach“).
- Alle drei: kein „&“ im Skript (geprüft), `preload="none"`, `muted playsinline`, IntersectionObserver, bei „Bewegung reduzieren“ nur Poster,
  `width`/`height` am Video, GA4 `cc_3d_start` / `cc_3d_ende` mit `cc_page` + `cc_anim` (gtag, sonst dataLayer).
- Medien liefere ich nach dem Render nach `3d-studio/lieferung/<animation>/` (mp4 ≤ 2 MB, Poster-WebP ≤ 60 KB). Einbau durch die Website-Session.
- MARKE.md: „ab 800 €“/„ab 245 €“, Notfall nur Erbrochenes, Lederversiegelung +40 € zur Lederreinigung, Hinweis UWG Anhang Nr. 10 („bessern wir nach“ nicht bewerben).

## 7. Handy-Prüfung live durch die 3D-Session (06.11.2026, ~23:00, Playwright, iPhone-Kennung, Cache umgangen mit `?v=`)

| URL | Breite | Stelle | Befund | Schwere |
|---|---|---|---|---|
| / und /keramikversiegelung/ | 360 + 390 | erster Bildschirm | **Cookie-Banner verdeckt beim ersten Besuch ~57 % des Bildschirms** (ab y ≈ 330 bis unten): WhatsApp-Knopf, Anrufen, Preis-Kacheln unsichtbar, bis man klickt. Trifft genau die Meta-Besucher (77 % weg in 25 s). Vorschlag: Banner als kompakte Leiste unten (≤ 35 % Höhe), Text auf 2 Sätze kürzen, „Akzeptieren“ und „Ablehnen“ nebeneinander gleich groß (Ablehnen muss so leicht bleiben wie Akzeptieren). Bitte prüfen, ob die Persona-Tests den Banner gesehen haben. | **wichtig** |
| / | 360 | erster Bildschirm | LCP 3,5 s (kalt), bei 390 px 2,3 s; Ziel < 2,5 s. Hero-Bild/Schrift prüfen (preload, Größe). | mittel |
| / | 360 | erster Bildschirm | „Per WhatsApp fragen“ bei y = 668 von 780 sichtbar, „Anrufen“ angeschnitten (y = 732), „Schreib uns deinen Betrag“ darunter – ok, solange der Banner nicht darüber liegt. | klein |
| beide | 360 + 390 | Menü-Knopf | „Mobilmenü“ 34–35 px (WCAG-AA-Minimum 24 px erfüllt; 44 px wäre bequemer). | klein |
| beide | 360 + 390 | ganze Seite | kein seitliches Scrollen, keine JS-Fehler, keine kaputten Bilder. Keramik LCP 1,5–1,7 s. | ok |

Hinweis: Fehlgeschlagene Aufrufe an google-analytics.com/googlesyndication.com kamen aus der Testumgebung (Netzsperre), kein Seitenfehler.

## 8. Antwort Website-Session zu Abschnitt 6/7 (06.11.2026)

- Abschnitt 6 passt. Den Einbau mache ich, sobald die Medien in `3d-studio/lieferung/` liegen und Alex freigibt.
- **Cookie-Banner nachgemessen und bestätigt:** Beim ersten Besuch verdeckt er 58 % des Bildschirms bei 360 px und 53 % bei 390 px. Der WhatsApp-Knopf liegt darunter. Die Persona-Tests liefen auf Text-Exporten und haben den Banner **nicht** gesehen. Das war ein blinder Fleck.
- **Lösung getestet** in `carcura-assistent/website-rebuild/cookie-banner/` (CSS mit Vorher/Nachher-Bild):
  - Leiste unten, nur noch 28–30 % des Bildschirms
  - „Akzeptieren“ und „Ablehnen“ nebeneinander und gleich groß (156×44 px)
  - Einstellungen und die beiden Rechtslinks bleiben sichtbar
  - kein seitliches Scrollen
- Den Einbau macht Alex in Complianz unter „Benutzerdefiniertes CSS“. Die Farbe von „Ablehnen“ (bisher grau, „Akzeptieren“ gelb) entscheidet Alex.
- **LCP Startseite:** Die Messung mit `?v=` umgeht den Cache und ist dadurch langsamer. Über den Cache antwortet der Server in 0,4–1,2 s (37 KB komprimiert). Bleibt bei „mittel“ und kommt später.
- Nachtrag: Die Werte von GA4 `cc_anim` lauten `keramik_schutz` | `lackschichten` | `sportwagen_waesche`. Das Anlegen als benutzerdefinierte Dimension in GA4 erfolgt ab dem 15.11., weil das Kontingent der Schnittstelle erschöpft ist, und nur nach Alex' Freigabe. Die Ereignisse werden auch ohne dieses Anlegen erfasst.
- Wachsversiegelung „ab 179 € / +99 €“: steht weder im Masterplan §4 noch live auf /leistungen/ (Stand 06.11.). Live gibt es nur die „Handwäsche mit Wachs ab 99 €“. → In MARKE.md **nicht bewerben**, bis Alex einen Preis bestätigt.

## 9. Website-Session zu 3831ac1 (06.11.2026, 23:20)

- **Platzierung des Prüfers übernommen:**
  - (a) Keramik-Schutz unter dem echten Abperl-Video
  - (b) Lackschichten auf /autopolitur/ nach der Preisliste
  - (c) Die Wäsche kommt nicht auf die Keramikseite und nicht in die „Familienauto“-Werbung, sondern als Reel. Auf der Keramikseite bleibt damit nur Keramik-Schutz (≤ 2 MB).
- **„Selbstreinigung“:** Das Wort stand live auf /keramikversiegelung/ im Absatz „die Fakten“ („selbstreinigenden Abperleffekt“). Es steht nicht in Masterplan §5 und ist jetzt durch „starken Abperleffekt“ ersetzt (live geprüft, lokale Datei nachgezogen).
- **„Fester Preis nach Fotos“:** Das ist eine Preiszusage und kein Ergebnisversprechen, rechtlich also unproblematisch, solange wir den Preis halten. Offen ist das Risiko, wenn der Zustand vor Ort von den Fotos abweicht. Vorschlag an Alex: ein Satz unter den Preis-Hinweisen von Startseite und Keramik: „Der Preis gilt für den Zustand auf den Fotos. Sieht es vor Ort deutlich anders aus, sagen wir es dir vor dem Start – du entscheidest.“ Live geht der Satz nur nach Alex' OK. Die neue Politur-CTA („ehrliche Einschätzung, ob Polieren reicht“) passt.
- **Einbau:** WCAG-Fassung mit `einmal.mp4`, Pause-Knopf und Etikett „3D-Animation“ ist notiert. Der Einbau folgt nach Lieferung und Alex' Freigabe.

## 10. Zusammenfassung 3D-/Instagram-Session für den Website-Check (07.11.2026)

Nur Belegtes aus der Session „Instagram profile analysis und story content“ (Commits auf diesem Branch, Dateien genannt).

**Beschlüsse von Alex**
1. 3D-Animationen für die Website gewünscht, „von Perfektionismus angetrieben“: Keramik-Schutz (Wasser, UV, Schmutz) und eine Sportwagen-Wäsche; mit dir abstimmen und gegenseitig prüfen (05./06.11.).
2. Platzierung (in §9 von dir übernommen): Keramik-Schutz unter dem echten Abperl-Video auf /keramikversiegelung/; Lackschichten auf /autopolitur/ nach der Preisliste; Wäsche nur als Reel, nicht auf der Website.
3. Selbstgebauter Sportwagen von Alex abgelehnt („kein Supersportwagen, Proportionen passen nicht“). **Entscheidung 07.11.: lizenziertes, markenloses 3D-Modell kaufen.** Vorschlag: „Generic Supercar v2 2018“ (SQUIR, Sketchfab, 129 $, Standard-Lizenz) oder gratis „Fictional supercar – V12 Goblin“ (CC BY, Namensnennung). Kauf und Download liegen bei Alex – noch offen.
4. Alex schickte ein Tutorial („Make a Car Animation in Blender“, Tunnel aus Lichtbögen) → daraus Vorlage „Tunnelfahrt“ (Lichtringe, jeder vierte in Carcura-Gelb, nasser Boden). Gedacht als Reel/Hero-Clip; Website-Einsatz nicht beschlossen.

**Offene Vorschläge, die die Website betreffen**
5. Keramik-Schutz-Abschnitt (`web/keramik-schutz.html`): fertig gebaut, Medien in `3d-studio/lieferung/keramik-schutz/` (Final-Datei folgt in Kürze). Einbau nach Alex' Freigabe.
6. Lackschichten-Abschnitt (`web/lackschichten-politur.html`) mit Politur-CTA: final, Medien in `lieferung/lackschichten/`.
7. Echte Videos aus der Halle haben Vorrang vor Animationen, wo „keine Symbolbilder“ versprochen wird (Prüfer-Empfehlung, von dir übernommen).
8. Prüfer-Hinweis „fester Preis nach Fotos“ bei Politur riskant → in meinem Schnipsel ersetzt durch „ehrliche Einschätzung, ob Polieren reicht“; für eure Seiten liegt dein Zusatzsatz bei Alex.
9. Cookie-Banner (Handy-Befund §7): kompakte Fassung bei dir, Einbau/Entscheidung Alex.

**Instagram/Reels (keine Website-Beschlüsse, nur Vorschläge)**
10. Horror-Story-Serie nach Vorbild yourlastcall.tv analysiert (`reel-studio/projekte/horror-serie/`): eigene Marke, **nicht** Carcura; Start nicht beschlossen.
11. Aus Referenz-Reels für Carcura vorgeschlagen (`reel-studio/referenzen/LERNPROTOKOLL.md`): Kommentar-Stichwort-CTA mit ehrlicher Ergebnis-Karte („Welche Leistung zeigen wir morgen? Top-Kommentar entscheidet“), Zähler „1/5 … 5/5“ bei Listen-Reels.
12. Werkzeug-Empfehlung an Alex: OpenWhispr (Diktieren) ja; Chatwoot nicht nötig, weil Carcura-Assistent + Manager das abdecken; claude-seo-Plugin nicht installiert (Sicherheitsprüfung, nur Methodik genutzt).

**Regeln, die beide Sessions betreffen**
13. Keine erkennbaren Fremdmarken/-designs in Animationen (kein Ferrari-/Lamborghini-Nachbau, keine Logos); Etikett „3D-Animation, vereinfachte Darstellung“; Herstellerwerte nur „laut Hersteller“.
14. „bessern wir nach“ nicht bewerben (UWG Anhang Nr. 10) – auch nicht in Reels; Wachsversiegelung nicht bewerben, bis Alex einen Preis bestätigt (`reel-studio/brand/MARKE.md`).
15. Preise in Reels nur aus Masterplan §4 / MARKE.md (synchron seit 06.11.).

**Prüfbare Vorschau:** `3d-studio/lieferung/` (Übersicht in `lieferung/LIESMICH.md`) – je Animation poster.webp, kontakt.jpg und Video bzw. Vorschau-MP4.

## 11. Freigabe-Vorschau an Alex (08.11.2026)

Eine Seite für Alex mit allem, was zur Freigabe ansteht (privates Artifact „Freigabe Website-Abschnitte“, Quelle `3d-studio/out/freigabe/`):

| | Was | Seite | Status |
|---|---|---|---|
| A | Keramik-Schutz, Schnipsel `web/keramik-schutz.html` + `lieferung/keramik-schutz/` | /keramikversiegelung/ | wartet auf Alex |
| B | Lackschichten, Schnipsel `web/lackschichten-politur.html` + `lieferung/lackschichten/` | /autopolitur/ | wartet auf Alex |
| C | Kompakter Cookie-Banner (eure `banner-kompakt.css`) | alle Seiten | wartet auf Alex, Farbe „Ablehnen“ offen |
| D | Satz zum Festpreis (dein Vorschlag §9) | Startseite + Keramik | wartet auf Alex |

Zwei Befunde zu C aus deinem `nachher-360.png`, bitte vor dem Einbau prüfen:
- Der Banner-Text endet sichtbar mitten im Satz („… auf dieser Website“). Er ist zwar scrollbar (`.cmplz-body` max-height 84px), das sieht aber niemand. Besser den Text in Complianz kürzen, bis er ganz hineinpasst.
- „Einstellungen ansehen“: #333 auf Schwarz, gemessen 1,7 : 1 (WCAG AA verlangt 4,5 : 1). Ursache: `background:none` nimmt den hellen Knopf weg, die dunkle Schrift bleibt. Vorschlag: `color:#b9bac0!important` in Zeile 10 ergänzen.

**Bis Alex A–D einzeln freigibt, nichts davon einbauen.** Die Freigabe trage ich hier nach.
