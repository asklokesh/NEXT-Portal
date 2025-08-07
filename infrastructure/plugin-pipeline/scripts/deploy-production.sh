#!/bin/bash

# Plugin Pipeline Orchestrator - Production Deployment Script
# Zero-downtime deployment with automatic rollback capabilities
# Supports multiple deployment strategies: blue-green, canary, rolling update

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"
HELM_CHART_DIR="$PROJECT_ROOT/helm/plugin-orchestrator"

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
DEPLOYMENT_STRATEGY="${DEPLOYMENT_STRATEGY:-blue-green}"
VERSION="${VERSION:-latest}"
NAMESPACE="${NAMESPACE:-plugin-pipeline}"
REGISTRY="${REGISTRY:-ghcr.io}"
TIMEOUT="${TIMEOUT:-600}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"
}

# Help function
show_help() {
    cat << EOF
Plugin Pipeline Orchestrator - Production Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENVIRONMENT    Target environment (default: production)
    -s, --strategy STRATEGY         Deployment strategy: blue-green, canary, rolling (default: blue-green)
    -v, --version VERSION           Image version to deploy (default: latest)
    -n, --namespace NAMESPACE       Kubernetes namespace (default: plugin-pipeline)
    -r, --registry REGISTRY         Container registry (default: ghcr.io)
    -t, --timeout TIMEOUT           Deployment timeout in seconds (default: 600)
    --dry-run                       Perform a dry run without actual deployment
    --skip-tests                    Skip pre-deployment tests
    --no-rollback                   Disable automatic rollback on failure
    --disable-monitoring            Disable monitoring setup
    -h, --help                      Show this help message

Examples:
    $0 --environment staging --strategy canary --version v1.2.3
    $0 --dry-run --strategy rolling --version latest
    $0 --environment production --strategy blue-green --no-rollback

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--strategy)
            DEPLOYMENT_STRATEGY="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE="false"
            shift
            ;;
        --disable-monitoring)
            ENABLE_MONITORING="false"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate deployment strategy
case $DEPLOYMENT_STRATEGY in
    blue-green|canary|rolling)
        ;;
    *)
        log_error "Invalid deployment strategy: $DEPLOYMENT_STRATEGY. Must be one of: blue-green, canary, rolling"
        exit 1
        ;;
esac

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in kubectl helm docker curl jq; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check Kubernetes context
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || echo "")
    if [ -z "$current_context" ]; then
        log_error "No Kubernetes context configured"
        exit 1
    fi
    
    log_info "Using Kubernetes context: $current_context"
    
    # Verify cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warn "Namespace $NAMESPACE does not exist, creating..."
        if [ "$DRY_RUN" = "false" ]; then
            kubectl create namespace "$NAMESPACE"
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Pre-deployment tests
run_pre_deployment_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warn "Skipping pre-deployment tests"
        return 0
    fi
    
    log_info "Running pre-deployment tests..."
    
    # Test 1: Validate Helm chart
    log_info "Validating Helm chart..."
    helm lint "$HELM_CHART_DIR" --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml"
    
    # Test 2: Dry run deployment
    log_info "Running Helm dry-run..."
    helm upgrade --install plugin-orchestrator "$HELM_CHART_DIR" \
        --namespace "$NAMESPACE" \
        --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml" \
        --set image.tag="$VERSION" \
        --set environment="$ENVIRONMENT" \
        --dry-run --debug > /dev/null
    
    # Test 3: Check container image exists
    log_info "Verifying container image exists..."
    local image_url="$REGISTRY/plugin-orchestrator:$VERSION"
    if ! docker manifest inspect "$image_url" &> /dev/null; then
        log_error "Container image not found: $image_url"
        exit 1
    fi
    
    # Test 4: Validate Kubernetes resources
    log_info "Validating Kubernetes resources..."
    helm template plugin-orchestrator "$HELM_CHART_DIR" \
        --namespace "$NAMESPACE" \
        --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml" \
        --set image.tag="$VERSION" \
        --set environment="$ENVIRONMENT" | kubectl apply --dry-run=client -f -
    
    log_success "Pre-deployment tests passed"
}

# Get current deployment info
get_current_deployment() {
    local current_revision=""
    local current_version=""
    
    if kubectl get deployment plugin-orchestrator -n "$NAMESPACE" &> /dev/null; then
        current_revision=$(kubectl get deployment plugin-orchestrator -n "$NAMESPACE" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}' 2>/dev/null || echo "0")
        current_version=$(kubectl get deployment plugin-orchestrator -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | cut -d: -f2 || echo "none")
    fi
    
    echo "${current_revision:-0}:${current_version:-none}"
}

# Blue-Green deployment
deploy_blue_green() {
    log_info "Starting Blue-Green deployment..."
    
    local current_info
    current_info=$(get_current_deployment)
    local current_revision="${current_info%%:*}"
    local current_version="${current_info##*:}"
    
    log_info "Current deployment: revision=$current_revision, version=$current_version"
    
    # Deploy green environment
    log_info "Deploying green environment..."
    
    local green_release="plugin-orchestrator-green"
    local green_namespace="${NAMESPACE}-green"
    
    # Create green namespace if it doesn't exist
    if ! kubectl get namespace "$green_namespace" &> /dev/null; then
        kubectl create namespace "$green_namespace"
    fi
    
    # Deploy to green environment
    if [ "$DRY_RUN" = "false" ]; then
        helm upgrade --install "$green_release" "$HELM_CHART_DIR" \
            --namespace "$green_namespace" \
            --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml" \
            --set image.tag="$VERSION" \
            --set environment="$ENVIRONMENT" \
            --set nameOverride="plugin-orchestrator-green" \
            --timeout "${TIMEOUT}s" \
            --wait
    else
        log_info "DRY RUN: Would deploy green environment"
    fi
    
    # Wait for green deployment to be ready
    if [ "$DRY_RUN" = "false" ]; then
        log_info "Waiting for green deployment to be ready..."
        kubectl wait --for=condition=available deployment/plugin-orchestrator-green \
            -n "$green_namespace" --timeout="${TIMEOUT}s"
    fi
    
    # Run health checks on green environment
    if ! run_health_checks "$green_namespace" "plugin-orchestrator-green"; then
        log_error "Green environment health checks failed"
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            cleanup_green_environment "$green_namespace" "$green_release"
        fi
        exit 1
    fi
    
    # Switch traffic to green
    log_info "Switching traffic to green environment..."
    if [ "$DRY_RUN" = "false" ]; then
        # Update service selector to point to green deployment
        kubectl patch service plugin-orchestrator -n "$NAMESPACE" \
            -p '{"spec":{"selector":{"app.kubernetes.io/instance":"plugin-orchestrator-green"}}}'
        
        # Wait for traffic to settle
        sleep 30
        
        # Run final health check
        if ! run_health_checks "$NAMESPACE" "plugin-orchestrator"; then
            log_error "Final health check failed, rolling back..."
            rollback_blue_green "$green_namespace" "$green_release"
            exit 1
        fi
    fi
    
    # Clean up old blue environment
    log_info "Cleaning up old blue environment..."
    if [ "$DRY_RUN" = "false" ] && [ "$current_revision" != "0" ]; then
        kubectl delete deployment plugin-orchestrator -n "$NAMESPACE" --ignore-not-found
        
        # Migrate green deployment to main namespace
        kubectl get all -l "app.kubernetes.io/instance=$green_release" -n "$green_namespace" -o yaml | \
            sed "s/namespace: $green_namespace/namespace: $NAMESPACE/g" | \
            sed "s/$green_release/plugin-orchestrator/g" | \
            kubectl apply -f -
        
        # Clean up green namespace
        cleanup_green_environment "$green_namespace" "$green_release"
    fi
    
    log_success "Blue-Green deployment completed successfully"
}

# Canary deployment
deploy_canary() {
    log_info "Starting Canary deployment..."
    
    local canary_weight="${CANARY_WEIGHT:-10}"
    local canary_steps="${CANARY_STEPS:-10,25,50,75,100}"
    
    IFS=',' read -ra STEPS <<< "$canary_steps"
    
    for step in "${STEPS[@]}"; do
        log_info "Deploying canary with $step% traffic..."
        
        if [ "$DRY_RUN" = "false" ]; then
            helm upgrade --install plugin-orchestrator "$HELM_CHART_DIR" \
                --namespace "$NAMESPACE" \
                --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml" \
                --set image.tag="$VERSION" \
                --set environment="$ENVIRONMENT" \
                --set canary.enabled=true \
                --set canary.weight="$step" \
                --timeout "${TIMEOUT}s" \
                --wait
        fi
        
        # Wait for deployment to stabilize
        if [ "$DRY_RUN" = "false" ]; then
            kubectl wait --for=condition=available deployment/plugin-orchestrator \
                -n "$NAMESPACE" --timeout="${TIMEOUT}s"
            
            # Monitor canary for a period
            log_info "Monitoring canary deployment for 2 minutes..."
            sleep 120
            
            # Check health and metrics
            if ! run_canary_analysis "$step"; then
                log_error "Canary analysis failed at $step% traffic"
                if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                    rollback_canary
                fi
                exit 1
            fi
        fi
        
        log_success "Canary step $step% completed successfully"
    done
    
    log_success "Canary deployment completed successfully"
}

# Rolling update deployment
deploy_rolling() {
    log_info "Starting Rolling Update deployment..."
    
    if [ "$DRY_RUN" = "false" ]; then
        helm upgrade --install plugin-orchestrator "$HELM_CHART_DIR" \
            --namespace "$NAMESPACE" \
            --values "$HELM_CHART_DIR/values-$ENVIRONMENT.yaml" \
            --set image.tag="$VERSION" \
            --set environment="$ENVIRONMENT" \
            --set strategy.type=RollingUpdate \
            --set strategy.rollingUpdate.maxUnavailable=25% \
            --set strategy.rollingUpdate.maxSurge=25% \
            --timeout "${TIMEOUT}s" \
            --wait
    else
        log_info "DRY RUN: Would perform rolling update"
    fi
    
    # Wait for rollout to complete
    if [ "$DRY_RUN" = "false" ]; then
        kubectl rollout status deployment/plugin-orchestrator -n "$NAMESPACE" --timeout="${TIMEOUT}s"
        
        # Run health checks
        if ! run_health_checks "$NAMESPACE" "plugin-orchestrator"; then
            log_error "Rolling update health checks failed"
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                rollback_rolling
            fi
            exit 1
        fi
    fi
    
    log_success "Rolling update deployment completed successfully"
}

# Health checks
run_health_checks() {
    local namespace="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=0
    
    log_info "Running health checks for $service_name in namespace $namespace..."
    
    while [ $attempt -lt $max_attempts ]; do
        if kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator" -n "$namespace" \
           -o jsonpath='{.items[*].status.phase}' | grep -q Running; then
            
            # Test API endpoint
            local pod_name
            pod_name=$(kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator" -n "$namespace" \
                      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            
            if [ -n "$pod_name" ]; then
                if kubectl exec -n "$namespace" "$pod_name" -- curl -f http://localhost:8081/health &> /dev/null; then
                    log_success "Health check passed for $service_name"
                    return 0
                fi
            fi
        fi
        
        log_info "Health check attempt $((attempt + 1))/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed for $service_name after $max_attempts attempts"
    return 1
}

# Canary analysis
run_canary_analysis() {
    local traffic_percentage="$1"
    
    log_info "Running canary analysis for $traffic_percentage% traffic..."
    
    # Check error rate
    local error_rate
    error_rate=$(kubectl exec -n "$NAMESPACE" \
        $(kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator,version=canary" -n "$NAMESPACE" \
          -o jsonpath='{.items[0].metadata.name}') -- \
        curl -s http://localhost:9090/metrics | grep -E 'http_request_duration_seconds_count|http_requests_total' | \
        awk '/status="[45][0-9][0-9]"/ { sum += $2 } END { print (sum/NR)*100 }' 2>/dev/null || echo "0")
    
    if (( $(echo "$error_rate > 5.0" | bc -l) )); then
        log_error "High error rate detected: $error_rate%"
        return 1
    fi
    
    # Check response time
    local p95_latency
    p95_latency=$(kubectl exec -n "$NAMESPACE" \
        $(kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator,version=canary" -n "$NAMESPACE" \
          -o jsonpath='{.items[0].metadata.name}') -- \
        curl -s http://localhost:9090/metrics | grep 'http_request_duration_seconds_bucket' | \
        awk '/le="1.0"/ { sum += $2 } END { print sum/NR }' 2>/dev/null || echo "0")
    
    if (( $(echo "$p95_latency > 1000" | bc -l) )); then
        log_error "High latency detected: ${p95_latency}ms"
        return 1
    fi
    
    log_success "Canary analysis passed: error_rate=$error_rate%, p95_latency=${p95_latency}ms"
    return 0
}

# Rollback functions
rollback_blue_green() {
    local green_namespace="$1"
    local green_release="$2"
    
    log_warn "Rolling back Blue-Green deployment..."
    
    # Switch traffic back to blue
    kubectl patch service plugin-orchestrator -n "$NAMESPACE" \
        -p '{"spec":{"selector":{"app.kubernetes.io/instance":"plugin-orchestrator"}}}'
    
    # Clean up green environment
    cleanup_green_environment "$green_namespace" "$green_release"
    
    log_success "Blue-Green rollback completed"
}

rollback_canary() {
    log_warn "Rolling back Canary deployment..."
    
    helm rollback plugin-orchestrator -n "$NAMESPACE"
    kubectl rollout status deployment/plugin-orchestrator -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    log_success "Canary rollback completed"
}

rollback_rolling() {
    log_warn "Rolling back Rolling Update deployment..."
    
    kubectl rollout undo deployment/plugin-orchestrator -n "$NAMESPACE"
    kubectl rollout status deployment/plugin-orchestrator -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    log_success "Rolling update rollback completed"
}

# Cleanup functions
cleanup_green_environment() {
    local green_namespace="$1"
    local green_release="$2"
    
    log_info "Cleaning up green environment..."
    
    if kubectl get namespace "$green_namespace" &> /dev/null; then
        helm uninstall "$green_release" -n "$green_namespace" 2>/dev/null || true
        kubectl delete namespace "$green_namespace" --ignore-not-found
    fi
}

# Setup monitoring
setup_monitoring() {
    if [ "$ENABLE_MONITORING" = "false" ]; then
        log_warn "Monitoring setup disabled"
        return 0
    fi
    
    log_info "Setting up monitoring..."
    
    # Deploy ServiceMonitor for Prometheus
    if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
        kubectl apply -f "$PROJECT_ROOT/monitoring/servicemonitor.yaml"
    fi
    
    # Deploy Grafana dashboard
    if kubectl get configmap grafana-dashboards -n monitoring &> /dev/null; then
        kubectl create configmap plugin-orchestrator-dashboard \
            --from-file="$PROJECT_ROOT/monitoring/grafana-dashboard-plugin-orchestrator.json" \
            -n monitoring --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    log_success "Monitoring setup completed"
}

# Post-deployment validation
run_post_deployment_validation() {
    log_info "Running post-deployment validation..."
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=plugin-orchestrator" \
        -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    # Check deployment status
    kubectl rollout status deployment/plugin-orchestrator -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    # Run comprehensive health check
    if ! run_health_checks "$NAMESPACE" "plugin-orchestrator"; then
        log_error "Post-deployment health check failed"
        return 1
    fi
    
    # Check metrics endpoint
    local pod_name
    pod_name=$(kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator" -n "$NAMESPACE" \
              -o jsonpath='{.items[0].metadata.name}')
    
    if ! kubectl exec -n "$NAMESPACE" "$pod_name" -- curl -f http://localhost:9090/metrics &> /dev/null; then
        log_error "Metrics endpoint not accessible"
        return 1
    fi
    
    log_success "Post-deployment validation passed"
}

# Generate deployment report
generate_deployment_report() {
    log_info "Generating deployment report..."
    
    local report_file="/tmp/plugin-orchestrator-deployment-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "strategy": "$DEPLOYMENT_STRATEGY",
    "version": "$VERSION",
    "namespace": "$NAMESPACE",
    "registry": "$REGISTRY",
    "dry_run": $DRY_RUN,
    "rollback_enabled": $ROLLBACK_ON_FAILURE
  },
  "status": "success",
  "duration_seconds": $SECONDS,
  "pods": $(kubectl get pods -l "app.kubernetes.io/name=plugin-orchestrator" -n "$NAMESPACE" -o json | jq '.items[].status.phase'),
  "services": $(kubectl get services -l "app.kubernetes.io/name=plugin-orchestrator" -n "$NAMESPACE" -o json | jq '.items[].status'),
  "health_check": "passed"
}
EOF
    
    log_success "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    local start_time=$SECONDS
    
    log_info "Starting Plugin Pipeline Orchestrator deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Strategy: $DEPLOYMENT_STRATEGY"
    log_info "Version: $VERSION"
    log_info "Namespace: $NAMESPACE"
    log_info "Registry: $REGISTRY"
    log_info "Dry Run: $DRY_RUN"
    
    # Trap for cleanup on exit
    trap 'log_error "Deployment failed or interrupted"; exit 1' ERR INT TERM
    
    # Execute deployment pipeline
    check_prerequisites
    run_pre_deployment_tests
    
    case $DEPLOYMENT_STRATEGY in
        blue-green)
            deploy_blue_green
            ;;
        canary)
            deploy_canary
            ;;
        rolling)
            deploy_rolling
            ;;
    esac
    
    if [ "$DRY_RUN" = "false" ]; then
        setup_monitoring
        run_post_deployment_validation
        generate_deployment_report
    fi
    
    local duration=$((SECONDS - start_time))
    log_success "Plugin Pipeline Orchestrator deployment completed successfully in ${duration}s"
}

# Execute main function
main "$@"