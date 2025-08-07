#!/bin/bash

# Portal Status Script - Shows status of all services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Backstage IDP Portal Status${NC}"
echo "============================"
echo ""

# Function to check if a port is in use
check_port() {
 local port=$1
 if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
 return 0
 else
 return 1
 fi
}

# Function to check process by PID file
check_pid_file() {
 local pid_file=$1
 if [ -f "$pid_file" ]; then
 PID=$(cat "$pid_file")
 if ps -p $PID > /dev/null 2>&1; then
 return 0
 fi
 fi
 return 1
}

# Function to get process info by port
get_process_info() {
 local port=$1
 lsof -i :$port -sTCP:LISTEN 2>/dev/null | grep -v COMMAND | head -1 | awk '{print $1 " (PID: " $2 ")"}'
}

# 1. Docker Services
echo -e "${YELLOW}Docker Services:${NC}"
if command -v docker &> /dev/null && docker info > /dev/null 2>&1; then
 # PostgreSQL
 if docker-compose ps 2>/dev/null | grep -q "postgres.*Up"; then
 echo -e " ${GREEN}${NC} PostgreSQL: Running on port 5432"
 else
 echo -e " ${RED}${NC} PostgreSQL: Not running"
 fi
 
 # Redis
 if docker-compose ps 2>/dev/null | grep -q "redis.*Up"; then
 echo -e " ${GREEN}${NC} Redis: Running on port 6379"
 else
 echo -e " ${RED}${NC} Redis: Not running"
 fi
else
 echo -e " ${YELLOW}${NC} Docker not available"
fi

echo ""

# 2. Backstage Backend
echo -e "${YELLOW}Backstage Backend:${NC}"
if check_port 4410; then
 process_info=$(get_process_info 4410)
 echo -e " ${GREEN}${NC} Running on port 4410 - $process_info"
 echo -e " URL: http://localhost:4410"
elif check_pid_file "$PROJECT_ROOT/.backstage.pid" || check_pid_file "$PROJECT_ROOT/.mock-backstage.pid"; then
 echo -e " ${YELLOW}${NC} Process exists but port 4410 not responding"
else
 echo -e " ${RED}${NC} Not running"
fi

echo ""

# 3. Next.js Frontend
echo -e "${YELLOW}Next.js Frontend:${NC}"
if check_port 4400; then
 process_info=$(get_process_info 4400)
 echo -e " ${GREEN}${NC} Running on port 4400 - $process_info"
 echo -e " URL: http://localhost:4400"
elif check_pid_file "$PROJECT_ROOT/.nextjs.pid"; then
 echo -e " ${YELLOW}${NC} Process exists but port 4400 not responding"
else
 echo -e " ${RED}${NC} Not running"
fi

echo ""

# 4. Log Files
echo -e "${YELLOW}Log Files:${NC}"
if [ -d "$PROJECT_ROOT/logs" ]; then
 for log in "$PROJECT_ROOT/logs"/*.log; do
 if [ -f "$log" ]; then
 filename=$(basename "$log")
 size=$(du -h "$log" | cut -f1)
 echo -e " • $filename ($size)"
 fi
 done
else
 echo -e " ${YELLOW}No logs directory found${NC}"
fi

echo ""

# 5. Environment
echo -e "${YELLOW}Environment:${NC}"
if [ -f "$PROJECT_ROOT/.env.local" ]; then
 echo -e " ${GREEN}${NC} .env.local exists"
else
 echo -e " ${YELLOW}${NC} .env.local not found"
fi

if [ -d "$PROJECT_ROOT/node_modules" ]; then
 echo -e " ${GREEN}${NC} Dependencies installed"
else
 echo -e " ${RED}${NC} Dependencies not installed"
fi

echo ""

# 6. Quick Actions
echo -e "${YELLOW}Quick Actions:${NC}"
echo " • Start all: ./scripts/start-all.sh"
echo " • Stop all: ./scripts/stop-all.sh"
echo " • Restart all: ./scripts/restart-all.sh"
echo " • View logs: tail -f logs/*.log"