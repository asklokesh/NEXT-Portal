#!/bin/bash

# =============================================================================
# NEXT Portal - One-Click Setup Script
# =============================================================================
# This script sets up the complete NEXT Portal development environment.
#
# Usage:
#   ./scripts/setup.sh              # Full setup with Docker
#   ./scripts/setup.sh --local      # Local development without Docker
#   ./scripts/setup.sh --docker     # Docker-only setup
#   ./scripts/setup.sh --clean      # Clean install (removes existing data)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.full.yml"
ENV_FILE=".env.local"
NODE_VERSION_REQUIRED="18.17.0"
DOCKER_VERSION_REQUIRED="24.0.0"

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                    ║"
    echo "║     ███╗   ██╗███████╗██╗  ██╗████████╗    ██████╗  ██████╗       ║"
    echo "║     ████╗  ██║██╔════╝╚██╗██╔╝╚══██╔══╝    ██╔══██╗██╔═══██╗      ║"
    echo "║     ██╔██╗ ██║█████╗   ╚███╔╝    ██║       ██████╔╝██║   ██║      ║"
    echo "║     ██║╚██╗██║██╔══╝   ██╔██╗    ██║       ██╔═══╝ ██║   ██║      ║"
    echo "║     ██║ ╚████║███████╗██╔╝ ██╗   ██║       ██║     ╚██████╔╝      ║"
    echo "║     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝   ╚═╝       ╚═╝      ╚═════╝       ║"
    echo "║                                                                    ║"
    echo "║           Enterprise Internal Developer Portal                     ║"
    echo "║                     Setup Script v1.0.0                            ║"
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

version_compare() {
    if [[ $1 == $2 ]]; then
        echo "0"
        return
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            echo "1"
            return
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            echo "-1"
            return
        fi
    done
    echo "0"
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p $pid > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# =============================================================================
# Prerequisite Checks
# =============================================================================

check_node() {
    log_info "Checking Node.js..."
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js >= ${NODE_VERSION_REQUIRED}"
        echo "  Visit: https://nodejs.org/"
        return 1
    fi

    local node_version=$(node -v | sed 's/v//')
    local compare=$(version_compare "$node_version" "$NODE_VERSION_REQUIRED")

    if [[ $compare == "-1" ]]; then
        log_error "Node.js version $node_version is too old. Required: >= ${NODE_VERSION_REQUIRED}"
        return 1
    fi

    log_success "Node.js v$node_version ✓"
    return 0
}

check_npm() {
    log_info "Checking npm..."
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed."
        return 1
    fi

    local npm_version=$(npm -v)
    log_success "npm v$npm_version ✓"
    return 0
}

check_docker() {
    log_info "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker."
        echo "  Visit: https://docs.docker.com/get-docker/"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        return 1
    fi

    local docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    log_success "Docker v$docker_version ✓"
    return 0
}

check_docker_compose() {
    log_info "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed."
        return 1
    fi

    local compose_version=""
    if docker compose version &> /dev/null; then
        compose_version=$(docker compose version --short 2>/dev/null)
    else
        compose_version=$(docker-compose version --short 2>/dev/null)
    fi
    log_success "Docker Compose v$compose_version ✓"
    return 0
}

check_git() {
    log_info "Checking Git..."
    if ! command -v git &> /dev/null; then
        log_warning "Git is not installed. Some features may not work."
        return 0
    fi

    local git_version=$(git --version | sed 's/git version //')
    log_success "Git v$git_version ✓"
    return 0
}

check_prerequisites() {
    log_step "Checking Prerequisites"

    local failed=0

    check_node || failed=1
    check_npm || failed=1

    if [[ "$SETUP_MODE" != "local" ]]; then
        check_docker || failed=1
        check_docker_compose || failed=1
    fi

    check_git

    if [[ $failed -eq 1 ]]; then
        log_error "Prerequisites check failed. Please install missing dependencies."
        exit 1
    fi

    log_success "All prerequisites satisfied!"
}

# =============================================================================
# Environment Setup
# =============================================================================

setup_environment() {
    log_step "Setting Up Environment"

    cd "$PROJECT_DIR"

    if [[ ! -f "$ENV_FILE" ]]; then
        log_info "Creating environment file from template..."
        if [[ -f ".env.example" ]]; then
            cp .env.example "$ENV_FILE"
            log_success "Created $ENV_FILE"
        else
            log_warning "No .env.example found, creating minimal $ENV_FILE"
            cat > "$ENV_FILE" << 'EOF'
# NEXT Portal Environment Configuration
# Generated by setup.sh

# Core Settings
NODE_ENV=development
PORT=4400
NEXT_PUBLIC_APP_URL=http://localhost:4400

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/next_portal

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
NEXTAUTH_URL=http://localhost:4400
NEXTAUTH_SECRET=your-super-secret-key-change-in-production

# Feature Flags
ENABLE_AI_ASSISTANT=true
ENABLE_PORTAL_BUILDER=true
ENABLE_SCORECARDS=true
ENABLE_TEMPLATES=true
ENABLE_ACTIONS=true
ENABLE_ANALYTICS=true
ENABLE_ENTERPRISE=true
ENABLE_WEBSOCKET=true
EOF
            log_success "Created minimal $ENV_FILE"
        fi
    else
        log_info "Environment file already exists"
    fi

    # Generate secure secret if using default
    if grep -q "your-super-secret-key-change-in-production" "$ENV_FILE" 2>/dev/null; then
        log_info "Generating secure NEXTAUTH_SECRET..."
        local secret=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i '' "s/your-super-secret-key-change-in-production/$secret/g" "$ENV_FILE"
        else
            sed -i "s/your-super-secret-key-change-in-production/$secret/g" "$ENV_FILE"
        fi
        log_success "Generated secure secret"
    fi
}

# =============================================================================
# Dependency Installation
# =============================================================================

install_dependencies() {
    log_step "Installing Dependencies"

    cd "$PROJECT_DIR"

    log_info "Installing npm packages..."
    npm ci --prefer-offline 2>&1 | while read line; do
        echo -ne "\r${BLUE}[NPM]${NC} $line                    "
    done
    echo ""
    log_success "npm packages installed"

    log_info "Generating Prisma client..."
    npx prisma generate
    log_success "Prisma client generated"
}

# =============================================================================
# Docker Setup
# =============================================================================

start_docker_services() {
    log_step "Starting Docker Services"

    cd "$PROJECT_DIR"

    log_info "Pulling Docker images..."
    docker compose -f "$DOCKER_COMPOSE_FILE" pull 2>&1 | while read line; do
        echo -ne "\r${BLUE}[DOCKER]${NC} $line                    "
    done
    echo ""

    log_info "Starting services..."
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis

    log_info "Waiting for services to be healthy..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "healthy"; then
            break
        fi
        echo -ne "\r${YELLOW}[WAIT]${NC} Waiting for services... ($retries attempts remaining)"
        sleep 2
        ((retries--))
    done
    echo ""

    if [[ $retries -eq 0 ]]; then
        log_error "Services did not become healthy in time"
        docker compose -f "$DOCKER_COMPOSE_FILE" logs
        exit 1
    fi

    log_success "Docker services started and healthy"
}

setup_database() {
    log_step "Setting Up Database"

    cd "$PROJECT_DIR"

    # Load environment variables from .env.local for Prisma
    if [[ -f "$ENV_FILE" ]]; then
        log_info "Loading environment variables from $ENV_FILE..."
        set -a
        source "$ENV_FILE"
        set +a
    fi

    log_info "Running database migrations..."
    npx prisma db push --accept-data-loss
    log_success "Database migrations completed"

    log_info "Seeding database with sample data..."
    if [[ -f "prisma/seed.ts" ]]; then
        npx tsx prisma/seed.ts 2>/dev/null || log_warning "Seed script not found or failed"
    fi
    log_success "Database setup completed"
}

# =============================================================================
# Application Start
# =============================================================================

start_application() {
    log_step "Starting Application"

    cd "$PROJECT_DIR"

    if [[ "$SETUP_MODE" == "docker" ]]; then
        log_info "Starting all services with Docker..."
        docker compose -f "$DOCKER_COMPOSE_FILE" up -d
        log_success "Application started in Docker"
    else
        log_info "Starting development server..."

        # Start in background
        npm run dev &
        local pid=$!

        log_info "Waiting for server to be ready..."
        local retries=60
        while [[ $retries -gt 0 ]]; do
            if curl -s http://localhost:4400/api/health > /dev/null 2>&1; then
                break
            fi
            echo -ne "\r${YELLOW}[WAIT]${NC} Server starting... ($retries seconds remaining)"
            sleep 1
            ((retries--))
        done
        echo ""

        if [[ $retries -eq 0 ]]; then
            log_warning "Server may still be starting..."
        else
            log_success "Server is ready!"
        fi
    fi
}

# =============================================================================
# Cleanup Functions
# =============================================================================

clean_install() {
    log_step "Cleaning Previous Installation"

    cd "$PROJECT_DIR"

    log_warning "This will remove all existing data. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        return
    fi

    log_info "Stopping Docker services..."
    docker compose -f "$DOCKER_COMPOSE_FILE" down -v 2>/dev/null || true

    log_info "Removing node_modules..."
    rm -rf node_modules

    log_info "Removing .next build directory..."
    rm -rf .next

    log_info "Removing Prisma generated files..."
    rm -rf node_modules/.prisma

    log_success "Cleanup completed"
}

# =============================================================================
# Summary & Help
# =============================================================================

print_summary() {
    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                     Setup Complete! 🎉                              ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "${CYAN}Access your portal:${NC}"
    echo "  • Portal:       http://localhost:4400"
    echo "  • API Health:   http://localhost:4400/api/health"
    echo ""

    if [[ "$SETUP_MODE" != "local" ]]; then
        echo -e "${CYAN}Docker Services:${NC}"
        echo "  • PostgreSQL:   localhost:5432"
        echo "  • Redis:        localhost:6379"
        echo ""
    fi

    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  • npm run dev           - Start development server"
    echo "  • npm run build         - Build for production"
    echo "  • npm run test          - Run tests"
    echo "  • npm run db:studio     - Open Prisma Studio"
    echo ""

    echo -e "${CYAN}Docker Commands:${NC}"
    echo "  • docker compose -f docker-compose.full.yml up -d     - Start all services"
    echo "  • docker compose -f docker-compose.full.yml logs -f   - View logs"
    echo "  • docker compose -f docker-compose.full.yml down      - Stop services"
    echo ""

    echo -e "${CYAN}Documentation:${NC}"
    echo "  • README:       ./README.md"
    echo "  • API Docs:     http://localhost:4400/api/docs"
    echo ""

    echo -e "${YELLOW}Note: Some features may require additional configuration.${NC}"
    echo -e "${YELLOW}Edit .env.local to configure external integrations.${NC}"
}

print_help() {
    echo "NEXT Portal Setup Script"
    echo ""
    echo "Usage: ./scripts/setup.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --local        Setup for local development (without Docker for app)"
    echo "  --docker       Setup everything in Docker"
    echo "  --clean        Clean install (removes existing data)"
    echo "  --skip-deps    Skip npm install"
    echo "  --skip-db      Skip database setup"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/setup.sh                    # Full setup"
    echo "  ./scripts/setup.sh --local            # Local development"
    echo "  ./scripts/setup.sh --clean --local    # Clean local setup"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    # Parse arguments
    SETUP_MODE="default"
    SKIP_DEPS=false
    SKIP_DB=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                SETUP_MODE="local"
                shift
                ;;
            --docker)
                SETUP_MODE="docker"
                shift
                ;;
            --clean)
                CLEAN_INSTALL=true
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --help|-h)
                print_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done

    # Start setup
    print_banner

    log_info "Setup mode: $SETUP_MODE"

    # Clean install if requested
    if [[ "$CLEAN_INSTALL" == "true" ]]; then
        clean_install
    fi

    # Check prerequisites
    check_prerequisites

    # Setup environment
    setup_environment

    # Install dependencies
    if [[ "$SKIP_DEPS" != "true" ]]; then
        install_dependencies
    fi

    # Start Docker services (for database)
    if [[ "$SETUP_MODE" != "local" ]] || [[ "$SETUP_MODE" == "default" ]]; then
        start_docker_services
    fi

    # Setup database
    if [[ "$SKIP_DB" != "true" ]]; then
        setup_database
    fi

    # Start application
    start_application

    # Print summary
    print_summary

    # Open browser (optional)
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:4400 &> /dev/null &
    elif command -v open &> /dev/null; then
        open http://localhost:4400 &> /dev/null &
    fi
}

# Run main function
main "$@"
