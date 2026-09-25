@echo off
rem Baut den Windows-Installer "Carcura-Management-Setup-<Version>.exe" (Ordner desktop\dist).
rem Voraussetzung: Node.js 22.13 oder neuer (https://nodejs.org), Internet fuer den ersten Build.
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js fehlt. Bitte von https://nodejs.org installieren. & pause & exit /b 1)
echo [1/3] Abhaengigkeiten installieren ...
call npm ci --no-audit --no-fund || goto :fail
echo [2/3] Pruefen ...
call npm run check || goto :fail
echo [3/3] Installer bauen ...
call npm run dist || goto :fail
echo.
echo Fertig. Installer liegt in: %~dp0dist
start "" "%~dp0dist"
pause
exit /b 0
:fail
echo Build fehlgeschlagen. Meldungen oben pruefen.
pause
exit /b 1
