---
name: kdp-listing-launch
description: Erstellt nach bestandener Qualitätsprüfung das komplette KDP-Listing mit Titelvarianten, ehrlicher Beschreibung, sieben Keywordfeldern, Kategorien, Preis- und Margenrechnung, Startplan für organische Sichtbarkeit und einem Messplan. Nutzen für Buchbeschreibung, Titel, Untertitel, Keywords, Kategorien, Preisfindung, Buchstart, Launchplan oder Amazon-Ads-Vorschläge. Aktiviert kein Werbebudget und veröffentlicht nichts.
---

# KDP Listing & Launch

Bereitet alles vor, was der Nutzer in KDP einträgt. Trägt selbst nichts ein.

## Voraussetzung

Compliance-Bericht mit `STATUS: READY FOR HUMAN APPROVAL` in
`amazon-kdp-business/reports/compliance/`. Fehlt er: **abbrechen**.

## Gesperrte Aktionen

Diese Aktionen führt der Skill **nie** aus — auch nicht teilweise, auch nicht
vorbereitend mit Konto:

- Buch veröffentlichen, entfernen oder Preis ändern
- KDP- oder Werbekonto verknüpfen, anmelden, Zugangsdaten entgegennehmen
- Werbekampagne anlegen, Budget aktivieren oder erhöhen
- Kostenpflichtige Exemplare bestellen
- Kostenpflichtige Werkzeuge, Schriften, Bilder oder Lizenzen kaufen

Er liefert **Vorschläge und Rechnungen**. Die Eingabe macht der Nutzer.

## Ablauf

1. **Titelvarianten** — drei Varianten, Regeln in `references/titel-und-beschreibung.md`
2. **Beschreibung** — ehrlich, prüfbar, ohne Superlative
3. **Keywords** — sieben Felder, `references/keywords-und-kategorien.md`
4. **Kategorien und Altersangabe**
5. **Preis und Marge** — `references/preis-und-marge.md`, Druckkosten am Prüftag verifizieren
6. **Startplan** — `references/startplan.md`
7. **Ads-Vorschlag** — `references/ads-vorschlag.md`, ausschließlich als Vorschlag
8. **Messplan** — Kennzahlen, Rhythmus, Handlungsschwellen

## Ausgabe

`amazon-kdp-business/books/series/{{reihe}}/band-{{n}}/listing.md`
nach Vorlage `amazon-kdp-business/templates/07-listing-briefing.md`.

Kopf immer:

```
LISTING-ENTWURF — nicht veröffentlicht
Compliance-Status: READY FOR HUMAN APPROVAL vom JJJJ-MM-TT
Druckkosten geprüft am: JJJJ-MM-TT
Freigabe durch Nutzer erforderlich für: Preis, Veröffentlichung, Werbebudget
```

## Grundregeln für alle Texte

- Keine irreführenden Superlative
- Keine fremden Marken, Titel oder Autorennamen
- Keine unbelegten Auszeichnungen oder Empfehlungen
- Keine Lernversprechen
- Jede Aussage muss der Inhalt einlösen

Ein Listing, das mehr verspricht als das Buch hält, erzeugt Retouren und
schlechte Bewertungen — und beides ist teurer als ein zurückhaltender Text.

## Bestehendes KDP-Konto

Der Nutzer hat bereits ein KDP-Konto. Vorhandene Verkaufsdaten sind über den
manuellen Berichtsexport nutzbar — siehe `references/messplan-und-daten.md`.
Auch dabei erfolgt **keine** automatische Anmeldung.

## Referenzen

| Datei | Wofür |
|---|---|
| `references/titel-und-beschreibung.md` | Aufbau, Regeln, Formulierungsmuster |
| `references/keywords-und-kategorien.md` | Keyword-Recherche, Kategoriewahl, Altersangabe |
| `references/preis-und-marge.md` | Preisfindung, Margenrechnung, Preisband |
| `references/startplan.md` | Sichtbarkeit ohne Budget, erste 8 Wochen |
| `references/ads-vorschlag.md` | Ads-Struktur als Vorschlag, Abbruchkriterien |
| `references/messplan-und-daten.md` | Kennzahlen, Datenimport aus KDP-Berichten |
