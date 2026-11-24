# Carcura: Sichtbarkeit in Google und KI-Suchen (Prüfung 24.11.2026)

Anlass: Reel von titusharmann („Skill prüft, wie Googles KI deine Firma sieht“). Den Skill gibt es nur per Kommentar, daher hier dieselbe Prüfung von Hand.
**Nichts live geändert.** Alle Texte unten sind Entwürfe. Freigabe durch Alex, Einbau über die Website-Session.

## Ergebnis in einem Satz

Die Website ist inhaltlich stark. Außerhalb der eigenen Website gibt es Carcura für Suchmaschinen und KI aber kaum. Und genau von dort holt sich eine KI ihr Urteil darüber, wer „der Gute in der Nähe“ ist.

## Was gut ist (nicht anfassen)

- 26 Seiten, sauber per Sitemap gemeldet. `robots.txt` sperrt niemanden aus, auch keine KI-Crawler.
- Fast jede Leistungs- und Ortsseite hat echte Fragen und Antworten mit strukturierten Daten (FAQPage), dazu Preise (Offer) und Einzugsgebiet (City/AdministrativeArea).
- Ortsseiten für Altenkirchen, Hachenburg, Neuwied, Wissen und Asbach, jeweils mit Abholkosten. Genau das fragen Kunden eine KI.
- Klare Preise im Seitentitel und in der Beschreibung („Keramik ab 700 €“). Das lesen KI-Antworten direkt aus.

## Lücken, nach Wirkung sortiert

| # | Lücke | Warum es zählt | Aufwand |
|---|---|---|---|
| 1 | **Zu wenige Bewertungen:** 17 bzw. 18 bei Google. Andere Aufbereiter in Portalen haben 64 bis 126. | Bewertungszahl und Antworten auf Bewertungen sind das stärkste Signal für Karte und KI-Empfehlung. | laufend, 2 Min. pro Auftrag |
| 2 | **Kaum Einträge außerhalb der eigenen Website.** In der Websuche fanden sich keine Treffer auf Branchenportalen. | Eine KI vergleicht mehrere Quellen. Stehen Name, Adresse und Telefon nur auf der eigenen Seite, gilt die Firma als schwach belegt. | einmalig 2–3 Std. |
| 3 | **Zwei Firmen-Einträge in den Daten der Startseite** (einmal „LocalBusiness“ nur mit Facebook, einmal „AutomotiveBusiness“ mit Instagram, TikTok, Maps). | Für eine Maschine sind das zwei verschiedene Firmen. Besser ist ein einziger Eintrag mit allen Profilen. | 15 Min. (Website-Session) |
| 4 | **Bewertungszahl widersprüchlich:** Startseite „18“, Westerwald-Seite „4,8 ★ aus 17“. | Widersprüche senken das Vertrauen, auch bei Menschen. | 5 Min. |
| 5 | **Keramikseite nennt keinen Ort außer Walterschen** („Altenkirchen“ fehlt im Text). | Suchanfrage „Keramikversiegelung Altenkirchen“ bzw. „… Westerwald“ | 5 Min. |
| 6 | **Gutscheinseite ohne Ortsbezug** und ohne Frage zu Weihnachten, obwohl gerade Saison ist. | „Geschenk für Autoliebhaber Westerwald“ wird jetzt gesucht. | 10 Min. |
| 7 | Seiten ohne strukturierte Daten: Spezialreinigung, Galerie, Partner. | gering | 15 Min. |
| 8 | Keine `llms.txt` (Kurzbeschreibung für KI). | Nutzen unsicher, schadet nicht | 5 Min. |

Grenzen der Prüfung: Ich konnte die Google-KI-Antworten (AI Overviews) nicht selbst abrufen, und mein Suchwerkzeug ist nicht Google. Das Google-Unternehmensprofil habe ich nicht von innen gesehen.

## Entwürfe

### 1. Bewertungen: WhatsApp nach jedem Auftrag (Alex/Richy schicken selbst)

> Hi [Name], danke dir, dass du uns dein Auto anvertraut hast! Wenn du zufrieden bist, hilft uns eine kurze Google-Bewertung enorm. Wir sind ein kleiner Betrieb, und jede Bewertung bringt uns neue Kunden aus der Region: [Bewertungslink]
> Und falls etwas nicht gepasst hat, schreib uns direkt, dann kümmern wir uns.

- Den Bewertungslink gibt es im Google-Unternehmensprofil unter „Bewertungen anfordern“.
- Nicht erlaubt: Bewertungen gegen Rabatt oder Geschenk, Bewertungen von Freunden ohne Auftrag. Das verstößt gegen die Google-Richtlinien und ist wettbewerbsrechtlich angreifbar.
- Auf **jede** Bewertung antworten, auch kurz. Der Skill `local-seo-manager` schreibt die Antworten als Entwurf.
- Ziel: 40 Bewertungen bis Ende Februar.

### 2. Einträge anlegen (einmal, überall exakt gleich schreiben)

**Carcura GbR – Fahrzeugaufbereitung** · Hauptstr. 7, 57632 Walterschen · +49 170 6669516 · https://carcura.info
Kategorie: Fahrzeugaufbereitung / Autopflege

Reihenfolge nach Wirkung: Bing Places, Apple Business Connect (Apple Karten und Siri), Das Örtliche und Gelbe Seiten, 11880, Cylex, golocal, werkenntdenbesten. Alle kostenlos in der Grundversion. Bezahl-Upgrades nicht nötig.

### 3. Strukturierte Daten Startseite (für die Website-Session)

Die beiden Firmen-Einträge zu **einem** `AutomotiveBusiness` zusammenführen. `sameAs` mit Facebook, Instagram, TikTok und Google Maps (cid=13912678674450594421) in einer Liste. Den zweiten Eintrag (`LocalBusiness`/`Organization` nur mit Facebook) entfernen.

### 4. Keramikseite: ein Satz mit Ort (zum Beispiel unter der Hauptüberschrift)

> Keramikversiegelung in unserer Halle in Walterschen, direkt bei Altenkirchen – für Kunden aus dem ganzen Westerwald, auf Wunsch mit Hol- und Bringservice.

### 5. Gutscheinseite: neue Frage im FAQ-Block

**Frage:** Ist ein Carcura-Gutschein ein gutes Weihnachtsgeschenk?
**Antwort:** Ja, gerade für Menschen, die ihr Auto lieben und eigentlich schon alles haben. Du kannst eine Leistung verschenken, zum Beispiel eine Innenreinigung ab 90 € oder eine Keramikversiegelung ab 700 €, oder einen Wunschbetrag. Eingelöst wird bei uns in Walterschen bei Altenkirchen, auf Wunsch holen wir das Auto ab. Schreib uns einfach per WhatsApp, wir schicken dir den Gutschein zu.

(Die Gültigkeitsdauer ist nicht genannt, weil sie auf der Seite bewusst entfernt wurde. Gesetzlich gelten bei uns drei Jahre zum Jahresende.)

### 6. `llms.txt` (Datei im Hauptverzeichnis, optional)

```
# Carcura – Fahrzeugaufbereitung im Westerwald

> Inhabergeführte Fahrzeugaufbereitung (Carcura GbR, Alexander Fuchs und Richy Schumacher) in eigener Halle in Walterschen bei Altenkirchen. Alles von Hand, fester Preis nach Fotos vorab, Hol- und Bringservice (bis 10 km kostenlos).

- Adresse: Hauptstr. 7, 57632 Walterschen · Telefon/WhatsApp: +49 170 6669516
- Einzugsgebiet: Altenkirchen, Hachenburg, Neuwied, Wissen, Betzdorf, Asbach, Weyerbusch, Flammersfeld, Eitorf, Hennef
- Öffnungszeiten: Mo–Do 17–22 Uhr, Fr 14–21 Uhr, Sa 8–20 Uhr

## Leistungen und Preise
- [Keramikversiegelung](https://carcura.info/keramikversiegelung/): ab 700 € inkl. Handwäsche, Kneten, Politur und Pflegeset
- [Autopolitur](https://carcura.info/autopolitur/): ab 349 €, Lackkorrektur ab 549 €
- [Auto-Innenreinigung](https://carcura.info/auto-innenreinigung/): ab 90 €
- [Scheinwerfer aufbereiten](https://carcura.info/scheinwerfer-aufbereiten/): 69 € für beide
- [Geruch entfernen (Ozon)](https://carcura.info/geruch-im-auto-entfernen/): ab 59 €
- [Wohnmobil-Aufbereitung](https://carcura.info/wohnmobil-aufbereitung/): ab 245 €
- [Alle Preise](https://carcura.info/leistungen/) · [Gutschein](https://carcura.info/gutschein/) · [Anfrage](https://carcura.info/anfragen/)
```

Vor dem Einbau Preise und Zeiten gegen `docs/WEBSITE-REBUILD-MASTERPLAN.md` §4 prüfen.

## Reihenfolge

1. **Jetzt (Alex):** Bewertungslink holen, WhatsApp-Text ab sofort nach jedem Auftrag schicken.
2. **Diese Woche (Alex, 2–3 Std.):** Bing Places und Apple Business Connect anlegen, danach die Verzeichnisse.
3. **Website-Session, nach Freigabe:** Punkte 3 bis 6.
4. **In 4 Wochen:** erneut prüfen (Bewertungszahl, Einträge, Suchtreffer).
