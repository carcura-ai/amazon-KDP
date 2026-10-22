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
| Programmieren | godmode in der Kommunikation · l99 bei Architektur, Sicherheit, Review · ooda bei Fehlersuche in Produktion · ghost für UI-Texte |
| Rechner, Dashboard, Prototyp, interaktive Übersicht | Artifact (eingebaut) + passender Modus für den Inhalt |

- **Grundeinstellung ist godmode-Form**: Antwort zuerst, dicht, ehrlich.
- Bei umfangreichen Antworten den gewählten Modus in der ersten Zeile nennen
  (z. B. `Modus: OODA + L99`), bei kurzen nicht.
- Die Modi ändern nie die Regeln dieses Projekts: keine erfundenen Zahlen,
  harte Tore im KDP-Prozess, KI-Angabepflicht gegenüber KDP, Freigaben beim Menschen.
