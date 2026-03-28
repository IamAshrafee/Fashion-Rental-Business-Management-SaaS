@echo off
title ClosetRent Dev Launcher
cd /d "%~dp0"

:menu
cls
echo ====================================================
echo             ClosetRent Dev Launcher
echo ====================================================
echo  1. Start All (Docker + Backend + Frontend)
echo  2. Restart Backend Only
echo  3. Restart Frontend Only
echo  4. Restart Everything (Docker + Both Apps)
echo  5. Stop All (Kill Dev Apps ^& Docker Down)
echo  0. Exit
echo ====================================================
echo.
set /p choice="Select an option (0-5): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto restart_backend
if "%choice%"=="3" goto restart_frontend
if "%choice%"=="4" goto restart_everything
if "%choice%"=="5" goto stop_all
if "%choice%"=="0" exit
goto menu

:start_all
echo [1/3] Starting Docker Compose...
docker compose up -d
echo [2/3] Starting Backend Server...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
echo [3/3] Starting Frontend Server...
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo All services launched!
pause
goto menu

:restart_backend
echo Stopping Backend (Port 4000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":4000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Starting Backend...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
echo Backend restarted!
pause
goto menu

:restart_frontend
echo Stopping Frontend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Starting Frontend...
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo Frontend restarted!
pause
goto menu

:restart_everything
echo Stopping Apps...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":4000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Restarting Docker Containers...
docker compose restart
echo Starting Apps...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo Everything restarted!
pause
goto menu

:stop_all
echo Stopping Apps...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":4000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Stopping Docker...
docker compose down
echo All services stopped.
pause
goto menu
