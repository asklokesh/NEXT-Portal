#!/bin/bash

# Kong Deployment Script for Production
set -e

echo "Deploying Kong API Gateway to production environment..."

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
KONG_VERSION="${KONG_VERSION:-3.8.0.0}"
NAMESPACE="${NAMESPACE:-kong-system}"
CLUSTER_NAME="${CLUSTER_NAME:-production-cluster}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl > /dev/null 2>&1; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm > /dev/null 2>&1; then
        print_error "helm is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info > /dev/null 2>&1; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Namespace $NAMESPACE is ready"
}

# Install Kong using Helm
install_kong() {
    print_status "Installing Kong API Gateway using Helm..."
    
    # Add Kong Helm repository
    helm repo add kong https://charts.konghq.com
    helm repo update
    
    # Create values file for production
    cat > /tmp/kong-values.yaml << EOF
# Kong Production Configuration
image:
  tag: "$KONG_VERSION"

env:
  database: postgres
  pg_host: postgres-postgresql.database.svc.cluster.local
  pg_port: 5432
  pg_user: kong
  pg_password: 
    valueFrom:
      secretKeyRef:
        name: postgres-secret
        key: postgres-password
  pg_database: kong
  
  # Performance settings
  nginx_worker_processes: "auto"
  nginx_proxy_worker_connections: "4096"
  
  # Logging
  log_level: info
  proxy_access_log: /dev/stdout
  proxy_error_log: /dev/stderr
  admin_access_log: /dev/stdout
  admin_error_log: /dev/stderr
  
  # Plugins
  plugins: bundled,prometheus,correlation-id,request-transformer,response-transformer,rate-limiting,cors,jwt,oauth2,key-auth,basic-auth

# Proxy service configuration
proxy:
  enabled: true
  type: LoadBalancer
  http:
    enabled: true
    servicePort: 80
    containerPort: 8000
  tls:
    enabled: true
    servicePort: 443
    containerPort: 8443
    parameters:
    - http2

# Admin API configuration
admin:
  enabled: true
  type: ClusterIP
  http:
    enabled: true
    servicePort: 8001
    containerPort: 8001
  tls:
    enabled: false

# Manager (Admin GUI) configuration
manager:
  enabled: true
  type: LoadBalancer
  http:
    enabled: true
    servicePort: 8002
    containerPort: 8002
  tls:
    enabled: false

# Portal API configuration
portal:
  enabled: false

# Portal GUI configuration
portalapi:
  enabled: false

# Clustering
cluster:
  enabled: false

# Enterprise features (if licensed)
enterprise:
  enabled: false

# Resources
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi

# Autoscaling
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Pod disruption budget
podDisruptionBudget:
  enabled: true
  maxUnavailable: 1

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001

# Service monitor for Prometheus
serviceMonitor:
  enabled: true
  labels:
    release: prometheus

# Migrations
migrations:
  preUpgrade: true
  postUpgrade: true

# Wait for database
waitImage:
  enabled: true

# Deployment strategy
deploymentStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

# Pod anti-affinity
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - kong
        topologyKey: kubernetes.io/hostname

# Tolerations
tolerations: []

# Node selector
nodeSelector: {}
EOF
    
    # Install or upgrade Kong
    helm upgrade --install kong kong/kong \
        --namespace $NAMESPACE \
        --values /tmp/kong-values.yaml \
        --version 2.38.0 \
        --wait \
        --timeout 10m
    
    print_success "Kong installed successfully"
}

# Create PostgreSQL database
create_database() {
    print_status "Setting up PostgreSQL database..."
    
    # Create database secret
    kubectl create secret generic postgres-secret \
        --from-literal=postgres-password=$(openssl rand -base64 32) \
        --namespace database \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Install PostgreSQL using Helm
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    cat > /tmp/postgres-values.yaml << EOF
architecture: standalone
auth:
  postgresPassword: 
    valueFrom:
      secretKeyRef:
        name: postgres-secret
        key: postgres-password
  username: kong
  password: $(openssl rand -base64 32)
  database: kong
primary:
  persistence:
    enabled: true
    size: 20Gi
    storageClass: "gp2"
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi
metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: prometheus
EOF
    
    helm upgrade --install postgres bitnami/postgresql \
        --namespace database \
        --create-namespace \
        --values /tmp/postgres-values.yaml \
        --wait \
        --timeout 5m
    
    print_success "PostgreSQL database created"
}

# Setup SSL certificates
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    # Create TLS secret for Kong
    if kubectl get secret kong-tls --namespace $NAMESPACE > /dev/null 2>&1; then
        print_warning "SSL certificates already exist"
    else
        # Generate self-signed certificate (replace with real certificates in production)
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /tmp/tls.key \
            -out /tmp/tls.crt \
            -subj "/CN=kong-gateway/O=kong-gateway"
        
        kubectl create secret tls kong-tls \
            --cert=/tmp/tls.crt \
            --key=/tmp/tls.key \
            --namespace $NAMESPACE
        
        # Clean up temporary files
        rm -f /tmp/tls.key /tmp/tls.crt
        
        print_success "SSL certificates created"
    fi
}

# Configure ingress
configure_ingress() {
    print_status "Configuring ingress..."
    
    cat > /tmp/kong-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-admin
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - kong-admin.yourdomain.com
    secretName: kong-admin-tls
  rules:
  - host: kong-admin.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kong-admin
            port:
              number: 8001
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-manager
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  tls:
  - hosts:
    - kong-manager.yourdomain.com
    secretName: kong-manager-tls
  rules:
  - host: kong-manager.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kong-manager
            port:
              number: 8002
EOF
    
    kubectl apply -f /tmp/kong-ingress.yaml
    
    print_success "Ingress configured"
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create ServiceMonitor for Prometheus
    cat > /tmp/kong-servicemonitor.yaml << EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kong
  namespace: $NAMESPACE
  labels:
    app: kong
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kong
  endpoints:
  - port: kong-admin
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
  - port: kong-proxy
    path: /status/ready
    interval: 30s
    scrapeTimeout: 10s
EOF
    
    kubectl apply -f /tmp/kong-servicemonitor.yaml
    
    # Create Kong-specific Grafana dashboard ConfigMap
    cat > /tmp/kong-dashboard.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  kong-dashboard.json: |
    {
      "dashboard": {
        "id": null,
        "title": "Kong API Gateway",
        "description": "Kong Gateway metrics and performance dashboard",
        "tags": ["kong", "api-gateway"],
        "style": "dark",
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(kong_http_requests_total[5m])",
                "legendFormat": "Request Rate"
              }
            ]
          }
        ]
      }
    }
EOF
    
    kubectl apply -f /tmp/kong-dashboard.yaml
    
    print_success "Monitoring setup completed"
}

# Apply Kong configuration
apply_kong_config() {
    print_status "Applying Kong configuration..."
    
    # Wait for Kong to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=kong --namespace $NAMESPACE --timeout=300s
    
    # Get Kong Admin service URL
    KONG_ADMIN_URL=$(kubectl get service kong-admin --namespace $NAMESPACE -o jsonpath='{.spec.clusterIP}'):8001
    
    # Apply declarative configuration using deck
    kubectl run deck-config --rm -i --restart=Never --image=kong/deck:v1.38.1 -- \
        deck sync --kong-addr http://$KONG_ADMIN_URL --config /dev/stdin <<EOF
_format_version: "3.0"
_transform: true

services:
- name: backstage-api
  url: http://backstage.backstage.svc.cluster.local:7007
  protocol: http
  host: backstage.backstage.svc.cluster.local
  port: 7007
  path: /
  connect_timeout: 60000
  write_timeout: 60000
  read_timeout: 60000
  retries: 5
  tags:
  - backstage
  - production

routes:
- name: backstage-api
  service: backstage-api
  paths:
  - /api
  methods:
  - GET
  - POST
  - PUT
  - DELETE
  - PATCH
  strip_path: false
  preserve_host: false
  tags:
  - backstage
  - production

plugins:
- name: prometheus
  config:
    per_consumer: true
    status_code_metrics: true
    latency_metrics: true
    bandwidth_metrics: true
    upstream_health_metrics: true

- name: cors
  config:
    origins:
    - "*"
    methods:
    - GET
    - HEAD
    - PUT
    - PATCH
    - POST
    - DELETE
    - OPTIONS
    headers:
    - Accept
    - Accept-Version
    - Content-Length
    - Content-MD5
    - Content-Type
    - Date
    - X-Auth-Token
    - Authorization
    credentials: true
    max_age: 3600

- name: rate-limiting
  config:
    minute: 1000
    hour: 10000
    day: 100000
    policy: redis
    redis_host: redis.redis.svc.cluster.local
    redis_port: 6379
    fault_tolerant: true
EOF
    
    print_success "Kong configuration applied"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check Kong pods
    kubectl get pods -l app.kubernetes.io/name=kong --namespace $NAMESPACE
    
    # Check Kong services
    kubectl get services --namespace $NAMESPACE
    
    # Check Kong ingress
    kubectl get ingress --namespace $NAMESPACE
    
    # Test Kong Admin API
    KONG_ADMIN_SERVICE=$(kubectl get service kong-admin --namespace $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    if kubectl run test-pod --rm -i --restart=Never --image=curlimages/curl -- \
        curl -f -s http://$KONG_ADMIN_SERVICE:8001/status > /dev/null; then
        print_success "Kong Admin API is responding"
    else
        print_error "Kong Admin API is not responding"
        return 1
    fi
    
    print_success "Deployment verification completed"
}

# Display deployment information
display_info() {
    echo
    echo "=================================================================="
    echo "Kong API Gateway Production Deployment Complete!"
    echo "=================================================================="
    echo
    echo "Deployment Information:"
    echo "  Environment:          $ENVIRONMENT"
    echo "  Namespace:            $NAMESPACE"
    echo "  Kong Version:         $KONG_VERSION"
    echo "  Cluster:              $CLUSTER_NAME"
    echo
    echo "Service Endpoints:"
    kubectl get services --namespace $NAMESPACE -o wide
    echo
    echo "Ingress Information:"
    kubectl get ingress --namespace $NAMESPACE -o wide
    echo
    echo "Pod Status:"
    kubectl get pods --namespace $NAMESPACE -o wide
    echo
    echo "Next Steps:"
    echo "  1. Configure DNS to point to your LoadBalancer IPs"
    echo "  2. Update SSL certificates with real certificates"
    echo "  3. Configure monitoring alerts"
    echo "  4. Set up backup procedures"
    echo "  5. Configure log aggregation"
    echo
    echo "Useful Commands:"
    echo "  View logs:            kubectl logs -l app.kubernetes.io/name=kong -n $NAMESPACE"
    echo "  Port forward admin:   kubectl port-forward service/kong-admin 8001:8001 -n $NAMESPACE"
    echo "  Port forward manager: kubectl port-forward service/kong-manager 8002:8002 -n $NAMESPACE"
    echo "  Scale deployment:     kubectl scale deployment kong --replicas=5 -n $NAMESPACE"
    echo
}

# Cleanup function
cleanup_on_error() {
    print_error "Deployment failed. Check logs for more information."
    echo "To clean up, run:"
    echo "  helm uninstall kong --namespace $NAMESPACE"
    echo "  kubectl delete namespace $NAMESPACE"
    exit 1
}

# Set up error handling
trap cleanup_on_error ERR

# Main deployment function
main() {
    echo "=================================================================="
    echo "Kong API Gateway Production Deployment"
    echo "=================================================================="
    echo
    echo "Environment: $ENVIRONMENT"
    echo "Namespace: $NAMESPACE"
    echo "Kong Version: $KONG_VERSION"
    echo
    
    check_prerequisites
    create_namespace
    create_database
    setup_ssl
    install_kong
    configure_ingress
    setup_monitoring
    apply_kong_config
    verify_deployment
    display_info
    
    print_success "Kong API Gateway deployment completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Deploy Kong API Gateway to production environment"
        echo
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --verify            Verify existing deployment"
        echo "  --uninstall         Uninstall Kong deployment"
        echo "  --upgrade           Upgrade Kong deployment"
        echo
        echo "Environment Variables:"
        echo "  ENVIRONMENT         Target environment (default: production)"
        echo "  KONG_VERSION        Kong version to deploy (default: 3.8.0.0)"
        echo "  NAMESPACE           Kubernetes namespace (default: kong-system)"
        echo "  CLUSTER_NAME        Cluster name (default: production-cluster)"
        echo
        exit 0
        ;;
    --verify)
        verify_deployment
        exit 0
        ;;
    --uninstall)
        print_status "Uninstalling Kong deployment..."
        helm uninstall kong --namespace $NAMESPACE
        print_success "Kong deployment uninstalled"
        exit 0
        ;;
    --upgrade)
        print_status "Upgrading Kong deployment..."
        install_kong
        apply_kong_config
        verify_deployment
        print_success "Kong deployment upgraded"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac