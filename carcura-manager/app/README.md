# Carcura Manager als iPhone-App (ohne App Store)

Dieser Ordner enthält die native iOS-Hülle des Managers. Sie wird als echte App auf dem iPhone
installiert: eigenes Icon auf dem Homescreen, Startbild, Vollbild ohne Browserleiste, Kamera für
Protokollfotos, gespeicherte Anmeldung. Die Verteilung läuft über **TestFlight**, Apples eigenen
Weg für Apps außerhalb des App Stores. Es gibt keine öffentliche Store-Seite, keine Bewertung durch
Apple für interne Tester und niemand außer den eingeladenen Personen kann die App installieren.

## Wie die App aufgebaut ist

Die App ist eine native Hülle (Capacitor 8, Apples WKWebView), in der die Oberfläche des Managers
läuft. Die Daten liegen weiterhin auf deinem Server (Laptop oder Mietserver). Das ist derselbe Aufbau,
den viele Business-Apps nutzen, und hat zwei Vorteile: Änderungen an der Oberfläche brauchen keinen
neuen App-Build, und es gibt nur eine Codebasis für Browser, Tablet und iPhone. Beim ersten Start
fragt die App nach der Server-Adresse und merkt sie sich.

Native Funktionen, die dadurch möglich sind: Icon und Startbild, Statusleiste in Markenfarbe,
Kamera und Fotomediathek über die Dateiauswahl, Sicherheitsbereiche für Dynamic Island. Push-
Benachrichtigungen und Face-ID-Anmeldung lassen sich später als Plugin ergänzen.

## Was du brauchst

| Was | Kosten | Wo |
|---|---|---|
| Apple Developer Program | 99 USD / Jahr | https://developer.apple.com/programs/enroll/ – Freischaltung dauert 1 bis 2 Tage, Apple-ID mit Zwei-Faktor nötig |
| Server mit HTTPS-Adresse | ab ca. 5 EUR / Monat oder Cloudflare Tunnel kostenlos | Damit die App auch außerhalb des Werkstatt-WLANs funktioniert. Im WLAN reicht die Laptop-Adresse `http://192.168.x.x:4800` |
| GitHub-Repository mit Actions | im privaten Repository 2.000 Minuten/Monat frei, macOS zählt zehnfach | Der Build läuft auf einem macOS-Rechner in der Cloud, du brauchst keinen Mac |

Ein Mac ist **nicht** nötig. Wer einen hat, kann alternativ `npm run ios:open` ausführen und in
Xcode auf „Product → Archive → Distribute App → TestFlight“ klicken.

## Einmalige Einrichtung (etwa 45 Minuten, ohne Wartezeit auf Apple)

### 1. Apple Developer Program
1. Auf https://developer.apple.com/programs/enroll/ mit deiner Apple-ID anmelden und als
   Einzelperson oder Organisation (Carcura GbR, D-U-N-S-Nummer nötig) beitreten. Für den Anfang
   reicht Einzelperson; der Name im App-Store-Konto ist später nur intern sichtbar.
2. Nach der Bestätigungs-E-Mail unter https://developer.apple.com/account → „Membership details“
   die **Team ID** notieren (10 Zeichen, z. B. `A1B2C3D4E5`).

### 2. Bundle-ID registrieren
1. https://developer.apple.com/account/resources/identifiers/list → „+“ → „App IDs“ → „App“.
2. Description `Carcura Manager`, Bundle ID **Explicit**: `info.carcura.manager`. Capabilities
   nichts anhaken. „Register“.

### 3. App in App Store Connect anlegen
1. https://appstoreconnect.apple.com → „Meine Apps“ → „+“ → „Neue App“.
2. Plattform iOS, Name `Carcura Manager`, Sprache Deutsch, Bundle-ID `info.carcura.manager`,
   SKU `carcura-manager`, Zugriff „Vollzugriff“. Anlegen.
   Es wird nichts veröffentlicht; die App bleibt im Status „Zur Einreichung bereit“ und dient nur
   als Behälter für TestFlight-Builds.

### 4. API-Schlüssel für den automatischen Upload
1. App Store Connect → „Benutzer und Zugriff“ → Reiter „Integrationen“ → „App Store Connect API“
   → „Team-Schlüssel“ → „+“.
2. Name `GitHub Build`, Zugriff **App Manager**. Erzeugen.
3. Notieren: **Issuer ID** (oben auf der Seite) und **Key ID**. Den Schlüssel `AuthKey_XXXX.p8`
   herunterladen. Das geht nur einmal, die Datei sicher aufbewahren (Passwort-Manager).

### 5. Secrets im GitHub-Repository setzen
Repository → „Settings“ → „Secrets and variables“ → „Actions“ → „New repository secret“:

| Name | Wert |
|---|---|
| `APPLE_TEAM_ID` | Team ID aus Schritt 1 |
| `ASC_KEY_ID` | Key ID aus Schritt 4 |
| `ASC_ISSUER_ID` | Issuer ID aus Schritt 4 |
| `ASC_KEY_P8_BASE64` | Inhalt der `.p8`-Datei als Base64. Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Pfad\AuthKey_XXXX.p8"))` – macOS/Linux: `base64 -i AuthKey_XXXX.p8` |

### 6. Build starten
1. Repository → Reiter „Actions“ → Workflow „iOS App (TestFlight)“ → „Run workflow“.
2. Der Lauf dauert 15 bis 25 Minuten. Grüner Haken = Build liegt bei Apple.
3. Danach jeden Monat automatisch ein frischer Build (TestFlight-Builds laufen nach 90 Tagen ab).

Beim ersten Lauf erzeugt Xcode über den API-Schlüssel automatisch Zertifikat und Profil
(„Cloud-verwaltete Signierung“). Schlägt der Lauf fehl, steht der Grund im Protokoll des
Schritts „Archiv bauen“; die häufigsten Ursachen: Bundle-ID nicht registriert (Schritt 2), Team-ID
falsch, Schlüssel ohne Rolle „App Manager“.

### 7. Auf dem iPhone installieren
1. App Store Connect → deine App → Reiter „TestFlight“. Der Build erscheint nach 5 bis 15 Minuten
   Verarbeitung. Bei der Frage zur Exportkonformität „Nein“ (keine eigene Verschlüsselung; ist im
   Build bereits hinterlegt).
2. „Interne Tests“ → „+“ → Gruppe `Team` anlegen → Tester hinzufügen: dich selbst und Mitarbeiter
   (Apple-ID-Adressen, bis zu 100 Personen). Keine Prüfung durch Apple.
3. Auf dem iPhone die App **TestFlight** aus dem App Store laden, Einladung annehmen,
   „Installieren“. Fertig: „Carcura Manager“ liegt auf dem Homescreen.
4. Beim ersten Start die Server-Adresse eingeben: im Werkstatt-WLAN `http://192.168.x.x:4800`
   (die Adresse des Laptops; dazu muss in dessen `.env` `HOST=0.0.0.0` stehen), von unterwegs die
   öffentliche HTTPS-Adresse. Die Adresse lässt sich auf der Anmeldeseite jederzeit ändern.

Neue Builds erscheinen in TestFlight automatisch als Update. Die Oberfläche selbst aktualisiert
sich ohne neuen Build, sobald der Server aktualisiert wurde.

## Alternative Wege und warum nicht

| Weg | Bewertung |
|---|---|
| Kostenlose Apple-ID + Xcode-Sideload | App verfällt alle 7 Tage, braucht einen Mac und Kabel. Für den Alltag unbrauchbar. |
| AltStore / Sideloadly | Gleiche 7-Tage-Grenze ohne Developer Program, mit Program kein Vorteil gegenüber TestFlight. |
| Ad-hoc-Verteilung (IPA-Datei) | Möglich mit Developer Program, aber jede Geräte-ID muss eingetragen und die Profile jährlich erneuert werden. TestFlight ist bequemer. |
| Apple Business Manager, „Custom Apps“ | Für Firmen mit vielen Geräten; erfordert App-Review. Später sinnvoll, wenn die App an andere Betriebe verkauft wird. |
| Enterprise Program | Nur für Organisationen ab 100 Mitarbeitern. |
| Komplett native Neuentwicklung in Swift | Doppelte Pflege jeder Funktion, mehrere Monate Aufwand, kein Nutzen für die tägliche Arbeit. |

## Für Entwickler

```
cd carcura-manager/app
npm install
bash scripts/ios-prepare.sh     # nur auf macOS: erzeugt ios/, Icons, Info.plist
npm run ios:open                # Xcode
```

`www/index.html` ist der Startbildschirm mit der Server-Abfrage, `capacitor.config.json` die
App-Konfiguration (Bundle-ID, erlaubte Server-Domains unter `allowNavigation`, Farben). Wird der
Manager unter einer anderen Domain betrieben, diese Domain dort ergänzen.
