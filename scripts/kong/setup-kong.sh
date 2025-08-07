#!/bin/bash

# Kong API Gateway Setup Script
set -e

echo "Setting up Kong API Gateway for Backstage Portal..."

# Configuration
KONG_DIR="/Users/lokesh/git/saas-idp/infrastructure/kong"
KONG_COMPOSE_FILE="$KONG_DIR/docker-compose.yml"
KONG_SSL_DIR="$KONG_DIR/ssl"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker status..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    print_status "Checking docker-compose availability..."
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "docker-compose is not installed. Please install it and try again."
        exit 1
    fi
    print_success "docker-compose is available"
}

# Create SSL certificates
create_ssl_certificates() {
    print_status "Creating SSL certificates for Kong..."
    
    if [ ! -d "$KONG_SSL_DIR" ]; then
        mkdir -p "$KONG_SSL_DIR"
    fi
    
    cd "$KONG_SSL_DIR"
    
    # Generate SSL certificates if they don't exist
    if [ ! -f "kong.crt" ] || [ ! -f "kong.key" ]; then
        print_status "Generating SSL certificates..."
        
        # Generate private key
        openssl genrsa -out kong.key 2048
        
        # Generate certificate signing request
        openssl req -new -key kong.key -out kong.csr -subj "/C=US/ST=CA/L=San Francisco/O=Company/OU=IT Department/CN=kong-gateway"
        
        # Generate self-signed certificate
        openssl x509 -req -days 365 -in kong.csr -signkey kong.key -out kong.crt
        
        # Set proper permissions
        chmod 600 kong.key
        chmod 644 kong.crt
        
        # Clean up CSR file
        rm kong.csr
        
        print_success "SSL certificates generated successfully"
    else
        print_success "SSL certificates already exist"
    fi
}

# Start Kong services
start_kong() {
    print_status "Starting Kong API Gateway services..."
    
    cd "$KONG_DIR"
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T kong-database pg_isready -U kong -d kong > /dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start within 30 attempts"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for Kong Gateway
    print_status "Waiting for Kong Gateway to be ready..."
    for i in {1..30}; do
        if curl -f -s http://localhost:8001/status > /dev/null 2>&1; then
            print_success "Kong Gateway is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Kong Gateway failed to start within 30 attempts"
            exit 1
        fi
        sleep 3
    done
    
    # Wait for Kong Admin GUI
    print_status "Waiting for Kong Admin GUI to be ready..."
    for i in {1..20}; do
        if curl -f -s http://localhost:8002 > /dev/null 2>&1; then
            print_success "Kong Admin GUI is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            print_warning "Kong Admin GUI may not be ready yet"
            break
        fi
        sleep 2
    done
}

# Apply Kong configuration
apply_kong_configuration() {
    print_status "Applying Kong configuration..."
    
    cd "$KONG_DIR"
    
    # Wait for deck service to complete
    print_status "Waiting for Kong deck configuration to be applied..."
    sleep 10
    
    # Verify configuration was applied
    if curl -f -s http://localhost:8001/services > /dev/null 2>&1; then
        SERVICES_COUNT=$(curl -s http://localhost:8001/services | jq -r '.data | length' 2>/dev/null || echo "0")
        print_success "Kong configuration applied successfully. Services count: $SERVICES_COUNT"
    else
        print_warning "Unable to verify Kong configuration"
    fi
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring services..."
    
    # Wait for Prometheus
    print_status "Waiting for Prometheus to be ready..."
    for i in {1..20}; do
        if curl -f -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
            print_success "Prometheus is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            print_warning "Prometheus may not be ready yet"
            break
        fi
        sleep 2
    done
    
    # Wait for Grafana
    print_status "Waiting for Grafana to be ready..."
    for i in {1..20}; do
        if curl -f -s http://localhost:3001/api/health > /dev/null 2>&1; then
            print_success "Grafana is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            print_warning "Grafana may not be ready yet"
            break
        fi
        sleep 2
    done
}

# Verify Kong installation
verify_kong() {
    print_status "Verifying Kong installation..."
    
    # Check Kong status
    KONG_STATUS=$(curl -s http://localhost:8001/status)
    if echo "$KONG_STATUS" | jq -e .database.reachable > /dev/null 2>&1; then
        print_success "Kong database connection is healthy"
    else
        print_error "Kong database connection failed"
        return 1
    fi
    
    # Check services
    SERVICES=$(curl -s http://localhost:8001/services)
    if echo "$SERVICES" | jq -e '.data' > /dev/null 2>&1; then
        SERVICE_COUNT=$(echo "$SERVICES" | jq -r '.data | length')
        print_success "Kong services endpoint is working. Found $SERVICE_COUNT services"
    else
        print_warning "Kong services endpoint may not be working properly"
    fi
    
    # Check routes
    ROUTES=$(curl -s http://localhost:8001/routes)
    if echo "$ROUTES" | jq -e '.data' > /dev/null 2>&1; then
        ROUTE_COUNT=$(echo "$ROUTES" | jq -r '.data | length')
        print_success "Kong routes endpoint is working. Found $ROUTE_COUNT routes"
    else
        print_warning "Kong routes endpoint may not be working properly"
    fi
    
    # Check plugins
    PLUGINS=$(curl -s http://localhost:8001/plugins)
    if echo "$PLUGINS" | jq -e '.data' > /dev/null 2>&1; then
        PLUGIN_COUNT=$(echo "$PLUGINS" | jq -r '.data | length')
        print_success "Kong plugins endpoint is working. Found $PLUGIN_COUNT plugins"
    else
        print_warning "Kong plugins endpoint may not be working properly"
    fi
}

# Display service information
display_service_info() {
    echo
    echo "=================================================================="
    echo "Kong API Gateway Setup Complete!"
    echo "=================================================================="
    echo
    echo "Service URLs:"
    echo "  Kong Proxy (HTTP):    http://localhost:8000"
    echo "  Kong Proxy (HTTPS):   https://localhost:8443"
    echo "  Kong Admin API:       http://localhost:8001"
    echo "  Kong Admin GUI:       http://localhost:8002"
    echo "  Kong Status:          http://localhost:8100"
    echo "  Prometheus:           http://localhost:9090"
    echo "  Grafana:              http://localhost:3001"
    echo "  PostgreSQL:           localhost:5433"
    echo "  Redis:                localhost:6379"
    echo
    echo "Default Credentials:"
    echo "  Grafana:              admin/admin"
    echo "  PostgreSQL:           kong/kongpassword"
    echo
    echo "Configuration Files:"
    echo "  Kong Declaration:     $KONG_DIR/deck/kong.yaml"
    echo "  Docker Compose:       $KONG_DIR/docker-compose.yml"
    echo "  SSL Certificates:     $KONG_DIR/ssl/"
    echo
    echo "Useful Commands:"
    echo "  View logs:            cd $KONG_DIR && docker-compose logs -f"
    echo "  Stop services:        cd $KONG_DIR && docker-compose down"
    echo "  Restart services:     cd $KONG_DIR && docker-compose restart"
    echo "  Apply config:         cd $KONG_DIR && docker-compose run --rm kong-deck deck sync"
    echo
    echo "Next Steps:"
    echo "  1. Configure your applications to use Kong proxy URLs"
    echo "  2. Set up additional plugins and policies via Admin GUI"
    echo "  3. Monitor performance through Grafana dashboards"
    echo "  4. Configure SSL certificates for production use"
    echo
}

# Cleanup function for error handling
cleanup_on_error() {
    print_error "Setup failed. Cleaning up..."
    cd "$KONG_DIR" 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    exit 1
}

# Set up error handling
trap cleanup_on_error ERR

# Main execution
main() {
    echo "=================================================================="
    echo "Kong API Gateway Setup for Backstage Portal"
    echo "=================================================================="
    echo
    
    # Pre-flight checks
    check_docker
    check_docker_compose
    
    # Setup steps
    create_ssl_certificates
    start_kong
    apply_kong_configuration
    setup_monitoring
    verify_kong
    
    # Display information
    display_service_info
    
    print_success "Kong API Gateway setup completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Setup Kong API Gateway for Backstage Portal"
        echo
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --verify            Verify existing Kong installation"
        echo "  --stop              Stop Kong services"
        echo "  --restart           Restart Kong services"
        echo "  --logs              Show Kong services logs"
        echo
        exit 0
        ;;
    --verify)
        verify_kong
        exit 0
        ;;
    --stop)
        print_status "Stopping Kong services..."
        cd "$KONG_DIR"
        docker-compose down
        print_success "Kong services stopped"
        exit 0
        ;;
    --restart)
        print_status "Restarting Kong services..."
        cd "$KONG_DIR"
        docker-compose restart
        print_success "Kong services restarted"
        exit 0
        ;;
    --logs)
        print_status "Showing Kong services logs..."
        cd "$KONG_DIR"
        docker-compose logs -f
        exit 0
        ;;
    "")
        # Default action - run setup
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac