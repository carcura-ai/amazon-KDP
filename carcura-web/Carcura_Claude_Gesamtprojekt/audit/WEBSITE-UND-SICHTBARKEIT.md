# Website und Sichtbarkeit · Befunde und Umsetzung (23.11.2026)

Kennzeichnung: **B** = Beobachtung (gemessen), **S** = Schlussfolgerung, **H** = Hypothese.

## Datenbasis
- **Live-Abruf** von carcura.info am 23.11.2026 mit curl: robots.txt, Sitemap-Index und 28 URLs geprüft.
  - Alle URLs liefern Status 200. `/abo-bedingungen/`, `/kuendigen/` und `/widerruf/` stehen auf noindex.
  - `/preise/` und `/team/` liefern 404. `/firmenkunde-werden/` und `/https-carcura-info-leistungen/` sind bereits 301-Weiterleitungen.
- **Google Search Console** für https://carcura.info/, Zeitraum 25.08.–22.11.2026 (dataState all): 128 Klicks, 2.359 Impressionen, Durchschnittsposition 10,4.
- **Google Ads** (Konto 919-151-5213), Zeitraum 01.–22.11.2026: 33 Klicks, 18,48 €, 0 Conversions.
- **Nicht verfügbar:** Lighthouse (nicht installiert), Felddaten (CrUX), Daten aus dem Google-Unternehmensprofil (Abfrage brach nach 60 s ab), öffentliche Google-Suchergebnisse und Maps (aus dem Container nicht zuverlässig abrufbar). Suchvolumen und Rankings fremder Anbieter wurden deshalb nicht erhoben und nicht erfunden.

## Befunde nach Wirkung

| Prio | Befund (B/S/H) | URL | Maßnahme im Build |
|---|---|---|---|
| 1 | **B:** Der Großteil der organischen Klicks kommt über den Markennamen („carcura“). Generische Begriffe ranken auf den Positionen 18–64. | / | Einstieg, Title und Preisabschnitt der Startseite neu, Ortsbezug Walterschen/Altenkirchen |
| 1 | **B:** Acht eigene URLs ranken gleichzeitig für „fahrzeugaufbereitung westerwald“/„autoaufbereitung westerwald“ (Kannibalisierung). | /, /fahrzeugaufbereitung-westerwald/, Leistungsseiten | Startseite primär; Westerwald-Seite auf Orte & Abholkosten umgestellt |
| 1 | **B:** Laufende Ads-Anzeigen führen auf `/anfragen/?leistung=…`, die Politur-Anzeige einer Gruppe auf `/leistungen/` statt `/autopolitur/`. | /anfragen/ | Vorauswahl über `?leistung=` bleibt kompatibel; Empfehlung zu Ziel-URLs in GOOGLE-MAPS-ADS-MESSUNG.md |
| 2 | **B:** Rund 100 Impressionen für „was kostet scheinwerfer aufbereitung“ und Varianten, Position 8–18, nur 1 Klick. | /scheinwerfer-aufbereiten/ | Title und H1 mit Kostenfrage, Preis im ersten Satz, Kostenfrage zuerst in den FAQ |
| 2 | **B:** Die Keramikseite steht bei „keramikversiegelung westerwald“ auf Position 15. „keramikversiegelung bad marienberg“ hat 33 Impressionen auf Position 35. | /keramikversiegelung/ | Umfang und Grenzen klar. Keine Ortsseite Bad Marienberg (zu wenig Beleg, Gefahr Massenortsseiten) – Wiedervorlage bei weiter steigenden Impressionen |
| 2 | **B:** Zwei LocalBusiness-Schema-Blöcke mit widersprüchlichem priceRange („55€–600€“, obwohl Keramik 700 € kostet) und unterschiedlicher Region. | alle | Ein `AutomotiveBusiness`-Block aus zentralen Daten |
| 2 | **B:** Ortsseiten nennen Abholkosten, die nicht zur eigenen Formel passen (Asbach 11 statt 12 €, Wissen 31 statt 30 €, Neuwied 51 statt 52 €). | Ortsseiten | Beträge nach Formel berechnet |
| 2 | **B:** Unterschiedliche Bewertungsanzahl (17 auf Unterseiten, 18 auf der Startseite). | mehrere | Ein zentraler Wert mit Datum; vor dem Livegang am Profil prüfen |
| 3 | **B:** `/widerruf/` (live, noindex) und `/impressum/` (in der Live-Sitemap) fehlten im Paket. | /widerruf/, /impressum/ | ergänzt |
| 3 | **B:** In der Cookie-Richtlinie steht die E-Mail-Adresse „carcura@ex.comweb.de“. | /cookie-richtlinie-eu/ | im Build korrigiert; live ebenfalls korrigieren |
| 3 | **B:** In der Search Console tauchen Kubio-Parameter-URLs (`?kubio_recommend_page=108`, 19 Impressionen, heute 404) auf. | / | Nach Theme-Wechsel 301 auf / oder 410; in URL-MAPPING.csv vermerkt |
| 3 | **B:** Die Leistungsseiten nennen den Wert des Waschsets („fast 100 €“) ohne Beleg. | /leistungen/, /keramikversiegelung/, /gutschein/ | Im Build ohne Wertangabe |
| 3 | **H:** Ohne Lighthouse ist die Ladezeit nicht gemessen. Transfergrößen siehe unten. | alle | lazy loading, Fonts WOFF2, Filmbilder erst ab 1.200 px vor dem Film |

## Gemessene Transfergrößen (Build)
- Startseite bis zum ersten Bild: HTML, CSS, Fonts und das Heldbild. Genaue Werte siehe QUALITAETSPRUEFUNG.md.
- 15 Filmbilder zusammen rund 1,0 MB (WebP). Sie werden erst geladen, wenn der Film näher als 1.200 px ist.
- Schriften 267 KB (drei WOFF2-Dateien). Die beiden wichtigsten werden vorgeladen.

## Umgesetzte Änderungen (Auszug)
- Neues Layout aller 31 Seiten mit gemeinsamem CSS und JS, ohne Framework und ohne externe Laufzeit-Ressourcen.
- Preise, Kontakt und Öffnungszeiten stammen nur aus `CARCURA-DATA.json` (zentral änderbar, `python3 src/build.py`).
- Pro Leistungsseite in dieser Reihenfolge: Leistung, Ergebnis, Ab-Preis, CTA, enthalten/nicht enthalten, Grenzen, Ablauf, echter Fall (wo belegt), FAQ mit FAQPage-Schema, verwandte Leistungen, CTA-Band.
- Startseite: Einstieg, Preise, Film mit 15 Zuständen, echte Fälle, Team, Holservice-Rechner, Einzugsgebiet, FAQ.
- Sitemap: nur indexierbare Seiten. robots.txt mit Sitemap-Verweis. Canonicals auf https://carcura.info.

## Offen und vor dem Livegang zu prüfen
- Aktuelle Bewertungsanzahl im Google-Profil.
- Echte Lighthouse- und Felddaten auf dem Produktionsserver.
- 301-Weiterleitungen gemäß `URL-MAPPING.csv` serverseitig einrichten. Die Vorschau nutzt nur Meta-Refresh-Platzhalter.
- Rank Math darf beim späteren WordPress-Theme keine zweiten Meta- und Schema-Angaben ausgeben.
