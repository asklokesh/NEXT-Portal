#!/bin/bash

# Script to check all pages with curl and report status
BASE_URL="http://localhost:4400"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Array of all pages to check
pages=(
 "/"
 "/dashboard"
 "/catalog"
 "/catalog/relationships"
 "/create"
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

# API endpoints to check
apis=(
 "/api/health"
 "/api/backstage/version"
 "/api/backstage/catalog/entities"
 "/api/backstage/scaffolder/v2/templates"
 "/api/monitoring/alerts"
 "/api/costs"
)

echo "Checking all pages and APIs..."
echo "=============================="

errors=0
success=0

# Check pages
echo -e "\n${YELLOW}Checking Pages:${NC}"
for page in "${pages[@]}"; do
 response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${page}")
 if [ "$response" = "200" ]; then
 echo -e "${GREEN}${NC} ${page} - ${response}"
 ((success++))
 else
 echo -e "${RED}${NC} ${page} - ${response}"
 ((errors++))
 fi
done

# Check APIs
echo -e "\n${YELLOW}Checking APIs:${NC}"
for api in "${apis[@]}"; do
 response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${api}")
 if [ "$response" = "200" ]; then
 echo -e "${GREEN}${NC} ${api} - ${response}"
 ((success++))
 else
 echo -e "${RED}${NC} ${api} - ${response}"
 ((errors++))
 fi
done

# Summary
echo -e "\n=============================="
echo -e "${YELLOW}Summary:${NC}"
echo -e "Total checked: $((success + errors))"
echo -e "${GREEN}Success: ${success}${NC}"
echo -e "${RED}Errors: ${errors}${NC}"

if [ $errors -eq 0 ]; then
 echo -e "\n${GREEN}All pages and APIs are working correctly!${NC}"
 exit 0
else
 echo -e "\n${RED}Some pages or APIs have errors. Please check the output above.${NC}"
 exit 1
fi