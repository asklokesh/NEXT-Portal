#!/bin/bash

# Stop Production Script
set -e

echo "Stopping SaaS IDP Portal Production..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# 1. Stop Next.js
echo -e "${YELLOW}Stopping Next.js production server...${NC}"
if [ -f ".nextjs-prod.pid" ]; then
    PID=$(cat .nextjs-prod.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}Next.js stopped${NC}"
    fi
    rm -f .nextjs-prod.pid
fi

# Also check port 4400
if lsof -ti:4400 > /dev/null 2>&1; then
    lsof -ti:4400 | xargs kill -9 2>/dev/null || true
fi

# 2. Stop Mock Backstage
echo -e "${YELLOW}Stopping Mock Backstage...${NC}"
if [ -f ".backstage-prod.pid" ]; then
    PID=$(cat .backstage-prod.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}Mock Backstage stopped${NC}"
    fi
    rm -f .backstage-prod.pid
fi

# Also check port 4402
if lsof -ti:4402 > /dev/null 2>&1; then
    lsof -ti:4402 | xargs kill -9 2>/dev/null || true
fi

# 3. Stop Docker services
echo -e "${YELLOW}Stopping Docker services...${NC}"
docker compose down

echo -e "\n${GREEN}Production services stopped successfully!${NC}"