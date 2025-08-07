#!/bin/bash

# Comprehensive test script for all pages and functionality
BASE_URL="http://localhost:4400"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Comprehensive Platform Test${NC}"
echo -e "${BLUE}=====================================${NC}"

# Test pages
echo -e "\n${YELLOW}Testing Pages:${NC}"
pages=(
 "/dashboard:Dashboard"
 "/catalog:Service Catalog"
 "/catalog/relationships:Service Relationships"
 "/create:Create Service"
 "/templates:Templates"
 "/plugins:Plugins"
 "/workflows:Workflows"
 "/deployments:Deployments"
 "/health:Health Monitor"
 "/analytics:Analytics"
 "/cost:Cost Tracking"
 "/monitoring:Monitoring"
 "/activity:Activity Feed"
 "/docs:Documentation"
 "/api-docs:API Documentation"
 "/teams:Teams"
 "/settings:Settings"
 "/admin:Admin Panel"
)

page_count=0
page_success=0
for page_info in "${pages[@]}"; do
 IFS=':' read -r path name <<< "$page_info"
 response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
 ((page_count++))
 
 if [ "$response" = "200" ]; then
 echo -e "${GREEN}${NC} ${name} - ${response}"
 ((page_success++))
 else
 echo -e "${RED}${NC} ${name} - ${response}"
 fi
done

# Test APIs
echo -e "\n${YELLOW}Testing APIs:${NC}"
apis=(
 "/api/health:Health Check"
 "/api/backstage/version:Backstage Version"
 "/api/backstage/catalog/entities:Catalog Entities"
 "/api/backstage/scaffolder/v2/templates:Templates API"
 "/api/monitoring/alerts:Monitoring Alerts"
 "/api/costs:Cost API"
 "/api/health/ready:Readiness Check"
 "/api/health/live:Liveness Check"
)

api_count=0
api_success=0
for api_info in "${apis[@]}"; do
 IFS=':' read -r path name <<< "$api_info"
 response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
 ((api_count++))
 
 if [ "$response" = "200" ]; then
 echo -e "${GREEN}${NC} ${name} - ${response}"
 ((api_success++))
 else
 echo -e "${RED}${NC} ${name} - ${response}"
 fi
done

# Test data retrieval
echo -e "\n${YELLOW}Testing Data Retrieval:${NC}"

# Check catalog entities
entity_count=$(curl -s "${BASE_URL}/api/backstage/catalog/entities" | jq '.items | length' 2>/dev/null || echo "0")
if [ "$entity_count" -gt 0 ]; then
 echo -e "${GREEN}${NC} Catalog entities: ${entity_count} found"
else
 echo -e "${YELLOW}${NC} Catalog entities: No entities found"
fi

# Check health status
health_status=$(curl -s "${BASE_URL}/api/health" | jq -r '.status' 2>/dev/null || echo "error")
if [ "$health_status" = "ok" ]; then
 echo -e "${GREEN}${NC} Health status: ${health_status}"
else
 echo -e "${RED}${NC} Health status: ${health_status}"
fi

# Performance check
echo -e "\n${YELLOW}Testing Performance:${NC}"
start_time=$(date +%s%3N)
curl -s "${BASE_URL}/dashboard" > /dev/null
end_time=$(date +%s%3N)
load_time=$((end_time - start_time))

if [ $load_time -lt 1000 ]; then
 echo -e "${GREEN}${NC} Dashboard load time: ${load_time}ms"
else
 echo -e "${YELLOW}${NC} Dashboard load time: ${load_time}ms (slow)"
fi

# Summary
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}=====================================${NC}"

total_tests=$((page_count + api_count))
total_success=$((page_success + api_success))
success_rate=$(( (total_success * 100) / total_tests ))

echo -e "Pages tested: ${page_success}/${page_count}"
echo -e "APIs tested: ${api_success}/${api_count}"
echo -e "Total tests: ${total_success}/${total_tests}"
echo -e "Success rate: ${success_rate}%"

if [ $success_rate -eq 100 ]; then
 echo -e "\n${GREEN} All tests passed! Platform is fully operational.${NC}"
 exit 0
elif [ $success_rate -ge 90 ]; then
 echo -e "\n${YELLOW} Platform is mostly operational (${success_rate}% success).${NC}"
 exit 0
else
 echo -e "\n${RED} Platform has issues (${success_rate}% success).${NC}"
 exit 1
fi