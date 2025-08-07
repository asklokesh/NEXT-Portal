#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting IDP Platform Services...${NC}"

# Function to check if port is in use
check_port() {
 lsof -i :$1 > /dev/null 2>&1
 return $?
}

# Function to wait for service
wait_for_service() {
 local port=$1
 local service=$2
 local max_attempts=30
 local attempt=0
 
 echo -e "${YELLOW}Waiting for $service on port $port...${NC}"
 while ! check_port $port && [ $attempt -lt $max_attempts ]; do
 sleep 1
 attempt=$((attempt + 1))
 done
 
 if [ $attempt -eq $max_attempts ]; then
 echo -e "${RED}$service failed to start on port $port${NC}"
 return 1
 else
 echo -e "${GREEN}$service is running on port $port${NC}"
 return 0
 fi
}

# Kill existing processes
echo -e "${YELLOW}Stopping existing services...${NC}"
lsof -ti :4400 | xargs kill -9 2>/dev/null
lsof -ti :4401 | xargs kill -9 2>/dev/null
lsof -ti :4402 | xargs kill -9 2>/dev/null
lsof -ti :4403 | xargs kill -9 2>/dev/null
sleep 2

# Start Docker services
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d postgres redis

# Wait for PostgreSQL
echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
until docker-compose exec -T postgres pg_isready -U backstage_user > /dev/null 2>&1; do
 sleep 1
done
echo -e "${GREEN}PostgreSQL is ready${NC}"

# Wait for Redis
echo -e "${YELLOW}Waiting for Redis...${NC}"
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
 sleep 1
done
echo -e "${GREEN}Redis is ready${NC}"

# Start IDP Portal (port 4400)
echo -e "${YELLOW}Starting IDP Portal on port 4400...${NC}"
cd /Users/lokesh/git/saas-idp
npm run dev > logs/idp-portal.log 2>&1 &
IDP_PID=$!

# Start WebSocket Server (port 4403)
echo -e "${YELLOW}Starting WebSocket Server on port 4403...${NC}"
npx tsx scripts/websocket-server.ts > logs/websocket-server.log 2>&1 &
WS_PID=$!

# Start Backstage Frontend (port 4401) - if exists
if [ -d "backstage" ]; then
 echo -e "${YELLOW}Starting Backstage Frontend on port 4401...${NC}"
 cd backstage
 PORT=4401 yarn start > ../logs/backstage-frontend.log 2>&1 &
 BACKSTAGE_FRONTEND_PID=$!
 cd ..
fi

# Start Backstage Backend (port 4402) - if exists
if [ -d "backstage-backend" ]; then
 echo -e "${YELLOW}Starting Backstage Backend on port 4402...${NC}"
 cd backstage-backend
 PORT=4402 yarn start:backend > ../logs/backstage-backend.log 2>&1 &
 BACKSTAGE_BACKEND_PID=$!
 cd ..
fi

# Wait for all services to start
wait_for_service 4400 "IDP Portal"
wait_for_service 4403 "WebSocket Server"

if [ -d "backstage" ]; then
 wait_for_service 4401 "Backstage Frontend"
fi

if [ -d "backstage-backend" ]; then
 wait_for_service 4402 "Backstage Backend"
fi

echo -e "\n${GREEN}All services started successfully!${NC}"
echo -e "\nService URLs:"
echo -e " ${GREEN}IDP Portal:${NC} http://localhost:4400"
echo -e " ${GREEN}WebSocket Server:${NC} http://localhost:4403"
if [ -d "backstage" ]; then
 echo -e " ${GREEN}Backstage Frontend:${NC} http://localhost:4401"
fi
if [ -d "backstage-backend" ]; then
 echo -e " ${GREEN}Backstage Backend:${NC} http://localhost:4402"
fi
echo -e " ${GREEN}PostgreSQL:${NC} localhost:5432"
echo -e " ${GREEN}Redis:${NC} localhost:6379"

echo -e "\nLogs are available in the 'logs' directory"
echo -e "\nTo stop all services, run: ${YELLOW}./scripts/stop-all-services.sh${NC}"

# Keep script running
echo -e "\nPress Ctrl+C to stop all services..."

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}Stopping all services...${NC}"; ./scripts/stop-all-services.sh; exit' INT

# Wait indefinitely
while true; do
 sleep 1
done