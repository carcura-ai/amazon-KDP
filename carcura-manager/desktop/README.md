# Carcura Management – Windows-Desktop-App

Electron-Anwendung, die als Client auf das zentrale Carcura-Backend zugreift. Keine lokalen Geschäftsdaten.
Architektur und Sicherheitsmaßnahmen: `../docs/architecture/desktop-architecture.md`.
Inbetriebnahme: `../docs/deployment/zentraler-server-und-desktop-app.md`.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm ci` | Abhängigkeiten installieren |
| `npm start` | App im Entwicklungsmodus starten |
| `npm run check` | Syntaxprüfung und Tests der Sicherheitsfunktionen |
| `npm run dist` | Windows-Installer bauen → `dist/Carcura-Management-Setup-<Version>.exe` |
| `build-windows.cmd` | alles in einem Schritt (Doppelklick unter Windows) |

## Dateien

| Datei | Inhalt |
|---|---|
| `src/main.cjs` | Hauptprozess: Fenster, Verbindung, Sicherheitsregeln, Menü, Updates |
| `src/preload.cjs` | minimale Brücke zur Oberfläche (`window.carcuraDesktop`) |
| `src/lib.cjs` | geprüfte Hilfsfunktionen (Adressprüfung, externe Links, Pfadschutz) |
| `src/ui/` | lokale Seiten: Ersteinrichtung, Verbinden, Offline, Update nötig |
| `app-config.json` | Produktname, feste Server-Adresse, Update-Adresse, Support-Link |
| `package.json` → `build` | Installer (NSIS, Deutsch, Desktop- und Startmenü-Verknüpfung) und Electron-Fuses |

## Version erhöhen
`version` in `package.json` anpassen, Installer bauen. Serverseitig kann `MIN_DESKTOP_VERSION` ältere
Versionen zu einem Update auffordern.
