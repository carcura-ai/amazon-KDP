# Entscheidungen · Carcura Relaunch (Stand 23.11.2026)

Je Entscheidung: Beobachtung, Vorschlag, Befund und Entscheidung, Datei, erwarteter Vorteil, Messgröße und Datenlücke.
Quellen: Live-Abruf carcura.info am 23.11.2026, Google Search Console (25.08.–22.11.2026, 128 Klicks, 2.359 Impressionen), Google Ads (01.–22.11.2026).

## 1. Einstieg der Startseite
- **Beobachtung (/):** Die H1 „Fahrzeugaufbereitung im Westerwald“ nennt Thema und Region. Handwäsche, Politur und Keramik erscheinen erst weiter unten. Die Waschset-Aktion steht früh und groß.
- **Vorschlag:** H1 „Fahrzeugaufbereitung in Walterschen bei Altenkirchen“, Einleitung mit vier Leistungen, Buttons „Leistungen & Preise“ und „Preis per WhatsApp anfragen“.
- **Befund:** Die Search Console stützt den Ortsbezug. Bei „autoaufbereitung altenkirchen“ steht die Startseite auf Position 1,8, die Altenkirchen-Seite nur auf Position 10. Bei „fahrzeugaufbereitung westerwald“ ist die Startseite mit Position 18,3 die beste eigene URL. „Westerwald“ bleibt deshalb im Seitentitel.
- **Entscheidung:** Übernommen.
  - Title: „Fahrzeugaufbereitung bei Altenkirchen im Westerwald | Carcura“.
  - Eine Telefonzeile und die Bewertung mit Datum stehen direkt unter den Buttons.
  - Das Heldbild ist der saubere Endzustand aus der Hallenvorschau (Heck zum Rolltor, Front zur Kamera) und als Inszenierung gekennzeichnet.
- **Datei:** `src/build.py` → `home()`, `dist/index.html`.
- **Getestet:** Auf dem Handy (390 × 844) und dem Tablet (768 × 1024) sind H1, Einleitung und beide Buttons ohne Scrollen sichtbar.
- **Vorteil:** Besucher erkennen Angebot, Ort und nächsten Schritt in der ersten Ansicht.
- **Messgröße:** Klickrate der Startseite in der Search Console, Klicks auf `#preise`, WhatsApp und Telefon.
- **Datenlücke:** Ohne Daten ist ein Rankingvorteil durch die neue H1 nur eine Hypothese.

## 2. Preise früh und vergleichbar
- **Beobachtung:** Die Preise lagen bisher auf der Startseite verstreut (Laufband, Karten, Aktion).
- **Entscheidung:** Direkt unter dem Einstieg steht jetzt der Abschnitt „Was kostet das?“.
  - Vier Hauptkarten: Innenreinigung 90 €, Handwäsche 69 €, Politur 349 €, Keramik 700 €.
  - Jede Karte nennt Ergebnis, Ab-Preis, Umfang und Grenzen und hat die Buttons „Details & Umfang“ und „Anfragen“.
  - Darunter folgen Basic 145 €, Familienpaket 169 € und Leasing 229 €.
  - Statt „Budget knapp?“ gibt es einen konkreteren Weg: „Unsicher, was dein Auto braucht? Fotos schicken“.
- **Reihenfolge:** Innenreinigung zuerst, weil sie in Google Ads die meisten Klicks hat (11 von 33). Keramik steht mit Aktion am Ende der Zeile.
- **Fragen aus dem Auftrag, direkt auf der Seite beantwortet:**
  - Innenreinigung: Was ist für 90 € enthalten, was kostet extra (Polster +59 €, Tierhaare +29 €, Ozon +39 €)?
  - Politur: 1- oder 2-stufig?
  - Keramik: Was ist enthalten, was kostet die 2-stufige Variante (+200 €)?
  - Abholung: Wie wird gerechnet (Formel und Rechner)?
- **Aktion:** Die Keramik-Aktion steht an der Keramik-Karte und auf der Keramik-Seite, nicht mehr als großer Block auf der Startseite. Sie blendet sich nach dem 31.12.2026 aus, beim Build und zusätzlich im Browser über `data-ende`. Der Wert „fast 100 €“ aus der Live-Seite wird bewusst nicht genannt, weil kein Beleg vorliegt.
- **Messgröße:** Anfragen mit Vorauswahl je Leistung (`source`/`service` im Lead).

## 3. Film nach den Preisen statt davor
- **Vorschlag aus dem Briefing:** Film als Einstieg.
- **Entscheidung:** Abgewandelt. Der Film steht nach dem Preisabschnitt und bleibt der visuelle Schwerpunkt.
  - Er hat Kapitel-Buttons und einen Link „Film überspringen“.
  - Grund: Der Auftrag verlangt, dass Einstieg und Buttons auf dem Handy ohne Durchscrollen des Films nutzbar sind.
- **Kennzeichnung:** Der Film ist als „Inszenierung · KI-generierte Bilder · kein Kundenfahrzeug“ gekennzeichnet.
- **Datei:** `dist/assets/js/film.js`, `film_html()`.

## 4. Echte Belege
- **Entscheidung:** Für Belege werden nur echte Carcura-Fotos verwendet: BMW M2 Vorher/Nachher, Audi TT, Tankklappe, Fußraum, Cockpit und Team.
  - Die Zitate sind wörtliche Auszüge aus Google-Bewertungen, die bereits auf der Live-Seite stehen.
  - Referenzformat: Fahrzeug · Ausgangszustand · Arbeit · Ergebnis. Fehlende Details sind weggelassen.
- **Bewertung:** Die Live-Seiten nennen widersprüchlich 17 und 18 Bewertungen. Verwendet wird zentral 4,8 aus 18 (laut CARCURA-DATA.json) mit Datum und Link zum Profil. Vor dem Livegang erneut prüfen.

## 5. Keine eigene /preise/- und /team/-Seite
- **Vorschlag (Briefing 01):** Neue Seiten /preise/ und /team/.
- **Befund:** /leistungen/ ist laut Title bereits die Preisliste. Eine zweite Preisseite würde mit ihr um dieselbe Suchintention konkurrieren. Für eine Teamseite gibt es nur zwei Gründer und ein Foto.
- **Entscheidung:** Verworfen. Beide Pfade werden per 301 weitergeleitet (/preise/ → /leistungen/#preise, /team/ → /ueber-uns/#team). In der Vorschau sind das noindex-Platzhalter mit Weiterleitung.

## 6. Startseite gegen Westerwald-Seite
- **Beobachtung:** Bei „fahrzeugaufbereitung westerwald“ und „autoaufbereitung westerwald“ ranken acht eigene URLs gleichzeitig auf den Positionen 18 bis 64.
- **Entscheidung:** Die Startseite ist die primäre URL. Die Westerwald-Seite ist neu ausgerichtet:
  - H1 „Autoaufbereitung im Westerwald: Orte & Abholung“ mit Entfernungstabelle, Abholkosten, Rechner und Hallenadresse.
  - Sie verlinkt auf die Startseite.
- **Messgröße:** Anzahl rankender URLs je Suchbegriff und Position der Startseite in der Search Console nach 6–8 Wochen.

## 7. Abholkosten der Ortsseiten nach Formel
- **Befund:** Die Live-Ortsseiten nennen Beträge, die nicht zur eigenen Formel passen. Beispiele: Asbach 16 km „ca. 11 €“ (Formel 12 €), Wissen 25 km „ca. 31 €“ (Formel 30 €), Neuwied 36 km „ca. 51 €“ (Formel 52 €).
- **Entscheidung:** Alle Beträge werden mit `max(0, km − 10) × 2` aus den genannten Kilometern berechnet, als „ca.“ ab Ortsmitte. Den genauen Betrag bestätigt Carcura vor dem Termin.

## 8. Anfrageweg
- **Entscheidung:** Das Formular nutzt den bestehenden Endpunkt `/wp-json/ccrr/v1/lead` mit denselben Feldern wie das Live-Formular.
  - Erfolg wird nur bei HTTP 2xx und ohne `ok:false` gemeldet.
  - Im Fehlerfall bleiben alle Eingaben stehen. Telefon, WhatsApp mit vorbereitetem Text und E-Mail mit eingetragenen Angaben werden angeboten.
- **Vorauswahl:** `?leistung=Name` (so nutzen es die laufenden Google-Ads-Anzeigen) und `?service=id` funktionieren, auch mehrfach. `&abholung=1` setzt den Holservice.
- **Aufbau:** Drei Schritte. Die zehn häufigsten Leistungen sind sichtbar, alle weiteren aufklappbar. Ein Preis wird nicht automatisch summiert, damit Extras nicht doppelt berechnet werden.
- **Abweichung vom Live-Formular:** Das Upsell-Popup („Basic statt Innen + Wäsche“) entfällt. Grund: weniger Schritte bis zum Absenden.
- **Messgröße:** Abschlussrate des Formulars (gesendete Anfragen ÷ Seitenaufrufe von /anfragen/).

## 9. Interaktives 3D-Waschspiel nicht gebaut
- **Vorschlag (Briefing 01, Punkt 11):** Interaktives 3D-Waschspiel mit `CarConcept.glb` (11,8 MB).
- **Entscheidung:** Verworfen. Es bringt keine Anfragen, braucht 12 MB Ladevolumen und ein Konzeptauto statt Carcura-Fahrzeug, was auf dem Handy kontraproduktiv ist. Die Dateien bleiben im Projekt.

## 10. Technisches
- **Schema:** Vorher gab es zwei konkurrierende LocalBusiness-Blöcke, einer mit veraltetem priceRange „55€–600€“. Jetzt gibt es einen `AutomotiveBusiness`-Block mit Öffnungszeiten, Adresse und Einzugsgebiet, ohne aggregateRating.
- **Fehlende Seiten ergänzt:** `/impressum/` (in der Live-Sitemap) und `/widerruf/` (live, noindex) fehlten im Paket. Beide sind ergänzt.
- **Tippfehler korrigiert:** In der Live-Cookie-Richtlinie steht „carcura@ex.comweb.de“. Korrigiert in `/cookie-richtlinie-eu/`.
- **Schriften:** WOFF2 lokal, keine externen Fonts, keine Tracking-Skripte in der Vorschau. Klick-Ereignisse `cc_whatsapp`, `cc_anruf` und `cc_anfrage` werden nur gesendet, wenn auf der Live-Seite ein Google-Tag mit Einwilligung existiert.

## 11. Design-Update „carcura-finish“ (23.11.2026) – in die Templates übernommen
- **Übernommen:** Film als Einstieg (`.studio-opening`) mit Kapitelwahl und „Film abspielen“. Der Scroll-Film (`film.js`) entfällt. Dunkleres Glas und weiche Lichter im Preisbereich. Leistungsübersicht ohne Bilder.
- **Eingebaut in `src/build.py`, nicht als Patch auf `dist/`:** `home()` erzeugt den Einstieg, `page()` kann Zusatz-CSS und eine Body-Klasse setzen, die Bildkarten auf /leistungen/ sind ohne Bildcontainer. `apply-finish.py` liegt nur als Referenz in `src/design-update/`.
- **/leistungen/ geprüft:** 0 `<img>`, 0 `<picture>`, 0 Bildunterschriften, 0 leere Bild- oder Foto-Container, keine CSS-Hintergrundbilder (`url()` nur für Schriften).
- **Abweichungen vom Paket (mit Befund):**
  1. Wasser (12) → Perlen (13) als harter Schnitt statt Wischübergang. Grund: Die Phasenkorrelation ergibt 0,034, also eine andere Perspektive. Eine Wischkante würde Doppelkanten erzeugen.
  2. Die Kapitel-Buttons bleiben markiert, solange ein Bild aus ihrem Kapitel läuft. Im Paket war beim Abspielen zwischen den Kapitelanfängen kein Button aktiv.
  3. Layout-Anpassungen, weil im Paket-Zustand bei 1440 × 900 die Buttons an der Unterkante und die Kapitelwahl außerhalb des Bildschirms lagen und bei 360 × 740 beide Buttons unter der Kontaktleiste. Außerdem gab es mobil einen leeren Streifen über dem Bild. Die Anpassungen stehen gekennzeichnet am Ende von `carcura-finish.css`.
  4. Der Hinweis lautet „KI-Inszenierung auf Basis unserer Hallenfotos · kein Kundenfahrzeug“, ergänzt um „kein Kundenfahrzeug“.
  5. Desktop: dunkler Verlauf von links, damit „Carcura · Walterschen · Westerwald“ vor dem hellen Rolltor lesbar ist.

## 12. Startseite: Porsche zuerst, Aufbereitung beim Scrollen (23.11.2026)
- **Erster Bildschirm:** Nur das Bild und die transparente Navigation, keine Überschrift, kein Preis, keine Karte. Der Einstieg „Fahrzeugaufbereitung in Walterschen bei Altenkirchen“ mit Buttons folgt als HTML direkt nach dem Film (`#einstieg`). Preise und Anfrage sind jederzeit über die Navigation, auf dem Handy zusätzlich über die Kontaktleiste erreichbar.
- **Klein gehalten:** Die Hinweise „KI-Inszenierung“ und „Film überspringen“ bleiben klein am Bildrand. Grund: Ehrlichkeit über die Bildquelle und ein Ausweg für Tastatur- und Handynutzer.
- **Vier Karten, Preise aus CARCURA-DATA.json:** Außenwäsche ab 69 €, Innenraumreinigung ab 90 €, Lackpolitur ab 349 €, Keramik ab 700 €.
  - Jede Karte erscheint erst beim passenden Arbeitsschritt: Schaum sichtbar, Innenraum vorher, Polierpad, Applikator. Die Keramik-Karte bleibt bis zum Ende der Perlen-Szene.
  - Die Karte folgt dem **tatsächlich angezeigten** Bild. Lädt ein Bild langsam, bleibt das letzte Bild ohne falsche Karte stehen.
- **Kartenpositionen** nach Sichtprüfung, damit die Arbeit frei bleibt:
  - Desktop: Außenwäsche oben rechts (Auto, Schaum und LED-Hauptleisten frei), Innen und Politur oben links, Keramik unten links (Applikator, Tuch, Wasser und Perlen frei).
  - Handy und Tablet hochkant: Karte unter dem Bild.
- **Struktur:** Szenen, Karten und Material stehen in `src/film-szenen.json`. Besseres Material wird pro Szene eingetragen, ohne Codeänderung (siehe FILM-MATERIAL.md).
- **Assets:** Die Assets liegen jetzt in `src/assets/` und werden beim Build kopiert. Ein Build aus leerem Ordner wurde getestet.
- **Nicht erfüllt, weil Material fehlt:** fotorealistische Sequenzen ≥ 1920 px, Hochformat-Fassung, echte Tür-, Wasser- und Pad-Bewegung, Halle aus Originalfotos. Pro Szene benannt in FILM-MATERIAL.md.

## 13. Startseite mit Außenwäsche-Video statt Scroll-Film (24.11.2026, Zweig `claude/carcura-aussenwaesche-video`)
- **Auftrag:** nur Außenwäsche, echtes `<video>`. Daher entfallen Scroll-Film, Leistungskarten im Film, Tür-, Innenraum-, Politur- und Keramikbilder (`film.js`, `film-szenen.json` und die Bilder 04–14 sind entfernt).
- **Video:** `autoplay muted loop playsinline`, Posterbild, Quellen für Handy (Media-Query ≤ 809 px) und Desktop jeweils als MP4 und WebM. Dazu Pause/Abspielen, Sprungmarken zu den fünf Phasen und ein direkter MP4-Download.
- **Reduzierte Bewegung:** kein Autoplay, Poster bleibt stehen, Abspielen auf Wunsch. Das Video pausiert außerhalb des Sichtbereichs.
- **Layout:** Das Video steht unter der Navigation und überlagert sie nicht. Desktop 16:9, höchstens so hoch, dass Steuerleiste und Hinweis in den ersten Bildschirm passen. Mobil im ganzen 3:2-Bild, damit Front und Heck sichtbar bleiben.
- **Glas:** einheitliches Material für Navigation, Karten, Formulare, Buttons und Videosteuerung mit Verlauf, heller Oberkante, feinem Rand und Blur. `@supports`-Fallback mit deckenden Flächen für Browser ohne `backdrop-filter`.
- **Lesbarkeit:** Fließtext, Listen, FAQ, Formular-Labels und Aktionshinweis mindestens 16 px. Preistabellen sind bis 900 px gestapelt, vorher lief /leistungen/ bei 768 px 63 px über.
- **Ehrlich ausgewiesen:** Das Video ist eine Vorschau aus KI-Zuständen und erfüllt die Abnahme nicht. Fehlendes Material und der Austauschweg stehen in FILM-MATERIAL.md, der Hallenvergleich in HALLENVERGLEICH.md.

## 14. Außenwäsche als Scroll-Effekt statt Video (24.11.2026, Zweig `claude/carcura-aussenwaesche-video`)
Vorgabe des Nutzers: „kein Video, ein Scroll-Effekt, kein MP4-Download und keine Buttons. Einfach scrollen, das Auto wird gewaschen und die Seite geht weiter.“
- **Umsetzung:** `<section id="film">` ist 330 svh hoch, am Handy 270 svh. Darin bleibt eine 100 svh hohe Bühne stehen (sticky). Die Scrollposition steuert den Zustand: verschmutzt → Schaum läuft von oben auf → Abspülen von oben → fleckiges Abtrocknen → sauber. Danach scrollt die Seite normal zum Einstieg mit H1 weiter.
- **Technik:** Es gibt keine Bildfolge und kein Video. Geladen werden vier Zustandsbilder und eine Verlaufskarte, die ein WebGL-Shader live mischt (dieselben Formeln wie die Videovorschau). Geprüft wurde auch eine Folge aus 100 WebP-Bildern, sie bringt 20 MB statt jetzt 0,87 MB am Desktop und 0,67 MB am Handy. Für die Scrollsteuerung reicht eigener Code mit etwa 150 Zeilen, GSAP oder Motion braucht es nicht.
- **Ohne Bedienelemente:** Eine kleine Anzeige ohne Funktion (aria-hidden) zeigt Phase 1/5 bis 5/5 mit Fortschrittslinie. Zu Beginn steht ein Hinweis „Scrollen“, der nach dem ersten Scrollen ausblendet. Der KI-Hinweis bleibt als Text sichtbar.
- **Ausweichfälle:** Ohne WebGL oder unter `file://` blendet ein 2D-Canvas weich über. Ohne JavaScript oder bei reduzierter Bewegung steht das saubere Ergebnis als Standbild, die Sektion ist dann nicht verlängert.
- **Handy:** Das Bild ist im Format 6:5 zugeschnitten, an Tablets im Hochformat 4:3. So ist das Auto größer, bleibt aber vollständig sichtbar. Anzeige und Hinweis stehen unter dem Bild statt darauf.
- **Video entfernt:** `video.js`, Video-CSS und die Bedienleiste sind entfernt. Die MP4-/WebM-Vorschau liegt weiter unter `src/video/out/` (für Social Media nutzbar), wird aber nicht mehr nach `dist/` kopiert.
