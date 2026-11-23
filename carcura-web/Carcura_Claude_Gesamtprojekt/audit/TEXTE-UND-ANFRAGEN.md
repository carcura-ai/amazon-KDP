# Texte und Anfragewege (23.11.2026)

## Haupttexte (vorher → nachher)
| Seite | Vorher (live) | Nachher (Build) | Grund |
|---|---|---|---|
| / H1 | Fahrzeugaufbereitung im Westerwald | Fahrzeugaufbereitung in Walterschen bei Altenkirchen | Standort und Ort mit Daten (Altenkirchen Pos. 1,8) |
| / Einleitung | Von Hand in unserer Halle: innen. Wir holen dein Auto auch ab. | Innenraumreinigung, Handwäsche, Lackpolitur und Keramikversiegelung. Wir bereiten dein Auto in unserer Halle von Hand auf und holen es auf Wunsch bei dir ab. | Alle vier Leistungen im ersten Satz |
| / Title | Fahrzeugaufbereitung Westerwald mit Abholung \| Carcura | Fahrzeugaufbereitung bei Altenkirchen im Westerwald \| Carcura | Beide belegten Ortsbegriffe |
| /fahrzeugaufbereitung-westerwald/ H1 | Fahrzeugaufbereitung im Westerwald. Von Hand, in Walterschen. | Autoaufbereitung im Westerwald: Orte & Abholung. | Eigene Suchintention statt Dublette der Startseite |
| /scheinwerfer-aufbereiten/ H1 | Scheinwerfer aufbereiten lassen. Wieder klar sehen. | Scheinwerfer aufbereiten. Was kostet das? | ca. 100 Impressionen für Kostenfragen |
| /keramikversiegelung/ Einleitung | … bis zu 5 Jahre Standzeit (laut Hersteller) … Waschset im Wert von fast 100 € | Erst polieren, dann versiegeln, dann aushärten … laut Hersteller bis zu 5 Jahre oder 70.000 km, je nach Pflege und Nutzung | Herstellerbezug klar, keine unbelegte Wertangabe |
| /leistungen/ H1 | Leistungen & Preise der Autoaufbereitung im Westerwald. | Autoaufbereitung: Leistungen & Preise. | kürzer, Preisliste direkt verlinkt (#preise) |
| Alle Leistungsseiten | unterschiedlicher Aufbau | Leistung → Ergebnis → Ab-Preis → CTA → enthalten / nicht enthalten → Grenzen → Ablauf → echter Fall → FAQ | gleiche Entscheidungslogik, unterschiedliche Texte |

Weitere Titel und H1 je Seite: `dist/pages.json`, Quelltexte in `src/build.py`.

## Sprachregeln
- Privatkunden werden geduzt, die Seite Händler & Firmen siezt.
- Kurze Sätze ohne Keyword-Wiederholung.
- Keine Garantien, keine erfundenen Ergebnisse.
- Haltbarkeit nur mit „laut Hersteller“.
- Preise sind Endpreise nach § 19 UStG, nie „inkl. MwSt.“.
- Kein Festpreisversprechen: „Den Endpreis bestätigen wir dir vor dem Termin.“
- Der Porsche-Film ist an drei Stellen als Inszenierung mit KI-Bildern gekennzeichnet: Bildnachweis im Einstieg, Hinweis im Film und Überschrift der statischen Fassung.

## Anfragewege je Leistung
| Seite | Primärer CTA | Zweiter Weg | Dritter Weg |
|---|---|---|---|
| / | Leistungen & Preise (#preise) | WhatsApp mit Text „…Preis anfragen. Mein Fahrzeug: “ | Telefon im Einstieg, Leiste unten (mobil) |
| /auto-innenreinigung/ | /anfragen/?service=innen-normal | WhatsApp „…Preis für Auto-Innenreinigung…“ | Telefon im CTA-Band |
| /autopolitur/ | ?service=politur-1 | WhatsApp „…Autopolitur…“ | Telefon |
| /keramikversiegelung/ | ?service=keramik | WhatsApp „…Keramikversiegelung…“; Aktion: Termin per WhatsApp | Telefon |
| /leasingrueckgabe-aufbereitung/ | ?service=leasing | WhatsApp | Telefon |
| /scheinwerfer-aufbereiten/ | ?service=scheinwerfer | WhatsApp | Telefon |
| /tierhaare-auto-entfernen/ | ?service=innen-normal,tierhaare | WhatsApp | Telefon |
| /geruch-im-auto-entfernen/ | ?service=innen-normal,ozon | WhatsApp | Telefon |
| Ortsseiten | ?service=innen-normal&abholung=1 | WhatsApp „Ich komme aus <Ort>…“ | Telefon |
| /firmenkunde/ | ?service=haendler | Telefon | WhatsApp (Sie-Ansprache) |
| /gutschein/ | WhatsApp je Gutschein | ?service=gutschein | – |

Google-Ads-Kompatibilität: `/anfragen/?leistung=Keramikversiegelung`, `?leistung=1-stufige%20Politur` und `?leistung=Innenraumreinigung%20Normal` wählen die richtige Leistung vor. Getestet am 23.11.2026.

## Formular (/anfragen/) – geprüft bis unmittelbar vor dem Absenden
- Drei Schritte:
  1. Leistung und Fahrzeug
  2. Wunschtag, Zeitfenster und Holservice
  3. Name und Kontaktweg, optional Nachricht
- **Datensatz** wie das Live-Formular: `name, email, phone, vehicle, service, message, customer_type, source=anfrage_formular, channel=web, gclid, website` (Honeypot).
- **Tests mit abgefangenem Endpunkt** (Playwright, Testumgebung, nichts live gesendet):
  - ohne Leistung → Fehlermeldung
  - ohne Telefon und E-Mail → Fehlermeldung
  - HTTP 200 `{"ok":true}` → Erfolgsmeldung („Das ist noch keine Terminbestätigung“) und Formular zurückgesetzt
  - HTTP 500 → Fehlermeldung, Eingaben bleiben, Ersatzwege Telefon, WhatsApp und E-Mail
  - `{"ok":false}` → Fehler
  - lokaler Server ohne Backend (404) → Fehler
- **/kuendigen/:** Feldnamen identisch zum Live-Formular (`cck_*`), Absenden an `/kuendigen/` per POST. Auf anderen Hosts als carcura.info blockiert ein Vorschau-Schutz das Senden.
- **Produktionshinweis:** Der Endpunkt erwartet dieselbe Domain (credentials: same-origin). Der Build funktioniert nur auf carcura.info mit aktivem Plugin für `ccrr/v1/lead`. Ohne Backend zeigt das Formular ehrlich den Fehlerfall mit Ersatzwegen.
