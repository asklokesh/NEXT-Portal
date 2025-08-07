#!/bin/bash

# Portal Stop Script - Stops all services for the Backstage IDP Wrapper
# This script stops: Next.js Frontend, Backstage Backend, PostgreSQL, Redis

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Backstage IDP Portal...${NC}"
echo "================================="

# Function to stop a process by PID file
stop_process() {
 local name=$1
 local pid_file=$2
 
 if [ -f "$pid_file" ]; then
 PID=$(cat "$pid_file")
 if ps -p $PID > /dev/null 2>&1; then
 echo -n "Stopping $name (PID: $PID)..."
 kill $PID 2>/dev/null || true
 
 # Wait for process to stop
 local count=0
 while ps -p $PID > /dev/null 2>&1 && [ $count -lt 10 ]; do
 sleep 1
 count=$((count + 1))
 done
 
 # Force kill if still running
 if ps -p $PID > /dev/null 2>&1; then
 kill -9 $PID 2>/dev/null || true
 fi
 
 echo -e " ${GREEN}Stopped${NC}"
 else
 echo "$name not running (stale PID file)"
 fi
 rm -f "$pid_file"
 else
 echo "$name not running (no PID file)"
 fi
}

# Function to stop process by port
stop_by_port() {
 local name=$1
 local port=$2
 
 if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
 echo -n "Stopping $name on port $port..."
 lsof -ti:$port | xargs kill -9 2>/dev/null || true
 echo -e " ${GREEN}Stopped${NC}"
 else
 echo "$name not running on port $port"
 fi
}

# 1. Stop Next.js frontend
echo -e "\n${YELLOW}1. Stopping Next.js frontend...${NC}"
stop_process "Next.js" "$PROJECT_ROOT/.nextjs.pid"
stop_by_port "Next.js" 4400

# 2. Stop Backstage backend
echo -e "\n${YELLOW}2. Stopping Backstage backend...${NC}"
stop_process "Backstage" "$PROJECT_ROOT/.backstage.pid"
stop_process "Mock Backstage" "$PROJECT_ROOT/.mock-backstage.pid"
stop_by_port "Backstage" 4410

# 3. Stop any remaining Node.js processes
echo -e "\n${YELLOW}3. Cleaning up Node.js processes...${NC}"

# Find and kill any node processes running from project directory
ps aux | grep -E "node.*$PROJECT_ROOT" | grep -v grep | awk '{print $2}' | while read pid; do
 if [ ! -z "$pid" ]; then
 echo "Stopping orphaned Node.js process (PID: $pid)"
 kill -9 $pid 2>/dev/null || true
 fi
done

# 4. Stop Docker services
echo -e "\n${YELLOW}4. Stopping Docker services...${NC}"
cd "$PROJECT_ROOT"

if command -v docker-compose &> /dev/null; then
 if docker info > /dev/null 2>&1; then
 echo "Stopping PostgreSQL and Redis..."
 docker-compose down
 echo -e "Docker services ${GREEN}stopped${NC}"
 else
 echo -e "${YELLOW}Docker is not running${NC}"
 fi
else
 echo -e "${YELLOW}docker-compose not found${NC}"
fi

# 5. Clean up
echo -e "\n${YELLOW}5. Cleaning up...${NC}"

# Remove PID files
rm -f "$PROJECT_ROOT/.nextjs.pid"
rm -f "$PROJECT_ROOT/.backstage.pid"
rm -f "$PROJECT_ROOT/.mock-backstage.pid"

# Optional: Clear logs (uncomment if desired)
# rm -rf "$PROJECT_ROOT/logs"

echo -e "\n${GREEN}================================="
echo "Portal stopped successfully!"
echo "=================================${NC}"