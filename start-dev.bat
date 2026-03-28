@echo off
title ClosetRent Dev Launcher
echo Starting ClosetRent Development Environment...

:: Set current directory to the location of this batch file
cd /d "%~dp0"

echo.
echo [1/3] Starting Docker Compose (Database, Redis, Minio)...
docker compose up -d

echo.
echo [2/3] Starting Backend Server (NestJS)...
:: Opens a new command prompt running the backend
start "ClosetRent Backend" cmd /k "echo Starting Backend... && npm run dev:backend"

echo.
echo [3/3] Starting Frontend Server (NextJS)...
:: Opens a new command prompt running the frontend
start "ClosetRent Frontend" cmd /k "echo Starting Frontend... && npm run dev:frontend"

echo.
echo Development environment is starting up!
echo The backend should be available at http://localhost:3001
echo The frontend should be available at http://localhost:3000
echo.
pause
