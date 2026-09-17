# Carcura Manager kostenlos auf dem iPhone – der AltStore-Weg

Dieser Weg kostet nichts. Der Preis dafür: Die App muss alle 7 Tage neu „gestempelt“ werden.
Das übernimmt der Windows-Laptop automatisch, sobald das iPhone im selben WLAN ist. Läuft der
Laptop mal länger als eine Woche nicht oder ist das iPhone eine Woche nicht im Werkstatt-WLAN, öffnet
sich die App nicht mehr, bis beide wieder zusammenkommen. Daten gehen dabei nie verloren, sie liegen
auf dem Server.

Du brauchst: den Windows-Laptop, das iPhone, eine Apple-ID (die normale vom iPhone reicht), ein
USB-Kabel für die erste Einrichtung und ein GitHub-Konto mit Zugriff auf das Repository.

---

## Teil A – App-Datei bauen lassen (10 Minuten, im Browser)

Die App-Datei (`.ipa`) wird von GitHub auf einem Mac in der Cloud gebaut. Du brauchst keinen Mac
und kein Apple-Entwicklerkonto.

1. Im Browser das Repository öffnen → Reiter **„Actions“**.
2. Links den Workflow **„iOS App-Datei (unsigniert, für AltStore)“** anklicken → rechts
   **„Run workflow“** → grüner Knopf „Run workflow“.
3. Etwa 10 bis 15 Minuten warten, bis der Lauf einen grünen Haken hat.
4. Den Lauf anklicken → ganz unten unter **„Artifacts“** die Datei `CarcuraManager-ipa`
   herunterladen. Es ist eine ZIP-Datei; darin liegt `CarcuraManager-<Nummer>.ipa`.
   Die `.ipa` in einen Ordner auf dem Laptop legen, zum Beispiel `C:\Carcura\App\`.

Bleibt der Lauf rot, den Text des fehlgeschlagenen Schritts kopieren und mir schicken.

---

## Teil B – AltServer auf dem Windows-Laptop (15 Minuten, einmalig)

AltServer ist das Programm, das die App mit deiner Apple-ID signiert und alle 7 Tage verlängert.

1. **iTunes und iCloud von Apple installieren – nicht aus dem Microsoft Store.**
   AltStore braucht die Versionen von Apples Website:
   - iTunes: https://www.apple.com/itunes/download/win64 (die Seite bietet die Store-Version an;
     der direkte Windows-Installer heißt „iTunes64Setup.exe“ und ist über den Link „Windows 64-Bit“
     weiter unten erreichbar)
   - iCloud: https://support.apple.com/HT204283 → „iCloud für Windows von Apple herunterladen“
   Sind bereits die Store-Versionen installiert, diese zuerst deinstallieren.
2. **AltServer herunterladen:** https://altstore.io → „Download AltServer for Windows“.
   ZIP entpacken, `setup.exe` ausführen. AltServer erscheint als Symbol in der Taskleiste unten rechts
   (eventuell unter dem Pfeil „ausgeblendete Symbole“).
3. **iPhone per Kabel anschließen.** Auf dem iPhone „Diesem Computer vertrauen“ bestätigen, in
   iTunes das iPhone auswählen und **„Mit diesem iPhone über WLAN synchronisieren“** anhaken →
   „Anwenden“. Das ist der Schalter, der später die automatische Verlängerung ohne Kabel erlaubt.
4. **AltStore auf das iPhone bringen:** Rechtsklick auf das AltServer-Symbol → „Install AltStore“ →
   dein iPhone auswählen → Apple-ID und Passwort eingeben. Nach einer Minute liegt „AltStore“ auf dem
   iPhone.
   Hinweis zur Apple-ID: AltServer nutzt sie, um bei Apple ein kostenloses Entwicklerzertifikat zu
   holen. Wer die Haupt-Apple-ID nicht eingeben möchte, legt eine zweite Apple-ID nur für AltStore
   an (appleid.apple.com). Diese zweite ID muss nicht auf dem iPhone angemeldet sein; sie wird nur
   in AltServer und in der AltStore-App eingegeben.
5. **Auf dem iPhone freigeben:**
   - Einstellungen → Allgemein → VPN & Geräteverwaltung → deine Apple-ID antippen → „Vertrauen“.
   - Einstellungen → Datenschutz & Sicherheit → ganz unten **„Entwicklermodus“** einschalten
     (iPhone startet neu, danach bestätigen).
6. AltStore auf dem iPhone öffnen. Unter „Settings“ mit derselben Apple-ID anmelden.

---

## Teil C – Carcura Manager installieren (5 Minuten)

Die `.ipa` aus Teil A muss auf das iPhone. Der einfachste Weg:

1. Die Datei `CarcuraManager-….ipa` vom Laptop auf das iPhone bringen. AirDrop gibt es unter Windows
   nicht, deshalb entweder
   - in **iCloud Drive** oder **OneDrive** legen und auf dem iPhone in der App „Dateien“ öffnen, oder
   - sich selbst per E-Mail schicken und den Anhang in „Dateien“ speichern, oder
   - direkt am iPhone im Browser bei GitHub anmelden, den Actions-Lauf öffnen und das Artifact
     herunterladen (landet in „Dateien“ → „Downloads“, ZIP antippen zum Entpacken).
2. Auf dem iPhone AltStore öffnen → Reiter **„My Apps“** → **„+“** oben links → in „Dateien“ die
   `.ipa` auswählen.
3. AltStore signiert und installiert die App. Nach etwa einer Minute liegt **„Carcura Manager“** auf
   dem Home-Bildschirm.
4. Beim ersten Start die Server-Adresse eingeben:
   - im Werkstatt-WLAN: `http://<IP-des-Laptops>:4800`, zum Beispiel `http://192.168.178.20:4800`.
     Dafür muss in `carcura-manager\.env` auf dem Laptop `HOST=0.0.0.0` stehen (Programm danach neu
     starten). Die IP zeigt `ipconfig` in der Eingabeaufforderung.
   - von unterwegs: die öffentliche HTTPS-Adresse, sobald es eine gibt (Cloudflare Tunnel oder Server).

Beim ersten Öffnen kann iOS fragen, ob die App auf das lokale Netzwerk zugreifen darf → „Erlauben“.

---

## Teil D – Damit die App am Laufen bleibt

- **Alle 7 Tage** muss AltStore die App verlängern. Das passiert automatisch, wenn:
  - der Laptop an ist und AltServer läuft (Symbol in der Taskleiste; startet mit Windows),
  - das iPhone im selben WLAN ist,
  - AltStore auf dem iPhone gelegentlich geöffnet wird oder die Hintergrundaktualisierung an ist
    (Einstellungen → Allgemein → Hintergrundaktualisierung → AltStore an).
- In AltStore unter „My Apps“ steht bei jeder App, wie viele Tage sie noch gültig ist. Mit
  „Refresh All“ verlängerst du sofort von Hand.
- **Maximal 3 Apps** gleichzeitig mit einer freien Apple-ID, und höchstens 10 neue App-Signaturen
  pro Woche. Für den Manager reicht das.
- **Neue Version der App:** Teil A wiederholen, die neue `.ipa` in AltStore über „+“ installieren.
  Die App-Oberfläche selbst aktualisiert sich ohne neue `.ipa`, sobald der Manager auf dem Laptop
  aktualisiert wurde – ein neuer App-Build ist nur nötig, wenn sich die App-Hülle ändert.

---

## Wenn etwas hakt

| Problem | Lösung |
|---|---|
| AltServer findet das iPhone nicht | iTunes läuft nicht oder ist die Store-Version. iPhone entsperren, „Vertrauen“ bestätigen, Kabel wechseln |
| „Could not find AltServer“ auf dem iPhone | Laptop und iPhone nicht im selben WLAN, oder AltServer nicht gestartet, oder WLAN-Sync in iTunes nicht aktiv |
| Apple-Anmeldung schlägt fehl | Zwei-Faktor-Code abwarten und eingeben; bei „Apple ID has been locked“ das Passwort über appleid.apple.com zurücksetzen |
| App startet nicht mehr, Meldung „nicht mehr verfügbar“ | Die 7 Tage sind abgelaufen: iPhone ins Werkstatt-WLAN, AltStore öffnen, „Refresh All“ |
| „Maximum number of apps reached“ | Eine andere Sideload-App in AltStore entfernen |
| App zeigt „Keine Verbindung“ | Läuft `start.cmd` auf dem Laptop? Steht `HOST=0.0.0.0` in `.env`? Windows-Firewall beim ersten Start mit „Zulassen“ bestätigt? |

Sobald die App bei einem zweiten Menschen laufen soll oder du das Produkt an andere Betriebe
verkaufst, lohnt sich das Apple Developer Program (99 USD/Jahr). Dann gilt die Anleitung in
`README.md` (TestFlight), der Wochen-Rhythmus entfällt, und der Code bleibt derselbe.
