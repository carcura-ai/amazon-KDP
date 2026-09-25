# Desktop-Architektur: Carcura Management als Windows-Anwendung

Stand: 25.09.2026. Diese Entscheidung ersetzt die Browser-Nutzung als Standardweg. Der Browser bleibt
technisch möglich (z. B. für den Passwort-Link aus einer E-Mail), wird für die normale Arbeit aber nicht
benötigt.

## 1. Ausgangslage (Analyse vor der Umstellung)

| Bereich | Stand | Funktioniert |
|---|---|---|
| Backend | Fastify 5, Node.js, SQLite, 185+ Routen, Mandantentrennung mit Test über alle Routen, Rollen/Rechte, 2FA, Audit, Supportzugriff | ja, 86 automatisierte Tests grün |
| Oberfläche | React 19 + Vite, vom Backend ausgeliefert, relative API-Pfade (`/api/...`), Session-Cookie (HttpOnly) | ja, 9 UI-Testskripte |
| Betrieb | Lokale Installation auf einem Laptop (`install.cmd`/`start.cmd`), Oberfläche im Browser | ja, beim Betreiber im Einsatz |
| Mobile | PWA für iPhone, Capacitor-Hülle vorbereitet | ja |

Problem der bisherigen Form: Daten liegen auf **einem** PC (Insellösung), Nutzung über den Browser.

## 2. Zielbild

```
Windows-PC 1 ─┐                         ┌──────────────────────────────┐
Windows-PC 2 ─┼── HTTPS (TLS) ─────────▶│ Zentrales Backend (EU-Server) │
iPhone (PWA) ─┘   Session-Cookie        │ API + Oberfläche + Datenbank  │
                                        │ Dateien, PDFs, Jobs, Backups  │
Desktop-App = Client                    └──────────────────────────────┘
(kein lokaler Datenbestand)             einzige Datenquelle, mandantengetrennt
```

- **Desktop-App** („Carcura Management“, `desktop/`): installierbare Windows-Anwendung mit eigenem
  Programmfenster, Desktop- und Startmenü-Verknüpfung, Deinstallation über Windows.
- **Zentrales Backend** (`server/` + `web/`, Deployment unter `deploy/`): läuft auf einem Server im
  Internet, bevorzugt in der EU. Alle PCs und Benutzer eines Betriebs greifen auf dieselben Daten zu.
- **Mandanten**: ein Betrieb = ein Mandant; Trennung serverseitig (siehe `docs/privacy/tenant-isolation.md`).

## 3. Technologieentscheidung: Electron statt Tauri

| Kriterium | Electron | Tauri |
|---|---|---|
| Passt zur Codebasis (Node.js/TypeScript, React) | ja, gleiche Sprache und Werkzeuge | Hauptprozess in Rust, neue Sprache im Team |
| Rendering-Engine | Chromium, identisch mit der getesteten Web-Oberfläche | WebView2 (Edge) – auf Windows ebenfalls Chromium, aber systemabhängige Version |
| PDF-Anzeige im Fenster | eingebaut | abhängig von WebView2 |
| Installer | electron-builder: NSIS-Installer, Verknüpfungen, Updates, Signatur | eigener Bundler (MSI/NSIS) |
| Größe | ca. 90 MB Installer | ca. 5–10 MB |
| Sicherheitshärtung | Fuses (Cookie-Verschlüsselung, kein RunAsNode), Sandbox, Kontextisolation | Capability-System |

**Entscheidung: Electron.** Ausschlaggebend sind die vorhandene Node/React-Codebasis, die identische
Chromium-Engine (keine Abweichungen zu getesteter Oberfläche und PDF-Ansicht), ein ausgereifter Windows-Installer
und automatische Updates. Der Größennachteil ist für eine Büro-/Werkstattanwendung unerheblich.

## 4. Wie die Desktop-App arbeitet

1. Beim ersten Start fragt sie die Server-Adresse ab (oder nutzt die in `app-config.json` fest
   hinterlegte Adresse einer Kunden-Version) und prüft `/api/health` über den Hauptprozess.
2. Danach lädt sie die Oberfläche des Servers in das eigene Fenster. Anmeldung, Dashboard und alle
   Funktionen sind dieselben wie bisher; keine Funktion wurde entfernt.
3. Ist der Server nicht erreichbar, zeigt sie eine eigene Offline-Seite mit „Erneut versuchen“.
   Es gibt bewusst **keinen Offline-Modus**: Die Daten liegen zentral, damit mehrere PCs konsistent arbeiten.
4. Verlangt der Server eine neuere App-Version (`MIN_DESKTOP_VERSION`), erscheint ein Update-Hinweis;
   mit eingerichteter Update-Adresse aktualisiert sich die App selbst.

Warum die Oberfläche vom Server geladen wird statt im Installer zu stecken: Die bestehende sichere
Anmeldung (HttpOnly-Session-Cookie, SameSite, CSP `'self'`, CSRF-Schutz über gleiche Herkunft) funktioniert
unverändert, Bilder und PDFs werden mit derselben Anmeldung geladen, und Server und Oberfläche passen immer
zusammen. Eine lokal gebündelte Oberfläche hätte Token-Anmeldung, CORS, signierte Datei-URLs und eine
Versionsabstimmung erfordert – mehr Angriffsfläche ohne Nutzen für den Anwender.

## 5. Sicherheitsmaßnahmen der Desktop-App

| Maßnahme | Umsetzung (`desktop/src/main.cjs`, `package.json`) |
|---|---|
| Kein Node-Zugriff für Seiten | `contextIsolation`, `sandbox`, `nodeIntegration: false`, Preload stellt nur ein festes Objekt bereit |
| Nur eigener Server | Navigation und Weiterleitungen nur zur Server-Adresse und zu lokalen App-Seiten; fremde Links öffnet der Standardbrowser (nur https, mailto, tel) |
| Verschlüsselte Verbindung | nur `https://`; `http://` ausschließlich für localhost und private Netze (Werkstatt-/Testserver) |
| Zertifikate | Fehler werden nie übergangen |
| Anmeldedaten | Session-Cookie (HttpOnly) in eigener Sitzung; Cookie-Verschlüsselung über Windows-DPAPI per Electron-Fuse `enableCookieEncryption` |
| Kein Datenrest auf dem PC | API-Antworten `Cache-Control: no-store`; HTTP-Cache wird beim Beenden geleert; Menü „Lokale Anmeldedaten löschen“ |
| Manipulationsschutz | Fuses: kein `RunAsNode`, keine `NODE_OPTIONS`, keine Inspect-Argumente, App nur aus signiertem ASAR mit Integritätsprüfung |
| Berechtigungen | nur Zwischenablage, Vollbild, Benachrichtigungen, Kamera – und nur für den eigenen Server |
| IPC | jeder Aufruf prüft die Herkunft der aufrufenden Seite |
| Lokale Seiten | eigenes Schema `carcura://app`, Zugriff nur auf den UI-Ordner (Test gegen Path Traversal) |

## 6. Änderungen im Backend für den Desktop-Betrieb

| Änderung | Grund |
|---|---|
| `TRUST_PROXY` | Betrieb hinter HTTPS-Proxy (Caddy): korrekte Client-IP für Rate-Limits und Audit |
| `Cache-Control: no-store` für `/api/*` | keine personenbezogenen Daten im Cache der Clients |
| `/api/health` liefert `minDesktopVersion`, `deploymentMode` | Versionsprüfung der App |
| Passwort vergessen (`/api/auth/password-reset/*`) | Selbstbedienung für mehrere Benutzer/PCs |
| Betreiber-SMTP (`SYSTEM_SMTP_*`) | Konto-E-Mails unabhängig vom SMTP des Mandanten |
| Request-ID je Anfrage | Nachvollziehbarkeit in Logs und Audit |

## 7. Was unverändert bleibt

Alle Module, Datenfelder (außer der bewussten Reduktion der Fahrzeugfelder, siehe unten), APIs, Rollen,
Tests und die Weboberfläche. Die lokale Installation (`scripts/install.cmd`, `start.cmd`) bleibt für
Entwicklung und Einzelplatz-Tests erhalten, ist aber nicht mehr der empfohlene Betriebsweg.

## 8. Datensparsamkeit bei Fahrzeugen

Fahrzeug-Stammdaten bestehen aus Hersteller, Modell, Kennzeichen und besonderen Merkmalen. Baujahr,
Kilometerstand, Farbe, Fahrzeugtyp und FIN werden nicht mehr erfasst oder angezeigt; die Datenbankspalten
bleiben für ältere Einträge bestehen (keine stille Löschung, Auskunft nach Art. 15 vollständig). Der
Kilometerstand wird nur im Annahmeprotokoll festgehalten und nicht mehr in das Fahrzeug übernommen.
Hinweis: FIN und Farbe standen in einer früheren Anforderungsliste; sie lassen sich bei Bedarf wieder
aktivieren.

## 9. Offene Punkte

- **Code-Signatur**: Ohne Zertifikat zeigt Windows SmartScreen beim ersten Start eine Warnung. Vor dem
  Verkauf ein Code-Signing-Zertifikat (OV/EV) oder Azure Trusted Signing einrichten; der Build-Workflow
  unterstützt die Signatur über Secrets.
- **Update-Server**: `updateUrl` in `desktop/app-config.json` auf einen Download-Ordner (HTTPS) setzen,
  in dem Installer und `latest.yml` liegen.
- **Hosting-Vertrag**: AV-Vertrag nach Art. 28 DSGVO mit dem Hoster abschließen (juristisch zu prüfen).
