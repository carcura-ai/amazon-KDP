# Carcura-Assistent (WhatsApp)

Der digitale Kollege für Alex und Richy. Er läuft auf einem eigenen kleinen Server und schreibt euch beiden **einzeln** per WhatsApp.

**Was er kann (Version 1):**
- **Website-Anfragen sofort aufs Handy** – locker formuliert, mit allen Kundendaten und der Frage „Mail oder ruft ihr an?“.
- **Chat mit der KI (Claude)** – jeder für sich:
  - Anfragen auflisten, Status und Termin pflegen, Leads von Instagram oder Telefon eintragen.
  - Dem anderen Bescheid geben („sag Richy, ich ruf den an“).
  - **Kunden-E-Mails**: Der Assistent zeigt zuerst einen Entwurf und schickt ihn erst nach eurem OK.
  - **Website ändern**: Der Assistent zeigt zuerst vorher/nachher und ändert erst nach eurem OK.
  - **Rechnungen** als Foto oder PDF schicken: Er liest die Eckdaten aus und speichert sie.
- **Montags 9 Uhr Wochenrückblick** über die Anfragen.
- **Fertige Auswertungen weiterleiten**, zum Beispiel die bisherige Wochenauswertung (`POST /report`).

- **Kunden-WhatsApps an die Firmennummer** sofort melden (Variante Firmennummer).
- **Neue Google-Bewertungen sofort melden**, mit Antwort: 5 Sterne beantwortet er automatisch und sagt euch, was er geschrieben hat. Bei schlechteren Bewertungen kommt ein Vorschlag, gepostet wird erst nach eurem OK.
- **Montags 9 Uhr Wochenbericht** mit allem: Werbeausgaben und was dabei rauskam, Website-Besucher und woher, gesendete und fast gesendete Anfragen, WhatsApp- und Anruf-Klicks, Google-Profil (Aufrufe, Anrufe, Routen), Bewertungen, offene Anfragen und ein konkreter Vorschlag.
- **Zahlen jederzeit im Chat:** „Wie lief die Werbung diese Woche?“, „Wie viele waren gestern auf der Seite?“

**Noch nicht drin, kommt als Nächstes:** Google-Kalender und Sprachnachrichten.

**Sicherheit:**
- **Website-Änderungen und Kunden-Mails brauchen immer euer OK in einer neuen Nachricht.** Das ist im Programm fest erzwungen, nicht nur der KI gesagt. Den Vorschlag des einen kann der andere nicht freigeben.
- Fremde Nummern bekommen nur einen Hinweis auf eure Geschäftsnummer.
- Nur Meta kann Nachrichten einliefern; jede eingehende Nachricht wird auf ihre Meta-Signatur geprüft.

---

## Variante Firmennummer (Koexistenz) – empfohlen
Der Bot läuft auf der Firmennummer **+49 170 6669516**, die WhatsApp-Business-App auf dem Handy bleibt unverändert.
- Der Bot schreibt Alex und Richy **auf ihre privaten Nummern**. Diese stehen in `OWNERS`, niemals die Firmennummer.
- Mit `KUNDEN_CHATS=melden` gilt: Schreibt ein Kunde, bekommt er **nichts** vom Bot. Ihr beide werdet benachrichtigt und antwortet selbst in der App.
- `WA_BOT_NUMBER=+49 170 6669516` eintragen. Der Bot startet nicht, wenn diese Nummer versehentlich als Inhaber eingetragen ist.

**Anmeldung:**
- Die Anmeldung läuft nicht über Schritt 1–2 unten, sondern über die **Koexistenz-Anmeldung (Embedded Signup)** eines Meta-Partners, z. B. Dualhook oder 360dialog.
- Voraussetzung ist die WhatsApp-Business-App ab Version 2.24.17.

**Wichtig:**
- Nach der Anmeldung werden **verknüpfte Geräte** (WhatsApp Web/Desktop) getrennt. Unterstützte Geräte lassen sich neu verknüpfen, WhatsApp für Windows wird nicht unterstützt.
- Die Business-App muss **mindestens alle 13 Tage** geöffnet werden.

## Einrichtung – Schritt für Schritt (ca. 1–2 Stunden)

### 1. Nummer für den Assistenten
- **Neue Prepaid-SIM besorgen**, etwa 10 €. **Nicht** eure Kundennummer 0170 6669516.
- Auf dieser Nummer darf **kein normales WhatsApp** installiert sein.
- Die SIM muss nur einmal eine SMS mit dem Bestätigungscode empfangen können.

### 2. Meta (WhatsApp Cloud API)
1. Auf **business.facebook.com** ein Business-Portfolio „Carcura GbR“ anlegen, falls es noch keins gibt.
2. Auf **developers.facebook.com** → *Meine Apps* → *App erstellen*:
   - Anwendungsfall „Mit Kunden über WhatsApp in Kontakt treten“ wählen.
   - Das Portfolio verknüpfen.
3. In der App unter *WhatsApp → API-Setup*:
   - **Telefonnummer hinzufügen**. Das ist die neue SIM.
   - Anzeigename **„Carcura Assistent“** eingeben.
   - Per SMS bestätigen.
   - Die **Phone number ID** notieren → `WA_PHONE_NUMBER_ID`.
4. **Dauerhaften Token erstellen** im Business Manager:
   - Pfad: *Einstellungen → Nutzer → Systemnutzer → Hinzufügen*, Rolle Admin.
   - App und WhatsApp-Konto zuweisen.
   - *Token generieren* mit den Berechtigungen `whatsapp_business_messaging` und `whatsapp_business_management`.
   - Den Token notieren → `WA_TOKEN`.
5. In der App unter *App-Einstellungen → Allgemeines* den **App-Geheimcode** kopieren → `WA_APP_SECRET`.
6. Unter *WhatsApp-Manager → Nachrichtenvorlagen* eine **Vorlage anlegen**:
   - Name: `carcura_hinweis`
   - Kategorie: **Dienstprogramm (Utility)**
   - Sprache: Deutsch
   - Text: `Neue Nachricht vom Carcura-Assistenten: {{1}}. Antworte kurz, dann schicke ich dir alles.`
   - Beispiel für {{1}}: `Neue Anfrage L-0001: Basic Innen & Außen von Max`
   - Die Prüfung durch Meta dauert meist Minuten bis wenige Stunden.
7. Im WhatsApp-Manager eine **Zahlungsmethode** hinterlegen. Vorlagen kosten wenige Cent pro Stück.
8. **Den Webhook erst nach Schritt 4 eintragen** (der Server muss dann laufen). Pfad: *WhatsApp → Konfiguration → Webhook*:
   - Rückruf-URL: `https://bot.carcura.info/webhook`
   - Überprüfungstoken: ein selbst ausgedachtes Passwort, dasselbe wie `WA_VERIFY_TOKEN` in der `.env`.
   - Danach das Feld **messages** abonnieren.

Wann WhatsApp was kostet: Antwortet der Assistent innerhalb von 24 Stunden nach eurer letzten Nachricht, ist das in der Regel kostenlos. Ist das Fenster zu, schickt er zuerst die kurze Vorlage. Sobald ihr antwortet, liefert er den ganzen Text nach. Aktuelle Preise stehen bei Meta unter „WhatsApp Business Platform Pricing“.

### 3. Claude (KI)
- Auf **console.anthropic.com** ein Konto anlegen.
- Zahlungsmittel hinterlegen und ein **monatliches Ausgabenlimit** setzen, z. B. 50 €.
- Einen API-Schlüssel erstellen → `ANTHROPIC_API_KEY`.

### 4. Server (Hetzner, Rechenzentrum in Deutschland)
1. Auf **hetzner.com/cloud** einen Server anlegen:
   - Typ: kleinster Typ (2 vCPU / 4 GB, etwa 4–5 € pro Monat)
   - Betriebssystem: Ubuntu 24.04
   - Standort: Nürnberg oder Falkenstein
   - Im Hetzner-Konto den **Auftragsverarbeitungsvertrag (AVV)** abschließen.
2. Dort, wo die Domain carcura.info verwaltet wird, einen **A-Eintrag** anlegen: `bot` → IP-Adresse des Servers.
3. Auf dem Server ausführen:
   ```bash
   curl -fsSL https://get.docker.com | sh
   git clone <dieses Repository> && cd carcura-assistent   # oder Ordner per SFTP hochladen
   cp .env.example .env && nano .env                        # alle Werte eintragen
   docker compose up -d --build
   docker compose logs -f assistent                         # muss "Carcura-Assistent läuft" zeigen
   ```
4. Jetzt bei Meta den Webhook eintragen (Schritt 2.8). Meta bestätigt ihn sofort, wenn der Server läuft.

### 5. Website-Anfragen anbinden
1. In `wordpress/carcura-assistent-bridge.php` das `LEAD_SECRET` eintragen. Es muss derselbe Wert sein wie in der `.env`.
2. Die Datei per FTP oder Datei-Manager nach `wp-content/mu-plugins/` hochladen. Den Ordner `mu-plugins` gegebenenfalls anlegen.
3. Die bisherige E-Mail bei Anfragen bleibt erhalten. Abschalten erst nach der Testwoche.

### 6. Website-Änderungen und Kunden-Mails freischalten
- **WordPress:**
  - Pfad: *Benutzer → Profil → Anwendungspasswörter*.
  - Name „Carcura Assistent“ → *Neues Anwendungspasswort*.
  - Eintragen in `WP_USER` (dein Benutzername) und `WP_APP_PASSWORD`.
- **web.de:**
  - Pfad: *Einstellungen → POP3/IMAP Abruf*.
  - „E-Mails über externe Programme senden und empfangen“ aktivieren.
  - Das Passwort eintragen in `SMTP_PASS`. Wenn bei web.de eine Zwei-Faktor-Anmeldung aktiv ist, stattdessen ein App-Passwort erstellen und eintragen.
- Danach: `docker compose up -d` (lädt die Einstellungen neu).

### 6b. Zahlen und Bewertungen
1. **Windsor.ai:**
   - Auf windsor.ai den **API-Schlüssel** kopieren und in `WINDSOR_API_KEY` eintragen.
   - Google Ads, Analytics und das Unternehmensprofil sind dort schon verbunden. Die Konto-IDs stehen bereits in der `.env.example`.
   - Prüfen, ob euer Windsor-Tarif API-Zugriff enthält.
2. **Meta-Werbung:** in Windsor „Facebook Ads“ verbinden und die Werbekonto-ID in `WINDSOR_META_ACCOUNT` eintragen.
3. **Antworten auf Bewertungen selbst posten (optional):**
   - Google Cloud-Projekt anlegen.
   - Zugang zur **Business Profile API** beantragen. Google prüft das, das dauert meist einige Tage.
   - OAuth-Client anlegen, einmalig ein Refresh-Token erzeugen und `GBP_*` ausfüllen.
   - Bis das steht, schickt der Assistent die fertige Antwort zum Kopieren.

### 7. Testen
- **Chat:** Von deinem Handy an die Assistenten-Nummer „Moin“ schreiben. Er antwortet locker.
- **Anfragen:** Auf carcura.info/anfragen eine Test-Anfrage senden. Ihr beide bekommt eine WhatsApp.
- **E-Mail:** „Schreib dem Kunden eine Mail und frag nach einem Termin“ → Er zeigt einen Entwurf → „ja“ → Mail geht raus, mit Kopie an carcura@web.de.

---

## Wochenauswertung von außen schicken
Jede fertige Auswertung lässt sich an euch beide weiterleiten, zum Beispiel die bisherige Telegram-Auswertung:
```bash
curl -X POST https://bot.carcura.info/report \
  -H "Content-Type: application/json" -H "X-Carcura-Secret: <LEAD_SECRET>" \
  -d '{"text":"Woche 43: 2 Anfragen, 140 € Ads, …","preview":"Die Wochenauswertung ist da"}'
```

## Kosten (Schätzung)
| Posten | pro Monat |
|---|---|
| Hetzner-Server | ca. 5 € |
| Claude, je nach Nutzung (Modell `claude-opus-5-5`, Effort `medium`) | ca. 10–40 € |
| WhatsApp-Vorlagen (nur wenn das 24-h-Fenster zu ist) | wenige Euro |
| SIM | Guthaben reicht, da nur Empfang nötig |

Günstiger geht es mit `CLAUDE_EFFORT=low` in der `.env`.

## Datenschutz (bitte erledigen)
- **Datenschutzerklärung ergänzen**: Anfragen werden zur Bearbeitung über die WhatsApp Business Platform (Meta Platforms Ireland) an die Inhaber übermittelt und von einer KI (Anthropic) verarbeitet. Server bei Hetzner in Deutschland.
- **Auftragsverarbeitung**:
  - Hetzner: AVV in der Cloud-Konsole abschließen.
  - Meta: Die Auftragsverarbeitungsbedingungen sind Teil der WhatsApp-Business-Bedingungen.
  - Anthropic: Die Bedingungen zur Datenverarbeitung (DPA) sind Teil der kommerziellen Nutzungsbedingungen.
- **Im Zweifel kurz anwaltlich prüfen lassen**, besonders den Satz zur Übermittlung in die USA.
- **Rechnungen**: Der Assistent speichert nur die Eckdaten. Für die Buchhaltung gehören Belege weiterhin ins Buchhaltungsprogramm bzw. an den Steuerberater (Aufbewahrungspflicht nach GoBD).

## Für Entwickler
- Tests: `npm test`. Sie laufen komplett ohne echte Zugänge.
- Daten liegen im Docker-Volume `assistent_data`:
  - Anfragen
  - Gesprächsverläufe
  - Vorschläge
  - Eingangsdateien
- Den Gesprächsverlauf hängt der Assistent nur an, er ändert ihn nie nachträglich. Das verlangt die Claude-API. Nach 12 Stunden Pause beginnt ein frisches Gespräch; Anfragen und Notizen bleiben gespeichert.
