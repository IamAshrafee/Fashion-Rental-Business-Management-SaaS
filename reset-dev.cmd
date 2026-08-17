@echo off
setlocal

cd /d "%~dp0"
node scripts\dev-environment.mjs reset-start %*
set "result=%errorlevel%"

if "%result%"=="0" exit /b 0
echo(
if not "%CLOSERENT_NO_PAUSE%"=="1" pause
exit /b %result%
