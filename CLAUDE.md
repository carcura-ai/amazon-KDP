# Arbeitsmodi — immer aktiv

Vier Modi als Skills in `.claude/skills/`: `godmode`, `l99`, `ooda`, `ghost`.
Claude wählt sie bei **jeder** Aufgabe selbst — auch beim Programmieren —
und kombiniert sie, wenn sinnvoll. Der Nutzer kann einen Modus mit `/name` erzwingen.

| Situation | Modi |
|---|---|
| Faktenfrage, Status, kurze Rückfrage | godmode |
| Strategie, Kalkulation, Preis, Recht, Steuer, Geschäftsmodell | l99 in godmode-Form |
| Entscheidung zwischen Optionen, Priorisierung, Krise, Verzettelung | ooda + l99 |
| Kundensichtbarer Text (Website, E-Mail, WhatsApp, Caption, Anzeige, Listing) | ghost, bei Verkaufstexten + l99 |
| Programmieren | godmode in der Kommunikation · l99 bei Architektur, Sicherheit, Review · ooda bei Fehlersuche in Produktion · ghost für UI-Texte · immer `karpathy-guidelines` |
| Rechner, Dashboard, Prototyp, interaktive Übersicht | Artifact (eingebaut) + passender Modus für den Inhalt |

- **Grundeinstellung ist godmode-Form**: Antwort zuerst, dicht, ehrlich.
- Bei umfangreichen Antworten den gewählten Modus in der ersten Zeile nennen
  (z. B. `Modus: OODA + L99`), bei kurzen nicht.
- **Vor größeren Investitionen oder neuen Geschäftsfeldern:** `business-investment-advisor`
  für die Zahlen, danach `challenge` (Pre-Mortem) auf den gewählten Plan.
- **Neue Fremd-Skills:** erst `skill-security-auditor`, dann vollständig lesen,
  dann dokumentieren in `docs/SICHERHEITSPRUEFUNG-FREMDSKILLS.md`.
- **`caveman` nur auf Zuruf** (`/caveman`), nie automatisch: Er bleibt bis
  „stop caveman" aktiv und verträgt sich nicht mit ghost, l99 und der
  Abschlussstruktur. Solange er läuft, entfällt diese Abschlussstruktur.
- Die Modi ändern nie die Regeln dieses Projekts: keine erfundenen Zahlen,
  harte Tore im KDP-Prozess, KI-Angabepflicht gegenüber KDP, Freigaben beim Menschen.

## Programmierregeln (karpathy-guidelines)

Gilt bei jedem Code, jeder Website-Änderung und jedem Review:

1. **Erst denken:** Annahmen offen nennen. Bei mehreren Deutungen kurz aufzeigen.
   Rückfrage nur, wenn die Antwort das Ergebnis wesentlich ändert – sonst
   Annahme kennzeichnen und weiterarbeiten. Einfacheren Weg ansprechen.
2. **Einfach zuerst:** Nur was verlangt ist. Keine Zusatzfunktionen, keine
   Abstraktion für Einmal-Code, keine Fehlerbehandlung für Unmögliches.
3. **Chirurgisch ändern:** Nur anfassen, was nötig ist; vorhandenen Stil
   übernehmen. Nur selbst verursachte Reste entfernen, fremden toten Code melden
   statt löschen. Jede geänderte Zeile muss auf die Aufgabe zurückgehen.
4. **Zielgeführt:** Prüfbares Erfolgskriterium festlegen (`Schritt → Prüfung`),
   erst melden, wenn geprüft. Live-Änderungen an carcura.info nach dem Schreiben
   immer nachlesen.

Wirkt, wenn Diffs kleiner werden, weniger nachgebessert wird und Rückfragen vor
der Umsetzung kommen statt nach Fehlern.
