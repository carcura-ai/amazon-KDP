# Carcura – Gesamtstand

Stand: 24.11.2026 · erstellt von der Session „Carcura Management System Development“ · zur Gegenprüfung durch Codex

**Quellen-Kürzel:**
- **[M]** Manager-Repo, Branch `claude/kind-curie-4rhi0y` (Commit `d4b88ee`)
- **[A]** Branch `claude/amazon-kdp-kinderbuch-setup-374xk0`, Sessions „Fahrzeug Aufbereitungen Analyse Walterschen“ und „Instagram profile analysis“
- **[B]** Branch `claude/hopeful-turing-cvybo3` (Mail-Relay-Session)
- **[C]** Branch `claude/dreamy-albattani-ii4ric` (SEO-Session)
- **[WP]** live über die WordPress-Schnittstelle am 24.11.2026 abgefragt
- **[S]** Status-Zusammenfassung einer Claude-Session (nicht in Dateien belegt)

**Statuswerte:** LIVE = in Betrieb · ENTWURF = gebaut, nicht live · OFFEN = noch nicht begonnen bzw. blockiert

> Die anderen Sessions waren nicht direkt ansprechbar: Cloud-Sessions können von hier keine Nachrichten empfangen. Ihr Stand
> wurde aus ihren Git-Branches und Session-Statusmeldungen gelesen.

---

## 1. Kurzfazit

- **Website und Lead-Eingang laufen:** WordPress mit neuer Startseite, neuen Leistungs- und Ortsseiten, Lead-Alarm per Telegram, Waschset-Aktion bis 31.12.2026.
- **Der Manager läuft seit 07.11.2026** auf dem Hetzner-Server unter `app.carcura.info` (PWA) [A].
- **Größte Risiken:**
  1. **Keine externe Sicherung:** Hetzner-Backups sind aus [A]; Sicherungen des Managers liegen unverschlüsselt auf demselben Server [M].
  2. **Drei hohe Sicherheitslücken im Manager**, bisher nicht behoben (Plan wartet auf Freigabe) [M].
  3. **Kundendaten an vielen Stellen:** 5 WordPress-Plugins, Telegram-Gruppe, Manager, interne WP-Seiten.
  4. **Google Ads:** 0 Conversions bei falschen Kampagnenzielen [A].
- **Nächster großer Hebel:** WhatsApp-Assistent. Er ist fertig gebaut, die Freischaltung bei Meta über Dualhook steht aber noch aus [A].

---

## 2. Infrastruktur

| Teil | Stand | Status | Quelle |
|---|---|---|---|
| Hetzner-Server | IP 94.130.76.109, Hostname `carcura-assistent`, Ubuntu; Servertyp nicht dokumentiert (Empfehlung 2 vCPU / 4 GB) | LIVE | [A] `carcura-assistent/deploy/MANAGER-INSTALLATION.md` |
| Reverse Proxy | gemeinsamer Caddy 2, automatisches HTTPS: `app.carcura.info` → Manager, `bot.carcura.info` → Assistent | LIVE (bot antwortet mit 502, weil der Assistent nicht gestartet ist) | [A] `deploy/gemeinsam/*` |
| Hetzner-Backups | „Danach (nicht heute)“: Server → Backups einschalten (ca. 20 % Aufpreis) | **OFFEN** | [A] MANAGER-INSTALLATION.md:66-68 |
| APP_SECRET im Passwortmanager | als Aufgabe genannt, Erledigung nicht dokumentiert | OFFEN bzw. unklar | [A] |
| AV-Vertrag mit Hetzner | als Datenschutz-Aufgabe genannt | OFFEN | [A] `carcura-assistent/README.md` |
| Website-Hosting | carcura.info auf eigenem Hosting (Plesk), WordPress 7.1.5, PHP 8.5 | LIVE | [WP], [A] |

**Korrektur zu [M] `docs/AUDIT.md`:** Der Manager läuft unter `app.carcura.info` auf Hetzner, nicht unter `manager.carcura.info`
auf Plesk. Die Hosting-Entscheidung E4 aus `docs/PLAN.md` ist damit faktisch gefallen (Hetzner). Offen sind noch der zweite
Sicherungsort und die TLS-Härtung.

---

## 3. Management-System (Carcura Manager) [M]

- **Funktionen:** Leads, Kunden, Fahrzeuge, Kalender, Aufträge, Annahmeprotokoll, Angebote, Rechnungen, Belegimport, Finanzen, Lager, Marketing, Wettbewerber, Berichte, KI-Assistent, Datenschutz, Mandanten, API-Schlüssel. Details: `carcura-manager/docs/SOFTWARESTAND.md`.
- **Tests:** 180 Tests grün (24.11.).
- **Betrieb:** seit 07.11.2026 als PWA unter `app.carcura.info`. Der Windows-Installer startete am 07.11. nicht (nicht signiert) [A].
- **Nicht dokumentiert:** ob das Konto für Richy angelegt ist und ob der Lead-Eingang von der Website zum Manager produktiv eingerichtet ist (Bridge bzw. `MANAGER_LEAD_TOKEN`).
- **Phase 0 des Umbaus erledigt** (`docs/AUDIT.md`, `docs/PLAN.md`, 82–97 PT). **Wartet auf Freigabe** sowie auf die Entscheidungen E1, E8 und E10.
- **Offene Sicherheitslücken, hoch:**
  - Ein gesperrter Mandant kann sich weiter anmelden.
  - Rechte-Ausweitung über „Benutzer verwalten“.
  - 2FA-Pflicht für Admins nur in der Oberfläche.
- **Offene Sicherheitslücken, mittel:** Sicherungen unverschlüsselt und auf demselben Datenträger.
- **Fehlende Kernfunktionen:**
  - Online-Terminanfrage, Statusmeldungen, Checklisten, Auftragszeit, Boxen
  - Preise je Fahrzeugklasse, Pflegeabos
  - Lexware-Anbindung, Einwilligungsverwaltung, Onboarding
- **Barzahlung:** heute an 3 Stellen erfassbar (Kassenpflicht-Risiko, Abschnitt 7 in AUDIT.md).

---

## 4. Website carcura.info

| Teil | Stand | Status | Quelle |
|---|---|---|---|
| Rebuild | live seit 05.11.2026. Persona-Tests: Anfragen 5/15 → 13/15 | LIVE | [A] `docs/WEBSITE-REBUILD-MASTERPLAN.md` |
| Startseite | neuer HTML-Block, Header und Footer auf allen Seiten, Galerie (Seite 1655) seit 16.11. | LIVE | [A] `website-rebuild/live-startseite/README.md`, [WP] |
| Seiten | 35 Seiten (33 veröffentlicht bzw. privat, 2 Entwürfe), darunter Ortsseiten (Westerwald, Altenkirchen, Neuwied, Wissen, Hachenburg, Asbach) und Leistungsseiten (Politur, Keramik, Innenreinigung, Scheinwerfer, Geruch, Tierhaare, Flecken, Spezialreinigung, Leasing, Wohnmobil, Gutschein, Hol- und Bringservice) | LIVE | [WP] |
| Rechtsseiten | Impressum, Datenschutz, Cookie-Richtlinie, Widerruf, **Abo-Bedingungen (veröffentlicht 19.10.)**, Vertrag kündigen: live. **AGB und Datenschutz-Ergänzungen: Entwurf.** | teils | [WP] |
| Kündigungsbutton § 312k | Plugin 1.0.0 aktiv | LIVE | [WP] |
| Waschset-Aktion | „Keramik buchen, Waschset geschenkt“ bis 31.12.2026; Rückbau am 02.01.2027 | LIVE | [A] `aktion-v4/LIESMICH.md` |
| Tracking | `cx-track` → GA4 (Property 548650753) mit Consent Mode, ca. 25 Ereignisse. **Benutzerdefinierte Dimensionen in GA4 fehlen.** | LIVE bzw. OFFEN | [A] `docs/TRACKING-WEBSITE.md` |
| Statischer Relaunch | 31 Seiten in `dist/`, Film aus KI-Bildern; nicht angebunden | ENTWURF | [A] `carcura-web/…/LIESMICH-WEBSITE.md`, `DELIVERY-STATUS.md` |
| 3D-Animationen | lackschichten und keramik-schutz fertig; Einbau wartet auf Alex; Sportwagen braucht ein lizenziertes Modell | ENTWURF | [A] `3d-studio/lieferung/LIESMICH.md` |
| Plugin „Maintenance“ | aktiv; ob der Wartungsmodus eingeschaltet ist, wurde nicht geprüft | ? | [WP] |
| Site Health (24.11.) | 16 gut, 5 empfohlen, **1 kritisch** (1 MB automatisch geladene Optionen). Cron `ccrr_queue_tick` (Revenue Recovery) überfällig. Updates offen: Contact Form 7, Easy MCP AI, Site Kit, 1 Theme. | — | [WP] |

**SEO und Sichtbarkeit** [A] `audit/WEBSITE-UND-SICHTBARKEIT.md`, `seo/ranking-log.md`:
- **Search Console 25.08.–22.11.:** 128 Klicks, 2.359 Impressionen, Durchschnittsposition 10,4, meist über den Markennamen. „autoaufbereitung altenkirchen“ Position 1,8; generische Begriffe Position 18–64; 8 URLs konkurrieren um „…westerwald“.
- **Offen:**
  - Sitemap unvollständig (MU-Plugin auf [C], Installation nicht belegt)
  - robots.txt ohne Sitemap-Zeile, llms.txt 404, doppelter title
  - 301 von Seite 1048 nicht entschieden
  - Tippfehler `carcura@ex.comweb.de` in der Cookie-Richtlinie
- **Ranking-Log:** seit 09.11. nicht fortgeführt.

---

## 5. Leads, Kommunikation, APIs

| Kanal bzw. API | Stand | Status | Quelle |
|---|---|---|---|
| Website-Formular → Revenue Recovery (`/ccrr/v1/lead`) | zentraler Lead-Funnel 4.8.0 | LIVE | [WP] |
| Lead-Alarm 1.2.0 | jede Anfrage **mit allen Kundendaten** in die Telegram-Gruppe (Alex und Richy), WhatsApp-Knopf, Wochenbericht `/bericht` | LIVE | [WP], [A] |
| Mail-Relay 1.2.0 | Assistent versendet über FluentSMTP → carcura@web.de; Freigabe, Zustimmungspflicht B2B, Sperrliste, Tageslimit | LIVE | [WP], [A]/[C] |
| B2B-Akquise per Mail | 15 Zustimmungsmails gesendet; **7 Firmen ohne E-Mail-Adresse** (Blum-Bau, Spedition Hoffmann, Kurt Groß, MESO, ADI'S Fahrservice, Pflegedienst Westerwald, Pflegedienst Zens) | BLOCKIERT | [S] Mail-Relay-Session |
| `mailing.py` (Fuhrpark-Mailing) | schickt die Felder `art` und `einwilligung` nicht mit. Relay 1.2.0 lehnt solche Mails ab. Nicht auf [A] gemergt. | ENTWURF bzw. inkompatibel | [B] |
| **WhatsApp-Assistent** (`carcura-assistent/`) | Node-Dienst: WhatsApp Cloud API, Claude (Anthropic), WP-REST, SMTP, Windsor.ai, Google Business Profile (optional), Lead-Weitergabe an den Manager, Wochenbericht, Bewertungen | **ENTWURF, nicht gestartet** | [A] `carcura-assistent/README.md`, `deploy/gemeinsam/LIESMICH.md` |
| **WhatsApp-Freischaltung** | Plan: Koexistenz auf der Firmennummer +49 170 6669516 über Dualhook bzw. 360dialog (Embedded Signup). Danach `.env` füllen und starten. Vorlage `carcura_hinweis` (Utility, Deutsch), Webhook `https://bot.carcura.info/webhook`. | **OFFEN („bald“)** | [A] |
| Google Business Profile API | optional, Antrag bei Google („einige Tage“) | OFFEN | [A] |
| Manager-API | Website-Lead-Eingang mit Token; neu: API-Schlüssel für Programme (u. a. den Assistenten) | vorhanden | [M] |
| Marketing-APIs im Manager | Google Ads, GA4, Search Console, Meta, Windsor.ai, Google Places (Places-Verlauf laut AUDIT nicht zulässig) | vorhanden; Einrichtung unklar | [M] |
| Lexware | Leistungskatalog CC-101…CC-999 gepflegt (Kleinunternehmer, 0 %); **keine API-Anbindung** | manuell | [A] `docs/LEXWARE-LEISTUNGEN.md`, [M] |

**Die benötigten Zugangsdaten des Assistenten (nur Namen)** stehen in [A] `carcura-assistent/.env.example`: WA_TOKEN, WA_PHONE_NUMBER_ID,
WA_VERIFY_TOKEN, WA_APP_SECRET, LEAD_SECRET, OWNERS, ANTHROPIC_API_KEY, WP_APP_PASSWORD, SMTP_*, WINDSOR_*, GBP_*, MANAGER_URL,
MANAGER_LEAD_TOKEN.

---

## 6. Angebot, Preise, Kalkulation [A]

- **Preise (Lexware, Stand 18.11.):**
  - Innenreinigung 90 €, detailliert 150 €
  - Basic innen und außen 145 €
  - Handwäsche 69 €
  - Politur 349 € (1-stufig) / 549 € (2-stufig)
  - **Keramik 700 € / 900 €**
  - Wohnmobil 800 €
  - Hol- und Bringservice 2 €/km ab dem 11. km
  - Waschset gratis bis 31.12.
- **Kalkulation** (`docs/KALKULATION-ARBEITSZEITEN.md`): Ziel 50 €/Person/h; Kosten 1.300 €/Monat; Vollkosten ca. 66 €/h plus Material. Richtzeiten für Politur und Keramik noch **zu bestätigen**.
- **Neue Regeln, live seit 09.11.:** Anzahlung 50 % ab 500 €, Absage 48 h bzw. 50 %. **Fehlt noch in den AGB, Anwaltsprüfung offen.**
- **Widersprüche, zu bereinigen:**
  - Kleinanzeigen-Texte nennen „Keramik ab 650 €“ (aktuell 700 €).
  - `CLAUDE.md` nennt 60 €/h und 1.040 € Fixkosten, die Kalkulation 50 €/h und 1.300 €.
  - Der Masterplan nennt noch das „Pflegeset“. Laut `MARKE.md` gibt es seit 18.11. kein Pflegeset und kein Festpreis-Versprechen.

---

## 7. Marketing und Content

| Thema | Stand | Status | Quelle |
|---|---|---|---|
| Google Ads (01.–22.11.) | 2 Kampagnen (3 + 2 €/Tag), 33 Klicks, 18,48 €, **0 Conversions**. Primärziele falsch gesetzt (auch Websitebesuche und YouTube). Empfehlung: nur `cc_anfrage`. | LIVE, korrigieren | [A] `audit/GOOGLE-MAPS-ADS-MESSUNG.md` |
| Google-Unternehmensprofil | 4,8★, 16–18 Bewertungen (Zahl uneinheitlich); 5★-Bewertung vom 04.11. unbeantwortet; Beiträge W1 und W2 belegt, W3 und W4 nicht | teils | [A] |
| Reels und Videos | fertig: Keramik-Story (2 Teile), Keramik-Anzeige (Meta), Keramik-Erklärvideo, Keramik-Ablauf 4K, Visitenkarte, Hol- und Bringservice, Tim & Bob. **Keine Veröffentlichung belegt, Lernlog leer.** „KI-Info“ beim Hochladen Pflicht; Waschset-Bezug nur bis 31.12. nutzbar. | ENTWURF | [A] `reel-studio/`, `carcura-assistent/instagram/` |
| 3D-Reel im Porsche-Stil | hier nicht machbar; Empfehlung: Auftrag an einen Künstler, < 500 € | Entscheidung offen | [S] Instagram-Session |
| Instagram / TikTok | `@_carcura_`; Markenregeln in `reel-studio/brand/MARKE.md` | — | [A] |
| Kleinanzeigen | Ratgeber mit 3 gestaffelten Anzeigen; ob geschaltet: unbekannt; Preis veraltet | ENTWURF | [A]/[C] |
| B2B-Segmente | 13 Branchenvorlagen; Ablauf anrufen → Zustimmung → Mail (§ 7 UWG) | LIVE (siehe 5) | [A]/[C] |
| Werbebudget-Regel | höchstens 5 €/Tag je Kampagne bzw. 10 €/Tag insgesamt, nur nach OK von Alex | Regel | [A] `docs/ABSTIMMUNG-3D-WEBSITE.md` |

---

## 8. Datenschutz und Recht (Querschnitt)

- **Kundendaten liegen verteilt** in:
  - WordPress: CRM Suite, Suite v2, Revenue Recovery, Firmenkunden-Portal, Newsletter-Plugin (am 12.10. aktiv, am 24.11. inaktiv; Site Health meldet 1 inaktives Plugin), interne Seiten „Akquise-Liste“ und „Auftragsbuch“
  - **Telegram-Gruppe** (Lead-Alarm mit allen Kundendaten; Anbieter außerhalb der EU, kein AV-Vertrag dokumentiert)
  - Manager
  - künftig WhatsApp bzw. Meta und Anthropic (Assistent)

  Folge: Auskunft und Löschung sind schwer vollständig erfüllbar. **Empfehlung:** Manager als einzige Kundendatenbank, WordPress nur als Lead-Eingang, Telegram-Meldung ohne Kundendaten (nur „neue Anfrage“ mit Link).
- **Abo-Bedingungen** sind seit 19.10. live. Die Vorlage war als „ENTWURF, vor Veröffentlichung prüfen lassen“ gekennzeichnet; ob eine Anwaltsprüfung erfolgt ist, ist nicht dokumentiert.
- **AGB und Datenschutz-Ergänzungen** sind noch Entwurf. Die Datenschutzerklärung muss Meta, Anthropic, Hetzner, Telegram und GA4-Ereignisse nennen.
- **Konflikt WhatsApp:** Der Umbau-Auftrag für den Manager (Verkaufsprodukt) sagt „WhatsApp nur als wa.me-Link, keine API“. Der Carcura-Assistent nutzt die WhatsApp Cloud API. **Vorschlag:** Für den eigenen Betrieb ist das zulässig zu gestalten (Meldungen an die Inhaber, Kundenchats über die Koexistenz). Vorher klären:
  - Werden Kundennachrichten an Anthropic übermittelt?
  - Ergänzung der Datenschutzerklärung
  - AV-Verträge mit Meta-BSP und Anthropic
  - Anwaltsprüfung der USA-Übermittlung

  Im Verkaufsprodukt bleibt es beim Link.
- **Offene Rechtsfragen** (Steuerberater und Anwalt): `carcura-manager/docs/legal/OFFENE-FRAGEN.md` [M].

---

## 9. Wo wir stehen geblieben sind (letzte Aktivität je Strang)

| Strang | Letzter Stand | Datum |
|---|---|---|
| Manager-Umbau | Phase 0 fertig, wartet auf Freigabe; Softwarestand dokumentiert | 12.10. / 23.11. |
| Manager-Betrieb | live auf Hetzner, Backups offen | seit 07.11. |
| Website (WordPress) | neue Startseite, SEO-Seiten, Waschset-Aktion | 16.–19.11. |
| Statischer Relaunch | Startseite mit Porsche-Totale und Scroll-Aufbereitung als Offline-Build | 23.11. |
| WhatsApp-Assistent | fertig gebaut, wartet auf Meta-Freischaltung | seit 30.10. |
| B2B-Mailing | 7 E-Mail-Adressen fehlen | 09.11. |
| Reels | 7 Videos fertig, Veröffentlichung nicht belegt | 18.11. |
| SEO-Monitoring | Ranking-Log seit 09.11. nicht fortgeführt | 09.11. |
| VELUSJET (Nebenstrang) | Folge-Mail an Frau Barkhau entworfen (Demo-Termine) | 03.11. |

---

## 10. Prioritäten

**Jetzt (diese Woche)**
1. Hetzner-Backups einschalten und APP_SECRET sichern. Ohne das droht Totalverlust von Rechnungen und Fotos.
2. Google-Ads-Ziele korrigieren: nur `cc_anfrage` als Primärziel; Offline-Conversions aus den Leads.
3. WhatsApp-Freischaltung über Dualhook starten (Firmennummer), dabei die Datenschutzpunkte aus 8 klären.
4. Manager-Umbau Phase 1 freigeben, mindestens die Sofortmaßnahmen 1.1 (ca. 1 PT).

**Als Nächstes**
- 7 fehlende B2B-Adressen nachliefern.
- Reels veröffentlichen (vor dem 31.12. wegen der Waschset-Aktion).
- 5★-Bewertung beantworten.
- SEO-Technik in Ordnung bringen: Sitemap, robots.txt, llms.txt, doppelter title, 301 für Seite 1048, Tippfehler in der Cookie-Richtlinie.
- Preise vereinheitlichen (Kleinanzeigen 650 → 700 €, CLAUDE.md).
- AGB mit Anzahlungs- und Absageregel vom Anwalt prüfen lassen.

**Später**
- Kundendaten aus den WordPress-Plugins in den Manager zusammenführen.
- Lexware-API, Online-Terminanfrage, Pflegeabos (Phase 2/3 des Plans).
- Entscheiden, ob der statische Relaunch WordPress ersetzt.
- Plugin-Updates und Site-Health-Befunde abarbeiten.
- Aktion am 02.01.2027 zurückbauen.

---

## 11. Prüfauftrag für Codex

Bitte jede Aussage gegen die angegebene Quelle prüfen und Abweichungen melden. Schwerpunkte:
1. Läuft der Manager tatsächlich auf 94.130.76.109 unter `app.carcura.info`? Wie sind die Backup-Einstellungen bei Hetzner?
2. Sind die Befunde H1–H3 aus `carcura-manager/docs/AUDIT.md` weiterhin im Code (Branch `claude/kind-curie-4rhi0y`)?
3. Ist der Wartungsmodus auf carcura.info aktiv? Stimmen Plugin-Versionen und Seitenstatus?
4. Sind die Widersprüche bei Preisen und Kalkulation (Abschnitt 6) richtig erfasst?
5. Fehlt ein Strang? Branches B und C sind nicht in A gemergt; ist dort etwas Wichtiges verloren?
6. Ist die Einordnung in Abschnitt 8 vollständig (Telegram, WhatsApp, Anthropic, verteilte Daten)?
