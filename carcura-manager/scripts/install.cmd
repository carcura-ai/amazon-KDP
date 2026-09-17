@echo off
rem Erstinstallation (Windows): Abhaengigkeiten, Chromium fuer PDFs, Build, .env anlegen.
setlocal
cd /d "%~dp0.."
where node >nul 2>&1 || (echo Node.js fehlt: https://nodejs.org ^(LTS 22 oder neuer^) & pause & exit /b 1)
node -e "const v=process.versions.node.split('.').map(Number); if (v[0] < 22 || (v[0] === 22 && v[1] < 13)) { console.error('Node.js 22.13 oder neuer erforderlich, gefunden ' + process.version + '. Bitte von https://nodejs.org die LTS-Version installieren.'); process.exit(1); }" || (pause & exit /b 1)
echo %CD% | findstr /i "OneDrive Desktop Downloads" >nul && (
  echo.
  echo WARNUNG: Der Ordner liegt unter OneDrive, Desktop oder Downloads: %CD%
  echo OneDrive sperrt Dateien waehrend der Installation und synchronisiert tausende Programmdateien.
  echo Bitte den Ordner carcura-manager nach C:\Carcura\ verschieben und die Installation dort starten.
  echo.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
echo Abhaengigkeiten installieren ...
if exist node_modules rmdir /s /q node_modules
call npm install --no-audit --no-fund || goto :fail
echo Chromium fuer PDF-Erzeugung ...
call npx playwright install chromium || echo Hinweis: Chromium konnte nicht geladen werden - alternativ CHROMIUM_PATH in .env auf ein installiertes Chrome/Edge setzen.
echo Anwendung bauen ...
call npm run build || goto :fail
echo.
echo Fertig. Start mit scripts\start.cmd  -  danach http://127.0.0.1:4800 im Browser oeffnen.
pause
exit /b 0
:fail
echo.
echo Installation fehlgeschlagen. Haeufige Ursachen:
echo  - kein Internet oder Virenscanner blockiert den Download (kurz deaktivieren, erneut starten)
echo  - Ordner liegt unter OneDrive/Desktop (nach C:\Carcura verschieben)
echo  - Node.js aelter als 22.13 (node -v pruefen, LTS von nodejs.org installieren)
echo Den Text in diesem Fenster abfotografieren und an den Support schicken.
pause
exit /b 1
