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
echo  6. Status Check
echo  0. Exit
echo ====================================================
echo.
set /p choice="Select an option (0-6): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto restart_backend
if "%choice%"=="3" goto restart_frontend
if "%choice%"=="4" goto restart_everything
if "%choice%"=="5" goto stop_all
if "%choice%"=="6" goto status_check
if "%choice%"=="0" exit
goto menu

:start_all
echo [1/4] Starting Docker Compose...
docker compose up -d
echo [2/4] Waiting for services to be healthy...
call :wait_for_docker
echo [3/4] Starting Backend Server...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
echo [4/4] Starting Frontend Server...
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo.
echo All services launched!
pause
goto menu

:restart_backend
echo Stopping Backend (Port 4000)...
call :kill_port 4000
echo Starting Backend...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
echo Backend restarted!
pause
goto menu

:restart_frontend
echo Stopping Frontend (Port 3000)...
call :kill_port 3000
echo Starting Frontend...
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo Frontend restarted!
pause
goto menu

:restart_everything
echo Stopping Apps...
call :kill_port 4000
call :kill_port 3000
echo Restarting Docker Containers...
docker compose restart
echo Waiting for services to be healthy...
call :wait_for_docker
echo Starting Apps...
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"
echo Everything restarted!
pause
goto menu

:stop_all
echo Stopping Apps...
call :kill_port 4000
call :kill_port 3000
echo Stopping Docker...
docker compose down
echo.
echo All services stopped.
pause
goto menu

:status_check
echo.
echo --- Docker Containers ---
docker compose ps
echo.
echo --- Port 4000 (Backend) ---
netstat -ano | findstr /r "LISTENING" | findstr /r "\<4000\>" >nul 2>&1
if %errorlevel%==0 (
    echo   [RUNNING] Backend is listening on port 4000
) else (
    echo   [STOPPED] Nothing on port 4000
)
echo --- Port 3000 (Frontend) ---
netstat -ano | findstr /r "LISTENING" | findstr /r "\<3000\>" >nul 2>&1
if %errorlevel%==0 (
    echo   [RUNNING] Frontend is listening on port 3000
) else (
    echo   [STOPPED] Nothing on port 3000
)
echo.
pause
goto menu

:: ============================================================
:: HELPER FUNCTIONS
:: ============================================================

:kill_port
:: Kills all processes listening on the specified port
:: Usage: call :kill_port 4000
set "_port=%~1"
set "_killed=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r "LISTENING" ^| findstr /r " :%_port% "') do (
    taskkill /f /pid %%a >nul 2>&1
    if not errorlevel 1 (
        set "_killed=1"
        echo   Killed PID %%a on port %_port%
    )
)
if "%_killed%"=="0" echo   No process found on port %_port%
goto :eof

:wait_for_docker
:: Wait for Postgres and Redis to be healthy (max 30s)
set /a "_attempts=0"
:docker_wait_loop
set /a "_attempts+=1"
if %_attempts% gtr 15 (
    echo   Warning: Timed out waiting for containers. Proceeding anyway...
    goto :eof
)
docker compose exec -T postgres pg_isready -U closetrent >nul 2>&1
if errorlevel 1 (
    echo   Waiting for Postgres... (%_attempts%/15)
    timeout /t 2 /nobreak >nul
    goto docker_wait_loop
)
docker compose exec -T redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo   Waiting for Redis... (%_attempts%/15)
    timeout /t 2 /nobreak >nul
    goto docker_wait_loop
)
echo   Postgres and Redis are ready!
goto :eof
