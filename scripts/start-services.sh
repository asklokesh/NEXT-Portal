#!/bin/bash
set -euo pipefail

# Service management script for Backstage IDP Platform
# Usage: ./start-services.sh [all|app|db|redis|stop]

COMMAND=${1:-all}

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

# Check if Docker is running
check_docker() {
 if ! docker info >/dev/null 2>&1; then
 error "Docker is not running. Please start Docker first."
 exit 1
 fi
}

# Start PostgreSQL
start_postgres() {
 log "Starting PostgreSQL..."
 
 # Check if container exists
 if docker ps -a --format "{{.Names}}" | grep -q "^backstage-postgres$"; then
 # Start existing container
 docker start backstage-postgres
 else
 # Create new container
 docker run -d \
 --name backstage-postgres \
 -e POSTGRES_USER=backstage_user \
 -e POSTGRES_PASSWORD=backstage_password \
 -e POSTGRES_DB=backstage_idp \
 -p 5432:5432 \
 -v backstage-postgres-data:/var/lib/postgresql/data \
 postgres:15-alpine
 fi
 
 # Wait for PostgreSQL to be ready
 info "Waiting for PostgreSQL to be ready..."
 for i in {1..30}; do
 if docker exec backstage-postgres pg_isready -U backstage_user >/dev/null 2>&1; then
 log "PostgreSQL is ready!"
 return 0
 fi
 sleep 1
 done
 
 error "PostgreSQL failed to start"
 return 1
}

# Start Redis
start_redis() {
 log "Starting Redis..."
 
 # Check if container exists
 if docker ps -a --format "{{.Names}}" | grep -q "^backstage-redis$"; then
 # Start existing container
 docker start backstage-redis
 else
 # Create new container
 docker run -d \
 --name backstage-redis \
 -p 6379:6379 \
 -v backstage-redis-data:/data \
 redis:7-alpine \
 redis-server --appendonly yes
 fi
 
 # Wait for Redis to be ready
 info "Waiting for Redis to be ready..."
 for i in {1..10}; do
 if docker exec backstage-redis redis-cli ping >/dev/null 2>&1; then
 log "Redis is ready!"
 return 0
 fi
 sleep 1
 done
 
 error "Redis failed to start"
 return 1
}

# Run database migrations
run_migrations() {
 log "Running database migrations..."
 
 # Set DATABASE_URL for migrations
 export DATABASE_URL="postgresql://backstage_user:backstage_password@localhost:5432/backstage_idp?schema=public"
 
 # Generate Prisma client
 npx prisma generate
 
 # Run migrations
 npx prisma migrate deploy || {
 warn "Migrations failed, attempting to push schema..."
 npx prisma db push
 }
 
 log "Database migrations completed"
}

# Start the application
start_app() {
 log "Starting the application..."
 
 # Check if dependencies are installed
 if [ ! -d "node_modules" ]; then
 info "Installing dependencies..."
 npm install
 fi
 
 # Set environment variables
 export DATABASE_URL="postgresql://backstage_user:backstage_password@localhost:5432/backstage_idp?schema=public"
 export REDIS_HOST="localhost"
 export REDIS_PORT="6379"
 export USE_MOCK_DATA="false"
 export NODE_ENV="development"
 
 # Start the development server
 log "Starting development server on http://localhost:3000"
 npm run dev
}

# Stop all services
stop_all() {
 log "Stopping all services..."
 
 # Stop containers
 docker stop backstage-postgres backstage-redis 2>/dev/null || true
 
 # Kill any running Node.js processes
 pkill -f "next dev" 2>/dev/null || true
 
 log "All services stopped"
}

# Check service status
check_status() {
 echo -e "\n${BLUE}=== Service Status ===${NC}\n"
 
 # PostgreSQL
 if docker ps --format "{{.Names}}" | grep -q "^backstage-postgres$"; then
 echo -e "PostgreSQL: ${GREEN}Running${NC}"
 docker exec backstage-postgres pg_isready -U backstage_user 2>/dev/null || echo -e " Status: ${YELLOW}Not ready${NC}"
 else
 echo -e "PostgreSQL: ${RED}Stopped${NC}"
 fi
 
 # Redis
 if docker ps --format "{{.Names}}" | grep -q "^backstage-redis$"; then
 echo -e "Redis: ${GREEN}Running${NC}"
 docker exec backstage-redis redis-cli ping >/dev/null 2>&1 || echo -e " Status: ${YELLOW}Not ready${NC}"
 else
 echo -e "Redis: ${RED}Stopped${NC}"
 fi
 
 # Application
 if pgrep -f "next dev" >/dev/null 2>&1; then
 echo -e "Application: ${GREEN}Running${NC}"
 echo -e " URL: http://localhost:3000"
 else
 echo -e "Application: ${RED}Stopped${NC}"
 fi
 
 echo ""
}

# Main execution
main() {
 case "$COMMAND" in
 all)
 check_docker
 start_postgres
 start_redis
 run_migrations
 check_status
 start_app
 ;;
 app)
 check_status
 start_app
 ;;
 db|postgres)
 check_docker
 start_postgres
 run_migrations
 check_status
 ;;
 redis)
 check_docker
 start_redis
 check_status
 ;;
 stop)
 stop_all
 check_status
 ;;
 status)
 check_status
 ;;
 migrate)
 run_migrations
 ;;
 *)
 echo "Usage: $0 [all|app|db|redis|stop|status|migrate]"
 echo ""
 echo "Commands:"
 echo " all - Start all services (PostgreSQL, Redis, and app)"
 echo " app - Start only the application"
 echo " db - Start only PostgreSQL and run migrations"
 echo " redis - Start only Redis"
 echo " stop - Stop all services"
 echo " status - Check status of all services"
 echo " migrate - Run database migrations"
 exit 1
 ;;
 esac
}

# Show banner
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ Backstage IDP Service Manager ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Run main function
main