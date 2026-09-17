@echo off
rem Startskript (Windows): startet den Manager und reagiert auf Neustart (Exit 75)
rem und Update (Exit 76), die aus der Oberflaeche unter Einstellungen -> System ausgeloest werden.
setlocal
cd /d "%~dp0.."
set CM_LAUNCHER=1
if "%NODE_ENV%"=="" set NODE_ENV=production
if exist .env for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
if not exist server\dist\index.js (
  echo Build fehlt - bitte scripts\install.cmd ausfuehren.
  pause
  exit /b 1
)
:loop
node server\dist\index.js
set code=%errorlevel%
if "%code%"=="75" (
  echo Neustart angefordert ...
  timeout /t 1 /nobreak >nul
  goto loop
)
if "%code%"=="76" (
  echo Update angefordert ...
  call scripts\update.cmd --no-backup
  timeout /t 1 /nobreak >nul
  goto loop
)
echo Manager beendet (Code %code%).
pause
exit /b %code%
