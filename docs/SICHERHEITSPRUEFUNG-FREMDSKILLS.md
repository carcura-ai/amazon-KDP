# Sicherheitsprüfung der Fremd-Skills

**Prüfdatum:** 2026-08-24 · **Prüfumgebung:** Ubuntu 24.04, Claude Code 2.1.241

## Prüfverfahren

Jede Quelle wurde in einen isolierten Prüfbereich außerhalb des Projekts geklont
(`--depth 1`) und **vor** jeder Installation vollständig gelesen.
Es wurde nichts per `curl | sh`, `wget | sh` oder vergleichbarer Direktausführung
geladen. Keine Binärdatei wurde ausgeführt. Kein Installationsskript wurde gestartet.

Geprüft wurde je Quelle: `SKILL.md`, Installationsskripte, Abhängigkeiten, Hooks,
MCP-Konfigurationen, automatisch ausgeführte Shell-Befehle, Schreib-/Lösch-/
Netzwerkoperationen, Umgang mit Cookies, Zugangsdaten, Tokens und KDP-Daten,
Prompt-Injection-Muster, Lizenz und Wartungsqualität.

**Prompt-Injection-Befund:** In keiner Quelle gefunden. Die Treffer des Suchmusters
(„bypass") waren sachlich — das Überspringen eines Amazon-„Server Busy"-Dialogs und
eine Warnung vor dem Umgehen von Einreichungslimits.

---

## Ergebnis auf einen Blick

| Quelle | Commit | Lizenz | Entscheidung |
|---|---|---|---|
| arturseo-geo/ebook-publishing-skill | `8c23481` (2026-03-24) | MIT | **Teilweise installiert** |
| joshyattridge/amazon-kdp-skill | `9194489` (2026-07-05) | **keine** | **Nicht installiert** |
| nikmcfly/kindle-cover-skill | `954eb8e` (2026-03-27) | **keine** | **Nicht installiert** |
| MarketplaceAdPros/skill-amazon-ads | `47d7d78` (2026-03-10) | MIT | **Nicht installiert** |
| mcpmarket.com amazon-kdp-category-researcher | — | unbekannt | **Nicht installiert** |

---

## 1 arturseo-geo/ebook-publishing-skill — teilweise installiert

**Commit** `8c234813dfee2846703769ac821f0a9aae42a4b6`, 2026-03-24 · **MIT**

**Sicherheitsbefund: unbedenklich.** 13 Dateien, ausschließlich Markdown.
Keine Skripte, keine Hooks, keine MCP-Konfiguration, keine Abhängigkeiten,
keine Netzwerk-, Schreib- oder Löschoperationen, kein Umgang mit Zugangsdaten.

**Installiert:** `SKILL.md`, `references/` (6 Dateien), `LICENSE`
→ `.claude/skills/ebook-publishing/`

**Ausgelassen:**

| Datei | Grund |
|---|---|
| `project-context.md` | Eigenwerbung des Autors (Website, Gumroad, Social Media), kein Fachinhalt |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md` | Projekt-Meta, für den Betrieb nicht nötig |

**Änderung:** Der Abschnitt „Project Context" verwies auf die ausgelassene
Marketing-Datei. Ersetzt durch einen Verweis auf die verbindlichen eigenen Skills
plus Warnung vor der US-Lastigkeit. MIT erlaubt das; der Lizenztext liegt bei.
Dokumentiert in `.claude/skills/ebook-publishing/HERKUNFT.md`.

**Fachliche Einschränkung:** Marktfokus überwiegend englischsprachig/US.
Alle Beträge, Steuersätze und Plattformregeln sind **undatiert** und daher
`[NICHT VERIFIZIERT]`. Für amazon.de nicht ungeprüft übernehmen.
Das Skill ist Nachschlagewerk, nicht Entscheidungsgrundlage.

---

## 2 joshyattridge/amazon-kdp-skill — nicht installiert

**Commit** `9194489d23ffd287f5a9fbf33dc22cbb4132b3d2`, 2026-07-05 · **keine Lizenz**

101 Dateien: Express-Server + Playwright-Automatisierung, die sich mit gespeicherten
Browser-Sitzungscookies an KDP anmeldet und Berichte, Metadaten, Preise, Uploads
und Veröffentlichungen steuert.

**Nicht installiert.** Sechs Gründe, jeder für sich ausreichend:

**a) Keine Lizenz.** Ohne Lizenz sind Nutzung und Weitergabe rechtlich nicht gedeckt.

**b) Ungeschützter lokaler Server mit unwiderruflichen Aktionen.**
`server/src/index.ts:53` setzt `cors({ origin: true, credentials: true })` —
jede Herkunft wird zugelassen. Der Server auf `localhost:3001` hat **keine
Authentifizierung** und stellt unter anderem bereit:

| Route | Wirkung |
|---|---|
| `POST /api/kdp/titles/delete` | Titel löschen |
| `POST /api/kdp/titles/unpublish` | Titel zurückziehen |
| `POST /api/kdp/pricing/update` | Preis ändern |
| `POST /api/kdp/publish` | veröffentlichen |

Solange der Server läuft, kann eine beliebige im Browser geöffnete Webseite
Anfragen an diese Routen senden. Das ist ein klassischer CSRF-Weg zu
unwiderruflichen Änderungen an einem bestehenden KDP-Konto.

**c) Sitzungscookies im Klartext.** `login.ts:47` speichert den Playwright-
`storageState` nach `.kdp-session/amazon-kdp.json`. Diese Datei ist einem
angemeldeten Amazon-Zugang gleichwertig und liegt unverschlüsselt im Dateisystem.

**d) Der Skill widerspricht den geforderten Freigabegrenzen.**
`SKILL.md` weist an: *„You run everything. Do not ask the user to run terminal
commands."* Der Auftrag verlangt das Gegenteil — Veröffentlichung, Preisänderung,
Löschung und Kontoverknüpfung nur nach ausdrücklicher Freigabe.

**e) Automatische Ausführung bei Installation.**
`package.json` enthält `"postinstall": "playwright install chromium"` —
`npm install` löst unaufgefordert einen Browser-Download aus.

**f) Sondierung interner Amazon-Endpunkte.**
`scripts/discover-kdp-apis.mjs` und `probe-discovered-apis.mjs` testen nicht
dokumentierte KDP-Endpunkte mit der Sitzung des Nutzers. Das berührt die
Nutzungsbedingungen und kann ein bestehendes Konto gefährden.

*Positiv anzumerken:* `disable-model-invocation: true` (kein automatisches
Auslösen), erzwungene Einzelverarbeitung statt Stapelbetrieb und eine
Ratenbegrenzung von 4 s. Das ändert an a–f nichts.

**Ersatz:** `kdp-listing-launch` erzeugt fertige Listing-Entwürfe zum Eintragen;
`kdp-listing-launch/references/messplan-und-daten.md` beschreibt den manuellen
Berichtsimport ohne Kontoverknüpfung.

---

## 3 nikmcfly/kindle-cover-skill — nicht installiert

**Commit** `954eb8efc270397a635b92088c5a6eea815bf938`, 2026-03-27 · **keine Lizenz**

3 Dateien. `scripts/generate_cover.py` (335 Zeilen) erzeugt aus einem Frontcover-Bild
eine Full-Wrap-Cover-PDF mit `reportlab` und `Pillow`.

**Technischer Sicherheitsbefund: unbedenklich.** Keine Netzwerkaufrufe, kein
`subprocess`, kein `eval`, keine Lösch- oder Schreiboperationen außerhalb der
angegebenen Ausgabedatei, kein Umgang mit Zugangsdaten.

**Nicht installiert — Grund: keine Lizenz.** Ohne Lizenzangabe darf der Code nicht
in dieses Repository übernommen oder weitergegeben werden. Das ist ein rechtlicher,
kein technischer Befund.

**Ersatz:** Die Cover-Anforderungen (Anschnitt, Sicherheitsabstand, Rückenbreite aus
Seitenzahl und Papierart, kein eigener Barcode-Platzhalter) sind als Prüfpunkte in
`kdp-quality-compliance/references/druckdatei.md` abgebildet — sachliche
KDP-Vorgaben, keine Übernahme fremden Codes. Maße vor Verwendung im offiziellen
KDP-Vorlagengenerator prüfen.

**Wenn Sie das Skill dennoch nutzen möchten:** beim Autor eine Lizenz erfragen und
es anschließend selbst unter `~/.claude/skills/` installieren.

---

## 4 MarketplaceAdPros/skill-amazon-ads — nicht installiert

**Commit** `47d7d7844b45faa17fef9f31f20d9ed405f09c32`, 2026-03-10 · **MIT**

5 Dateien, davon eine `SKILL.md` (146 Zeilen). Der Inhalt ist **keine eigenständige
Funktion**, sondern eine Bedienungsanleitung für den MCP-Server von
Marketplace Ad Pros (`whoami`, `list_brands`, `ask_report_analyst` …).

**Sicherheitsbefund der Dateien: unbedenklich.** Kein Code, keine Hooks,
keine Anmeldedaten im Repository.

**Nicht installiert.** Zwei Gründe:

1. **Kontoverknüpfung erforderlich.** Das Skill ist ohne den externen MCP-Server
   wirkungslos, und dieser Server benötigt ein angebundenes Amazon-Ads-Konto bei
   einem Drittanbieter. Kontoverknüpfungen sind ohne Ihre ausdrückliche Freigabe
   gesperrt.
2. **Verweise auf nicht vorhandene Werkzeuge.** Wäre das Skill installiert, ohne
   dass der MCP-Server läuft, beschriebe es Werkzeuge, die es nicht gibt — das
   verleitet zu erfundenen Ergebnissen. Genau das soll dieses System vermeiden.

**Ersatz:** `kdp-listing-launch/references/ads-vorschlag.md` — Kampagnenstruktur,
Gebotslogik aus Deckungsbeitrag und Conversion, vorab festzulegende
Abbruchkriterien, Deutung von Impressionen/Klicks/Conversion. Ausschließlich
Analyse und Empfehlung; kein Konto, kein Budget, keine Kampagne.

**Wenn Sie später Amazon Ads anbinden möchten:** Das ist eine bewusste
Entscheidung mit Kontoverknüpfung an einen Drittanbieter. Sagen Sie Bescheid,
dann bereite ich die Prüfung vor — ausgeführt wird sie erst nach Ihrer Freigabe.

---

## 5 mcpmarket.com — amazon-kdp-category-researcher — nicht installiert

**Keine prüfbare Originalquelle vorhanden.**

- `https://mcpmarket.com/tools/skills/amazon-kdp-category-researcher` ist aus dieser
  Arbeitsumgebung **nicht abrufbar** (Sperre des Egress-Proxys der Organisation:
  `EGRESS_BLOCKED`).
- Eine Websuche nach einem Original-Repository (GitHub/GitLab) ergab **keinen**
  Treffer für dieses Skill — nur die Listing-Seite selbst sowie unabhängige,
  andere Projekte.
- Damit sind Quelltext, Autor, Lizenz und Versionsstand **nicht prüfbar**.

Ein Skill, dessen Inhalt nicht gelesen werden kann, wird nicht installiert.

**Ersatz — wie im Auftrag vorgesehen:** `kdp-opportunity-validator`.
Er deckt die beschriebene Funktion ab (Kategorieanalyse, BSR-Einordnung,
Wettbewerbsauswertung) und geht darüber hinaus mit einem 100-Punkte-Schema,
der 70-Punkte-Grenze, einer Mindestzahl von zehn geprüften Wettbewerbstiteln
und dem Verbot, BSR als Verkaufszahl darzustellen.

---

## Was daraus für den Betrieb folgt

1. **Keine Automatisierung, die sich bei KDP anmeldet.** Berichte werden manuell
   exportiert und lokal ausgewertet.
2. **Keine gespeicherten Sitzungen oder Zugangsdaten** in diesem Projekt.
3. **Kein lokaler Dienst**, der KDP-Aktionen ausführen kann.
4. **Amazon Ads nur als Analyse und Empfehlung**, ohne Kontoverknüpfung.
5. **Veröffentlichung, Preis, Budget und Bestellungen** bleiben beim Nutzer.

## Prüfbereich

Die Klone liegen außerhalb des Projekts im Scratchpad dieser Sitzung und wurden
nicht ins Repository übernommen. Sie verfallen mit dem Container. Die Prüfung ist
über die oben genannten Commit-Hashes jederzeit reproduzierbar.
