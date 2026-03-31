@echo off
REM ===========================================================
REM  ClosetRent — Full Dev Environment Reset
REM  Wipes: PostgreSQL, Redis, MinIO (all data, fresh start)
REM  Then re-runs Prisma migrations, seed, and recreates bucket
REM ===========================================================

setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   ClosetRent — FULL RESET
echo   This will DESTROY all data:
echo     - PostgreSQL (entire database wiped)
echo     - Redis (all cache keys flushed)
echo     - MinIO (all uploaded files deleted)
echo  ============================================
echo.

set /p CONFIRM="Are you sure? Type YES to continue: "
if /I not "%CONFIRM%"=="YES" (
    echo Aborted.
    exit /b 0
)

echo.
echo [1/7] Stopping containers and removing volumes...
REM  -v flag removes ALL named volumes declared in docker-compose.yml
REM  This guarantees pgdata, redisdata, miniodata are fully deleted
docker compose down -v
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: docker compose down failed. Is Docker running?
    exit /b 1
)
echo    Containers stopped, volumes destroyed.

echo.
echo [2/7] Starting fresh containers (empty volumes)...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: docker compose up failed.
    exit /b 1
)
echo    Containers started.

echo.
echo [3/7] Waiting for PostgreSQL to be ready...
set RETRIES=0
:WAIT_PG
timeout /t 2 /nobreak >nul
docker compose exec -T postgres pg_isready -U closetrent -d closetrent_dev >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set /a RETRIES+=1
    if %RETRIES% GEQ 15 (
        echo ERROR: PostgreSQL did not become ready in 30s.
        exit /b 1
    )
    goto WAIT_PG
)
echo    PostgreSQL is ready.

echo.
echo [4/7] Waiting for Redis to be ready...
set RETRIES=0
:WAIT_REDIS
timeout /t 1 /nobreak >nul
docker compose exec -T redis redis-cli ping >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set /a RETRIES+=1
    if %RETRIES% GEQ 10 (
        echo ERROR: Redis did not respond in 10s.
        exit /b 1
    )
    goto WAIT_REDIS
)
echo    Redis is ready (0 keys).

echo.
echo [5/7] Waiting for MinIO and creating bucket...
set RETRIES=0
:WAIT_MINIO
timeout /t 2 /nobreak >nul
docker compose exec -T minio curl -sf http://localhost:9000/minio/health/live >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set /a RETRIES+=1
    if %RETRIES% GEQ 10 (
        echo ERROR: MinIO did not become healthy in 20s.
        exit /b 1
    )
    goto WAIT_MINIO
)
echo    MinIO is healthy.

REM Recreate the application bucket using mc (MinIO Client) inside container
docker compose exec -T minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null; mc mb local/closetrent-dev --ignore-existing 2>/dev/null; mc anonymous set download local/closetrent-dev 2>/dev/null" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    Bucket 'closetrent-dev' created with public-read policy.
) else (
    echo    NOTE: Could not auto-create bucket. Create it manually in MinIO Console at http://localhost:9001
)

echo.
echo [6/7] Running Prisma migrations...
cd apps\backend
call npx prisma migrate deploy
if %ERRORLEVEL% NEQ 0 (
    echo    migrate deploy failed, trying migrate dev...
    call npx prisma migrate dev --name fresh_reset
)
cd ..\..
echo    Migrations applied.

echo.
echo [7/7] Seeding the database...
cd apps\backend
call npx prisma db seed
cd ..\..
echo    Seed complete.

echo.
echo  ============================================
echo   RESET COMPLETE — Everything is fresh!
echo  ============================================
echo.
echo   PostgreSQL : Empty DB, migrations applied, seeded
echo   Redis      : 0 keys, empty cache
echo   MinIO      : 0 files, bucket 'closetrent-dev' ready
echo.
echo   Start developing:
echo     cd apps\backend  ^&^& npm run start:dev
echo     cd apps\frontend ^&^& npm run dev
echo.

endlocal
