@echo off
rem Automatische Einrichtung (Firmendaten, Leistungen, Logo, Windsor.ai, E-Mail, KI, Wettbewerber).
rem Der Manager muss laufen (scripts\start.cmd). Geheimnisse werden nur abgefragt, nie gespeichert.
setlocal
cd /d "%~dp0.."
chcp 65001 >nul
if exist .env for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
node scripts\einrichten.mjs %*
echo.
pause
