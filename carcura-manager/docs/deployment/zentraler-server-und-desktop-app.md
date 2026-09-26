# Inbetriebnahme: zentraler Server + Windows-App

Reihenfolge: erst den Server im Internet einrichten, dann die Windows-App auf jedem PC installieren.
Die Daten liegen danach auf dem Server; jeder PC mit der App und Internet greift auf denselben Stand zu.

## Die zwei Dateien

| Datei | Wofür | Wo |
|---|---|---|
| `Carcura-Management-Setup-1.0.0.exe` | Windows-App, auf jedem PC installieren | GitHub → Repository `carcura-ai/amazon-KDP` → rechts „Releases“ → „Carcura Management 1.0.0 (Windows)“ → Assets |
| `carcura-manager.zip` | Server-Paket (Programm + Anleitung) für den zentralen Server | wird mitgeliefert; alternativ direkt per `git clone` auf dem Server |

Falls unter „Releases“ noch nichts steht: GitHub → Reiter „Actions“ → „Windows-Desktop-App (Installer)“ →
oberster grüner Lauf → ganz unten „Artifacts“ → „Carcura-Management-Windows“ herunterladen und entpacken.

## Teil A – Zentraler Server (einmalig, ca. 45 Minuten)

### A1. Server mieten (EU)
Empfehlung für den Start: virtueller Server bei einem Anbieter mit Rechenzentrum in Deutschland,
z. B. Hetzner Cloud CX22 (2 vCPU, 4 GB RAM, 40 GB SSD, Standort Nürnberg oder Falkenstein), Betriebssystem
Ubuntu 24.04. Kosten derzeit rund 4 bis 6 € im Monat (Preis beim Anbieter prüfen). Beim Anbieter den
**Auftragsverarbeitungsvertrag** (Art. 28 DSGVO) abschließen – bei Hetzner im Kundenkonto online möglich.

### A2. Domain verbinden
Beim Domain-Anbieter einen DNS-Eintrag anlegen: `app.carcura.info` → Typ A → IP-Adresse des Servers.

### A3. Server absichern, Docker installieren und starten
Vorab in der Hetzner-Konsole: **Firewall** anlegen (eingehend nur TCP 22, 80, 443 und UDP 443) und dem Server
zuweisen; beim Anlegen des Servers einen **SSH-Schlüssel** hinterlegen (kein Passwort-Login).

Per SSH auf dem Server:
```
apt update && apt -y upgrade && apt -y install unattended-upgrades
curl -fsSL https://get.docker.com | sh
git clone <Repository> carcura && cd carcura/carcura-manager/deploy
cp .env.example .env
nano .env        # DOMAIN, APP_SECRET (openssl rand -base64 48), SMTP eintragen
docker compose up -d --build
docker compose logs app | grep Einrichtungscode
```
- Das Repository ist privat: auf dem Server einen **Deploy-Key** (nur lesen) anlegen und in GitHub unter
  Settings → Deploy keys eintragen – oder das Server-Paket (ZIP) per `scp` hochladen und entpacken.
- `APP_SECRET` zusätzlich im Passwortmanager ablegen. Ohne ihn sind gespeicherte Zugangsdaten nach einer
  Wiederherstellung nicht mehr lesbar.
- SMTP: Port **587** (STARTTLS, `SYSTEM_SMTP_SECURE=false`). Hetzner sperrt bei neuen Konten ausgehend Port 25 und 465.

Nach 2 bis 5 Minuten ist `https://app.carcura.info` erreichbar; das HTTPS-Zertifikat holt Caddy automatisch.

### A4. Ersteinrichtung oder Umzug der bisherigen Daten
- **Einrichtungscode:** Ein frisch gestarteter Server lässt sich nur mit dem Code einrichten, der im Protokoll steht
  (`docker compose logs app | grep Einrichtungscode`). So kann niemand anderes das erste Administratorkonto anlegen.
- **Neu:** `https://app.carcura.info` öffnen (oder die Windows-App, Teil B), Einrichtungscode und Firmendaten eingeben.
- **Umzug vom Laptop:** Auf dem Laptop unter Einstellungen → System & Sicherung eine Sicherung erstellen und
  herunterladen. Auf dem Server einmal einrichten, dann unter Einstellungen → System & Sicherung → „Sicherung
  hochladen und wiederherstellen“; der Server startet dafür automatisch neu. Wichtig: denselben `APP_SECRET`-Wert
  wie auf dem Laptop verwenden (Datei `data/app-secret.key` des Laptops).
- **Große Sicherung (über 25 MB, z. B. mit vielen Fotos):** direkt auf den Server kopieren und einspielen:
  ```
  scp backup-….zip root@<server>:/root/
  docker compose cp /root/backup-….zip app:/data/restore-pending.zip
  docker compose restart app
  ```
- **Vor echten Daten:** einmal eine Sicherung erstellen und wiederherstellen (Probelauf).

### A5. Sicherung außerhalb des Servers (Pflicht)
Der Server legt täglich eine Sicherung im Datenvolume ab – auf **demselben** Server. Zusätzlich:
- in der Hetzner-Konsole die **Backup-Option** des Servers aktivieren (tägliche Snapshots), und
- eine Kopie außerhalb halten, z. B. Hetzner Storage Box mit täglichem `rsync` des Ordners
  `/var/lib/docker/volumes/deploy_carcura-data/_data/backups/`, oder wöchentlich die neueste Sicherung über
  Einstellungen → System & Sicherung herunterladen und auf einem eigenen Datenträger ablegen.

### A6. Updates des Servers
```
cd ~/carcura && git pull
cd carcura-manager/deploy && docker compose up -d --build
```
Vor Datenbank-Änderungen legt der Server automatisch eine Sicherung (`…-pre-update.zip`) an.
Alte Images gelegentlich entfernen: `docker image prune -f`.

## Teil B – Windows-App (je PC, ca. 3 Minuten)

1. `Carcura-Management-Setup-<Version>.exe` ausführen.
   Ohne Code-Signatur zeigt Windows „Der Computer wurde durch Windows geschützt“ → „Weitere Informationen“ →
   „Trotzdem ausführen“ (einmalig).
2. Installationsort bestätigen. Der Installer legt eine **Desktop-Verknüpfung** und einen **Startmenü-Eintrag**
   „Carcura Management“ an und startet die App.
3. Beim ersten Start die Server-Adresse eingeben, z. B. `app.carcura.info`, dann „Verbinden“.
4. Anmelden. Jeder Mitarbeiter bekommt ein eigenes Konto (Einstellungen → Benutzer); keine gemeinsamen Zugänge.

Die App funktioniert nur mit Internetverbindung. Ohne Verbindung erscheint „Keine Verbindung“ mit
„Erneut versuchen“.

## Teil C – Installer selbst bauen (Windows)

Voraussetzung: Node.js 22.13 oder neuer.
```
cd carcura-manager\desktop
build-windows.cmd
```
Ergebnis: `desktop\dist\Carcura-Management-Setup-1.0.0.exe`.
Alternativ baut GitHub Actions (Workflow „Windows-Desktop-App (Installer)“) den Installer bei jeder Änderung
an `desktop/`; er liegt dann unter Actions → Lauf → Artifacts.

### Kunden-Version mit fester Server-Adresse
Für einen Betrieb, der die App nicht selbst einrichten soll, in `desktop/app-config.json` setzen:
```json
{ "defaultServerUrl": "https://app.carcura.info", "lockServerUrl": true }
```
und den Installer neu bauen.

## Teil D – Kosten im Überblick

| Posten | Kosten | Pflicht |
|---|---|---|
| Server (EU, 4 GB RAM) | ca. 4–6 €/Monat | ja |
| Domain | vorhanden (carcura.info) | ja |
| Externe Sicherung (Storage Box 1 TB) | ca. 4 €/Monat | dringend empfohlen |
| Code-Signing-Zertifikat | ca. 10 $/Monat (Azure Trusted Signing) bis 300 €/Jahr (OV) | vor dem Verkauf an andere Betriebe |
