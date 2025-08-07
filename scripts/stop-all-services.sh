#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping IDP Platform Services...${NC}"

# Stop Node.js services
echo -e "${YELLOW}Stopping Node.js services...${NC}"
lsof -ti :4400 | xargs kill -9 2>/dev/null && echo -e "${GREEN}Stopped IDP Portal (4400)${NC}"
lsof -ti :4401 | xargs kill -9 2>/dev/null && echo -e "${GREEN}Stopped Backstage Frontend (4401)${NC}"
lsof -ti :4402 | xargs kill -9 2>/dev/null && echo -e "${GREEN}Stopped Backstage Backend (4402)${NC}"
lsof -ti :4403 | xargs kill -9 2>/dev/null && echo -e "${GREEN}Stopped WebSocket Server (4403)${NC}"

# Stop Docker services
echo -e "${YELLOW}Stopping Docker services...${NC}"
docker-compose stop

echo -e "${GREEN}All services stopped${NC}"