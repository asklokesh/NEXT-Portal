#!/bin/bash
set -euo pipefail

# Local development startup script (without Docker)
# This script sets up the development environment using local services

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log() {
 echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
 echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1" >&2
}

info() {
 echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO:${NC} $1"
}

warn() {
 echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

# Check dependencies
check_dependencies() {
 log "Checking dependencies..."
 
 # Check Node.js
 if ! command -v node &> /dev/null; then
 error "Node.js is not installed"
 exit 1
 fi
 
 # Check npm
 if ! command -v npm &> /dev/null; then
 error "npm is not installed"
 exit 1
 fi
 
 log "Dependencies checked "
}

# Install npm packages
install_packages() {
 if [ ! -d "node_modules" ]; then
 log "Installing npm packages..."
 npm install
 else
 info "npm packages already installed"
 fi
}

# Setup environment
setup_environment() {
 log "Setting up environment..."
 
 # Create .env.local if it doesn't exist
 if [ ! -f ".env.local" ]; then
 cat > .env.local << EOF
# Local Development Environment
NODE_ENV=development

# Use mock data for development (no external dependencies required)
USE_MOCK_DATA=true
USE_MOCK_DB=true

# Application settings
NEXT_PUBLIC_APP_NAME="Backstage IDP Platform (Dev)"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Mock Backstage API
BACKSTAGE_API_URL=http://localhost:7007
NEXT_PUBLIC_BACKSTAGE_API_URL=http://localhost:7007

# Session secret (development only)
SESSION_SECRET=development-secret-change-in-production
ENCRYPTION_KEY=development-key-32-characters-long

# Disable external services in development
SENTRY_DSN=
METRICS_AUTH_TOKEN=dev-token

# Feature flags
NEXT_PUBLIC_ENABLE_NO_CODE=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_WEBSOCKETS=false
EOF
 log "Created .env.local with mock data configuration"
 else
 info ".env.local already exists"
 fi
 
 # Update main .env to use mock data
 if grep -q "USE_MOCK_DATA=false" .env 2>/dev/null; then
 warn "Updating .env to use mock data for local development..."
 sed -i.bak 's/USE_MOCK_DATA=false/USE_MOCK_DATA=true/' .env
 sed -i.bak 's/USE_MOCK_DB=false/USE_MOCK_DB=true/' .env
 fi
}

# Generate Prisma client
setup_prisma() {
 log "Setting up Prisma..."
 npx prisma generate
}

# Start the development server
start_dev_server() {
 log "Starting development server..."
 
 # Kill any existing Next.js processes
 pkill -f "next dev" 2>/dev/null || true
 
 # Clear Next.js cache
 rm -rf .next
 
 echo ""
 echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
 echo -e "${GREEN} Development server starting on http://localhost:3000 ${NC}"
 echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
 echo ""
 echo -e "${YELLOW}Note: Running with mock data - no database required${NC}"
 echo -e "${YELLOW}To use real services, run: docker-compose up${NC}"
 echo ""
 
 # Start the server
 npm run dev
}

# Show help
show_help() {
 echo "Local Development Setup"
 echo ""
 echo "This script starts the application in development mode with mock data."
 echo "No external services (PostgreSQL, Redis) are required."
 echo ""
 echo "For production-like setup with real services, use:"
 echo " docker-compose up"
 echo ""
 echo "To stop the server, press Ctrl+C"
}

# Main execution
main() {
 echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
 echo -e "${BLUE}║ Backstage IDP Local Development ║${NC}"
 echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"
 
 check_dependencies
 install_packages
 setup_environment
 setup_prisma
 start_dev_server
}

# Handle Ctrl+C
trap 'echo -e "\n${YELLOW}Shutting down...${NC}"; exit 0' INT TERM

# Run main function
main