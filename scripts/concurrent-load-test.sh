#!/bin/bash

# Script to test concurrent page loads
BASE_URL="http://localhost:4400"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Concurrent Load Test${NC}"
echo -e "${BLUE}=============================${NC}"

# Pages to test
pages=(
 "/dashboard"
 "/catalog"
 "/catalog/relationships"
 "/templates"
 "/plugins"
 "/workflows"
 "/deployments"
 "/health"
 "/analytics"
 "/cost"
 "/monitoring"
 "/activity"
 "/docs"
 "/api-docs"
 "/teams"
 "/settings"
 "/admin"
)

# Function to load a page
load_page() {
 local path=$1
 local iteration=$2
 local response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
 echo "[Iteration $iteration] ${path}: ${response}"
}

# Run 5 concurrent iterations
echo -e "\n${YELLOW}Running 5 concurrent loads for each page...${NC}\n"

for page in "${pages[@]}"; do
 echo -e "${BLUE}Testing ${page}...${NC}"
 
 # Launch 5 concurrent requests
 for i in {1..5}; do
 load_page "$page" "$i" &
 done
 
 # Wait for all background jobs to complete
 wait
 
 echo ""
done

echo -e "${GREEN}Concurrent load test completed!${NC}"