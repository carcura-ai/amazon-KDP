# Carcura Manager – Installations- und Einrichtungsanleitung

Diese Anleitung führt Schritt für Schritt von der ZIP-Datei bis zum laufenden System auf einem
Windows-Laptop. macOS und Linux sind am Ende jedes Abschnitts vermerkt. Rechne für die
Erstinstallation mit 20 bis 30 Minuten, davon die meiste Zeit Download und Installation der
Abhängigkeiten.

---

## Teil 1 – Vorbereitung (einmalig, 10 Minuten)

### Schritt 1: Node.js installieren

Node.js ist die Laufzeitumgebung, in der das Programm läuft. Es ist kostenlos.

1. Browser öffnen und https://nodejs.org aufrufen.
2. Die Version **„LTS“** (Long Term Support) herunterladen. Es muss **Version 22.13 oder neuer** sein; die aktuelle LTS (24) ist richtig.
3. Die heruntergeladene Datei (`node-v22….msi`) doppelklicken und mit „Next“ durch das Setup gehen.
   Alle Voreinstellungen so lassen. Wichtig: Die Option „Add to PATH“ muss angehakt bleiben (Standard).
4. Prüfen: Windows-Taste drücken, `cmd` eingeben, Eingabeaufforderung öffnen, dort tippen:
   ```
   node -v
   ```
   Es muss etwas wie `v22.20.0` erscheinen. Erscheint eine Fehlermeldung, den Rechner neu starten und erneut prüfen.

macOS: Installer von nodejs.org (`.pkg`) ausführen. Linux: Paket `nodejs` Version 22 aus dem Repository oder von nodejs.org.

### Schritt 2: Programmordner anlegen

1. Die Datei `carcura-manager.zip` in einen dauerhaften Ordner legen, zum Beispiel `C:\Carcura\`.
   **Nicht auf den Desktop, nicht in „Downloads“, nicht in „Dokumente“**, weil diese Ordner bei den
   meisten Windows-Rechnern von OneDrive synchronisiert werden. OneDrive sperrt Dateien während der
   Installation und lädt tausende Programmdateien in die Cloud. Das Installationsskript bricht in
   solchen Ordnern absichtlich ab. Ordner anlegen: Explorer → „Dieser PC“ → Laufwerk `C:` → Rechtsklick
   → Neu → Ordner → `Carcura`.
2. Rechtsklick auf die ZIP-Datei → „Alle extrahieren…“ → Ziel `C:\Carcura\` bestätigen.
3. Danach existiert der Ordner `C:\Carcura\carcura-manager\` mit den Unterordnern `server`, `web`,
   `scripts`, `docs` und `e2e`.

> Der Ordner `carcura-manager` ist später auch der Ort, an dem alle Daten liegen
> (`data\` mit Datenbank, Fotos, PDFs und Sicherungen). Er darf nicht verschoben oder gelöscht werden.

---

## Teil 2 – Installation (einmalig, 10 Minuten)

### Schritt 3: Installationsskript ausführen

1. Im Explorer den Ordner `C:\Carcura\carcura-manager\scripts\` öffnen.
2. Die Datei `install.cmd` doppelklicken. Ein schwarzes Fenster öffnet sich und zeigt den Fortschritt.
3. Das Skript macht nacheinander:
   - Node.js-Version prüfen
   - Datei `.env` aus der Vorlage anlegen (Einstellungen wie Port und Datenordner)
   - Abhängigkeiten herunterladen (`npm install`, 2 bis 8 Minuten je nach Internet)
   - Chromium für die PDF-Erzeugung laden (etwa 150 MB)
   - Oberfläche und Server bauen (`npm run build`)
4. Am Ende steht `Fertig. Start mit scripts\start.cmd`. Mit einer beliebigen Taste schließen.

Bei einer Fehlermeldung: Das Fenster nicht schließen, den Text abfotografieren oder kopieren. Die
häufigsten Ursachen stehen in Teil 7.

Windows-SmartScreen: Beim ersten Doppelklick kann „Der Computer wurde durch Windows geschützt“
erscheinen. Dann auf „Weitere Informationen“ und „Trotzdem ausführen“ klicken. Das Skript ist
Klartext und kann mit dem Editor geöffnet und gelesen werden.

macOS/Linux: Terminal öffnen, `cd /Pfad/zu/carcura-manager`, dann `bash scripts/install.sh`.

---

## Teil 3 – Erster Start und Einrichtung (5 Minuten)

### Schritt 4: Programm starten

1. Im Ordner `scripts\` die Datei `start.cmd` doppelklicken.
2. Ein Fenster öffnet sich und bleibt offen. Darin steht nach wenigen Sekunden
   `Oberfläche: http://127.0.0.1:4800`. **Dieses Fenster muss offen bleiben, solange das Programm
   läuft.** Wird es geschlossen, ist das Programm beendet (die Daten bleiben erhalten).
3. Browser öffnen (Chrome, Edge oder Firefox) und `http://127.0.0.1:4800` eingeben.
   Tipp: Diese Adresse als Lesezeichen speichern.

macOS/Linux: `bash scripts/start.sh` im Terminal.

### Schritt 5: Einrichtungsassistent ausfüllen

Beim ersten Aufruf erscheint die Ersteinrichtung mit zwei Blöcken:

**Unternehmen**
- Firmenname (Pflicht), zum Beispiel `Carcura`
- E-Mail, Telefon, Website, Straße, PLZ, Ort (erscheinen später auf Rechnungen)
- Markenfarbe: Standard ist das Carcura-Gelb `#E8F320`

**Administrator (dein Zugang)**
- Vorname, Nachname
- E-Mail-Adresse = Anmeldename
- Passwort: mindestens 10 Zeichen mit Groß- und Kleinbuchstaben und einer Ziffer.
  Dieses Passwort gut aufbewahren. Es wird nirgends im Klartext gespeichert und kann nicht
  „wiederhergestellt“, sondern nur von einem anderen Administrator neu gesetzt werden.

Der Haken „Startkatalog typischer Aufbereitungsleistungen anlegen“ erzeugt den Leistungskatalog (Innenreinigung,
Lackpolitur, Keramikversiegelung usw.) mit Preis 0. Die Preise werden in Schritt 7 gepflegt.

Nach „Einrichtung abschließen“ bist du angemeldet und siehst das Dashboard.

---

## Teil 4 – Grundeinstellungen (15 Minuten, in dieser Reihenfolge)

Alle Punkte findest du links unter **Einstellungen**.

### Schritt 6: Unternehmen & Branding
- Rechtlicher Name (z. B. `Carcura GbR`), Steuernummer, USt-IdNr., Bankverbindung.
  Diese Angaben stehen in der Fußzeile jeder Rechnung.
- Logo hochladen (PNG oder JPG, quadratisch wirkt am besten).
- Kleinunternehmer nach § 19 UStG nur anhaken, wenn das für dich gilt. Dann weisen Rechnungen
  keine Umsatzsteuer aus. Im Zweifel den Steuerberater fragen.
- Zahlungsziel (Standard 14 Tage) und Terminerinnerung (Standard 2 Tage vorher).
- Produktname und Herstellerhinweis sind nur für den Verkauf an andere Betriebe relevant.
- Speichern.

### Schritt 7: Leistungen
- Für jede Leistung Preis (brutto sichtbar, netto gespeichert), Dauer in Minuten und
  Materialkosten eintragen. Dauer und Materialkosten braucht die Preisanalyse für Marge und
  Stundenertrag. Nicht angebotene Leistungen deaktivieren, eigene ergänzen.

### Schritt 8: Benutzer & Rollen
- Für jeden Mitarbeiter einen Benutzer anlegen. Rollen:
  - **Administrator**: alles
  - **Manager**: alles außer Benutzerverwaltung, Integrationen und Sicherungen
  - **Mitarbeiter**: Kunden, Termine, Aufträge, Protokolle, Fotos, keine Finanzen
  - **Buchhaltung**: Rechnungen, Ausgaben, Finanzen, nur lesend im Rest
  - **Nur lesen**: sieht alles, ändert nichts
- Die Rechte je Rolle lassen sich in der Tabelle darunter feiner einstellen.

### Schritt 9: E-Mail-Versand (für Terminerinnerungen, Angebote, Rechnungen)
- Zugangsdaten deines E-Mail-Postfachs eintragen (SMTP). Beispiele:
  - web.de: Server `smtp.web.de`, Port `587`, Verschlüsselung „STARTTLS“ (nicht „SSL“ anhaken),
    Benutzer = deine web.de-Adresse, Passwort = dein Postfach-Passwort. Bei web.de muss vorher
    im Postfach unter Einstellungen → POP3/IMAP der Zugriff „per E-Mail-Programm“ erlaubt sein.
  - IONOS/Strato/eigene Domain: Daten aus dem Hosting-Kundencenter.
  - Gmail: App-Passwort erforderlich (Google-Konto → Sicherheit → App-Passwörter).
- Absendername (z. B. `Carcura`) und Absenderadresse eintragen, Speichern, dann
  „Testmail an mich senden“. Erst wenn die Testmail ankommt, ist der Versand aktiv.

### Schritt 10: Integrationen (optional, jederzeit nachholbar)
- **Website-Lead-Eingang**: Token kopieren. Damit die Website Anfragen automatisch in den Manager
  schickt, muss der Laptop aus dem Internet erreichbar sein (siehe Teil 6). Bis dahin Anfragen
  manuell oder per CSV-Import erfassen.
- **Windsor.ai** (empfohlen für Google Ads, Meta Ads, Google Analytics, Instagram, Meta-Lead-Formulare):
  API-Key aus dem Windsor-Konto eintragen, „Verbindung testen“, dann unter Marketing
  „Jetzt synchronisieren“. Danach läuft der Abgleich alle 6 Stunden automatisch.
- **KI-Business-Assistent**: API-Schlüssel von https://console.anthropic.com (Kosten pro Frage im
  Cent-Bereich, Abrechnung über Anthropic). Ohne Schlüssel bleibt der Assistent aus, alles andere
  funktioniert.
- **Wettbewerber-Monitoring**: Google-Cloud-API-Key mit aktivierter „Places API (New)“, Suchbegriffe
  und Standort. Ohne Key lassen sich Wettbewerber manuell pflegen.

---

## Teil 5 – Täglicher Betrieb

| Wann | Was |
|---|---|
| Morgens | `start.cmd` starten (oder Autostart, siehe unten), Dashboard prüfen: neue Leads, Termine heute, überfällige Rechnungen, fällige Aufgaben |
| Neue Anfrage | Leads → Lead anlegen (Quelle wählen!) → nach dem Gespräch Status setzen → „Zu Kunde umwandeln“ |
| Termin | Kalender → Termin → Kunde und Fahrzeug wählen. Erinnerung geht automatisch 2 Tage vorher per E-Mail, WhatsApp per Klick |
| Fahrzeugannahme | Kundenakte oder Auftrag → Protokoll: Zustand, Schäden in der Skizze, Fotos, Unterschrift auf Tablet/Handy → „Abschließen“ |
| Nach der Arbeit | Auftrag auf „fertig“ → Rechnung aus dem Auftrag erzeugen → „Ausstellen“ → per E-Mail senden oder PDF drucken |
| Zahlungseingang | Rechnung → Zahlung erfassen. Überfällige Rechnungen erscheinen im Dashboard |
| Ausgaben | Finanzen → Ausgaben → Beleg fotografieren und Betrag eintragen |
| Montags | Wochenbericht unter Berichte lesen (kommt automatisch um 6 Uhr) |
| Monatsende | Rechnungen → CSV und Finanzen → Ausgaben → CSV an den Steuerberater |

### Auf dem iPhone oder iPad als App installieren (2 Minuten)
Der Manager lässt sich auf dem Home-Bildschirm wie eine App ablegen: eigenes Icon, Vollbild ohne
Safari-Leiste, eigener Startbildschirm. Es ist keine Installation aus dem App Store nötig.

1. Auf dem Laptop in `carcura-manager\.env` die Zeile `HOST=127.0.0.1` in `HOST=0.0.0.0` ändern und
   den Manager neu starten (Fenster von `start.cmd` schließen und erneut doppelklicken). Beim ersten
   Start fragt die Windows-Firewall, ob Node.js im privaten Netzwerk kommunizieren darf → „Zugriff zulassen“.
2. IP-Adresse des Laptops ermitteln: Eingabeaufforderung → `ipconfig` → Zeile „IPv4-Adresse“ des
   WLAN-Adapters, z. B. `192.168.178.20`. Tipp: Im Router (FRITZ!Box: Heimnetz → Netzwerk → Gerät
   bearbeiten → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“) die Adresse fest
   vergeben, sonst kann sie sich irgendwann ändern.
3. Auf dem iPhone **Safari** öffnen (nicht Chrome, nur Safari kann Apps auf den Home-Bildschirm legen)
   und `http://192.168.178.20:4800` aufrufen (deine Adresse einsetzen). Anmelden.
4. Unten das **Teilen-Symbol** (Quadrat mit Pfeil nach oben) antippen → nach unten blättern →
   **„Zum Home-Bildschirm“** → Name „Manager“ bestätigen → „Hinzufügen“.
5. Auf dem Home-Bildschirm liegt jetzt das gelbe Icon. Beim Öffnen startet der Manager im Vollbild.
   Die Anmeldung bleibt bis zu 30 Tage gespeichert, solange die App genutzt wird.

Einschränkungen: Die App funktioniert nur, solange der Laptop läuft und das iPhone im selben WLAN ist.
Für den Zugriff von unterwegs braucht es eine öffentliche HTTPS-Adresse (siehe Teil 6). Sobald die gibt,
die App einmal von dieser Adresse aus neu auf den Home-Bildschirm legen. Fotos für Protokolle kommen
direkt aus der Kamera, die Unterschrift wird mit dem Finger geleistet.

### Autostart einrichten (empfohlen)
1. Windows-Taste + R, `shell:startup` eingeben, Enter. Der Autostart-Ordner öffnet sich.
2. Rechtsklick auf `scripts\start.cmd` → „Verknüpfung erstellen“ → die Verknüpfung in den
   Autostart-Ordner ziehen.
3. Ab jetzt startet der Manager bei jeder Anmeldung am Laptop automatisch.

---

## Teil 6 – Sicherung, Update, Website-Anbindung

### Sicherung
- Läuft automatisch jede Nacht um 02:30 (nur wenn das Programm läuft) und beim Start, falls am
  Tag noch keine Sicherung existiert. Ablage: `carcura-manager\data\backups\`.
- Manuell: Einstellungen → System & Sicherung → „Jetzt sichern“. Dort auch Download, Löschen,
  Wiederherstellen und Hochladen einer Sicherung.
- **Wichtig:** Den Ordner `data\backups\` regelmäßig auf einen USB-Stick oder in eine Cloud
  (OneDrive, Google Drive) kopieren. Ein Backup auf demselben Laptop schützt nicht vor Diebstahl,
  Defekt oder Verschlüsselungstrojanern. Einfachster Weg: einmal pro Woche den Ordner
  `data\backups` per Hand in OneDrive oder auf einen USB-Stick kopieren. Wer es automatisch
  möchte: in OneDrive den Ordner `C:\Carcura\carcura-manager\data\backups` als zu sichernden
  Ordner hinzufügen.
- Die Datei `data\app-secret.key` ist **nicht** in der Sicherung enthalten. Ohne sie sind gespeicherte
  Zugangsdaten (SMTP, API-Keys) nach einer Wiederherstellung auf einem anderen Rechner nicht
  lesbar. Diese Datei einmalig in den Passwort-Manager kopieren.

### Update einspielen
- Wenn das Programm über `start.cmd` läuft: Einstellungen → System & Sicherung →
  „Update installieren“. Es wird zuerst gesichert, dann aktualisiert und neu gestartet.
- Voraussetzung ist, dass der Programmordner aus dem Git-Repository stammt (`git pull`).
  Bei der ZIP-Installation stattdessen: Programm beenden, neue ZIP über den Ordner entpacken
  (der Ordner `data\` bleibt unberührt), danach `scripts\update.cmd` ausführen.

### Website-Anfragen automatisch empfangen
Das Formular auf carcura.info kann Anfragen direkt an den Manager schicken. Dafür muss der
Manager aus dem Internet erreichbar sein. Zwei Wege:
1. **Cloudflare Tunnel** (kostenlos): Programm `cloudflared` auf dem Laptop installieren und den
   Port 4800 unter einer Adresse wie `manager.carcura.info` veröffentlichen. Dann in `.env`
   `PUBLIC_URL=https://manager.carcura.info` und `APP_SECRET=<32 zufällige Zeichen>` setzen.
2. **Kleiner Server** (ab etwa 5 Euro/Monat): Programm dort installieren, Laptop und Handy greifen
   über den Browser zu. Läuft dann auch, wenn der Laptop aus ist.
Anschließend im Website-Formular (WordPress) zusätzlich an
`POST https://manager.carcura.info/api/public/leads/website` mit dem Header `X-Lead-Token`
senden. Den Token findest du unter Einstellungen → Integrationen → Website-Lead-Eingang.
Diesen Schritt können wir gemeinsam erledigen, sobald die öffentliche Adresse steht.

---

## Teil 7 – Wenn etwas nicht funktioniert

| Problem | Ursache und Lösung |
|---|---|
| `node` wird nicht erkannt | Node.js nicht installiert oder Rechner nach der Installation nicht neu gestartet |
| `install.cmd` bricht bei `npm install` ab | Internet prüfen, Firewall/Virenscanner kurz pausieren, erneut ausführen |
| Meldung „WARNUNG: Der Ordner liegt unter OneDrive …“ | Ordner nach `C:\Carcura\` verschieben (siehe Schritt 2) und dort `install.cmd` erneut starten |
| Fehler mit `EPERM`, `operation not permitted` oder `Failed to remove some directories` | Dateien sind durch OneDrive oder den Virenscanner gesperrt. Ordner nach `C:\Carcura\` verschieben, Ordner `node_modules` löschen, `install.cmd` erneut starten |
| Fehler mit `node-gyp`, `Visual Studio`, `better-sqlite3` | Veraltete Programmversion. Aktuelle ZIP verwenden – die Datenbank braucht seit Version 0.2 keine Kompilierung mehr |
| Seite `127.0.0.1:4800` lädt nicht | Läuft `start.cmd`? Steht dort ein Fehler? Ist Port 4800 belegt? Dann in `.env` z. B. `PORT=4810` setzen |
| `APP_SECRET ist in Produktion Pflicht` beim Start | Nur in Version 0.2.0: In `carcura-manager\.env` eine Zeile `APP_SECRET=` mit mindestens 32 beliebigen Zeichen ergänzen, oder die aktuelle Version installieren |
| „Build fehlt“ beim Start | `install.cmd` wurde nicht bis zum Ende ausgeführt, erneut starten |
| PDF wird nicht erzeugt | Chromium fehlt. In der Eingabeaufforderung im Ordner `carcura-manager` ausführen: `npx playwright install chromium`. Alternativ in `.env` `CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Testmail kommt nicht an | Server, Port und Verschlüsselung prüfen; bei web.de/GMX den Zugriff für E-Mail-Programme freischalten; Fehlertext steht unter E-Mail-Versand → Versandprotokoll |
| Passwort vergessen | Ein anderer Administrator setzt es unter Benutzer neu. Gibt es keinen: Sicherung einspielen ist keine Lösung, melde dich, es gibt einen Weg über die Datenbank |
| Handy erreicht den Manager nicht | `HOST=0.0.0.0` in `.env`, Neustart, gleiche WLAN, Windows-Firewall-Abfrage beim ersten Start mit „Zulassen“ bestätigen |

Alle technischen Details, Umgebungsvariablen und Zeitpläne stehen in `docs\05-betrieb.md`.

---

## Teil 8 – Datenschutz und Sicherheit (Pflichtprogramm, 1 Stunde)

Das System erfüllt die technischen Anforderungen der DSGVO und die Grundschutz-Empfehlungen des BSI
(Details, Vorlagen und Prüfergebnis in `docs\06-datenschutz-und-sicherheit.md`). Diese Punkte musst du
selbst erledigen, weil sie außerhalb der Software liegen:

1. **BitLocker einschalten** (Windows: Einstellungen → Datenschutz und Sicherheit → Geräteverschlüsselung
   bzw. Systemsteuerung → BitLocker). Ohne Festplattenverschlüsselung sind alle Kundendaten bei
   Diebstahl des Laptops lesbar. Wiederherstellungsschlüssel im Passwort-Manager ablegen.
2. **Zwei-Faktor-Authentifizierung** für dich und alle Administratoren: Einstellungen → Konto & Datenschutz
   → „2FA einrichten“, QR-Code mit der Authenticator-App scannen (Apple Passwörter, Google Authenticator),
   Wiederherstellungscodes ausdrucken. Dann „2FA für Administratoren erzwingen“ aktivieren.
3. **Jeder Mitarbeiter ein eigenes Konto** mit passender Rolle, keine geteilten Passwörter, Konten beim
   Austritt sofort deaktivieren. Mitarbeiter schriftlich auf Vertraulichkeit verpflichten (Vorlage der IHK).
4. **Datenschutzhinweise für Kunden**: Text aus Abschnitt E der Doku in die Website-Datenschutzerklärung
   und auf das Annahmeprotokoll/Auftragsformular übernehmen, Aushang in der Werkstatt.
5. **Verzeichnis der Verarbeitungstätigkeiten** aus Abschnitt D übernehmen, Angaben prüfen, ablegen.
6. **Auftragsverarbeitungsverträge** abschließen: E-Mail-Anbieter, Windsor.ai, bei Nutzung Anthropic,
   Cloud für Sicherungen. Liste in Abschnitt F.
7. **Sicherungen außer Haus**: Ordner `data\backups` wöchentlich auf USB-Stick oder verschlüsselt in
   die Cloud kopieren. Schlüsseldatei `data\app-secret.key` separat im Passwort-Manager sichern.
8. **HTTPS**, sobald das System aus dem Internet erreichbar ist (Teil 6). Ohne HTTPS nur im eigenen WLAN
   betreiben; Gäste-WLAN getrennt halten.
9. **Löschfristen prüfen**: Einstellungen → Konto & Datenschutz. Voreinstellungen: verlorene Anfragen
   12 Monate, Versandprotokoll 12 Monate, Audit-Log 24 Monate. Rechnungen bleiben 10 Jahre.
10. **Auskunft und Löschung auf Kundenwunsch**: Kundenakte → „Export“ liefert die vollständige Auskunft
    als Datei; „Löschen“ entfernt alle personenbezogenen Daten und behält nur die steuerlich
    aufbewahrungspflichtigen Belege unter einem Pseudonym.

Ein Datenschutzbeauftragter ist erst ab etwa 20 ständig mit Datenverarbeitung beschäftigten Personen
Pflicht. Für Verträge, Datenschutzerklärung und den späteren Verkauf an andere Betriebe einen Anwalt
mit Schwerpunkt IT-Recht einbeziehen; die Doku enthält dafür alle technischen Angaben.
