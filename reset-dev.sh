#!/usr/bin/env bash
# ===========================================================
#  ClosetRent — Full Dev Environment Reset (macOS / Linux)
#  Equivalent of reset-dev.bat
#
#  Wipes: PostgreSQL, Redis, MinIO (all data, fresh start)
#  Then re-runs Prisma migrations, seed, and recreates bucket
# ===========================================================

set -euo pipefail
cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD} ============================================${NC}"
echo -e "${BOLD}  ClosetRent — FULL RESET${NC}"
echo -e "${RED}  This will DESTROY all data:${NC}"
echo -e "${RED}    - PostgreSQL (entire database wiped)${NC}"
echo -e "${RED}    - Redis (all cache keys flushed)${NC}"
echo -e "${RED}    - MinIO (all uploaded files deleted)${NC}"
echo -e "${BOLD} ============================================${NC}"
echo ""

read -rp "Are you sure? Type YES to continue: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BOLD}[1/7]${NC} Stopping containers and removing volumes..."
if ! docker compose down -v; then
    echo -e "${RED}ERROR: docker compose down failed. Is Docker running?${NC}"
    exit 1
fi
echo -e "  ${GREEN}Containers stopped, volumes destroyed.${NC}"

echo ""
echo -e "${BOLD}[2/7]${NC} Starting fresh containers (empty volumes)..."
if ! docker compose up -d; then
    echo -e "${RED}ERROR: docker compose up failed.${NC}"
    exit 1
fi
echo -e "  ${GREEN}Containers started.${NC}"

echo ""
echo -e "${BOLD}[3/7]${NC} Waiting for PostgreSQL to be ready..."
RETRIES=0
until docker compose exec -T postgres pg_isready -U closetrent -d closetrent_dev &>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [[ $RETRIES -ge 15 ]]; then
        echo -e "${RED}ERROR: PostgreSQL did not become ready in 30s.${NC}"
        exit 1
    fi
    sleep 2
done
echo -e "  ${GREEN}PostgreSQL is ready.${NC}"

echo ""
echo -e "${BOLD}[4/7]${NC} Waiting for Redis to be ready..."
RETRIES=0
until docker compose exec -T redis redis-cli ping &>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [[ $RETRIES -ge 10 ]]; then
        echo -e "${RED}ERROR: Redis did not respond in 10s.${NC}"
        exit 1
    fi
    sleep 1
done
echo -e "  ${GREEN}Redis is ready (0 keys).${NC}"

echo ""
echo -e "${BOLD}[5/7]${NC} Waiting for MinIO and creating bucket..."
RETRIES=0
until docker compose exec -T minio curl -sf http://localhost:9000/minio/health/live &>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [[ $RETRIES -ge 10 ]]; then
        echo -e "${RED}ERROR: MinIO did not become healthy in 20s.${NC}"
        exit 1
    fi
    sleep 2
done
echo -e "  ${GREEN}MinIO is healthy.${NC}"

# Recreate the application bucket using mc (MinIO Client) inside container
if docker compose exec -T minio sh -c 'mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null; mc mb local/closetrent-dev --ignore-existing 2>/dev/null; mc anonymous set download local/closetrent-dev 2>/dev/null' &>/dev/null; then
    echo -e "  ${GREEN}Bucket 'closetrent-dev' created with public-read policy.${NC}"
else
    echo -e "  ${YELLOW}NOTE: Could not auto-create bucket. Create it manually in MinIO Console at http://localhost:9001${NC}"
fi

echo ""
echo -e "${BOLD}[6/7]${NC} Running Prisma migrations..."
cd apps/backend
if ! npx prisma migrate deploy; then
    echo "  migrate deploy failed, trying migrate dev..."
    npx prisma migrate dev --name fresh_reset
fi
cd ../..
echo -e "  ${GREEN}Migrations applied.${NC}"

echo ""
echo -e "${BOLD}[7/7]${NC} Seeding the database..."
cd apps/backend
npx prisma db seed
cd ../..
echo -e "  ${GREEN}Seed complete.${NC}"

echo ""
echo -e "${BOLD} ============================================${NC}"
echo -e "${GREEN}  RESET COMPLETE — Everything is fresh!${NC}"
echo -e "${BOLD} ============================================${NC}"
echo ""
echo "  PostgreSQL : Empty DB, migrations applied, seeded"
echo "  Redis      : 0 keys, empty cache"
echo "  MinIO      : 0 files, bucket 'closetrent-dev' ready"
echo ""
echo "  Start developing:"
echo "    cd apps/backend  && npm run start:dev"
echo "    cd apps/frontend && npm run dev"
echo ""
