#!/bin/bash

# Portal Restart Script - Restarts all services for the Backstage IDP Wrapper

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Restarting Backstage IDP Portal...${NC}"
echo "===================================="

# Stop all services
"$SCRIPT_DIR/stop-all.sh"

echo -e "\n${YELLOW}Waiting for services to fully stop...${NC}"
sleep 3

# Start all services
"$SCRIPT_DIR/start-all.sh"