# Statusführung

## Zweck

Jede Sitzung kann an einer anderen Stelle beginnen. Die Statusdatei ist die
einzige Quelle dafür, wo ein Projekt steht.

## Datei

`amazon-kdp-business/data/status.md`

## Eintrag je Buch

```
## {{Reihe}} / Band {{n}} — {{Arbeitstitel}}

Aktuelle Stufe:            {{1-8}} — {{Name}}
Letzte abgeschlossene:     {{n}} am {{JJJJ-MM-TT}}
Ergebnis der letzten Stufe: {{2-3 Sätze}}
Artefakte:
  - {{Pfad}}
  - {{Pfad}}
Torbedingung erfüllt:      ja / nein — {{welche}}
Nächster Schritt:          {{konkret, eine Handlung}}
Blockiert durch:           {{Nutzerfreigabe für X / fehlende Daten / keine}}
Offene Fragen an Nutzer:   {{Liste oder "keine"}}
Aktualisiert:              {{JJJJ-MM-TT}}
```

## Regeln

1. **Nach jeder Stufe schreiben** — nicht am Ende der Sitzung, nicht gesammelt.
2. **Vor jeder Stufe lesen** — nie aus dem Gedächtnis fortsetzen.
3. **Nur belegte Ergebnisse** eintragen. Kein „vermutlich fertig".
4. **Blockaden ausdrücklich** notieren, mit der genauen ausstehenden Freigabe.
5. **Nicht überschreiben**, sondern fortschreiben. Verlauf bleibt lesbar.

## Protokoll

`amazon-kdp-business/data/protokoll.md` — eine Zeile je Ereignis:

```
| Datum | Reihe/Band | Stufe | Ereignis | Ergebnis | Artefakt |
```

Aufgenommen werden: Stufenabschlüsse, Torbedingung nicht erfüllt,
Freigabe angefragt, Freigabe erteilt, Freigabe verweigert, Abbruch mit Grund.

## Wiederaufnahme

1. `status.md` lesen
2. Genannte Artefakte auf Existenz prüfen
3. Torbedingung der letzten Stufe erneut prüfen — nicht dem Eintrag vertrauen,
   wenn die Datei fehlt
4. Bei Widerspruch zwischen Eintrag und Dateilage: der Dateilage folgen und
   den Eintrag korrigieren
5. Offene Fragen und ausstehende Freigaben dem Nutzer erneut vorlegen

## Mehrere Bücher

Ein Abschnitt je Buch. Der Orchestrator bearbeitet **ein** Buch zur Zeit.
Parallele Stapelproduktion ist ausgeschlossen — sie ist der schnellste Weg zu
inkonsistenten Reihen und zu Qualitätsproblemen, die erst der Kunde bemerkt.
