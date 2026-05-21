#!/usr/bin/env bash
# ===========================================================
#  ClosetRent — Dev Launcher (macOS / Linux)
#  Equivalent of start-dev.bat
# ===========================================================

set -euo pipefail
cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================
# HELPER FUNCTIONS
# ============================================================

kill_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        echo -e "  ${GREEN}Killed process(es) on port $port${NC}"
    else
        echo -e "  ${YELLOW}No process found on port $port${NC}"
    fi
}

wait_for_docker() {
    local attempts=0
    while true; do
        attempts=$((attempts + 1))
        if [[ $attempts -gt 15 ]]; then
            echo -e "  ${YELLOW}Warning: Timed out waiting for containers. Proceeding anyway...${NC}"
            return
        fi
        if docker compose exec -T postgres pg_isready -U closetrent &>/dev/null; then
            if docker compose exec -T redis redis-cli ping &>/dev/null; then
                echo -e "  ${GREEN}Postgres and Redis are ready!${NC}"
                return
            else
                echo -e "  Waiting for Redis... ($attempts/15)"
            fi
        else
            echo -e "  Waiting for Postgres... ($attempts/15)"
        fi
        sleep 2
    done
}

start_backend() {
    echo -e "${CYAN}Starting Backend...${NC}"
    npm run dev:backend &
    BACKEND_PID=$!
    echo -e "  ${GREEN}Backend started (PID: $BACKEND_PID)${NC}"
}

start_frontend() {
    echo -e "${CYAN}Starting Frontend...${NC}"
    npm run dev:frontend &
    FRONTEND_PID=$!
    echo -e "  ${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"
}

press_enter() {
    echo ""
    read -rp "Press Enter to continue..."
}

# ============================================================
# MENU ACTIONS
# ============================================================

start_all() {
    echo -e "${BOLD}[1/4]${NC} Starting Docker Compose..."
    docker compose up -d
    echo -e "${BOLD}[2/4]${NC} Waiting for services to be healthy..."
    wait_for_docker
    echo -e "${BOLD}[3/4]${NC} Starting Backend Server..."
    start_backend
    echo -e "${BOLD}[4/4]${NC} Starting Frontend Server..."
    start_frontend
    echo ""
    echo -e "${GREEN}All services launched!${NC}"
    press_enter
}

restart_backend() {
    echo "Stopping Backend (Port 4000)..."
    kill_port 4000
    start_backend
    echo -e "${GREEN}Backend restarted!${NC}"
    press_enter
}

restart_frontend() {
    echo "Stopping Frontend (Port 3000)..."
    kill_port 3000
    start_frontend
    echo -e "${GREEN}Frontend restarted!${NC}"
    press_enter
}

restart_everything() {
    echo "Stopping Apps..."
    kill_port 4000
    kill_port 3000
    echo "Restarting Docker Containers..."
    docker compose restart
    echo "Waiting for services to be healthy..."
    wait_for_docker
    echo "Starting Apps..."
    start_backend
    start_frontend
    echo -e "${GREEN}Everything restarted!${NC}"
    press_enter
}

stop_all() {
    echo "Stopping Apps..."
    kill_port 4000
    kill_port 3000
    echo "Stopping Docker..."
    docker compose down
    echo ""
    echo -e "${GREEN}All services stopped.${NC}"
    press_enter
}

status_check() {
    echo ""
    echo -e "${BOLD}--- Docker Containers ---${NC}"
    docker compose ps
    echo ""
    echo -e "${BOLD}--- Port 4000 (Backend) ---${NC}"
    if lsof -i :4000 -sTCP:LISTEN &>/dev/null; then
        echo -e "  ${GREEN}[RUNNING]${NC} Backend is listening on port 4000"
    else
        echo -e "  ${RED}[STOPPED]${NC} Nothing on port 4000"
    fi
    echo -e "${BOLD}--- Port 3000 (Frontend) ---${NC}"
    if lsof -i :3000 -sTCP:LISTEN &>/dev/null; then
        echo -e "  ${GREEN}[RUNNING]${NC} Frontend is listening on port 3000"
    else
        echo -e "  ${RED}[STOPPED]${NC} Nothing on port 3000"
    fi
    echo ""
    press_enter
}

# ============================================================
# MAIN MENU
# ============================================================

while true; do
    clear
    echo -e "${BOLD}====================================================${NC}"
    echo -e "${BOLD}            ClosetRent Dev Launcher${NC}"
    echo -e "${BOLD}====================================================${NC}"
    echo "  1. Start All (Docker + Backend + Frontend)"
    echo "  2. Restart Backend Only"
    echo "  3. Restart Frontend Only"
    echo "  4. Restart Everything (Docker + Both Apps)"
    echo "  5. Stop All (Kill Dev Apps & Docker Down)"
    echo "  6. Status Check"
    echo "  0. Exit"
    echo -e "${BOLD}====================================================${NC}"
    echo ""
    read -rp "Select an option (0-6): " choice

    case "$choice" in
        1) start_all ;;
        2) restart_backend ;;
        3) restart_frontend ;;
        4) restart_everything ;;
        5) stop_all ;;
        6) status_check ;;
        0) echo "Bye!"; exit 0 ;;
        *) echo "Invalid option."; sleep 1 ;;
    esac
done
