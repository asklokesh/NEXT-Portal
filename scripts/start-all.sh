#!/bin/bash

# Portal Start Script - Starts all services for the Backstage IDP Wrapper
# This script starts: PostgreSQL, Redis, Backstage Backend, Next.js Frontend

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Backstage IDP Portal...${NC}"
echo "================================="

# Function to check if a port is in use
check_port() {
 local port=$1
 if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
 return 0
 else
 return 1
 fi
}

# Function to wait for a service to be ready
wait_for_service() {
 local name=$1
 local port=$2
 local max_attempts=30
 local attempt=0
 
 echo -n "Waiting for $name to be ready..."
 while [ $attempt -lt $max_attempts ]; do
 if check_port $port; then
 echo -e " ${GREEN}Ready!${NC}"
 return 0
 fi
 echo -n "."
 sleep 1
 attempt=$((attempt + 1))
 done
 echo -e " ${RED}Failed to start!${NC}"
 return 1
}

# 1. Start Docker services (PostgreSQL and Redis)
echo -e "\n${YELLOW}1. Starting Docker services...${NC}"
cd "$PROJECT_ROOT"

if ! command -v docker compose &> /dev/null; then
 echo -e "${RED}docker compose not found. Please install Docker Compose.${NC}"
 exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
 echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
 exit 1
fi

# Stop any existing containers first
docker compose down 2>/dev/null || true

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
wait_for_service "Redis" 6379

# 2. Set up environment variables
echo -e "\n${YELLOW}2. Setting up environment...${NC}"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
 echo "Creating .env.local from .env.example..."
 if [ -f .env.example ]; then
 cp .env.example .env.local
 else
 cat > .env.local << EOF
# Backstage Backend URL
NEXT_PUBLIC_BACKSTAGE_URL=http://localhost:4410
BACKSTAGE_API_URL=http://localhost:4410/api

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/backstage

# Redis
REDIS_URL=redis://localhost:6379

# Auth (update with your values)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Node Environment
NODE_ENV=development
EOF
 fi
fi

# 3. Install dependencies if needed
echo -e "\n${YELLOW}3. Checking dependencies...${NC}"

if [ ! -d "node_modules" ]; then
 echo "Installing dependencies..."
 npm install
else
 echo "Dependencies already installed."
fi

# 4. Start Backstage backend (if available)
echo -e "\n${YELLOW}4. Starting Backstage backend...${NC}"

BACKSTAGE_DIR="$PROJECT_ROOT/backstage"
if [ -d "$BACKSTAGE_DIR" ]; then
 cd "$BACKSTAGE_DIR"
 
 if [ ! -d "node_modules" ]; then
 echo "Installing Backstage dependencies..."
 yarn install
 fi
 
 # Start Backstage in background
 echo "Starting Backstage backend on port 4410..."
 nohup yarn dev > "$PROJECT_ROOT/logs/backstage.log" 2>&1 &
 echo $! > "$PROJECT_ROOT/.backstage.pid"
 
 cd "$PROJECT_ROOT"
 wait_for_service "Backstage" 4402
else
 echo -e "${YELLOW}Backstage directory not found. Starting mock backend...${NC}"
 
 # Start mock Backstage server
 cd "$PROJECT_ROOT"
 nohup npm run mock-backstage > "$PROJECT_ROOT/logs/mock-backstage.log" 2>&1 &
 echo $! > "$PROJECT_ROOT/.mock-backstage.pid"
 
 wait_for_service "Mock Backstage" 4402
fi

# 5. Database migrations
echo -e "\n${YELLOW}5. Running database migrations...${NC}"
if [ -f "prisma/schema.prisma" ]; then
 npx prisma migrate deploy
 npx prisma generate
else
 echo "No Prisma schema found, skipping migrations."
fi

# 6. Start Next.js frontend
echo -e "\n${YELLOW}6. Starting Next.js frontend...${NC}"

# Kill any existing Next.js process
if check_port 4400; then
 echo "Killing existing process on port 4400..."
 lsof -ti:4400 | xargs kill -9 2>/dev/null || true
 sleep 2
fi

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Start Next.js
echo "Starting Next.js on port 4400..."
PORT=4400 npm run dev > "$PROJECT_ROOT/logs/nextjs.log" 2>&1 &
echo $! > "$PROJECT_ROOT/.nextjs.pid"

wait_for_service "Next.js" 4400

# 7. Summary
echo -e "\n${GREEN}================================="
echo "Portal started successfully!"
echo "=================================${NC}"
echo ""
echo "Services running:"
echo -e " ${GREEN}${NC} PostgreSQL: localhost:5432"
echo -e " ${GREEN}${NC} Redis: localhost:6379"
if [ -d "$BACKSTAGE_DIR" ]; then
 echo -e " ${GREEN}${NC} Backstage Backend: http://localhost:4410"
else
 echo -e " ${GREEN}${NC} Mock Backstage: http://localhost:4410"
fi
echo -e " ${GREEN}${NC} Next.js Frontend: http://localhost:4400"
echo ""
echo -e "${YELLOW}Logs available at:${NC}"
echo " - Backstage: $PROJECT_ROOT/logs/backstage.log"
echo " - Next.js: $PROJECT_ROOT/logs/nextjs.log"
echo ""
echo -e "${GREEN}Portal URL: http://localhost:4400${NC}"
echo ""
echo "To stop all services, run: ./scripts/stop-all.sh"