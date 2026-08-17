@echo off
setlocal

cd /d "%~dp0"
node scripts\dev-environment.mjs prepare-start %*
exit /b %errorlevel%
