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
| JuliusBrussee/caveman | `bad48a0` (2026-10-17) | Apache 2.0 | **Teilweise installiert** (1 von 22 Skills) |
| alirezarezvani/claude-skills | `27cfcd0` (2026-10-21) | MIT | **Teilweise installiert** (6 von 398 Skills) |
| bergside/awesome-design-skills | `f631a09` (2026-06-28) | MIT | **Teilweise installiert** (3 von 67 Stilvorlagen) |
| Design-Runde: impeccable, ui-ux-pro-max, emilkowalski, wshobson, vercel-labs | siehe Abschnitt 9 | MIT / Apache 2.0 | **Teilweise installiert** (6 Skills) |

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

## 6 JuliusBrussee/caveman — teilweise installiert

**Prüfdatum** 2026-10-22 · **Commit** `bad48a0e1df55e05e3f52249afa35ecc1909ee76`,
2026-10-17 · **Apache 2.0** · Anfrage: `npx skills add JuliusBrussee/caveman`

`npx` wurde nicht ausgeführt. Das Repo wurde in den Prüfbereich geklont und
gelesen; der gewählte Skill wurde von Hand kopiert.

**Umfang:** 1.791 Dateien, 27 MB — ein ganzes Ökosystem (CLI, SDKs, Proxy, MCP-Server,
Go-Engine) mit 22 Skills. `npx skills add` hätte nur Skill-Ordner kopiert.

**Sicherheitsbefund: unbedenklich, aber mit Datenschutzhaken.**
- Kern-Skill `caveman`: reiner Text, keine Skripte, kein Netzwerk.
- Sieben Skills bedienen den kommerziellen Dienst „Caveman Cloud".
  `caveman-setup` leitet die KI-Anfragen einer App über ein fremdes Gateway
  (`gateway.caveman.so`) — Kundendaten in Prompts gingen dann an Dritte
  (Auftragsverarbeitung nach DSGVO nötig).
- `caveman-compress` startet `claude` bzw. `opencode` als Unterprozess, schickt
  die Zieldatei an ein Sprachmodell und überschreibt sie. Dokumentiert und ohne
  Shell-Interpolation, aber für dieses Projekt schädlich.
- Keine Prompt-Injection-Muster in den Skill-Texten gefunden.

**Installiert:** `SKILL.md`, `LICENSE`, `NOTICE` → `.claude/skills/caveman/`.
Details und Gründe je ausgelassenem Skill: `.claude/skills/caveman/HERKUNFT.md`.

---

## 7 alirezarezvani/claude-skills — teilweise installiert

**Prüfdatum** 2026-10-22 · **Commit** `27cfcd0fb0a41f60adffcbd5271fdf8839f86ed2` · **MIT**

**Umfang:** 4.132 Dateien, 55 MB, 398 Skills (plus 468 Gemini-Kopien), 786 Python-Skripte.

**Verfahren:** Katalog aller 398 Beschreibungen → Vorauswahl nach Geschäftsbezug
(Carcura, Webdesign, Vertrieb, KDP) → 24 Kandidaten auf Skripte, Netzwerkzugriffe und
Querverweise geprüft → Finalisten vollständig gelesen → Gegenprobe mit
`skill-security-auditor` (alle sechs PASS; Kontrolltest auf `caveman-compress` = FAIL,
das Werkzeug schlägt also an).

**Installiert:** `local-seo-manager`, `business-investment-advisor`, `a11y-audit`
(alle drei mit Abschnitt „Deutschland"), `challenge`, `weekly-review`,
`skill-security-auditor`. Herkunft und Änderungen je Skill in dessen `HERKUNFT.md`.

**Bewusst nicht installiert (Auswahl):**

| Skill | Grund |
|---|---|
| `contract-and-proposal-writer` | Rechtlich riskant für Deutschland: überträgt „Urheberrecht" (§ 29 UrhG: nicht übertragbar), Haftungsausschluss „as is" (in AGB unwirksam, § 309 Nr. 7 BGB), Schiedsgericht für Kleinaufträge, keine Werkvertrags-Abnahme |
| `page-cro`, `seo-audit`, `schema-markup`, `copywriting`, `analytics-tracking`, `site-architecture` | Solide, aber deckungsgleich mit `agency-website-builder` und `ghost` — doppelte Auslöser, US-Rechtsrahmen |
| `content-humanizer`, `behuman`, `caveman` (Kopie) | Durch `ghost` bzw. den geprüften `caveman` abgedeckt |
| `roast` | Startet fünf parallele Agenten je Idee — hoher Tokenverbrauch; `challenge` leistet das Wesentliche in einem Durchgang |
| `referral-program`, `pricing-strategist`, `email-sequence`, `paid-ads`, `churn-prevention` | SaaS-lastig oder ohne Mehrwert gegenüber `l99` |
| `cold-email` | B2B-Kaltakquise per E-Mail ist in Deutschland nur mit mutmaßlicher Einwilligung zulässig (§ 7 UWG) |
| `aeo`, `free-tool-strategy`, `marketing-psychology` | Kein Mehrwert gegenüber vorhandenem Wissen |
| C-Level-, Engineering-, Compliance-, Medizintechnik-, Jira-, Cloud-Skills (~350) | Kein Bezug zu den Geschäftsfeldern |

---

## 8 bergside/awesome-design-skills — teilweise installiert

**Commit** `f631a09` (2026-06-28) · **MIT** · 67 Stilvorlagen des Generators typeui.sh, nur Markdown und Bilder.
Die Vorlagen unterscheiden sich nur in rund 16 Zeilen (Name, Farbwerte; Tailwind-Standardfarben).
**Installiert:** `dramatic`, `premium`, `refined` als Stilreferenz. Auditor: WARN nur wegen `.DS_Store`.

---

## 9 Design-Runde — teilweise installiert

**Prüfdatum** 2026-10-22. Angefragt als `npx skills add …` für acht Pakete; `npx` nicht ausgeführt.

| Angefragt | Tatsächliche Quelle | Entscheidung |
|---|---|---|
| pbakaus/impeccable | dto., Apache 2.0 | **installiert ohne `scripts/`** — Startskript lädt ungeprüfte Binärdatei |
| nextlevelbuilder/ui-ux-pro-max | `ui-ux-pro-max-skill`, MIT | **`ui-ux-pro-max` installiert**; `design` (Logo-Generierung über externe KI-APIs mit Schlüsseln), `ui-styling` (shadcn/Tailwind), `brand`, `banner-design`, `slides` nicht |
| emilkowalski/skill | dto., MIT | **`emil-design-eng`, `review-animations`**; Swift, Expo, React-Toasts, `break-ui` (React-Komponenten mit Datenquellen) nicht |
| shadcn/ui | dto., MIT | **nicht installiert** — nur React/Tailwind-Projekte mit `components.json`, passt nicht zu WordPress/Kubio |
| ui-skills/interaction-design | existiert nicht; Quelle `wshobson/agents`, MIT | **installiert** |
| ui-skills/interface-design | existiert nicht; Quelle `Dammyjay93/interface-design`, MIT | **nicht installiert** — schließt Marketing-Seiten laut eigener Beschreibung aus |
| ui-skills/web-design-guidelines | existiert nicht; Quelle `vercel-labs/agent-skills`, MIT | **installiert mit lokaler Regelkopie** — Original lädt Anweisungen live nach |
| vercel/skills-hub | existiert nicht; `vercel-labs/skills` ist das `npx skills`-Installationsprogramm | **nicht installiert** — kein Skill |

**Auditor-Befunde und Bewertung:** impeccable FAIL (Regex-`.exec()` in gebündeltem JS = Fehlalarm;
echter Befund ist der Binär-Download), break-ui FAIL (Schutzregel gegen Prompt-Injection und
Emoji-Testdaten = Fehlalarm), ui-ux-pro-max WARN (atomares Schreiben = unbedenklich).

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

---

## pipes-bot/claude-plugins (WhatsApp-Kanal über PipesBot) – Prüfung 28.10.2026

**Quelle:** https://github.com/pipes-bot/claude-plugins · Commit `a47a159` (2026-07-21) · Lizenz MIT · 8 Commits, ein Autor, Version 0.0.x („experimentell“)
**Geprüft:** alle 11 Dateien vollständig gelesen (`server.ts` 635 Zeilen, `.mcp.json`, `package.json`, Skill `configure`, Marketplace-Dateien). `skill_security_auditor.py`: WARN (nur Strukturhinweis, scannt kein TypeScript) – daher manuelle Prüfung.

**Was es ist:** MCP-Server (Bun) für eine **laufende Claude-Code-Sitzung**. Er hält eine WebSocket-Verbindung zu `wss://api.pipes.bot/ws` und liefert WhatsApp-Nachrichten, die an eine **PipesBot-Nummer** geschickt werden, als Kanal-Nachricht in die Sitzung; Werkzeuge `reply` und `react`.

**Befunde**
- Kein `eval`, keine Shell-Befehle, kein Nachladen von Code zur Laufzeit; Netzwerk nur zu `api.pipes.bot` (+ vorsignierte Medien-URLs). API-Schlüssel steht im WebSocket-URL-Parameter.
- **Keine Absender-Freigabeliste** (Commit `996c304` „remove allowlist“). Jede Nachricht, die PipesBot zustellt, landet als Anweisung in der Claude-Sitzung → **Prompt-Injection-Risiko**, sobald die Sitzung Zugriff auf WordPress, Google/Meta Ads oder den Mailversand hat.
- `reply` kann **beliebige lokale Dateien** (bis 50 MB) verschicken; gesperrt ist nur der eigene Kanal-Ordner.
- `bun install` bei **jedem Start** mit `^`-Versionsbereichen → Abhängigkeiten können sich unbemerkt ändern.
- Alle Nachrichteninhalte (bei Anfragen: Kundendaten) laufen über **PipesBot** – Firmensitz, Hosting und Auftragsverarbeitungsvertrag nicht dokumentiert.
- Funktioniert nur, solange eine Claude-Code-Sitzung auf einem Rechner läuft; kein 24/7-Betrieb, keine von sich aus gesendeten Benachrichtigungen (nur Antworten auf eingehende Nachrichten, WhatsApp-24-Stunden-Fenster).

**Entscheidung: Nicht installiert.** Für Lead-Benachrichtigungen und Kundendaten ungeeignet (Datenschutz, kein Dauerbetrieb, kein Push). Höchstens als privater Versuch in einer Sitzung **ohne** Zugriff auf Website, Werbekonten oder Mailversand.

## forrestchang/andrej-karpathy-skills (karpathy-guidelines) – Prüfung 29.10.2026

**Quelle:** github.com/forrestchang/andrej-karpathy-skills (gespiegelt als multica-ai/andrej-karpathy-skills), Commit `2c606141936f1eeef17fa3043a72095b4765b9c2` vom 20.04.2026, Lizenz MIT. Gefunden über ein Instagram-Reel von tecturtle.ai.

**Geprüft:** `skill-security-auditor` auf Repo und Skill-Ordner. Vollständig gelesen: `CLAUDE.md`, `skills/karpathy-guidelines/SKILL.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`. Nach unsichtbaren Zeichen und HTML-Kommentaren gesucht: keine gefunden.

**Was es ist:** Reine Verhaltensregeln in Markdown für das Programmieren: erst denken, einfach zuerst, chirurgisch ändern, zielgeführt arbeiten. Enthält keine Skripte, keine Abhängigkeiten und keine Netzwerkzugriffe.

**Befunde:**
- Skill-Ordner: **PASS**.
- Auf Repo-Ebene meldet der Scanner CRITICAL für `EXAMPLES.md:302`. Das ist ein Fehlalarm: Dort steht der Docstring „Upload file to destination" in einem Codebeispiel, keine Anweisung.
- Ebenfalls auf Repo-Ebene meldet er HIGH für den `.cursor`-Ordner und das fehlende Root-`SKILL.md`. Auch das ist ein Fehlalarm, es handelt sich nur um Struktur-Hinweise.

**Entscheidung: Installiert.** Übernommen wurde nur `SKILL.md`, unverändert und mit Quellenhinweis, nach `.claude/skills/karpathy-guidelines/`. Die vier Regeln stehen auf Deutsch in `CLAUDE.md`. Dabei wurde „bei Unklarheit fragen" an die Nutzervorgabe angepasst: Rückfrage nur, wenn sie das Ergebnis wesentlich ändert. `EXAMPLES.md`, `.cursor/` und die Plugin-Dateien wurden nicht übernommen.

## local-search-ads (localseoskills, über singhmuric/emjmedia-sites) – Prüfung 29.10.2026

**Quelle:** `npx skillfish add singhmuric/emjmedia-sites local-search-ads`. Der Befehl wurde **nicht** ausgeführt, weil er ein unbekanntes npm-Paket mit Schreibzugriff auf den Rechner starten würde. Stattdessen wurde das Repo per `git clone` geholt (Commit `7da44248eabbdb065c8fded88391e965c1928201`, 08.05.2026). Der Skill liegt dort unter `.claude/skills/local-seo-skills/skills/local-search-ads/` und ist eine Kopie von garrettjsmith/localseoskills, Version 1.0.0, MIT-Lizenz.

**Geprüft:**
- `skill-security-auditor` auf den Skill-Ordner: **PASS** (0 Befunde, 1 Markdown-Datei, keine Skripte).
- `SKILL.md` (199 Zeilen) vollständig gelesen.
- Keine HTML-Kommentare, keine Anweisungen außerhalb des Themas.
- `SECURITY.md` und `LICENSE` des Pakets gelesen.

**Was es ist:** Anleitung für Google-Ads-Anzeigen in der Kartenansicht: Standort-Assets, Verknüpfung mit dem Unternehmensprofil, Ausschlusskeywords und Messung.

**Befunde:** Keine sicherheitsrelevanten. Der Inhalt ist allgemein und auf die USA ausgerichtet, verweist auf nicht installierte Schwester-Skills und auf LSA (gibt es für Fahrzeugaufbereitung in Deutschland nicht).

**Entscheidung: Installiert.** Nur `SKILL.md`, mit Quellenhinweis, nach `.claude/skills/local-search-ads/`. `install.sh`/`install.ps1` und die restlichen 38 Skills des Pakets wurden **nicht** übernommen.

## zhuyansen/awesome-claude-video-skills – Prüfung 30.10.2026

**Quelle:** github.com/zhuyansen/awesome-claude-video-skills, Commit `b4b7c04` („Daily update 2026-10-29"), vom Nutzer genannt.

**Geprüft:** Repo in einen isolierten Ordner geklont. Inhalt: `README.md`, `README.zh-CN.md`, `LICENSE`, `data/skills.json`, ein Issue-Template und 230 Vorschaubilder. **Keine Skripte, kein `SKILL.md`, nichts Ausführbares.**

**Was es ist:** Kein Skill, sondern eine Linkliste mit 379 Video-Skills fremder Anbieter, jeweils mit Sicherheitsnote von agentskillshub.top.

**Befund für Carcura:**
- Realistisch aussehende Videos mit menschlichen Stimmen erzeugen alle Einträge über **kostenpflichtige Cloud-Dienste** (HeyGen-Avatare, ElevenLabs-Stimmen, Google Veo/Flow, fal.ai).
- Die kostenlosen, lokalen Einträge machen Grafik- und Zeichentrick-Animationen, wie wir sie schon selbst bauen.

**Entscheidung: Nichts installiert.** Ein konkreter Skill wird erst geprüft und übernommen, wenn der Nutzer den Weg (Dienst und Kosten) freigibt.
