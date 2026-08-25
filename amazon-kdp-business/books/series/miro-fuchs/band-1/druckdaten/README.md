# Druckdaten — Produktionsstand und der eine verbleibende Blocker

Stand: 2026-08-25 (autonomer Nachtlauf). Alle Bilddateien (`*.png`, `*.pdf`) liegen nur lokal
(`.gitignore`) — hier steht, was existiert und wo.

## Fertig

- **24 Rätselgrafiken** (`raetselgrafiken/seite-NN.png`) — programmatisch erzeugt
  (`scripts/generate-raetselgrafiken.py`), nicht mit KI. Grund: Labyrinthe, Punkte-Reihenfolge,
  exakte Objektzahlen brauchen garantierte Korrektheit, die ein Diffusionsmodell nicht zusichert.
  Zwei Lektoratsrunden durchlaufen (`../lektorat.md`), ein Farbfehler nach visueller Prüfung korrigiert.
- **32 Text-/Platzhalterseiten** (`textseiten/seite-NN.png`) — Vorspann, Nachspann, und 24
  Platzhalter für die noch fehlenden Szenenillustrationen (grüner Rahmen, Hinweistext, kein
  Blindtext, keine erfundene Kunst).
- **Interior-Entwurf-PDF** (`innenteil-entwurf.pdf`, 56 Seiten, 300 DPI, 8,5×8,5 Zoll) — strukturell
  vollständig, alle Rätselseiten final, alle Szenenseiten als klar gekennzeichnete Platzhalter.
- **Cover-Entwurf-PDF** (`cover-entwurf.pdf`, 17,376×8,75 Zoll inkl. Beschnitt, live geprüfte Maße)
  — Titel/Untertitel/Rückentext final, Miro-Illustration als Platzhalter.
- **Prompts für die KI-Illustration** (`prompts.json`) — vollständig ausformuliert für alle 24
  Szenen + Cover, einsatzbereit sobald ein funktionierender Generierungsweg steht.

## Der eine verbleibende Blocker: KI-Bildgenerierung der 24 Szenen- und der Cover-Illustration

**Was funktioniert hat:**
1. Lizenzproblem erkannt und behoben: Fooocus lädt standardmäßig „Juggernaut XL v8" (RunDiffusion),
   dessen kommerzielle Nutzung laut Lizenzseite eine gesonderte Vereinbarung mit RunDiffusion
   erfordert — nicht automatisch „kommerziell nutzbar" wie vom Nutzer gefordert. Preset umgestellt
   auf **Stability AI SDXL Base 1.0** (CreativeML Open RAIL++-M, kommerzielle Nutzung der Ausgaben
   ohne Zusatzvereinbarung üblich).
2. Checkpoint (6,46 GB) erfolgreich heruntergeladen — der erste Versuch über Fooocus' eigenen
   Downloader wurde vom 10-Minuten-Zeitlimit der Hintergrund-Ausführung abgewürgt (unvollständige
   Datei); per `Start-BitsTransfer` (Windows-eigener, resumable, prozessunabhängiger Download)
   erfolgreich nachgeholt.
3. Fooocus vollständig gestartet (CPU-Modus, keine dedizierte GPU vorhanden — nur Intel UHD
   Graphics ohne CUDA-Unterstützung). Der lokale Gradio-Server läuft nachweislich (`http://127.0.0.1:7866`,
   HTTP 200 bestätigt).

**Der Blocker:** Fooocus bietet keine dokumentierte, einfache REST-/Automatisierungs-API. Der
„Generieren"-Button ist über eine mehrstufige Gradio-Ereigniskette an eine interne `AsyncTask`
gebunden, die aus **über 100 positionsgebundenen UI-Werten** zusammengesetzt wird (Prompt, Stil,
Sampler, Scheduler, 5 LoRA-Slots, ADM-Skalierung, Inpaint-/Enhance-Parameter je nach Anzahl aktiver
Tabs uvm. — Liste in `Fooocus/webui.py` ab Zeile 977). Diese Werte hängen zusätzlich vom
Server-seitigen Sitzungszustand (`gr.State`) einer echten Browser-Sitzung ab, nicht von einem
einzelnen zustandslosen API-Aufruf. Ein blindes Nachbauen dieser Parameterliste ist angesichts
CPU-only-Inferenz (jeder Fehlversuch kostet mutmaßlich viele Minuten realer Rechenzeit ohne visuelle
Kontrollmöglichkeit während der Nacht) nicht verantwortbar automatisierbar — ein einzelner
Positionsfehler könnte unbemerkt fehlerhafte Bilder erzeugen oder den Lauf stundenlang blockieren.

**Das ist der einzige verbleibende Blocker.** Alle anderen Arbeitsschritte (Lektorat, Rätselgrafiken,
Seitenplan, Cover-Text, Compliance, Upload-Ordner) sind vollständig abgeschlossen.

## Empfohlener nächster Schritt (für den Nutzer, keine Aktion von Claude)

1. Fooocus manuell starten: `run.bat` im Ordner
   `Desktop\FitCoachApp_Gesundheit\KI\Fooocus_win64_2-5-0\Fooocus_win64_2-5-0\` doppelklicken.
2. Im Browser (`http://127.0.0.1:7866` oder die dort angezeigte Adresse) die Prompts aus
   `prompts.json` einzeln eintragen und generieren — 24 Szenen + 1 Cover-Motiv.
   CPU-only: mit mehreren Minuten pro Bild rechnen.
3. Erzeugte Bilder als `druckdaten/textseiten/seite-NN.png` (ungerade Seiten 5–51) bzw. als
   `--motiv`-Datei für `scripts/build-cover.py` ablegen, dann `build-interior-pdf.py` und
   `build-cover.py` erneut laufen lassen — die Skripte sind fertig und unverändert nutzbar.
4. Alternativ: das separate Community-Projekt „Fooocus-API" (eigenes REST-Interface) installieren,
   falls Automatisierung gewünscht ist — das ist ein anderes Repository als das hier vorhandene
   Basis-Fooocus.
