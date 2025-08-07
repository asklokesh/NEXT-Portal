#!/bin/bash

# Setup script for Backstage integration with UI wrapper
# This script configures and starts both Backstage and the UI wrapper

set -e

echo " Setting up Backstage integration..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
 echo -e "${RED} Node.js is not installed. Please install Node.js 20 or 22.${NC}"
 exit 1
fi

# Check node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
 echo -e "${RED} Node.js version must be 20 or higher. Current version: $(node --version)${NC}"
 exit 1
fi

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
 echo -e "${RED} Yarn is not installed. Please install Yarn.${NC}"
 exit 1
fi

echo -e "${GREEN} Prerequisites check passed${NC}"

# Function to wait for a service to be ready
wait_for_service() {
 local url=$1
 local service_name=$2
 local max_attempts=30
 local attempt=0

 echo -e "${YELLOW} Waiting for $service_name to be ready at $url...${NC}"
 
 while [ $attempt -lt $max_attempts ]; do
 if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302"; then
 echo -e "${GREEN} $service_name is ready!${NC}"
 return 0
 fi
 
 attempt=$((attempt + 1))
 echo -n "."
 sleep 2
 done
 
 echo -e "${RED} $service_name failed to start after $max_attempts attempts${NC}"
 return 1
}

# Create necessary environment files if they don't exist
create_env_files() {
 echo -e "${YELLOW} Creating environment files...${NC}"
 
 # Create .env.local for UI wrapper if it doesn't exist
 if [ ! -f ".env.local" ]; then
 cat > .env.local << EOF
# Backstage Integration
NEXT_PUBLIC_BACKSTAGE_URL=http://localhost:7007
NEXT_PUBLIC_BACKSTAGE_API_URL=http://localhost:7007/api
BACKSTAGE_API_URL=http://localhost:7007/api

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/idp

# Enable demo mode for development
NEXT_PUBLIC_DEMO_MODE=false

# Authentication (Guest mode for local development)
AUTH_PROVIDER=guest
EOF
 echo -e "${GREEN} Created .env.local${NC}"
 fi
 
 # Create app-config.local.yaml for Backstage if it doesn't exist
 if [ ! -f "backstage/app-config.local.yaml" ]; then
 cat > backstage/app-config.local.yaml << EOF
app:
 title: Local Backstage Instance
 baseUrl: http://localhost:3000 # UI wrapper URL

backend:
 baseUrl: http://localhost:7007
 listen:
 port: 7007
 cors:
 origin: http://localhost:3000
 methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
 credentials: true
 database:
 client: better-sqlite3
 connection: ':memory:'

auth:
 providers:
 guest:
 dangerouslyAllowOutsideDevelopment: true

catalog:
 import:
 entityFilename: catalog-info.yaml
 pullRequestBranchName: backstage-integration

integrations:
 github:
 - host: github.com
 # Add your GitHub token here if needed
 # token: \${GITHUB_TOKEN}
EOF
 echo -e "${GREEN} Created backstage/app-config.local.yaml${NC}"
 fi
}

# Start Backstage in the background
start_backstage() {
 echo -e "${YELLOW} Starting Backstage...${NC}"
 
 cd backstage
 
 # Build Backstage if needed
 if [ ! -d "node_modules/.cache/webpack" ]; then
 echo -e "${YELLOW} First time setup - building Backstage...${NC}"
 yarn build:backend
 fi
 
 # Start Backstage
 yarn dev &
 BACKSTAGE_PID=$!
 cd ..
 
 # Wait for Backstage to be ready
 wait_for_service "http://localhost:7007/api/catalog/entities" "Backstage"
}

# Start UI wrapper
start_ui_wrapper() {
 echo -e "${YELLOW} Starting UI Wrapper...${NC}"
 
 # Install dependencies if needed
 if [ ! -d "node_modules" ]; then
 echo -e "${YELLOW} Installing UI wrapper dependencies...${NC}"
 yarn install
 fi
 
 # Start the UI wrapper
 yarn dev &
 UI_WRAPPER_PID=$!
 
 # Wait for UI wrapper to be ready
 wait_for_service "http://localhost:3000" "UI Wrapper"
}

# Main execution
main() {
 # Create environment files
 create_env_files
 
 # Start both services
 start_backstage
 start_ui_wrapper
 
 echo -e "${GREEN} Both services are running!${NC}"
 echo -e "${GREEN} Backstage API: http://localhost:7007${NC}"
 echo -e "${GREEN} UI Wrapper: http://localhost:3000${NC}"
 echo -e "${YELLOW} Press Ctrl+C to stop both services${NC}"
 
 # Wait for user to stop the services
 trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $BACKSTAGE_PID $UI_WRAPPER_PID 2>/dev/null; exit' INT
 wait
}

# Run main function
main