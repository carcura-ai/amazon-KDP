# Qualitätsprüfung · eigene Fehler, Korrekturen, erneute Tests (23.11.2026)

Werkzeuge: Playwright/Chromium (headless, SwiftShader), `src/check.py` (Crawler für den Build), Python/PIL für Bildvergleiche.
Lokal **nicht** verfügbar: Lighthouse, echte Mobilgeräte, Felddaten. Darum gibt es keine Lighthouse-Werte.

## Geprüfte Viewports
390 × 844, 768 × 1024 und 1440 × 900. Zusätzlich 360 × 740 durch den Mobil-Prüfer. Reduzierte Bewegung über `reducedMotion: 'reduce'`.

## Selbst gefundene Fehler (vor den Prüfern)
| Fehler | Korrektur | Nachtest |
|---|---|---|
| Desktop-H1 der Startseite zu groß, Buttons unterhalb der ersten Ansicht | H1 auf clamp(44px, 5,4vw, 82px), 15ch | 1440 × 900: Buttons sichtbar ✔ |
| Mobil verdeckte die Kontaktleiste die Kapitel-Buttons des Films | Film-Navigation 86 px über dem Boden, Text höher | 390 × 844: alle vier Kapitel sichtbar ✔ |
| Sprühkante des Films lief mobil über den schwarzen Bereich | Sprühkante mobil ausgeblendet | ✔ |
| „Keramikversiegelung“ lief aus der Preiskarte (1440 px) | Trennstelle `Keramik&shy;versiegelung`, kleinere Kartentitel | ✔ |
| Preistabellen mobil 200–300 px breiter als der Bildschirm | Tabellen unter 640 px als gestapelte Zeilen | /leistungen/ 390 px: kein Überlauf ✔ |
| Anfrageformular mobil mit 28 Optionen sehr lang | 10 Hauptleistungen sichtbar, Rest aufklappbar; öffnet sich automatisch bei Vorauswahl | ✔ |
| Doppelte Aktionsbox auf /keramikversiegelung/ | entfernt | ✔ |
| Erstansicht der Startseite 607 KB (Logo 218 KB, volle Schriften) | Logo 240 px (10 KB), Schriften auf Latein reduziert (74/31/33 KB) | 365 KB ✔ |
| `/widerruf/` (live, noindex) fehlte | ergänzt | Crawl ✔ |
| Leder-Versiegelung fehlte im Formular | ergänzt | Crawl ✔ |
| Überschriften der Unterseiten auf dem Desktop zu groß | `.phead h1` clamp(40px, 5,4vw, 80px) | ✔ |

## Befunde Prüfer „Anfragewege“ (13) und Korrekturen
| # | Befund | Korrektur | Nachtest |
|---|---|---|---|
| 1 hoch | Auf /anfragen/ luden „Anfragen“ (Leiste) und „Termin anfragen“ die Seite neu, Eingaben gingen verloren | Auf /anfragen/ zeigen beide auf `#anfrage`, die Leiste heißt dort „Zum Formular“ | href = `#anfrage` ✔ |
| 2 | Fehlerbox nach Sendefehler unter der Kontaktleiste | `scrollIntoView({block:'center'})`, mobil `scroll-padding-bottom: 96px` | ✔ |
| 3 | Pflichtfehler weit unter dem Button, ohne aria | Fehler direkt an der Leistungsgruppe bzw. am Kontakt, `aria-invalid`/`aria-describedby` | Fehler bei 377–471 px sichtbar ✔ |
| 4 | Alte Fehlermeldung blieb stehen | wird bei jedem Absenden zurückgesetzt | ✔ |
| 5 | gclid ging auf anderen Zielseiten verloren | seitenweit in `localStorage ccrr_gclid {v,t}` (Format wie live), Weiterleitungen behalten Parameter | gclid TESTG aus /keramikversiegelung/ im Datensatz ✔; /preise/?gclid=ABC → /leistungen/?gclid=ABC#preise ✔ |
| 6 | 200 mit HTML galt als Erfolg und leerte das Formular | Erfolgsmeldung bleibt (wie live), Formular wird nur bei JSON-Antwort geleert | Name bleibt bei HTML-Antwort ✔ |
| 7 | Telefon „x“ akzeptiert | mind. 6 Ziffern oder gültige E-Mail (wie Live-Schnellformular) | „x“ abgelehnt ✔ |
| 8 | Unterer CTA auf Tierhaare/Geruch ohne Zusatzleistung | CTA-Band übernimmt alle Leistungen der Seite | `?service=innen-normal,tierhaare` ✔ |
| 9 | Galerie/Über uns wählten „Basic“ ohne Bezug vor | „Anfrage starten“ ohne Vorauswahl | ✔ |
| 10 | Händler-Link ließ „Privatkunde“ stehen | `?service=haendler` setzt „Firma / Händler“ | ✔ |
| 11 | Fokus unter der Kontaktleiste | `scroll-padding-bottom` mobil | ✔ |
| 12 | Kündigung: Grund und Datum nicht Pflicht trotz Auswahl | `required` je nach Auswahl, Datum ab heute | Grund Pflicht bei außerordentlicher Kündigung ✔ |
| 13 | `min` beim Wunschtag fest im Build | per JS auf das heutige Datum | ✔ |

## Befunde Prüfer „SEO und Texte“ (22) und Korrekturen
| # | Befund | Korrektur |
|---|---|---|
| 1 hoch | Interne Notizen („laut Startseite“, „laut Website“) in der Preistabelle | eigene Kundentexte (`SCOPE` in build.py); `note` wird nie ausgegeben; geprüft: 0 Treffer |
| 2 hoch | Zusatzpreise vertauscht („Zusammen mit … ab 79 €“) | „einzeln ab 79 € · mit Innenreinigung +59 €“, Felgen und Scheiben analog |
| 3 | KI-Hinweis am Heldbild fehlte, Alt-Text nannte die Carcura-Halle | „KI-generierte Inszenierung, kein Kundenfahrzeug“; Alt ohne Hallenbehauptung |
| 4 | Letzter Filmtext „in unserer Halle“ zum KI-Bild | „Ende der Inszenierung. Echte Fotos … weiter unten.“ |
| 5 | Anzahlungsregel fehlte auf der Startseite und im Holservice | ergänzt (Preisabschnitt, FAQ, Holservice, Über uns) |
| 6 | Fahrzeugklassen widersprüchlich | Innen/Wäsche: PKW, Kombi, Van; Politur/Keramik: PKW, Kombi |
| 7 | „900 €“ / „700 €“ ohne „ab“ | überall „ab“ |
| 8 | „festen Preis“ (Spezialreinigung) | „ein Angebot“ |
| 9 | Rechner zeigte ohne JS 10 € für alle Strecken | Startwert im Build nach Formel |
| 10 | Brotkrumen mitten im Wort abgeschnitten | feste Kurznamen je Seite |
| 11 | Startseite und Altenkirchen-Seite zielten beide auf „Fahrzeugaufbereitung Altenkirchen“ | Startseiten-Title wieder „Fahrzeugaufbereitung Westerwald mit Abholung \| Carcura“ (bisheriger Live-Title), H1 nennt Walterschen bei Altenkirchen als Standort |
| 12 | Westerwald-Seite doppelte die Abholseite | Rechner entfernt, Leistungen mit Preisen und Links ergänzt |
| 13 | Ortsseiten zu 89–90 % gleich | je Ort ein eigener Abschnitt (Strecke, wann sich Abholung lohnt) |
| 14 | „Betzdorf“ im H1 ohne Kosten | „aus Betzdorf rund 40 km, ca. 60 €“ |
| 15 | Ozon-Umfang unklar | getrennt: Ozon einzeln ab 59 € / Innenreinigung + Ozon ab 129 € |
| 16 | Einige Zahlen nur in research/, nicht in CARCURA-DATA.json | **offen:** Daten nachtragen (Wachs +30 €, Notfall 179 €, Abo-Preise, Entfernungen) |
| 17 | Scheinwerfer-Title ohne „ab“, Preis doppelt im Einstieg | korrigiert |
| 18 | „zwischen Altenkirchen und Asbach“, „beide selbst“ | einheitlich Weyerbusch, Formulierung abgeschwächt |
| 19 | Lange Wörter in Rechtstexten brachen ohne Bindestrich | weiche Trennstellen, `hyphens:auto` |
| 20 | Du/Sie in Rechtstexten gemischt; Kündigungsbutton heißt in den Abo-Bedingungen anders | Rechtstexte bleiben wörtlich wie live (**offen:** rechtlich prüfen lassen); Footer-Link heißt jetzt „Verträge hier kündigen“ (§ 312k BGB) |
| 21 | Title/Description-Längen, 404-Canonical, `price` im Service-Schema | gekürzt; 404 ohne Canonical; nur `minPrice` |
| 22 | Floskelhafte H1 („X. Slogan.“, „wie neu“) | Haupt-H1 mit Suchbegriff und konkreter Aussage, „wie neu“ entfernt |

## Automatische Prüfung nach den Korrekturen (`python3 src/check.py`)
36 Dateien, 32 verschiedene WhatsApp-Links (alle +49 170 6669516), 1 Telefonziel. **Keine Befunde.** Geprüft werden:
- interne Links und Anker
- Bilder
- genau eine H1 je Seite
- doppelte Titel
- Title ≤ 65, Description 70–160 Zeichen
- Canonical = https://carcura.info + Pfad
- noindex nur auf /kuendigen/, /abo-bedingungen/, /widerruf/, 404
- Sitemap = indexierbare Seiten
- jede €-Zahl gegen CARCURA-DATA.json oder belegte Werte aus research/
- jede Vorauswahl-ID

## Film und Bildachse
- **Waschzustände 00–03 und Endbild 14:** Verschiebung per Phasenkorrelation 0 px auf der ganzen Fläche, in der Halle oben und im Fahrzeugbereich. Die Scheinwerfer-Mittelpunkte weichen höchstens 7 px bei 762 px Breite ab (unter 1 %). Die Felgen- und Schaumgeometrie im Schaumbild weicht leicht ab, weil die Bilder generiert sind. Das ist sichtbar nur in der Nahansicht des Übergangs.
- **Innen- und Politurpaar:** gleiche Bildmaße, 0 px Verschiebung.
- **Bewegung:**
  - Freilegung per Clip-Kante bei Wäsche (00→01→02→03), Innenraum (06→07) und Politur (08→09).
  - Harter Schnitt bei abweichenden Blickwinkeln (03→04→05→06, 07→08, 09→10…14).
  - Keine echte 3D-Kamerafahrt, keine Türanimation, keine Blender-Renderings.
- **Vorwärts und rückwärts:** Bei den Werten 0, 0,6, 1, 2,7, 4,7, 6,55, 8,6, 10, 13,2, 14, dann zurück zu 6,6 und 0,2 stimmen Bild, Titel und aktives Kapitel überein (Desktop und Mobil).
- **Kapitel-Klicks:** Politur → „Swirls unter Prüflicht“, Außen → „So kommt es oft an“, Keramik → „Keramik auftragen“, Innen → „Wieder gerne einsteigen“ ✔.
- **Reduzierte Bewegung:** Der Film wird zur statischen Bildfolge mit allen Texten, kein leerer Scrollbereich ✔.

## Formular und Anfragewege
Siehe TEXTE-UND-ANFRAGEN.md. Alle Tests liefen mit abgefangenem Endpunkt (Testumgebung). **Es wurde keine Anfrage an carcura.info oder echte Empfänger gesendet.**

## Befunde Prüfer „Animation und Mobilansicht“ (12) und Korrekturen
| # | Befund | Korrektur | Nachtest |
|---|---|---|---|
| 1 hoch | 768 × 1024: Film schnitt das Auto auf die halbe Breite (cover-Regel griff im Hochformat) | Regel nur noch im Querformat | 768 × 1024: `contain`, ganzes Auto ✔ |
| 2 | Fehlendes Zielbild: alter Frame wurde eingeblendet, Text wechselte trotzdem | Übergang und Textwechsel nur bei gültigem Zielbild; kein Start-src am oberen Bild | 08 mit 404: Bild und Text bleiben bei „Nachher: gesaugt und gewischt“, Deckkraft 0 ✔ |
| 3 | 360 × 740: WhatsApp-Button unter der Kontaktleiste | bei niedrigen Mobil-Viewports kompakteres Bild, kein Label, kleinere Einleitung | Buttons enden bei 558/620 px, Leiste ab 671 px ✔ |
| 4 | „Film überspringen“ mobil ausgeblendet | mobil als kleiner Link über der Kapitelleiste | sichtbar, springt zu #nach-film ✔ |
| 5 | CLS 0,143 im Film (Sprühkante über `left`, springender Text) | Sprühkante per `transform`, Mindesthöhen für Titel/Text (Desktop) | CLS über den ganzen Film 0,006 bei 1440 ✔ |
| 6 | Filmbilder 762 px, auf dem Desktop weich | **offen** – braucht Neurenderings ≥ 1920 px | – |
| 7 | Lightbox ohne Fokusfalle | Tab-Fokusfalle wie im Menü | Fokus bleibt nach 5× Tab in der Lightbox ✔ |
| 8 | Pfeiltasten ignorierten den Filter | Blättern nur durch sichtbare Bilder | Filter „Innen“: nur 3 Bilder im Kreis ✔ |
| 9 | Escape am „Mehr“-Menü ließ aria-expanded=true, Fokus ging verloren | aria-expanded=false, Fokus zurück auf „Mehr“ | ✔ |
| 10 | Tabellenkopf auf hellem Grund 2,82:1 | #55565c (≈ 7:1) | ✔ |
| 11 | Desktop: Titel im Film verdeckte Teile des Autos | Titel max. 72 px, Textblock max. 600 px | ✔ (Screenshot 1440) |
| 12 | Statische Fassung ohne Preiszeilen | Preis und Link je Kapitel in den Bildunterschriften | ✔ |

Bestanden laut Prüfer: Vor-/Rückwärtsscrollen in 3 Durchgängen × 29 Messpunkten identisch, Kapitel-Buttons in 4 Viewports, Achse 00–03 ≤ 1 px, keine Doppelkanten, KI-Hinweis sichtbar, Unterseiten ohne Überlauf, CLS 0, keine 404/JS-Fehler.

## Offene Punkte
- Die Filmbilder haben nur 762 px. Auf großen Desktops wirken sie weich. Für scharfe Bilder ab 1440 px braucht es Neurenderings mit mindestens 1920 px.
- Keine echte 3D-Sequenz (Tür, Kamerafahrt, Pad, Applikator). Das Blender-Paket enthält nur ein Konzeptauto, kein Porsche-Modell mit Innenraum.
- Das Porsche-Wappen ist auf den KI-Bildern sichtbar. Markenrechtlich prüfen lassen oder Bilder ohne Logo neu erzeugen.
- Rechtstexte (Datenschutz, Cookie, Abo, Widerruf) sind wörtlich übernommen. Die Du/Sie-Mischung und die Inhalte prüft ein Anwalt bzw. Datenschutzberater.
- Bewertungsanzahl (18) vor dem Livegang am Profil prüfen.
- Lighthouse- und Felddaten nach dem Deploy messen.
- 301-Weiterleitungen serverseitig einrichten.

## Nachtest nach Design-Update (23.11.2026)
| Prüfung | 390 × 844 | 360 × 740 | 768 × 1024 | 1440 × 900 |
|---|---|---|---|---|
| H1 sichtbar | ✔ | ✔ | ✔ | ✔ |
| „Leistungen & Preise“ und „Preis per WhatsApp“ ohne Scrollen, nicht unter der Kontaktleiste | ✔ | ✔ | ✔ | ✔ |
| Kapitelwahl im ersten Bildschirm | direkt unter den Buttons (kurzes Scrollen) | ebenso | ebenso | ✔ |
| Kein horizontaler Überlauf | ✔ | ✔ | ✔ | ✔ |
| Schnelle Kapitelwechsel (8, 0, 10, 4, 8 im 120-ms-Takt) enden auf Politur mit passendem Bild und Text | ✔ | ✔ | ✔ | ✔ |

- **Reduzierte Bewegung:** Bei reduzierter Bewegung wird ohne Wischanimation direkt geschnitten ✔.
- **Film abspielen und pausieren:** funktioniert (1440) ✔.
- **Fehlerfreiheit:** keine JS-Fehler, keine 404.
- **`src/check.py`:** keine Befunde.
- **Offline-Fassung (`file://`):** Kapitelwahl funktioniert ✔.
- **Screenshots:** `audit/screenshots/`.

## Nachtest Startseitenfilm v2 (23.11.2026)
- **Zustände geprüft** bei 390 × 844, 768 × 1024 und 1440 × 900 (Bild/Karte):
  - Start und Haltephase: 00 ohne Karte ✔
  - kurz vor dem Schaum: noch ohne Karte ✔
  - Schaum, Sauber: Außenwäsche ✔
  - Seite, Tür: ohne Karte ✔
  - Innen vorher/nachher: Innenraum ✔
  - Politur vorher/nachher: Lackpolitur ✔
  - Keramik, Wasser, Perlen: Keramik ✔
  - Ende: ohne Karte ✔
  - zurück zu Innen: Innenraum ✔
  - zurück zum Start: frei ✔
- **Schnelles Scrollen:** 25 Zufallssprünge, danach Politur mit richtigem Bild und richtiger Karte ✔.
- **Langsames Laden** (Filmbilder um 3 s verzögert): Das Bild bleibt bei 00 ohne Karte, nach dem Laden kommt Politur mit Karte ✔.
- **Reduzierte Bewegung** (390/1440): statischer Einstieg mit Bild, allen vier Karten (Name, Text, Preis, Link) und Standbildern, kein Überlauf ✔.
- **Direkteinstieg und Links:**
  - `/#preise` landet bei 100 px ✔
  - „Film überspringen“ führt zum Einstieg ✔
  - „Leistungen & Preise“ führt zu #preise ✔
  - Kartenlinks liefern alle 200 ✔
  - Menü → /leistungen/ ✔
- **Verdeckung:** Keine Karte über Schaum, Auto, Applikator, Tuch, Wasser oder Perlen (Desktop-Sichtprüfung). Mobil stehen die Karten unter dem Bild.
- **Weitere Prüfungen:** Build aus leerem Ordner ✔; `src/check.py` ohne Befunde ✔; /leistungen/ ohne `<img>`, `<picture>`, Bildunterschriften, leere Container und CSS-Hintergrundbilder ✔.
- **Nicht getestet:** echte Geräte und echte Mobilfunkverbindung.

## Nachtest Außenwäsche-Video (24.11.2026)
- **ffprobe 1920×1080:** h264 High, yuv420p, 30/1, 399 Bilder, 13,3 s, 2.201.486 Byte, `moov` vor `mdat` (faststart) ✔. Die Mobil- und WebM-Fassungen sind geprüft.
- **Einzelbilder:** 10 aus dem fertigen MP4 extrahiert und angesehen (`audit/video-frames/`). Halle stabil, Phasen erkennbar.
  - Befund 1: In der ersten Fassung wirkten die Schaumausläufer wie dünne weiße Streifen. Kante weicher und breiter gemacht, neu gerendert, erneut geprüft.
  - Befund 2: Die Hochrechnung ist in der Vollansicht sichtbar weich (Detailausschnitt 6,6 s).
- **Website** bei 390 × 844, 768 × 1024, 1440 × 900 und 1920 × 1080:
  - Video spielt (Handy-Quelle bei 390/768, Desktop-Quelle bei 1440/1920).
  - Das Video liegt unter der Navigation und ist ganz sichtbar, die Steuerleiste ist sichtbar.
  - Sprung „Abspülen“ → 5,8 s ✔; Pause und Weiter ✔.
  - Download 200, `video/mp4`, 2,2 MB ✔.
  - Reduzierte Bewegung: pausiert, Handy-Poster, Button „Abspielen“ ✔.
  - Browser vor und zurück ✔.
- **Hinweis zum Springen:** Das braucht HTTP-Range. Python `http.server` kann das nicht, getestet wurde mit `src/video/testserver.py` (Aufruf: `python3 src/video/testserver.py dist 8080`). Übliche Webserver können Range.
- **Alle 31 Seiten** bei 390 und 768 px:
  - kein Überlauf
  - kein Fließtext unter 16 px
  - Tippflächen ≥ 40 px (außer Fließtext-Links)
  - keine abgeschnittenen Überschriften
- **Alle 31 Seiten** bei 1440 und 1920 px: keine JS-Fehler, keine Konsolenfehler, keine 4xx/5xx, kein Überlauf ✔.
- **Nicht getestet:** echte iPhone/Android-Geräte, Safari, langsame Mobilfunkverbindung.

## Nachtest Außenwäsche als Scroll-Effekt (24.11.2026)
Playwright mit Chromium, WebGL über SwiftShader.

| Prüfung | Ergebnis |
|---|---|
| 390 × 844, 768 × 1024, 1440 × 900, 1920 × 1080: Phasen bei 0/20/30/45/55/70/85/100 % der Strecke | Vorher → Schaumvorwäsche → Abspülen → Trocknen → Sauber, passend zur Position |
| Zurückscrollen an den Anfang | wieder „Vorher“ (verschmutzt) |
| Schnelles Hin- und Herscrollen (30 Mausrad-Stöße), danach Sprung nach oben | kein Hängenbleiben. Die Nachlaufglättung ist zeitbasiert, bei 60 fps ca. 0,3 s, in der Testumgebung mit 17 fps 0,5–1 s |
| Langsames Netz (Bilder 2,5 s verzögert) | Bühne steht dunkel, das Bild erscheint nach dem Laden, keine Fehler |
| Ohne WebGL | 2D-Überblendung, Fortschritt korrekt |
| Offline-Fassung (`file://`, Doppelklick) | WebGL verweigert fremde Bilder, deshalb 2D-Überblendung, läuft |
| Reduzierte Bewegung | keine Scrollstrecke, sauberes Standbild |
| Ohne JavaScript | sauberes Standbild, KI-Hinweis darunter, Seite normal |
| Übertragung | Desktop 0,87 MB, Handy 0,67 MB (zuvor Video 2,1 MB bzw. 1,2 MB, eine Bildfolge wären 20 MB) |
| Bedienelemente | keine. Kein Video, kein Download, keine Buttons. Die Phasenanzeige ist ohne Funktion und `aria-hidden` |
| Alle 28 Seiten der Sitemap × 4 Breiten | kein horizontaler Überlauf, keine JS-Fehler |
| `src/check.py` | keine Befunde |

Screenshots: `audit/screenshots/scroll-waesche-1440.jpg`, `scroll-waesche-390.jpg`, `scroll-waesche-mobil-tablet.jpg`.
Nicht geprüft: echte Geräte (iPhone Safari, Android Chrome). Prüfen lassen, ob die Adressleiste beim Scrollen (svh) ruckelt.
