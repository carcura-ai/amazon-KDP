# Search Console: Suchbegriffe ohne passende Seite (Auswertung 24.11.2026)

Methode wie im Reel von edward.builds bzw. Hridoy Reh: Search Console, Leistung, 12 Monate (20.11.2025–22.11.2026), Suchbegriff × Seite. Frage: „Für welche Begriffe erscheint carcura.info, hat aber keine passende Seite?“
Daten direkt aus der Search-Console-Schnittstelle, ohne CSV-Umweg. **Nichts live geändert.**

## Ausgangslage

- **151 Klicks, 2.670 Einblendungen** in 12 Monaten, Durchschnittsposition 10,4.
- **72 der 151 Klicks kommen über „carcura“**, also von Leuten, die euch schon kennen. Über Suchen nach Leistungen kommen bisher nur einzelne Klicks.
- Die Website ist erst seit dem Umbau Anfang November so stark. Viele Seiten sammeln noch Daten. Die Zahlen sind klein, die Richtung ist trotzdem klar.

## Die Lücken, nach Wirkung sortiert

| # | Suchbegriff(e) | Einbl. | Position | Problem | Maßnahme |
|---|---|---|---|---|---|
| 1 | fahrzeugaufbereitung westerwald · autoaufbereitung westerwald | 242 | 25–27 | Der wichtigste Begriff. 9 eigene Seiten konkurrieren darum, keine steht vorn. Die Westerwald-Seite liegt bei 31–45. | Eine Seite bündeln: interne Links mit dem Wort „Fahrzeugaufbereitung Westerwald“ von allen Seiten auf /fahrzeugaufbereitung-westerwald/. Startseite bleibt für „carcura“. |
| 2 | keramikversiegelung westerwald | 65 | 15–48 | 6 Seiten konkurrieren, die Keramikseite steht bei 15 | Interne Links „Keramikversiegelung im Westerwald“ auf /keramikversiegelung/. Der Begriff gehört in deren Seitentitel (steht schon drin) und in die H2. |
| 3 | **/https-carcura-info-leistungen/** (Fehlseite) | 89 | 21–48 | Eine doppelte Preisseite mit kaputter Adresse wird von Google angezeigt und nimmt /leistungen/ Gewicht weg | **301-Weiterleitung auf /leistungen/** (Rank Math → Weiterleitungen). Kleinster Aufwand, sofortige Wirkung. |
| 4 | keramikversiegelung bad marienberg | 33 | 35 | Keine Seite nennt Bad Marienberg | Bad Marienberg auf der Hachenburg-Seite mit aufnehmen (8 km auseinander), keine eigene dünne Seite. Text unten. |
| 5 | fahrzeugaufbereitung / autoaufbereitung waldbröl | 18 | 6–7 | Keine Waldbröl-Seite. Die Startseite rankt trotzdem schon auf 6 bis 7, die Nachfrage ist also da. | Neue Ortsseite /fahrzeugaufbereitung-waldbroel/ nach dem Muster der anderen Ortsseiten. Entwurf unten. |
| 6 | was kostet (eine) scheinwerfer aufbereitung · scheinwerfer polieren kosten/preis · scheinwerferaufbereitung kosten | 59 | 8–18 | Die Seite gibt es, aber keine Antwort auf genau diese Frage im Wortlaut | Neuer Abschnitt „Was kostet Scheinwerfer aufbereiten?“ als H2 plus FAQ. Entwurf unten. |
| 7 | fuhrparkpflege · firmenfahrzeugpflege | 14 | 17–40 | /firmenkunde/ erwähnt das Wort, erklärt es aber nicht | Abschnitt „Fuhrparkpflege im Westerwald“ auf /firmenkunde/. Entwurf unten. |
| 8 | verwitterte scheinwerfer polieren · scheinwerfer uv schutz | 17 | 29–52 | Wird auf der Scheinwerferseite kaum genannt | In den Abschnitt aus Nr. 6 einarbeiten. |
| 9 | wohnmobil aufbereitung · wohnmobilaufbereitung | 6 | 50–59 | Seite steht schlecht | Später. Erst prüfen, ob die Seite intern verlinkt ist. |
| 10 | schimmel im auto professionell entfernen | 4 | 65 | /spezialreinigung-auto/ hat keine strukturierten Daten | Später: FAQPage und Service ergänzen. |

**Bewusst ignoriert:** Altenburg, Waltershausen, Lichtenwald, Frechen, Baumholder (Verwechslungen), „waschkraft westerwald“ (Mitbewerber), Koblenz (23 Einbl., Position 52, zu weit weg), „care by acura“ (Automarke).

**Technisch, für die Website-Session:** Folgende Adressen tauchen bei Google auf: `/?kubio_recommend_page=108`, `/firmenkunde-werden/`, `/kuendigen/`, `/cookie-richtlinie-eu/`. Prüfen, ob die indexiert sein sollen. Die Adressen mit `rwg_token` (Reservierung über Google) brauchen ein Canonical auf /anfragen/.

## Entwürfe

### Nr. 4: Ergänzung Hachenburg-Seite (Bad Marienberg)

Seitentitel neu: **Fahrzeugaufbereitung Hachenburg & Bad Marienberg | Carcura**
Absatz unter der Einleitung:

> Auch aus Bad Marienberg, Nistertal und Umgebung holen wir dein Auto ab. Ob Keramikversiegelung, Politur oder Innenreinigung: Wir machen alles von Hand in unserer Halle in Walterschen und bringen dir das Auto aufbereitet zurück.

Neue FAQ: **Macht ihr auch Keramikversiegelung für Bad Marienberg?** – Ja. Die Keramikversiegelung kostet ab 700 €, mit Handwäsche, Kneten, Politur und Pflegeset. Wir holen dein Auto in Bad Marienberg ab; die Kosten für die Abholung nennen wir dir vorher. [Abholkosten nach Entfernung ergänzen: bis 10 km kostenlos, darüber 2 € pro km]

### Nr. 5: Neue Seite /fahrzeugaufbereitung-waldbroel/

Vorlage: die Wissen-Seite (gleicher Aufbau, gleiche Bausteine). **Vor dem Veröffentlichen die Entfernung Walterschen–Waldbröl und die Abholkosten eintragen. Ich habe sie nicht nachgemessen.**

- **Seitentitel:** Fahrzeugaufbereitung Waldbröl – mit Abholung | Carcura
- **Beschreibung:** Autoaufbereitung für Waldbröl und das Oberbergische: Innenreinigung ab 90 €, Politur ab 349 €, Keramik ab 700 €. Wir holen dein Auto ab.
- **H1:** Fahrzeugaufbereitung für Waldbröl. Wir holen ab.
- **Einleitung:** Du wohnst in Waldbröl, Morsbach oder Nümbrecht und suchst jemanden, der dein Auto richtig sauber macht? Wir sind Carcura, eine kleine Aufbereitung mit eigener Halle in Walterschen, [X] km von Waldbröl. Wir holen dein Auto bei dir ab, bereiten es von Hand auf und bringen es zurück.
- **Leistungen (Karten wie auf den anderen Ortsseiten):** Innenreinigung ab 90 € · Autopolitur ab 349 € · Keramikversiegelung ab 700 € · Scheinwerfer aufbereiten 69 € · Geruch entfernen (Ozon) ab 59 €
- **Abholung:** Bis 10 km kostenlos, darüber 2 € pro km. Aus Waldbröl sind das ca. [X] €.
- **FAQ:**
  1. *Lohnt sich der Weg von Waldbröl nach Walterschen?* – Du musst ihn nicht fahren: Wir holen ab und bringen zurück. Die Abholung kostet aus Waldbröl ca. [X] €, und den Preis nennen wir dir vorher.
  2. *Was kostet eine Innenreinigung?* – Normal ab 90 €, detailliert ab 150 €. Schick uns Fotos per WhatsApp, dann bekommst du einen festen Preis.
  3. *Wie lange ist mein Auto weg?* – [aus der Wissen-Seite übernehmen]
- **Strukturierte Daten:** wie die anderen Ortsseiten (Service, FAQPage, BreadcrumbList, City „Waldbröl“).
- **Interne Links:** von /hol-und-bringservice/ und der Westerwald-Seite auf die neue Seite.

### Nr. 6: Abschnitt auf /scheinwerfer-aufbereiten/

**H2: Was kostet es, Scheinwerfer aufbereiten zu lassen?**

> Bei uns kostet die Aufbereitung **69 € für beide Scheinwerfer**, inklusive UV-Schutzversiegelung. Das ist ein Festpreis, egal wie stark die Scheinwerfer vergilbt oder verwittert sind.
>
> Warum die UV-Versiegelung wichtig ist: Verwitterte Scheinwerfer sind matt, weil die Sonne die Schutzschicht des Kunststoffs zerstört hat. Wer nur poliert, hat nach ein paar Monaten wieder trübe Scheinwerfer. Deshalb versiegeln wir nach dem Polieren mit UV-Schutz.

FAQ neu:
- *Was kostet Scheinwerfer polieren?* – 69 € für beide, mit UV-Schutzversiegelung.
- *Kann man verwitterte Scheinwerfer noch polieren?* – Meistens ja. Schick uns ein Foto per WhatsApp, dann sagen wir dir ehrlich, ob Polieren reicht.

(Die 69 € stammen aus Seitentitel und Beschreibung der Scheinwerferseite. Vor dem Einbau gegen Masterplan §4 prüfen.)

### Nr. 7: Abschnitt auf /firmenkunde/

**H2: Fuhrparkpflege im Westerwald**

> Ihr habt mehrere Firmenwagen, Transporter oder Vorführwagen? Wir übernehmen die regelmäßige Pflege: innen und außen, nach festem Rhythmus oder auf Abruf. Wir holen die Fahrzeuge vom Hof und bringen sie sauber zurück, ohne dass bei euch jemand fahren muss. Die Konditionen richten sich nach der Zahl der Fahrzeuge und dem Rhythmus. Ruft an, dann machen wir euch ein Angebot.

## Reihenfolge

1. **Sofort (5 Min., Website-Session):** Nr. 3, die 301-Weiterleitung der Fehlseite.
2. **Diese Woche:** Nr. 6 (Scheinwerfer, steht schon auf Position 8, ist also nah an Seite 1) und Nr. 4 (Bad Marienberg).
3. **Danach:** Nr. 5 (Waldbröl-Seite, sobald die Entfernung eingetragen ist), Nr. 1 und Nr. 2 (interne Verlinkung), Nr. 7.
4. **In 6 Wochen:** dieselbe Auswertung wiederholen und Positionen vergleichen.
