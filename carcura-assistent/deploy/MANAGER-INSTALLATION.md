# Carcura Manager installieren (Server + Windows-App)

Dauer: rund 30 Minuten, davon 15–20 Minuten Warten beim ersten Bauen.

Was du brauchst:
- **deinen eigenen Laptop**, denn nur dort liegt der SSH-Schlüssel (nicht den Firmen-PC nehmen)
- Internet, zur Not den Hotspot vom Handy
- die Passphrase deines SSH-Schlüssels

## Teil A: Server einrichten (einmalig)

1. Auf dem Laptop **PowerShell** öffnen und eingeben:
   ```
   ssh root@94.130.76.109
   ```
   Passphrase eingeben. Die Zeile beginnt dann mit `root@carcura-assistent`.

2. Diese **eine Zeile** einfügen und Enter drücken:
   ```
   curl -fsSL https://raw.githubusercontent.com/carcura-ai/amazon-KDP/claude/amazon-kdp-kinderbuch-setup-374xk0/carcura-assistent/deploy/manager-einrichten.sh -o /root/manager-einrichten.sh && bash /root/manager-einrichten.sh
   ```
   Das Skript arbeitet 7 Schritte ab. Schritt 4 (Bauen) dauert beim ersten Mal 10–20 Minuten. Das Fenster in der Zeit nicht schließen.

3. Am Ende steht **FERTIG** und darunter der **Einrichtungscode** (Format `XXXX-XXXX-XXXX`). Schreib ihn dir auf.

4. Den geheimen Schlüssel einmal sichern:
   ```
   grep ^APP_SECRET= /opt/carcura-manager/carcura-manager/deploy/.env
   ```
   Den Text hinter `APP_SECRET=` in deinen Passwortmanager kopieren, Eintrag „Carcura Manager APP_SECRET“. Ohne ihn sind gespeicherte Zugangsdaten nach einer Wiederherstellung nicht lesbar.

## Teil B: Windows-App auf dem Laptop

1. Den Installer herunterladen (ca. 98 MB):
   https://github.com/carcura-ai/amazon-KDP/releases/download/desktop-v1.0.0/Carcura-Management-Setup-1.0.0.exe
2. Doppelklick auf die Datei. Falls Windows „Der Computer wurde geschützt“ meldet: **Weitere Informationen** → **Trotzdem ausführen**. Das Programm ist nicht bei Microsoft signiert, deshalb kommt die Meldung.
3. Die App startet. Als **Server-Adresse** `app.carcura.info` eingeben und **Verbinden** klicken.
4. **Ersteinrichtung** ausfüllen:
   - Einrichtungscode aus Teil A
   - Firma: Carcura GbR, Hauptstr. 7, 57632 Walterschen, carcura@web.de, 0170 6669516, https://carcura.info
   - Administrator: dein Name, deine E-Mail als Anmeldename, ein starkes Passwort (in den Passwortmanager)
5. Danach unter **Einstellungen → Benutzer → Benutzer anlegen** ein eigenes Konto für Richy anlegen.

Richy kann die App genauso installieren oder einfach im Browser **https://app.carcura.info** öffnen.

## Wenn etwas hängt

- **Skript bricht ab:** Die letzten 20 Zeilen an Claude schicken. Das Skript kann gefahrlos noch einmal laufen, Daten und Schlüssel bleiben erhalten.
- **„https://app.carcura.info antwortet noch nicht“:** 2 Minuten warten und das Skript noch einmal starten. Hilft das nicht, in der Hetzner-Konsole unter **Firewalls** prüfen, ob die Ports 80 und 443 offen sind.
- **Einrichtungscode vergessen:**
  ```
  cd /opt/carcura-manager/carcura-manager/deploy && docker compose logs app | grep Einrichtungscode
  ```
- **Später aktualisieren:** dieselbe Zeile aus Teil A noch einmal ausführen.

## Danach (nicht heute)

- Hetzner-Backups für den Server einschalten (Server → Backups, ca. 20 % Aufpreis), weil dort Rechnungen und Fotos liegen.
- Den WhatsApp-Assistenten mit dem Firmenhandy anbinden (Dualhook). Er läuft auf demselben Server unter bot.carcura.info und trägt Leads automatisch in den Manager ein.
