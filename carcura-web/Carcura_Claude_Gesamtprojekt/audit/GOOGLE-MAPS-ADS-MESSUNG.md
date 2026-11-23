# Google-Unternehmensprofil, Google Ads und Messung (23.11.2026)

Keine Live-Konten geändert. Alles hier sind Empfehlungen mit Entscheidungsregeln.

## Unternehmensprofil (Maps)
- **Website-Angaben (B):** Hauptstr. 7, 57632 Walterschen; Telefon +49 170 6669516; Öffnungszeiten Mo–Do 17–22, Fr 14–21, Sa 8–20 Uhr nach Terminabsprache. Impressum, Schema und Footer stimmen im Build überein.
- **Profil selbst:** Nicht geprüft. Die Abfrage brach ab, die öffentliche Maps-Seite ist aus dem Container nicht zuverlässig abrufbar. Ein Verifizierungsstatus wird deshalb **nicht** ausgewiesen.
- **Beleg für Wirkung (B):** Die Search Console zeigt die Profil-URL `/?utm_source=google&utm_medium=organic&utm_campaign=gbp_profil` mit 287 Impressionen und 14 Klicks bei Position 4,8 – nach der Startseite der stärkste Einstieg.
- **Maßnahmen, nach Wirkung sortiert:**
  1. Name, Adresse, Telefon und Öffnungszeiten im Profil exakt wie im Impressum (inklusive „Hauptstr. 7“). Hinweis „Besuch nach Terminabsprache“ in die Beschreibung.
  2. Hauptkategorie „Autoaufbereitung“ prüfen, Zusatzkategorien nur passend (z. B. Autopflegeservice). Leistungen mit denselben Ab-Preisen wie die Website eintragen.
  3. Website-Link auf `/` mit UTM behalten (canonical ist gesetzt). Termin-Link auf `/anfragen/?utm_source=google&utm_medium=organic&utm_campaign=gbp_termin`.
  4. Bewertungsbitte nach jeder Übergabe (keine Anreize, keine gekauften Bewertungen). Danach die Bewertungsanzahl auf der Website aktualisieren (`CARCURA-DATA.json`).
  5. Echte Fotos aus der Halle (die Galerie-Fotos), keine KI-Bilder im Profil.

## Google Ads – Lage (B, 01.–22.11.2026)
| Kampagne | Budget/Tag | Impr. | Klicks | Kosten | Conv. | Anteil an möglichen Impressionen | verloren wegen Budget | verloren wegen Rang |
|---|---|---|---|---|---|---|---|---|
| Walterschen 25km Test Okt26 | 3 € | 1.724 | 20 | 7,64 € | 0 | 29 % | 10 % | 61 % |
| Innenraum & Politur Walterschen 25km | 2 € | 236 | 13 | 10,84 € | 0 | 37 % | 28 % | 34 % |

- **Primäre Conversion-Ziele (B):** Neben cc_anfrage, cc_anruf und cc_whatsapp zählen auch „Local actions – Website visits“, „Other engagements“ und „YouTube channel subscriptions/follow-on views“ als primär. **S:** Damit kann Google auf Besuche statt auf Anfragen optimieren.
- **Suchbegriffe (B):** Viele Informations- oder Fremdabsichten, z. B. „autowäsche in meiner nähe“, „waschstrasse in meiner nähe“, „allzweckreiniger auto innenraum“, „autoreinigungsset innen“, „womit auto innenraum reinigen“.
- **Ziel-URLs (B):** Drei Anzeigen führen auf `/anfragen/?leistung=…`, eine Politur-Anzeige auf `/leistungen/`, eine allgemeine Anzeige auf `/`.

## Google Ads – Empfehlungen
1. **Primäre Ziele bereinigen:** Nur `carcura.info (web) cc_anfrage` (bestätigte Formularannahme) als primär. Anruf und WhatsApp als sekundär, sie zeigen nur Kontaktabsicht. Besuche, Engagements und YouTube aus den primären Zielen nehmen.
2. **Ziel-URLs je Anzeigengruppe:**
   - Keramik → `/keramikversiegelung/`
   - Politur → `/autopolitur/`
   - Innenreinigung → `/auto-innenreinigung/`
   - Allgemein → `/`

   Die Leistungsseiten beantworten Preis und Umfang zuerst und führen mit vorausgewählter Leistung zur Anfrage. Direkt auf `/anfragen/?leistung=…` nur testen, wenn A/B-Daten die höhere Abschlussquote zeigen.
3. **Ausschließende Keywords:** waschstraße, waschanlage, „in meiner nähe geöffnet“, set, kaufen, produkte, reiniger, „womit“, „selber“, „anleitung“, lackierer, lackiererei, „kratzer reparatur“.
4. **Standort:** Ziel „Personen an diesem Ort“ statt „Interesse an diesem Ort“. **Kehrseite:** Pendler, die im Umkreis arbeiten aber außerhalb wohnen, fallen ggf. heraus. 25 km um Walterschen bleibt sinnvoll, weil die Abholung ab 10 km 2 €/km kostet.
5. **Standort-Asset** mit dem Unternehmensprofil verknüpfen (liegt beim Kontoinhaber).
6. **Budget:** **Nicht** auf Basis der Impressionen erhöhen. Regel:
   - Wenn nach mindestens 30 Klicks je Kampagne ≥ 1 qualifizierte Anfrage vorliegt und die Kosten pro qualifizierter Anfrage unter 25 % des durchschnittlichen Auftragswerts liegen, dann das Budget schrittweise um 20 % erhöhen.
   - Wenn nach 50 Klicks 0 qualifizierte Anfragen vorliegen, dann zuerst Suchbegriffe und Landingpage prüfen, nicht das Budget erhöhen.
   - Verlust wegen Rang (34–61 %) zeigt: Gebot und Anzeigenqualität begrenzen stärker als das Budget.

## Messkette
Impression → Klick → **Kontaktabsicht** (WhatsApp- oder Telefon-Klick, getrennt gezählt) → **bestätigte Anfrage** (Endpunkt antwortet 2xx) → **qualifiziert** (passende Leistung, im Einzugsgebiet, realistisch) → **gebucht** → Umsatz.

- **Website:** Der Build sendet `cc_whatsapp`, `cc_anruf` (mit Seite/Leistung) und `cc_anfrage` erst nach bestätigter Serverantwort. Gesendet wird nur, wenn auf der Live-Seite ein Google-Tag nach Einwilligung geladen ist. Der Build lädt selbst kein Tracking.
- **Qualifiziert und gebucht:** Müssen außerhalb der Website erfasst werden. Empfehlung: Lead-Liste (der Endpunkt `ccrr` speichert bereits Leads) um die Felder „qualifiziert ja/nein“, „gebucht ja/nein“, „Umsatz“ und „gclid“ ergänzen und monatlich als Offline-Conversion nach Google Ads importieren.
- **Basisdaten für Vorher/Nachher (4 Wochen vor und nach Livegang):**
  - Search Console: Klicks, Impressionen und Klickrate je URL, Positionen der Begriffe aus KEYWORD-MAPPING.csv.
  - GA4: Sitzungen auf /anfragen/, Formular-Absendungen, WhatsApp- und Telefon-Klicks je Seite.
  - Ads: Klicks, Kosten, Conversions je Kampagne, Anteil an möglichen Impressionen.
  - Leads: Anzahl bestätigt, qualifiziert, gebucht, Umsatz.
- **Benötigte Exporte:** GA4-Ereignisse der letzten 90 Tage, Lead-Liste mit Status, Ads-Suchbegriffe der letzten 90 Tage.
