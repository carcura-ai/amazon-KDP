---
name: kinderbuch-entwickler
description: Entwickelt aus einer validierten Idee ein vollständiges deutschsprachiges Kinderbuchkonzept mit Zielalter, Figuren, Seitenplan je Doppelseite, kindgerechtem Text, Illustration Briefs und einem Reihenkonzept über mindestens drei Bände. Nutzen für Kinderbücher, Lernbücher, Beschäftigungsbücher, Rätselbücher, Arbeitsbücher, Vorlesegeschichten, Buchreihen, Seitenpläne oder Illustrationsbriefings. Setzt eine Freigabe STARTEN des Validators voraus.
---

# Kinderbuch-Entwickler

Macht aus einer freigegebenen Idee ein produzierbares Konzept.

## Voraussetzung

Es muss eine Scorecard mit `ENTSCHEIDUNG: STARTEN` in
`amazon-kdp-business/research/validated/` vorliegen. Fehlt sie: **abbrechen** und
an `kdp-opportunity-validator` verweisen. Kein Konzept auf Zuruf.

## Eiserne Regeln

1. **Keine geschützten Figuren, Marken, Logos oder realen Personen** — weder im Text
   noch in einem Illustration Brief.
2. **Kein Stil, der einen benennbaren lebenden Künstler imitiert.** Stil wird
   beschreibend definiert, nie über einen Künstlernamen.
3. **Fachaussagen kennzeichnen.** Alles Pädagogische, Medizinische, Sicherheits-
   relevante oder Sachliche kommt in die Tabelle „Prüfpflicht durch Menschen".
   Claude liefert Entwürfe und ersetzt **keine** Fachprüfung.
4. **Altersgruppe eng führen.** „3–8 Jahre" ist keine Zielgruppe. Eine Spanne von
   höchstens drei Jahren, und der Inhalt muss sie tatsächlich treffen.
5. **Serie von Anfang an.** Mindestens drei Bände, jeder eigenständig lesbar.
6. **Kein Kaufdruck auf Kinder.** Hinweise auf Folgebände richten sich an Erwachsene.

## Ablauf

1. Scorecard lesen — Zielalter, Lücke, Format, Preisrahmen übernehmen.
2. **Briefing** nach `templates/03-kinderbuch-briefing.md`.
3. **Figuren** entwerfen — Charakterbogen nach `references/figurenentwicklung.md`.
   Danach an `character-consistency` für die Character Bible übergeben.
4. **Seitenplan** je Doppelseite nach `templates/05-seitenplan.md`.
5. **Text** schreiben — Regeln in `references/sprache-und-alter.md`.
6. **Illustration Briefs** je Doppelseite nach `references/illustration-briefs.md`.
7. **Reihenkonzept** über drei Bände.
8. Prüfpflicht-Tabelle ausfüllen.

## Ausgabe

```
amazon-kdp-business/books/series/{{reihe}}/
├── reihenkonzept.md
└── band-{{n}}/
    ├── briefing.md
    ├── seitenplan.md
    ├── manuskript.md
    └── illustration-briefs.md
```

## Erstschwerpunkt der Marke

Deutschsprachige Kinderbuchmarke mit einer **wiederkehrenden eigenen Fuchsfigur**.
Startbereiche: Beschäftigungsbücher für Autofahrt, Reise, Restaurant, Regentag,
Urlaub · Vorschul- und Lernbücher mit eng definierter Altersgruppe ·
Geschichten zu Kindergartenstart, Zahnarzt, Freundschaft, Selbstvertrauen,
Angst und Wut · regionale Abenteuer in Westerwald, Oberbergischem Kreis, Köln.

Die Fuchsfigur ist eine **Eigenentwicklung**. Sie darf keiner bekannten Buch-,
Film- oder Markenfigur ähneln. Prüfung dazu in `character-consistency`.

## Referenzen

| Datei | Wofür |
|---|---|
| `references/sprache-und-alter.md` | Wortschatz, Satzlänge, Fähigkeiten je Altersstufe |
| `references/figurenentwicklung.md` | Charakterbogen, Originalitätsprüfung |
| `references/buchtypen.md` | Aufbau je Buchtyp, Seitenzahlen, Aktivitätsarten |
| `references/illustration-briefs.md` | Aufbau eines Briefs, Verbote |
| `references/reihenkonzept.md` | Bandlogik, Wiedererkennbarkeit |
