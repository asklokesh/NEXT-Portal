#!/bin/bash

# Test script to verify Backstage integration

set -e

echo " Testing Backstage Integration..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base URLs
BACKSTAGE_URL="http://localhost:7007"
UI_WRAPPER_URL="http://localhost:3000"

# Function to test endpoint
test_endpoint() {
 local url=$1
 local description=$2
 local expected_status=${3:-200}
 
 echo -n "Testing $description... "
 
 status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
 
 if [ "$status" = "$expected_status" ]; then
 echo -e "${GREEN} OK (Status: $status)${NC}"
 return 0
 else
 echo -e "${RED} FAILED (Status: $status, Expected: $expected_status)${NC}"
 return 1
 fi
}

# Function to test API response
test_api_response() {
 local url=$1
 local description=$2
 
 echo -n "Testing $description... "
 
 response=$(curl -s "$url")
 
 if [ -n "$response" ] && [ "$response" != "null" ]; then
 echo -e "${GREEN} OK${NC}"
 return 0
 else
 echo -e "${RED} FAILED (Empty or null response)${NC}"
 return 1
 fi
}

echo -e "\n${YELLOW}1. Testing Backstage Backend${NC}"
echo "================================"

test_endpoint "$BACKSTAGE_URL/api/catalog/entities" "Catalog API"
test_endpoint "$BACKSTAGE_URL/api/scaffolder/v1/templates" "Scaffolder API"
test_endpoint "$BACKSTAGE_URL/api/techdocs" "TechDocs API"

echo -e "\n${YELLOW}2. Testing UI Wrapper${NC}"
echo "======================="

test_endpoint "$UI_WRAPPER_URL" "UI Wrapper Homepage" "200"
test_endpoint "$UI_WRAPPER_URL/api/health" "Health Check API"
test_endpoint "$UI_WRAPPER_URL/catalog" "Catalog Page" "200"

echo -e "\n${YELLOW}3. Testing Integration (UI Wrapper Backstage)${NC}"
echo "==============================================="

test_endpoint "$UI_WRAPPER_URL/api/backstage/catalog/entities" "Proxied Catalog API"
test_endpoint "$UI_WRAPPER_URL/api/backstage/scaffolder/v1/templates" "Proxied Scaffolder API"

echo -e "\n${YELLOW}4. Testing Data Flow${NC}"
echo "====================="

# Test if UI wrapper can fetch entities through proxy
echo -n "Fetching entities through UI wrapper proxy... "
entities=$(curl -s "$UI_WRAPPER_URL/api/backstage/entities")
if echo "$entities" | grep -q "items"; then
 echo -e "${GREEN} OK${NC}"
 
 # Count entities
 count=$(echo "$entities" | grep -o '"kind"' | wc -l)
 echo -e " Found ${GREEN}$count${NC} entities"
else
 echo -e "${RED} FAILED${NC}"
fi

echo -e "\n${YELLOW}5. Testing CORS Configuration${NC}"
echo "=============================="

echo -n "Testing CORS headers... "
cors_headers=$(curl -s -I -X OPTIONS \
 -H "Origin: http://localhost:3000" \
 -H "Access-Control-Request-Method: GET" \
 "$BACKSTAGE_URL/api/catalog/entities" 2>/dev/null | grep -i "access-control")

if echo "$cors_headers" | grep -q "Access-Control-Allow-Origin"; then
 echo -e "${GREEN} OK${NC}"
 echo "$cors_headers" | sed 's/^/ /'
else
 echo -e "${RED} FAILED (No CORS headers found)${NC}"
fi

echo -e "\n${YELLOW}Summary${NC}"
echo "========"

# Calculate results
total_tests=0
failed_tests=0

# Run all tests and count failures
if ! test_endpoint "$BACKSTAGE_URL/api/catalog/entities" "" >/dev/null 2>&1; then
 ((failed_tests++))
fi
((total_tests++))

if ! test_endpoint "$UI_WRAPPER_URL" "" >/dev/null 2>&1; then
 ((failed_tests++))
fi
((total_tests++))

if ! test_endpoint "$UI_WRAPPER_URL/api/backstage/catalog/entities" "" >/dev/null 2>&1; then
 ((failed_tests++))
fi
((total_tests++))

passed_tests=$((total_tests - failed_tests))

if [ $failed_tests -eq 0 ]; then
 echo -e "${GREEN} All tests passed! ($passed_tests/$total_tests)${NC}"
 echo -e "${GREEN}Integration is working correctly.${NC}"
else
 echo -e "${RED} Some tests failed! ($passed_tests/$total_tests passed)${NC}"
 echo -e "${YELLOW}Please check the services are running and configured correctly.${NC}"
fi