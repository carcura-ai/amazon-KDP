# Packstart (Assistent „James") – Prüfung und Einrichtung auf dem Laptop

**Geprüft:** 03.11.2026 in der Cloud-Umgebung (Linux). Installiert wurde dort nichts, weil der
Installer nur unter Windows läuft. Ausgeführt wurde keine Datei aus dem Paket: Es wurde nur
entpackt und gelesen.

## 1 Datei

| | |
|---|---|
| Quelle | Google-Drive-Ordner „Claude jarves" (`1NPzLX2rEOfmeeqyoVCdJ9Fc9PHI6voT_`) |
| Datei | `Packstart-Setup-Beta-3.1.exe` (Windows, NSIS-Installer mit Electron-App) |
| Größe | 152.347.693 Bytes |
| SHA-256 | `9372a59c6b9e8effbfa97b64a3b1f393a89d1c0cd15d221802cc83511391cbd6` |
| Abgleich | **Stimmt** mit der Prüfsumme auf packstart.de/download überein (Stand 03.11.2026) |
| Version | 3.1.0-beta.1 |
| Hersteller | Emin Simsek (Packstart), Bergisch Gladbach, support@packstart.de |
| Lizenz | Kostenlos, aber kein Open Source (`LicenseRef-Packstart-James-1.0`). Zusatzpakete kosten ab 9,99 € einmalig. |

Die .exe liegt **nicht** im Repo: Sie ist 152 MB groß (GitHub erlaubt höchstens 100 MB je Datei)
und auf dem Laptop ohnehin aus Drive oder von packstart.de schneller geladen.

## 2 Was Packstart ist

Eine Desktop-Oberfläche um **Claude Code** (oder wahlweise OpenAI Codex / Google Gemini) mit
Sprachausgabe, Widgets, Office-Dateien (Word, Excel, PowerPoint), zeitversetzten Aufgaben und
optionalem Zugriff vom Handy über Telegram oder WhatsApp. Die KI-Leistung kommt aus **deinem
eigenen** Claude-Konto, Packstart selbst rechnet nichts ab.

**Wichtig für unser Setup:** Packstart benutzt ein **eigenes** Claude-Profil
(`CLAUDE_CONFIG_DIR` im Ordner `%APPDATA%\Packstart`, nie `~/.claude`). Die Skills aus diesem Repo
(KDP-Pipeline, Carcura, ghost, l99 …) und die MCP-Anschlüsse (WordPress usw.) sind in James
**nicht** vorhanden. Packstart läuft neben dem bestehenden Claude Code, ersetzt es nicht.

## 3 Sicherheitsbefund

**Gesamturteil: Installieren vertretbar, mit den Einstellungen aus Abschnitt 5.** Der Code ist
sorgfältig und sicherheitsbewusst geschrieben. Ein Schadcode-Muster wurde nicht gefunden.

| Geprüft | Ergebnis |
|---|---|
| Echtheit der Datei | SHA-256 identisch mit packstart.de ✔ |
| Code-Signatur der .exe | **Keine** Authenticode-Signatur → Windows SmartScreen warnt beim Start (vom Hersteller so angekündigt) |
| Autostart, Registry-Einträge, Aufgabenplanung | Nichts gefunden ✔ |
| Defender-Ausnahmen, Firewall-Änderungen, Adminrechte | Nichts gefunden ✔ |
| Claude Code | Lädt Packstart unverändert von `downloads.claude.ai` und prüft Anthropics OpenPGP-Signatur ✔ |
| Rechte von Claude in James | `--permission-mode manual`, Dateiwerkzeuge nur im Arbeitsordner, Schreiben läuft über eine Freigabeprüfung ✔ |
| Zugangsdaten | Bleiben laut Code lokal, gehen nicht in Fehlerberichte, Exporte oder Updates ✔ |
| Updates | Nur auf Klick „Nach Updates suchen“; Manifest mit Ed25519 signiert, Paket mit SHA-256 geprüft ✔ |
| Fern-Abschalter | Packstart kann per signiertem Update einzelne Wege abschalten: Claude-Abo, Gemini-Konto, Bildschirm- und Browser-Steuerung (siehe Risiko 1) |
| Fehlerberichte an packstart.de | Nur wenn du selbst sendest; Diagnose nur mit Häkchen ✔ |
| WhatsApp-Brücke | Inoffiziell (Bibliothek `whatsmeow`, gekoppelt als weiteres Gerät). Ab Werk aus. **Kontosperre möglich** |
| Codex mit ChatGPT-Konto | Inoffizieller Weg, ab Werk aus |
| Nachladen aus dem Netz | Feste Versionen von npm (docx, exceljs, pptxgenjs, pdfjs …), Stimmen von packstart.de / Hugging Face |
| Mitgelieferte Programme | `node.exe` 24.21.0, `espeak-ng.exe` (Aussprache), `whatsapp-bruecke-win32-x64.exe` (Go-Quelltext liegt bei) |

## 4 Risiken

1. **Claude-Abo über Drittprogramme.** Anthropic hat 2026 die Nutzung von Pro/Max-Abos in
   Drittprogrammen eingeschränkt: Seit dem 04.04.2026 deckt das Abo solche Programme nicht mehr ab,
   dafür braucht es „Extra Usage“ oder einen API-Schlüssel. Packstart argumentiert, es starte das
   unveränderte Claude Code mit deiner eigenen Anmeldung. Der Hersteller hat aber für genau diesen
   Weg einen Fern-Abschalter eingebaut und verweist im Code auf eine Anthropic-Regel ab 12.11.2026.
   **Folge:** Der Abo-Weg kann jederzeit wegfallen oder über Extra Usage Geld kosten. Ob Anthropic
   James als „Claude Code“ oder als Drittprogramm wertet, ist hier nicht abschließend geklärt.
2. **WhatsApp-Sperre.** Die Brücke ist von WhatsApp nicht freigegeben. Wird die Carcura-Nummer
   gesperrt, ist der wichtigste Kundenkanal weg.
3. **Datenschutz (DSGVO).** Alles, was James liest, geht an den KI-Anbieter. Kundendaten von
   Carcura (Namen, Telefonnummern, Kennzeichen, Fotos) gehören nicht ungeprüft in den Arbeitsordner.
4. **Beta.** Funktionen und Einstellungen ändern sich zwischen Versionen.

## 5 Einrichtung auf dem Laptop (Windows 10/11, 64 Bit)

**Vorher erledigen**

- [ ] claude.ai → Einstellungen → Nutzung: **Extra Usage aus** lassen oder ein festes Limit setzen.
      So entstehen keine Überraschungskosten, falls Anthropic James als Drittprogramm abrechnet.
- [ ] claude.ai → Einstellungen → Datenschutz: Nutzung der Chats für das Modelltraining prüfen und
      für Geschäftsdaten ausschalten.
- [ ] Rund 1 GB freien Speicher einplanen (520 MB Programm, dazu Claude Code und Stimmen).

**Installation**

1. Datei laden: aus dem Drive-Ordner oder von packstart.de/download, **im Browser**, nicht über die
   Mail-App (der Hersteller meldet dabei beschädigte Downloads).
2. Prüfsumme in PowerShell kontrollieren:
   ```powershell
   Get-FileHash "$env:USERPROFILE\Downloads\Packstart-Setup-Beta-3.1.exe" -Algorithm SHA256
   ```
   Erwartet: `9372A59C6B9E8EFFBFA97B64A3B1F393A89D1C0CD15D221802CC83511391CBD6`.
   **Weicht sie ab: nicht starten, Datei löschen.**
3. Installer per Doppelklick starten. SmartScreen zeigt „Der Computer wurde durch Windows geschützt“
   → „Weitere Informationen“ → „Trotzdem ausführen“. Nur tun, wenn Schritt 2 gepasst hat.
4. Erster Start: Claude verbinden. Packstart lädt Claude Code selbst; die Anmeldung läuft über
   claude.ai in deinem Browser.
5. **Arbeitsordner:** einen eigenen, leeren Ordner anlegen, z. B. `C:\Users\<Name>\James`. Nicht das
   ganze Benutzerverzeichnis, nicht den Ordner mit Carcura-Kundendaten, nicht dieses Repo.

**Einstellungen nach dem ersten Start**

| Funktion | Empfehlung | Grund |
|---|---|---|
| WhatsApp | **aus** (mit der Carcura-Nummer nie) | Risiko 2 |
| Telegram | bei Bedarf an | offizielle Bot-Schnittstelle |
| Codex mit ChatGPT-Konto | aus | inoffiziell, nicht gebraucht |
| Bildschirm- und Browser-Steuerung | aus, bis ein konkreter Anwendungsfall da ist | breiter Zugriff |
| Updates | gelegentlich manuell „Nach Updates suchen“ | Fehlerbehebungen, Fern-Abschalter greift nur dann |
| Zusatzpakete (ab 9,99 €) | **nicht kaufen** vor Ende der Testwoche | erst Nutzen belegen |

**Kontrolle nach der Einrichtung**

- [ ] James antwortet auf eine einfache Frage.
- [ ] Nach einer Woche in claude.ai prüfen: Läuft die Nutzung über das Abo, oder fällt Extra Usage an?
- [ ] Bestehendes Claude Code im Terminal läuft weiter wie vorher (`claude` → `/skills`).

## 6 Entfernen

Über Windows → Einstellungen → Apps, sofern Packstart dort eingetragen ist (ein Deinstallationsprogramm
war im verpackten Installer nicht direkt nachweisbar, bei NSIS wird es meist erst bei der Installation
erzeugt). Deine Daten liegen in `%APPDATA%\Packstart`;
laut Programm bleiben sie bei Updates und Neuinstallation erhalten. Nach dem Deinstallieren
nachsehen und den Ordner bei Bedarf von Hand löschen (enthält auch die Claude-Anmeldung von James).

## 7 Offene Punkte

- Laptop-System bestätigen. Diese Anleitung gilt für Windows. Für einen Mac gibt es auf packstart.de
  die Datei `Packstart-Beta-3.1.dmg` (332.353.553 Bytes, SHA-256
  `0a47bc6cdaffd9869ece6119d04bc70e3b038b65f4f41775810cdbda75dce35c`).
- Nutzen nach der Testwoche bewerten: Was erledigt James, das Claude Code mit unseren Skills nicht
  schon kann (Sprache, Handy-Zugriff, zeitversetzte Aufgaben)?

## Quellen zur Abo-Regel

- The Register, 20.02.2026: https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access
- Engadget, April 2026: https://engadget.com/ai/its-no-longer-free-to-use-claude-through-third-party-tools-like-openclaw-160912082.html
