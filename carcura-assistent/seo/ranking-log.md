# Carcura – wöchentlicher Ranking-Log (Ziel: Top 3 im Umkreis 30–40 km um Walterschen)

Quelle: Google Search Console (NotFair), Google-Unternehmensprofil (Windsor). Positionen = Durchschnitt.

## Basis 02.11.2026 (Zeitraum 01.09.–31.10.2026)

| Suchbegriff | beste URL | Position | Impr. |
|---|---|---|---|
| carcura | / | 3,2 | 267 |
| fahrzeugaufbereitung westerwald | / | 17,6 | 37 |
| autoaufbereitung westerwald | / | 20,6 | 31 |
| keramikversiegelung westerwald | /keramikversiegelung/ | 3,8 | 9 |
| autoaufbereitung altenkirchen | / | 1,8 | 5 |
| keramikversiegelung bad marienberg | /keramikversiegelung/ | 42,7 | 15 |
| fuhrparkpflege | /firmenkunde/ | 17,5 | 12 |
| „… in der nähe“-Suchen | / | 1–4 | – |

Oktober gesamt: 67 Klicks / 721 Impressionen (Sep 26/376, Aug 29/410).
GBP Oktober: 30 Website-Klicks, 60 Routen, 4,8 ★ (16).

### Maßnahmen 02.11.
- Neue Ortsseiten: /fahrzeugaufbereitung-hachenburg/ (24 km), -asbach/ (16 km), -wissen/ (25 km), -neuwied/ (36 km). Distanzen per OSRM gemessen.
- Interne Links: Startseite → Westerwald + Altenkirchen; Leistungen → Westerwald + Altenkirchen; Altenkirchen & Westerwald → neue Ortsseiten.
- Rank-Math-Titel /leistungen/: „Autoaufbereitung Westerwald: Preisliste ab 90 € | Carcura“.
- GBP: Teamfoto + Teambeitrag, Beitrag Woche 1 (Innenreinigung).
- Google Ads: 4 Ausschlusswörter (bad honnef, mülheim kärlich, king, unterbodenwäsche).

Beobachtung: Für „westerwald“-Suchen konkurrieren Startseite, /leistungen/ und Unterseiten (Kannibalisierung).
Die Westerwald-Seite selbst wird kaum gezeigt (Pos. 36). Prüfen, ob die neuen internen Links das ändern.

## Maßnahmen 06.11.2026 (SEO-Neubewertung nach Reel-Playbook)

- Schema: Service + FAQPage + BreadcrumbList auf /autositz-reinigen-flecken/ (1335) und /tierhaare-auto-entfernen/ (1334); FAQ-Text = sichtbarer Text.
- Rank-Math-Titel auf ≤ 60 Zeichen gekürzt, meist nur Zusatz/Marke gestrichen, Hauptbegriff vorn unverändert:
  Startseite (11) „Fahrzeugaufbereitung Westerwald mit Abholung | Carcura“, Flecken 1335, Geruch 1116, Keramik 777
  („Keramikversiegelung Westerwald ab 700 € inkl. Pflegeset“), Politur 1113, Leasing 1114, Wohnmobil 1115,
  Hol-&-Bring 843, Altenkirchen 1117, Wissen 1261, Gutschein 781.
- Beschreibungen auf 139–155 Zeichen gekürzt (gleiche Preise/Fakten): 11, 311, 382, 1334, 1335, 1116, 1113, 1114, 1115, 843, 1048, 1117, 1259, 134, 781.
- Nicht geändert: /leistungen/-Titel (seit 02.11. in Messung), Westerwald-Seite 1048 (Entscheidung nach GSC-Daten, s. u.).

Technische Funde:
- page-sitemap.xml veraltet (Stand 20.10.): 14 URLs, es fehlen 13 Leistungs- und Ortsseiten (Geruch, Politur, Leasing, Wohnmobil,
  Hol-&-Bring, Westerwald, Altenkirchen, Hachenburg, Asbach, Wissen, Neuwied, Flecken, Tierhaare). Ursache: Rank-Math-Sitemap-Cache.
- Plesk-nginx-Cache liefert Seiten verzögert aus (x-cache-status HIT); Änderungen erst nach Ablauf sichtbar.
- Doppelter <title> im <head> (Rank Math + Theme), gleicher Inhalt – geringe Wirkung, später beheben.
- robots.txt ohne Sitemap-Zeile; llms.txt noch 404.

Offene Entscheidung (am 15.11. mit GSC-Daten): Startseite und 1048 zielen beide auf „Fahrzeugaufbereitung Westerwald“
(Startseite Pos. 17,6; 1048 Pos. ~36). Steht 1048 weiter > 30 und die Startseite nicht besser: 1048 per 301 auf die Startseite
umleiten und Links Startseite → 1048 auf die Ortsseiten umstellen.

## Woche 09.11.2026
- Search Console: keine Daten, das NotFair-Kontingent ist bis 15.11. erschöpft. Positionsvergleich deshalb erst am 16.11.
- GBP: 1 neue Bewertung (04.11., 5 ★, Audi TT 8n, Politur + Keramik), noch unbeantwortet.
- GBP-Beitrag Woche 2 veröffentlicht: Keramik vor dem Winter, Foto Audi TT, Link /keramikversiegelung/ mit UTM gbp_post_w2.
- Maßnahmen diese Woche (Details im Masterplan, Abschnitt 9):
  - Texte auf allen Hauptseiten gekürzt; Titel, H1, FAQ und Schema blieben unverändert
  - Schema-Preise korrigiert (Wohnmobil 800, Basic 145), 17 Bewertungen auf den Ortsseiten
  - neue Fotos eingebaut, WP Consent API aktiv (GA4 zählt wieder)
