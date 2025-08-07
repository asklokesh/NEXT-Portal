#!/bin/bash

# Development Script - Starts all services and opens browser

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Backstage IDP Portal in Development Mode${NC}"
echo "=============================================="

# Start all services
"$SCRIPT_DIR/start-all.sh"

# Wait a bit for services to stabilize
sleep 2

# Open browser
echo -e "\n${YELLOW}Opening browser...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
 # macOS
 open http://localhost:4400
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
 # Linux
 if command -v xdg-open &> /dev/null; then
 xdg-open http://localhost:4400
 elif command -v gnome-open &> /dev/null; then
 gnome-open http://localhost:4400
 fi
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
 # Windows
 start http://localhost:4400
fi

echo -e "\n${GREEN}Development environment ready!${NC}"
echo "Portal URL: http://localhost:4400"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Show logs
echo -e "${YELLOW}Showing logs (Ctrl+C to stop)...${NC}"
tail -f "$SCRIPT_DIR/../logs"/*.log