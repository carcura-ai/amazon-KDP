---
name: meta-werbung
description: Schaltet, prüft und korrigiert Carcura-Werbeanzeigen auf Facebook und Instagram (Meta) über Windsor.ai – mit festen Regeln (35 km um Walterschen, Chat- oder Formular-Ziel, Freigabe vor Geldausgabe). Nutzen bei /meta-werbung, „Werbung schalten“, „Anzeige für …“, „Post bewerben“, „Kampagne prüfen“, „wie läuft die Werbung“.
---

# Meta-Werbung für Carcura

## Auftrag vom Nutzer (Kurzform genügt)
`Werbung: <Leistung/Angebot> · <€ pro Tag> · <bis Datum> · <Material>`
Material: Link zu einem Instagram-/Facebook-Post, „Post von heute“ oder ein öffentlicher Bild-/Video-Link.
Fehlt etwas: sinnvoll annehmen (5 €/Tag, 14 Tage, letzter passender Post) und im Vorschlag kennzeichnen.

## Ablauf
1. **Lesen:** `get_connectors` (Konto „Carcura Gbr“, 4466807416930043), laufende Kampagnen und Ergebnisse prüfen. Keine zweite Kampagne zum selben Thema starten.
2. **Vorschlag zeigen**, nichts anlegen: Ziel, Standort, Text (ghost), Überschrift, Button, Budget, Laufzeit, Abbruchregel.
3. **Erst nach „OK Werbung“:** per Windsor `create_campaign` → `create_adset` → `create_ad` (oder `boost_post`), alles **pausiert**.
4. **Aktivieren** nur nach zweitem OK auf die Windsor-Vorschau (confirmation_token). Budget-Erhöhungen genauso.
5. **Nachlesen** und dem Nutzer melden, was live ist. Nach 3–4 Tagen Ergebnis prüfen.

## Feste Regeln (siehe CLAUDE.md „Werbeanzeigen“)
- Standort: 35 km um 50.685111, 7.561778, Wohnort, Standorterweiterung aus. Nie ganz Deutschland.
- Ziel nur: **Instant-Formular (Leads)** oder **Chat (WhatsApp/Messenger) mit Begrüßung und Antippfragen**.
  Nie: Profilbesuche, Interaktionen, Videoaufrufe, Reichweite – die liefern keine Anfragen.
- Button: „Nachricht senden“, „WhatsApp-Nachricht“ oder „Angebot anfordern“, nie „Jetzt buchen“ ohne Buchungsseite.
- Text: Ort, Leistung, echter Ab-Preis aus CARCURA-DATA.json, Frist, Handlungsaufforderung. Kein Festpreisversprechen,
  Kleinunternehmer-Endpreis, Waschset-Wert nicht nennen, KI-Bilder kennzeichnen.
- Platzierungen: Feeds + Instagram Stories. Reels/Marketplace nur als Test.
- Lieber **eine** Dauerkampagne mit wechselnden Anzeigen als viele Kurzkampagnen (jede startet die Lernphase neu).
- Bewertet wird nach Anfragen aus dem Umkreis, nicht nach Klicks oder „Interaktionen“.
- Abbruchregel: 50 € ohne Anfrage → Angebot/Video tauschen, nicht Budget erhöhen.
