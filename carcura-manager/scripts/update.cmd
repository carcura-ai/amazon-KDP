@echo off
rem Update (Windows): Sicherung -> Code aktualisieren -> Abhaengigkeiten -> Build.
setlocal
cd /d "%~dp0.."
if exist .env for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
if not "%~1"=="--no-backup" (
  if exist server\dist\cli.js (
    node server\dist\cli.js backup pre-update || goto :fail
  ) else (
    echo Kein Build vorhanden - Sicherung uebersprungen.
  )
)
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel%==0 (
  echo Code aktualisieren (git pull) ...
  git pull --ff-only || goto :fail
) else (
  echo Kein Git-Arbeitsverzeichnis: neue Version manuell entpacken und erneut ausfuehren.
)
echo Abhaengigkeiten installieren ...
call npm install --no-audit --no-fund || goto :fail
echo Anwendung bauen ...
call npm run build || goto :fail
echo Update abgeschlossen.
exit /b 0
:fail
echo Update fehlgeschlagen.
exit /b 1
