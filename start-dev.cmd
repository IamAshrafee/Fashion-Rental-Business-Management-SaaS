@echo off
setlocal

cd /d "%~dp0"
node scripts\dev-environment.mjs start %*
exit /b %errorlevel%
