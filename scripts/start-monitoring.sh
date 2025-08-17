#!/bin/bash

# SaaS IDP Comprehensive Monitoring Startup Script
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_PROJECT_NAME="saas-idp"
DOCKER_COMPOSE_FILES=(
    "docker-compose.observability.yml"
    "docker-compose.elk.yml"
)

# Environment variables
export COMPOSE_PROJECT_NAME
export PROMETHEUS_RETENTION_TIME="${PROMETHEUS_RETENTION_TIME:-30d}"
export GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-admin123}"
export ELASTICSEARCH_PASSWORD="${ELASTICSEARCH_PASSWORD:-elastic123}"

# Functions
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

check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available memory
    TOTAL_MEM=$(free -g | awk 'NR==2{printf "%.0f", $2}')
    if [ "$TOTAL_MEM" -lt 8 ]; then
        log_warning "System has less than 8GB RAM. Monitoring stack may not perform optimally."
        log_warning "Consider increasing memory allocation or reducing service instances."
    fi
    
    # Check available disk space
    AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 20 ]; then
        log_warning "Less than 20GB disk space available. Consider freeing up space."
    fi
    
    log_success "System requirements check completed"
}

create_directories() {
    log_info "Creating required directories..."
    
    # Create data directories
    sudo mkdir -p /opt/saas-idp/{prometheus,grafana,elasticsearch,logstash,kibana,jaeger,alertmanager}
    
    # Create log directories
    mkdir -p logs/{prometheus,grafana,elasticsearch,logstash,kibana,jaeger,alertmanager}
    
    # Set permissions
    sudo chown -R $USER:$USER /opt/saas-idp
    chmod -R 755 /opt/saas-idp
    
    log_success "Directories created successfully"
}

prepare_configs() {
    log_info "Preparing configuration files..."
    
    # Create config directories if they don't exist
    mkdir -p config/{prometheus,grafana,elasticsearch,logstash,kibana,jaeger,alertmanager}
    
    # Copy default configurations if they don't exist
    if [ ! -f config/prometheus/prometheus.yml ]; then
        log_warning "prometheus.yml not found, using default configuration"
        # Default config would be created here
    fi
    
    if [ ! -f config/grafana/grafana.ini ]; then
        log_info "Creating default Grafana configuration"
        cat > config/grafana/grafana.ini << EOF
[server]
http_port = 3000
domain = localhost

[security]
admin_user = admin
admin_password = ${GRAFANA_ADMIN_PASSWORD}

[auth]
disable_login_form = false

[auth.anonymous]
enabled = false

[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/saas-idp-overview.json

[alerting]
enabled = true
execute_alerts = true

[unified_alerting]
enabled = true
EOF
    fi
    
    log_success "Configuration files prepared"
}

start_observability_stack() {
    log_info "Starting observability stack (Prometheus, Grafana, Jaeger, etc.)..."
    
    docker-compose -f docker-compose.observability.yml up -d
    
    # Wait for services to be healthy
    log_info "Waiting for observability services to be healthy..."
    
    # Wait for Prometheus
    log_info "Waiting for Prometheus..."
    timeout 120 bash -c 'until curl -f http://localhost:9090/-/healthy &>/dev/null; do sleep 2; done'
    log_success "Prometheus is ready"
    
    # Wait for Grafana
    log_info "Waiting for Grafana..."
    timeout 120 bash -c 'until curl -f http://localhost:3001/api/health &>/dev/null; do sleep 2; done'
    log_success "Grafana is ready"
    
    # Wait for Jaeger
    log_info "Waiting for Jaeger..."
    timeout 120 bash -c 'until curl -f http://localhost:16686/ &>/dev/null; do sleep 2; done'
    log_success "Jaeger is ready"
    
    log_success "Observability stack started successfully"
}

start_elk_stack() {
    log_info "Starting ELK stack (Elasticsearch, Logstash, Kibana)..."
    
    # Increase vm.max_map_count for Elasticsearch
    log_info "Setting vm.max_map_count for Elasticsearch..."
    sudo sysctl -w vm.max_map_count=262144
    echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf
    
    docker-compose -f docker-compose.elk.yml up -d
    
    # Wait for Elasticsearch
    log_info "Waiting for Elasticsearch to be ready (this may take a few minutes)..."
    timeout 300 bash -c 'until curl -u elastic:elastic123 -f http://localhost:9200/_cluster/health &>/dev/null; do sleep 5; done'
    log_success "Elasticsearch is ready"
    
    # Wait for Kibana
    log_info "Waiting for Kibana..."
    timeout 300 bash -c 'until curl -f http://localhost:5601/api/status &>/dev/null; do sleep 5; done'
    log_success "Kibana is ready"
    
    log_success "ELK stack started successfully"
}

configure_grafana_dashboards() {
    log_info "Configuring Grafana dashboards..."
    
    # Wait a bit more for Grafana to fully initialize
    sleep 10
    
    # Import dashboards
    GRAFANA_URL="http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:3001"
    
    # Create data source for Prometheus
    curl -X POST "${GRAFANA_URL}/api/datasources" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Prometheus",
            "type": "prometheus",
            "url": "http://prometheus:9090",
            "access": "proxy",
            "isDefault": true
        }' &>/dev/null || log_warning "Failed to create Prometheus data source (may already exist)"
    
    # Create data source for Elasticsearch
    curl -X POST "${GRAFANA_URL}/api/datasources" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Elasticsearch",
            "type": "elasticsearch",
            "url": "http://elasticsearch:9200",
            "access": "proxy",
            "database": "saas-idp-*",
            "basicAuth": true,
            "basicAuthUser": "elastic",
            "secureJsonData": {
                "basicAuthPassword": "elastic123"
            }
        }' &>/dev/null || log_warning "Failed to create Elasticsearch data source (may already exist)"
    
    # Create data source for Jaeger
    curl -X POST "${GRAFANA_URL}/api/datasources" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Jaeger",
            "type": "jaeger",
            "url": "http://jaeger:16686",
            "access": "proxy"
        }' &>/dev/null || log_warning "Failed to create Jaeger data source (may already exist)"
    
    log_success "Grafana data sources configured"
}

setup_elasticsearch_indices() {
    log_info "Setting up Elasticsearch indices and templates..."
    
    # Wait for Elasticsearch to be fully ready
    sleep 5
    
    ES_URL="http://elastic:elastic123@localhost:9200"
    
    # Create index template for SaaS IDP logs
    curl -X PUT "${ES_URL}/_index_template/saas-idp-logs" \
        -H "Content-Type: application/json" \
        -d '{
            "index_patterns": ["saas-idp-*"],
            "template": {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "index.refresh_interval": "5s",
                    "index.max_age": "30d"
                },
                "mappings": {
                    "properties": {
                        "@timestamp": {"type": "date"},
                        "level": {"type": "keyword"},
                        "message": {"type": "text"},
                        "service": {"type": "keyword"},
                        "component": {"type": "keyword"},
                        "userId": {"type": "keyword"},
                        "tenantId": {"type": "keyword"},
                        "traceId": {"type": "keyword"},
                        "spanId": {"type": "keyword"},
                        "ip": {"type": "ip"}
                    }
                }
            }
        }' &>/dev/null || log_warning "Failed to create index template"
    
    log_success "Elasticsearch indices configured"
}

verify_services() {
    log_info "Verifying all monitoring services..."
    
    # Check service URLs
    SERVICES=(
        "Prometheus|http://localhost:9090"
        "Grafana|http://localhost:3001"
        "Jaeger|http://localhost:16686"
        "Elasticsearch|http://localhost:9200"
        "Kibana|http://localhost:5601"
        "Alertmanager|http://localhost:9093"
    )
    
    for service in "${SERVICES[@]}"; do
        IFS='|' read -r name url <<< "$service"
        if curl -f "$url" &>/dev/null; then
            log_success "$name is accessible at $url"
        else
            log_error "$name is not accessible at $url"
        fi
    done
}

print_summary() {
    log_success "Monitoring stack startup completed!"
    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  SaaS IDP Monitoring Stack URLs${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Grafana (Dashboards):     ${BLUE}http://localhost:3001${NC}"
    echo -e "  Username: admin"
    echo -e "  Password: ${GRAFANA_ADMIN_PASSWORD}"
    echo
    echo -e "Prometheus (Metrics):     ${BLUE}http://localhost:9090${NC}"
    echo -e "Jaeger (Tracing):         ${BLUE}http://localhost:16686${NC}"
    echo -e "Kibana (Logs):            ${BLUE}http://localhost:5601${NC}"
    echo -e "Elasticsearch:            ${BLUE}http://localhost:9200${NC}"
    echo -e "Alertmanager:             ${BLUE}http://localhost:9093${NC}"
    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Quick Commands${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "View logs:                ${YELLOW}docker-compose -f docker-compose.observability.yml logs -f${NC}"
    echo -e "Stop monitoring:          ${YELLOW}./scripts/stop-monitoring.sh${NC}"
    echo -e "Restart monitoring:       ${YELLOW}docker-compose -f docker-compose.observability.yml restart${NC}"
    echo
    echo -e "${BLUE}For more information, see: docs/monitoring/README.md${NC}"
}

# Main execution
main() {
    log_info "Starting SaaS IDP Comprehensive Monitoring Stack..."
    
    check_requirements
    create_directories
    prepare_configs
    start_observability_stack
    start_elk_stack
    configure_grafana_dashboards
    setup_elasticsearch_indices
    verify_services
    print_summary
    
    log_success "Monitoring stack is now running!"
}

# Handle script interruption
trap 'log_error "Script interrupted"; exit 1' INT TERM

# Execute main function
main "$@"