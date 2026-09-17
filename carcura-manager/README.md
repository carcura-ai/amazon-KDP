# Carcura Manager

Mandantenfähiges, white-label-fähiges Management-System für Fahrzeugaufbereitungsbetriebe:
CRM (Leads, Kunden, Fahrzeuge), Kalender und Aufträge, Übergabeprotokolle mit Fotos und Unterschrift,
Angebote und Rechnungen (PDF, E-Mail), Lager, Finanzen, Marketing-Auswertung (Google Ads, Meta, GA4,
Search Console, Instagram), Berichte, KI-Business-Assistent, Wettbewerber-Monitoring, Aufgaben,
Import/Export, Sicherungen und Updates. Carcura ist der erste Mandant; weitere Betriebe lassen sich
über die Betreiber-Ebene anlegen.

## Schnellstart (Laptop)

```
scripts/install.cmd      # Windows   (macOS/Linux: bash scripts/install.sh)
scripts/start.cmd        # Windows   (macOS/Linux: bash scripts/start.sh)
```

Danach im Browser `http://127.0.0.1:4800` öffnen. Beim ersten Start führt ein Assistent durch die
Einrichtung von Unternehmen und Administrator. Voraussetzung: Node.js 22 (LTS) und einmalig Internet
für die Installation.

Das Startskript hält die Anwendung am Laufen und führt Neustart und Update aus, die unter
**Einstellungen → System & Sicherung** ausgelöst werden (vor jedem Update entsteht automatisch eine Sicherung).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `server/` | Fastify-API (TypeScript, SQLite über Drizzle), Jobs, Integrationen, PDF-Erzeugung, Tests |
| `web/` | React-Oberfläche (Vite), dunkles Design mit Mandantenfarbe, responsiv |
| `docs/` | Bestandsanalyse, Architektur, Datenmodell, Entwicklungsplan, Betriebshandbuch |
| `scripts/` | Installation, Start, Update (Windows `.cmd`, macOS/Linux `.sh`) |
| `e2e/` | Browser-Tests (Playwright) gegen einen laufenden Server, Demo-Daten-Skripte |
| `app/` | Native iPhone-App (Capacitor), Verteilung über TestFlight – siehe `app/README.md` |
| `data/` | Datenbank, Dateien, Sicherungen, Schlüssel (nicht im Git) |

## Entwicklung

```
npm install
npm run dev:server   # API mit Neustart bei Änderungen (Port 4800)
npm run dev:web      # Oberfläche mit Hot-Reload (Port 5173)
npm test             # Server-Tests
npm run typecheck    # TypeScript für Server und Web
npm run build        # Produktions-Build
```

Browser-Tests: Server mit frischem `DATA_DIR` starten, dann `SHOTS=<ordner> node e2e/ui-smoke.mjs` usw.
(Reihenfolge und Details in `docs/05-betrieb.md`).

## Wartung ohne Oberfläche

```
node server/dist/cli.js backup            # Sicherung erstellen
node server/dist/cli.js list              # Sicherungen anzeigen
node server/dist/cli.js restore <zip>     # Sicherung einspielen (Server vorher beenden)
```

## Sicherheit

Passwörter werden mit scrypt gehasht, Sitzungen liegen serverseitig (httpOnly-Cookie), Zugangsdaten zu
Drittdiensten werden mit AES-256-GCM verschlüsselt gespeichert und nie an den Browser gesendet. Alle
Änderungen landen im Audit-Log. Der Schlüssel `data/app-secret.key` bzw. `APP_SECRET` ist nicht Teil
der Sicherung und muss separat aufbewahrt werden. Dieses Repository darf keine `.env`, keinen
`data/`-Ordner und keine Schlüssel enthalten.

Weitere Informationen: `docs/05-betrieb.md`.
