@echo off
setlocal

cd /d "%~dp0"
node scripts\dev-environment.mjs stop %*
set "result=%errorlevel%"

echo(
if not "%CLOSERENT_NO_PAUSE%"=="1" pause
exit /b %result%
