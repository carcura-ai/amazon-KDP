@echo off
rem Erstinstallation (Windows): Abhaengigkeiten, Chromium fuer PDFs, Build, .env anlegen.
setlocal
cd /d "%~dp0.."
where node >nul 2>&1 || (echo Node.js fehlt: https://nodejs.org ^(LTS 22 oder neuer^) & pause & exit /b 1)
node -e "const v=process.versions.node.split('.').map(Number); if (v[0] < 22) { console.error('Node.js 22 oder neuer erforderlich, gefunden ' + process.version); process.exit(1); }" || (pause & exit /b 1)
if not exist .env copy .env.example .env >nul
echo Abhaengigkeiten installieren ...
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
echo Installation fehlgeschlagen.
pause
exit /b 1
