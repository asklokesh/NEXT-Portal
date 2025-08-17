#!/bin/bash

# Production Start Script for SaaS IDP Portal
set -e

echo "Starting SaaS IDP Portal in Production Mode..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root${NC}"
   exit 1
fi

# 1. Start Docker services
echo -e "\n${YELLOW}1. Starting Docker services...${NC}"
cd "$PROJECT_ROOT"

# Start PostgreSQL and Redis
docker compose up -d db redis

# Wait for PostgreSQL
echo -n "Waiting for PostgreSQL..."
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}Ready!${NC}"

# Wait for Redis
echo -n "Waiting for Redis..."
until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}Ready!${NC}"

# 2. Set production environment
echo -e "\n${YELLOW}2. Setting production environment...${NC}"
export NODE_ENV=production
export PORT=4400

# 3. Run database migrations
echo -e "\n${YELLOW}3. Running database migrations...${NC}"
if [ -f "prisma/schema.prisma" ]; then
    npx prisma db push --force-reset --accept-data-loss && npx prisma migrate deploy && npx prisma generate
fi

# 4. Start Mock Backstage (since we don't have real Backstage)
echo -e "\n${YELLOW}4. Starting Mock Backstage API...${NC}"
NODE_ENV=production PORT=4402 nohup node scripts/mock-backstage-server.js > logs/backstage-prod.log 2>&1 &
echo $! > .backstage-prod.pid

# Wait for Mock Backstage
echo -n "Waiting for Mock Backstage..."
for i in {1..30}; do
    if curl -s http://localhost:4402/health > /dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e " ${RED}Failed to start!${NC}"
        exit 1
    fi
    
    echo -n "."
    sleep 1
done

# 5. Start Next.js in production mode
echo -e "\n${YELLOW}5. Starting Next.js in production mode...${NC}"

# Create logs directory
mkdir -p logs

# Start the production server
NODE_ENV=production PORT=4400 npm start > logs/nextjs-prod.log 2>&1 &
echo $! > .nextjs-prod.pid

# Wait for Next.js
echo -n "Waiting for Next.js production server..."
for i in {1..30}; do
    if curl -s http://localhost:4400/api/health > /dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e " ${RED}Failed to start!${NC}"
        exit 1
    fi
    
    echo -n "."
    sleep 1
done

# 6. Summary
echo -e "\n${GREEN}================================="
echo "Production Portal Started!"
echo "=================================${NC}"
echo ""
echo "Services running:"
echo -e " ${GREEN}✓${NC} PostgreSQL: localhost:5432"
echo -e " ${GREEN}✓${NC} Redis: localhost:6379"
echo -e " ${GREEN}✓${NC} Mock Backstage API: http://localhost:4402"
echo -e " ${GREEN}✓${NC} Next.js Production: http://localhost:4400"
echo ""
echo -e "${GREEN}Portal URL: http://localhost:4400${NC}"
echo ""
echo -e "${YELLOW}Performance Tips:${NC}"
echo " - All assets are optimized and minified"
echo " - Static pages are pre-rendered"
echo " - API routes are optimized for production"
echo " - Caching is enabled for better performance"
echo ""
echo "To monitor: tail -f logs/nextjs-prod.log"
echo "To stop: ./scripts/stop-production.sh"