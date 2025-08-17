#!/bin/bash

# Production Infrastructure Deployment Script
# Deploys enterprise-grade SaaS IDP platform with full monitoring and security

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs/deployment"
BACKUP_DIR="$PROJECT_ROOT/backups"
CONFIG_DIR="$PROJECT_ROOT/config/production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_DIR/deployment.log"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_DIR/deployment.log"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_DIR/deployment.log"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_DIR/deployment.log"
}

# Cleanup function for rollback
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code. Starting rollback..."
        rollback_deployment
    fi
    exit $exit_code
}

# Set trap for cleanup
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("node" "npm" "git" "docker" "docker-compose" "pm2" "nginx" "redis-cli" "psql")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
        error "Node.js version $node_version is below required version $required_version"
        exit 1
    fi
    
    # Check available memory
    local available_memory=$(free -m | awk '/^Mem:/{print $7}')
    if [ "$available_memory" -lt 4096 ]; then
        warn "Available memory ($available_memory MB) is below recommended 4GB"
    fi
    
    # Check disk space
    local available_space=$(df -BG "$PROJECT_ROOT" | awk 'NR==2{gsub(/G/,"",$4); print $4}')
    if [ "$available_space" -lt 20 ]; then
        error "Available disk space ($available_space GB) is below required 20GB"
        exit 1
    fi
    
    log "Prerequisites check completed successfully"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$PROJECT_ROOT/logs/pm2"
    mkdir -p "$PROJECT_ROOT/logs/nginx"
    mkdir -p "$PROJECT_ROOT/logs/redis"
    mkdir -p "$PROJECT_ROOT/logs/postgres"
    mkdir -p "$PROJECT_ROOT/ssl/certs"
    mkdir -p "$PROJECT_ROOT/ssl/private"
    mkdir -p "$PROJECT_ROOT/data/redis"
    mkdir -p "$PROJECT_ROOT/data/postgres"
    
    # Set proper permissions
    chmod 700 "$PROJECT_ROOT/ssl/private"
    chmod 755 "$PROJECT_ROOT/logs"
    chmod 755 "$PROJECT_ROOT/data"
    
    log "Directories created successfully"
}

# Setup environment configuration
setup_environment() {
    log "Setting up production environment configuration..."
    
    # Check if .env.production exists
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        if [ -f "$PROJECT_ROOT/.env.production.template" ]; then
            info "Creating .env.production from template"
            cp "$PROJECT_ROOT/.env.production.template" "$PROJECT_ROOT/.env.production"
            warn "Please configure .env.production with your actual values before proceeding"
            read -p "Press Enter after configuring .env.production..."
        else
            error ".env.production template not found"
            exit 1
        fi
    fi
    
    # Load production environment
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
    
    # Validate required environment variables
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "SESSION_SECRET"
        "ENCRYPTION_KEY"
        "BACKSTAGE_API_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log "Environment configuration completed"
}

# Setup database
setup_database() {
    log "Setting up production database..."
    
    # Check database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
        error "Cannot connect to database. Please ensure PostgreSQL is running and DATABASE_URL is correct"
        exit 1
    fi
    
    # Run database migrations
    log "Running database migrations..."
    cd "$PROJECT_ROOT"
    npx prisma generate
    npx prisma db push
    
    # Setup database monitoring
    log "Setting up database monitoring..."
    psql "$DATABASE_URL" -c "
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        CREATE EXTENSION IF NOT EXISTS pgstattuple;
    " || warn "Could not install database extensions (requires superuser privileges)"
    
    log "Database setup completed"
}

# Setup Redis
setup_redis() {
    log "Setting up Redis cluster..."
    
    # Check Redis connectivity
    if ! redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
        error "Cannot connect to Redis. Please ensure Redis is running and REDIS_URL is correct"
        exit 1
    fi
    
    # Configure Redis for production
    redis-cli -u "$REDIS_URL" CONFIG SET save "900 1 300 10 60 10000"
    redis-cli -u "$REDIS_URL" CONFIG SET maxmemory-policy allkeys-lru
    redis-cli -u "$REDIS_URL" CONFIG SET timeout 300
    redis-cli -u "$REDIS_URL" CONFIG SET tcp-keepalive 60
    
    log "Redis setup completed"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    if [ "${SSL_ENABLED:-false}" = "true" ]; then
        if [ -n "${SSL_CERT_PATH:-}" ] && [ -n "${SSL_KEY_PATH:-}" ]; then
            if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
                log "SSL certificates found, copying to project directory"
                cp "$SSL_CERT_PATH" "$PROJECT_ROOT/ssl/certs/server.crt"
                cp "$SSL_KEY_PATH" "$PROJECT_ROOT/ssl/private/server.key"
                chmod 644 "$PROJECT_ROOT/ssl/certs/server.crt"
                chmod 600 "$PROJECT_ROOT/ssl/private/server.key"
            else
                warn "SSL certificate files not found, generating self-signed certificates"
                openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                    -keyout "$PROJECT_ROOT/ssl/private/server.key" \
                    -out "$PROJECT_ROOT/ssl/certs/server.crt" \
                    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
                chmod 600 "$PROJECT_ROOT/ssl/private/server.key"
                chmod 644 "$PROJECT_ROOT/ssl/certs/server.crt"
            fi
        else
            warn "SSL enabled but certificate paths not provided, generating self-signed certificates"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$PROJECT_ROOT/ssl/private/server.key" \
                -out "$PROJECT_ROOT/ssl/certs/server.crt" \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
            chmod 600 "$PROJECT_ROOT/ssl/private/server.key"
            chmod 644 "$PROJECT_ROOT/ssl/certs/server.crt"
        fi
    fi
    
    log "SSL setup completed"
}

# Setup monitoring and logging
setup_monitoring() {
    log "Setting up monitoring and logging..."
    
    # Configure log rotation
    cat > /etc/logrotate.d/saas-idp << EOF
$PROJECT_ROOT/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    copytruncate
    notifempty
    create 644 $USER $USER
}

$PROJECT_ROOT/logs/*/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    copytruncate
    notifempty
    create 644 $USER $USER
}
EOF
    
    # Setup PM2 monitoring
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 100M
    pm2 set pm2-logrotate:retain 30
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
    
    # Install monitoring tools
    if ! command -v htop &> /dev/null; then
        log "Installing monitoring tools..."
        sudo apt-get update
        sudo apt-get install -y htop iotop nethogs
    fi
    
    log "Monitoring setup completed"
}

# Build application
build_application() {
    log "Building application for production..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    rm -rf .next dist node_modules/.cache
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production=false
    
    # Build Next.js application
    log "Building Next.js application..."
    NODE_OPTIONS="--max_old_space_size=8192" npm run build:production
    
    # Build Backstage
    if [ -d "$PROJECT_ROOT/backstage" ]; then
        log "Building Backstage..."
        cd "$PROJECT_ROOT/backstage"
        yarn install --frozen-lockfile
        yarn build:backend
        cd "$PROJECT_ROOT"
    fi
    
    # Generate Prisma client
    log "Generating Prisma client..."
    npx prisma generate
    
    log "Application build completed"
}

# Deploy with PM2
deploy_with_pm2() {
    log "Deploying with PM2..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing processes
    pm2 stop ecosystem.production.config.js || true
    pm2 delete ecosystem.production.config.js || true
    
    # Start new processes
    log "Starting production processes..."
    pm2 start ecosystem.production.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup || warn "PM2 startup script setup requires sudo privileges"
    
    log "PM2 deployment completed"
}

# Setup Nginx reverse proxy
setup_nginx() {
    log "Setting up Nginx reverse proxy..."
    
    # Create Nginx configuration
    cat > "$CONFIG_DIR/nginx.conf" << EOF
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for" '
                    'rt=\$request_time uct="\$upstream_connect_time" '
                    'uht="\$upstream_header_time" urt="\$upstream_response_time"';

    access_log $PROJECT_ROOT/logs/nginx/access.log main;
    error_log $PROJECT_ROOT/logs/nginx/error.log warn;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone \$binary_remote_addr zone=api:10m rate=60r/m;
    
    # Upstream servers
    upstream app_backend {
        least_conn;
        server 127.0.0.1:4400 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:4401 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    upstream websocket_backend {
        ip_hash;
        server 127.0.0.1:4403;
    }
    
    upstream backstage_backend {
        least_conn;
        server 127.0.0.1:7007 max_fails=3 fail_timeout=30s;
        keepalive 16;
    }

    # HTTPS redirect
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        return 301 https://\$server_name\$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name _;

        # SSL configuration
        ssl_certificate $PROJECT_ROOT/ssl/certs/server.crt;
        ssl_certificate_key $PROJECT_ROOT/ssl/private/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # WebSocket proxy
        location /socket.io/ {
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 86400;
        }

        # Backstage API proxy
        location /api/backstage/ {
            proxy_pass http://backstage_backend/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # API rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app_backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Main application
        location / {
            proxy_pass http://app_backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    # Test Nginx configuration
    if command -v nginx &> /dev/null; then
        nginx -t -c "$CONFIG_DIR/nginx.conf" || error "Nginx configuration test failed"
    fi
    
    log "Nginx configuration completed"
}

# Health checks
perform_health_checks() {
    log "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    # Check main application
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:4400/health > /dev/null; then
            log "Main application health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "Main application health check failed after $max_attempts attempts"
            exit 1
        fi
        
        warn "Health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    # Check WebSocket server
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:4403/health > /dev/null; then
            log "WebSocket server health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "WebSocket server health check failed after $max_attempts attempts"
            exit 1
        fi
        
        warn "WebSocket health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    # Check database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        error "Database connectivity check failed"
        exit 1
    fi
    log "Database connectivity check passed"
    
    # Check Redis connectivity
    if ! redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
        error "Redis connectivity check failed"
        exit 1
    fi
    log "Redis connectivity check passed"
    
    log "All health checks passed successfully"
}

# Create backup before deployment
create_backup() {
    log "Creating backup before deployment..."
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="pre_deployment_$backup_timestamp"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup database
    log "Backing up database..."
    pg_dump "$DATABASE_URL" > "$backup_path/database.sql"
    
    # Backup Redis data
    log "Backing up Redis data..."
    redis-cli -u "$REDIS_URL" --rdb "$backup_path/redis_dump.rdb"
    
    # Backup application files
    log "Backing up application configuration..."
    tar -czf "$backup_path/app_config.tar.gz" -C "$PROJECT_ROOT" \
        .env.production ssl/ logs/ data/ || warn "Some files could not be backed up"
    
    # Create backup metadata
    cat > "$backup_path/metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "version": "${APP_VERSION:-unknown}",
    "environment": "production",
    "backup_type": "pre_deployment",
    "files": [
        "database.sql",
        "redis_dump.rdb",
        "app_config.tar.gz"
    ]
}
EOF
    
    log "Backup created successfully: $backup_path"
    echo "$backup_path" > "$PROJECT_ROOT/.last_backup"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    if [ -f "$PROJECT_ROOT/.last_backup" ]; then
        local backup_path=$(cat "$PROJECT_ROOT/.last_backup")
        
        if [ -d "$backup_path" ]; then
            log "Restoring from backup: $backup_path"
            
            # Stop current processes
            pm2 stop all || true
            
            # Restore database
            if [ -f "$backup_path/database.sql" ]; then
                log "Restoring database..."
                psql "$DATABASE_URL" < "$backup_path/database.sql"
            fi
            
            # Restore Redis data
            if [ -f "$backup_path/redis_dump.rdb" ]; then
                log "Restoring Redis data..."
                redis-cli -u "$REDIS_URL" FLUSHALL
                redis-cli -u "$REDIS_URL" --pipe < "$backup_path/redis_dump.rdb"
            fi
            
            # Restore configuration
            if [ -f "$backup_path/app_config.tar.gz" ]; then
                log "Restoring application configuration..."
                tar -xzf "$backup_path/app_config.tar.gz" -C "$PROJECT_ROOT"
            fi
            
            log "Rollback completed"
        else
            error "Backup directory not found: $backup_path"
        fi
    else
        warn "No backup found for rollback"
    fi
}

# Main deployment function
main() {
    log "Starting production infrastructure deployment..."
    log "Deployment started by: $(whoami) on $(hostname)"
    log "Project root: $PROJECT_ROOT"
    
    # Run deployment steps
    check_prerequisites
    create_directories
    setup_environment
    create_backup
    setup_database
    setup_redis
    setup_ssl
    setup_monitoring
    build_application
    deploy_with_pm2
    setup_nginx
    perform_health_checks
    
    log "Production infrastructure deployment completed successfully!"
    log "Application is now running at:"
    log "- HTTP: http://localhost (redirects to HTTPS)"
    log "- HTTPS: https://localhost"
    log "- Health Check: https://localhost/health"
    log "- Metrics: https://localhost/metrics"
    
    # Display process status
    info "Process status:"
    pm2 status
    
    # Display useful commands
    info "Useful commands:"
    echo "  pm2 status                    - Check process status"
    echo "  pm2 logs                      - View logs"
    echo "  pm2 monit                     - Monitor resources"
    echo "  pm2 restart all               - Restart all processes"
    echo "  pm2 reload ecosystem.production.config.js - Reload configuration"
    echo "  nginx -t                      - Test Nginx configuration"
    echo "  systemctl status nginx        - Check Nginx status"
}

# Run main function
main "$@"