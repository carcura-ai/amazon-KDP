# 30-Tage-Test: Faceless-Kanal „Erstaunliche Fakten“ (Start 25.11.2026)

Eigenes Projekt, **nichts mit Carcura zu tun**. Anlass ist das Reel von herr_tech über MoneyPrinterTurbo (Thema rein, fertiges Kurzvideo raus).

## Ziel und Abbruchregel

Herausfinden, ob ein Kanal mit kurzen deutschen Fakten-Videos in 30 Tagen Reichweite aufbaut, die sich später zu Geld machen lässt. Keine Erwartung von Einnahmen im Testzeitraum.

| Stichtag | Weiter, wenn … | Sonst |
|---|---|---|
| Tag 10 | mindestens 1 Video über 1.000 Aufrufe | Thema-Stil ändern (anderer Hook, andere Fakten-Kategorie) |
| Tag 20 | Durchschnitt über 500 Aufrufe pro Video, erste Abonnenten | Format ändern oder Plattform wechseln |
| Tag 30 | mindestens 1 Video über 10.000 Aufrufe **oder** 300 Abonnenten auf einer Plattform | Projekt beenden und Zeit zurück in Carcura oder Webdesign stecken |

Die Schwellen sind gesetzte Zielwerte, keine Marktdaten.

## Ehrliche Einordnung

- **Geld kommt spät:** YouTube schaltet Shorts-Werbung erst ab 1.000 Abonnenten und 10 Mio. Shorts-Aufrufen in 90 Tagen frei. Die Vergütung pro 1.000 Aufrufe ist bei Shorts sehr niedrig. Einnahmen im Testmonat sind unrealistisch.
- **YouTube streicht Geld für Massenware:** Inhalte, die gleichförmig oder wiederholt wirken, sind von der Monetarisierung ausgeschlossen. Deshalb gilt: jede Folge eigene Animation, eigenes Skript, eigener Hook, keine Vorlage, die 30-mal gleich aussieht.
- **Stark umkämpft:** Fakten-Kanäle gibt es viele. Der Vorteil hier ist die Qualität: animierte Grafiken statt Stockvideo-Zusammenschnitt, saubere Stimme, wahre Fakten.

## Regeln

1. **Nur geprüfte Fakten.** Jede Zahl wird gegen eine verlässliche Quelle geprüft (NASA, Wikipedia mit Beleg, Fachquelle). Die Quelle steht in `videos/<nr>/quellen.md`. Keine Gesundheits-, Finanz- oder Politik-Fakten (rechtlich heikel).
2. **KI-Kennzeichnung:** Die Stimme ist KI. Auf YouTube „Veränderte oder synthetische Inhalte“, auf TikTok „KI-generiert“, auf Instagram „KI-Info“ aktivieren.
3. **Nur eigene oder freie Inhalte:** Animation aus Code, Musik selbst erzeugt, Stockmaterial nur von Pexels/Pixabay (kommerziell frei). Keine Filmausschnitte, keine Musik aus Charts.
4. **Eigene Konten:** neuer YouTube-Kanal, neues TikTok- und Instagram-Konto. Nicht das Carcura-Profil.

## Tagesablauf (Ziel: unter 15 Min. für Alex)

1. Claude: Fakt auswählen und prüfen, Skript schreiben, Stimme, Animation, Musik, Video rendern (9:16, ca. 20–30 s). Dazu Titel, Beschreibung und Hashtags je Plattform.
2. Alex: Video ansehen, Freigabe, auf YouTube Shorts, TikTok und Instagram Reels hochladen (KI-Kennzeichen setzen).
3. Alle 3 Tage: Aufrufe, Zuschauerbindung und Abonnenten in `zahlen.md` eintragen. Claude wertet aus und passt Hooks und Themen an.

## Werkzeuge

- **Eigene Pipeline** (wie bei den Carcura-Reels): Animation als Code (Canvas, Playwright), Stimme „Kumpel“ (Qwen3-TTS, Apache-2.0), Untertitel aus Wortzeiten, Musik selbst erzeugt.
- **MoneyPrinterTurbo** (MIT-Lizenz, geprüft 25.11.: Code von GitHub harry0703, Stand 24.11.2026) nur als Option für Stockvideo-Folgen. Braucht einen kostenlosen **Pexels-API-Schlüssel**. Einen LLM-Schlüssel braucht es nicht, weil Claude die Skripte schreibt. Der Schlüssel kommt als Geheimnis in die Umgebungseinstellungen, **nicht in den Chat**.

## Themenvorrat (je Video ein Fakt, alle vor Produktion prüfen)

Weltraum: Venus-Tag länger als Venus-Jahr · Neutronenstern-Löffel · Sonnenlicht ist 8 Minuten alt
Tiere: Oktopus hat drei Herzen · Kühe haben beste Freunde (vorsichtig belegen) · Wombat-Würfelkot
Körper: Magen erneuert Schleimhaut alle paar Tage (kein Gesundheitsrat) · Knochen stärker als Beton bei gleichem Gewicht
Geschichte: Kleopatra lebte näher an der Mondlandung als am Bau der Cheops-Pyramide · Oxford ist älter als die Azteken
Technik: Erste Webcam überwachte eine Kaffeemaschine · Die Apollo-11-Computer hatten weniger Rechenleistung als ein Taschenrechner

## Stand

| Tag | Datum | Video | Status |
|---|---|---|---|
| 1 | 25.11. | 001 Venus: Ein Tag ist länger als ein Jahr | fertig (22 s), wartet auf Upload |
