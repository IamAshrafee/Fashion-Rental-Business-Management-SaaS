@echo off
setlocal

cd /d "%~dp0"
node scripts\dev-environment.mjs reset-start %*
exit /b %errorlevel%
