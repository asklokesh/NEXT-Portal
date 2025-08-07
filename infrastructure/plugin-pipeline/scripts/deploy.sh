#!/bin/bash

# Plugin Installation Pipeline Deployment Script
# 
# Production-ready deployment script for the plugin pipeline orchestrator
# with comprehensive validation, monitoring, and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-600}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-30}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Help function
show_help() {
    cat << EOF
Plugin Installation Pipeline Deployment Script

USAGE:
    ./scripts/deploy.sh [OPTIONS]

OPTIONS:
    -e, --environment    Target environment (dev|staging|prod) [required]
    -n, --namespace      Kubernetes namespace (default: plugin-pipeline)
    -i, --image-tag      Docker image tag (default: latest)
    -d, --dry-run        Perform a dry-run without making changes
    -s, --skip-build     Skip Docker image build
    -m, --skip-migrate   Skip database migrations
    -w, --wait           Wait for deployment to be ready
    -r, --rollback       Rollback to previous version
    -h, --help           Show this help message

EXAMPLES:
    ./scripts/deploy.sh -e prod -i v1.2.3 -w
    ./scripts/deploy.sh -e staging --dry-run
    ./scripts/deploy.sh -e prod --rollback

ENVIRONMENT VARIABLES:
    KUBECONFIG              Path to kubeconfig file
    DOCKER_REGISTRY         Docker registry URL
    DEPLOYMENT_TIMEOUT      Deployment timeout in seconds (default: 600)
    HEALTH_CHECK_RETRIES    Number of health check retries (default: 30)
    HEALTH_CHECK_INTERVAL   Health check interval in seconds (default: 10)

EOF
}

# Parse command line arguments
parse_args() {
    ENVIRONMENT=""
    NAMESPACE="plugin-pipeline"
    IMAGE_TAG="latest"
    DRY_RUN=false
    SKIP_BUILD=false
    SKIP_MIGRATE=false
    WAIT_FOR_READY=false
    ROLLBACK=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -i|--image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-build)
                SKIP_BUILD=true
                shift
                ;;
            -m|--skip-migrate)
                SKIP_MIGRATE=true
                shift
                ;;
            -w|--wait)
                WAIT_FOR_READY=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK=true
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

    # Validate required arguments
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "Environment is required. Use -e or --environment"
        show_help
        exit 1
    fi

    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check required tools
    local tools=("kubectl" "docker" "helm")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done

    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        exit 1
    fi

    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace '$NAMESPACE' does not exist. Creating..."
        if [[ "$DRY_RUN" == false ]]; then
            kubectl create namespace "$NAMESPACE"
        fi
    fi

    log_success "Prerequisites check passed"
}

# Load environment-specific configuration
load_config() {
    local config_file="$PROJECT_DIR/config/$ENVIRONMENT.env"
    
    if [[ -f "$config_file" ]]; then
        log_info "Loading configuration from $config_file"
        # shellcheck source=/dev/null
        source "$config_file"
    else
        log_warning "Configuration file $config_file not found, using defaults"
    fi

    # Set default values if not provided
    export DOCKER_REGISTRY=${DOCKER_REGISTRY:-"registry.hub.docker.com"}
    export DATABASE_HOST=${DATABASE_HOST:-"postgres-service"}
    export REDIS_HOST=${REDIS_HOST:-"redis-service"}
}

# Build Docker image
build_image() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Skipping Docker image build"
        return
    fi

    log_info "Building Docker image..."
    
    local image_name="plugin-pipeline-orchestrator"
    local full_image_name="$DOCKER_REGISTRY/$image_name:$IMAGE_TAG"

    if [[ "$DRY_RUN" == false ]]; then
        # Build the image
        docker build \
            --tag "$full_image_name" \
            --tag "$DOCKER_REGISTRY/$image_name:latest" \
            --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
            --build-arg VERSION="$IMAGE_TAG" \
            --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
            "$PROJECT_DIR"

        # Security scan
        if command -v trivy &> /dev/null; then
            log_info "Running security scan on image..."
            trivy image --exit-code 0 --severity HIGH,CRITICAL "$full_image_name"
        fi

        # Push to registry
        if [[ "$ENVIRONMENT" != "dev" ]]; then
            log_info "Pushing image to registry..."
            docker push "$full_image_name"
            docker push "$DOCKER_REGISTRY/$image_name:latest"
        fi
    else
        log_info "[DRY RUN] Would build and push image: $full_image_name"
    fi

    log_success "Docker image build completed"
}

# Run database migrations
run_migrations() {
    if [[ "$SKIP_MIGRATE" == true ]]; then
        log_info "Skipping database migrations"
        return
    fi

    log_info "Running database migrations..."

    if [[ "$DRY_RUN" == false ]]; then
        # Create migration job
        local job_name="plugin-pipeline-migrate-$(date +%s)"
        
        kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: plugin-pipeline-migration
    app.kubernetes.io/component: migration
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: $DOCKER_REGISTRY/plugin-pipeline-orchestrator:$IMAGE_TAG
        command: ["npm", "run", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pipeline-secrets
              key: database-url
      backoffLimit: 3
EOF

        # Wait for migration to complete
        kubectl wait --for=condition=complete --timeout=300s job/"$job_name" -n "$NAMESPACE"
        
        # Clean up job
        kubectl delete job "$job_name" -n "$NAMESPACE"
    else
        log_info "[DRY RUN] Would run database migrations"
    fi

    log_success "Database migrations completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to $ENVIRONMENT environment..."

    local manifests_dir="$PROJECT_DIR/k8s-manifests"
    
    if [[ "$DRY_RUN" == false ]]; then
        # Apply manifests in order
        local manifest_order=(
            "namespace.yaml"
            "rbac.yaml"
            "config-secrets.yaml"
            "resource-quotas.yaml"
            "network-policies.yaml"
            "pipeline-deployment.yaml"
            "monitoring.yaml"
            "istio-service-mesh.yaml"
        )

        for manifest in "${manifest_order[@]}"; do
            local manifest_path="$manifests_dir/$manifest"
            if [[ -f "$manifest_path" ]]; then
                log_info "Applying $manifest..."
                
                # Update image tag in deployment manifest
                if [[ "$manifest" == "pipeline-deployment.yaml" ]]; then
                    sed "s|plugin-pipeline-orchestrator:.*|plugin-pipeline-orchestrator:$IMAGE_TAG|g" "$manifest_path" | \
                    kubectl apply -f -
                else
                    kubectl apply -f "$manifest_path"
                fi
            else
                log_warning "Manifest $manifest not found, skipping..."
            fi
        done
    else
        log_info "[DRY RUN] Would apply Kubernetes manifests"
    fi

    log_success "Application deployment completed"
}

# Perform rollback
rollback_deployment() {
    log_info "Rolling back deployment..."

    if [[ "$DRY_RUN" == false ]]; then
        # Rollback deployment
        kubectl rollout undo deployment/plugin-pipeline-orchestrator -n "$NAMESPACE"
        
        # Wait for rollback to complete
        kubectl rollout status deployment/plugin-pipeline-orchestrator -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"
    else
        log_info "[DRY RUN] Would rollback deployment"
    fi

    log_success "Rollback completed"
}

# Wait for deployment to be ready
wait_for_ready() {
    if [[ "$WAIT_FOR_READY" == false ]]; then
        return
    fi

    log_info "Waiting for deployment to be ready..."

    # Wait for deployment rollout
    if ! kubectl rollout status deployment/plugin-pipeline-orchestrator -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"; then
        log_error "Deployment rollout failed"
        return 1
    fi

    # Perform health checks
    log_info "Performing health checks..."
    
    local retries=0
    while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
        if health_check; then
            log_success "Health checks passed"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Health check failed, retrying in ${HEALTH_CHECK_INTERVAL}s... ($retries/$HEALTH_CHECK_RETRIES)"
        sleep "$HEALTH_CHECK_INTERVAL"
    done

    log_error "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Perform health check
health_check() {
    # Check if pods are running
    local ready_pods
    ready_pods=$(kubectl get pods -l app=plugin-pipeline-orchestrator -n "$NAMESPACE" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}')
    
    if [[ "$ready_pods" =~ False ]]; then
        return 1
    fi

    # Check service endpoint
    if kubectl get service plugin-pipeline-orchestrator -n "$NAMESPACE" &> /dev/null; then
        # Port forward for health check
        local port=8081
        kubectl port-forward svc/plugin-pipeline-orchestrator "$port:$port" -n "$NAMESPACE" &
        local port_forward_pid=$!
        
        sleep 2
        
        # Health check
        if curl -f "http://localhost:$port/health/readiness" &> /dev/null; then
            kill $port_forward_pid 2>/dev/null || true
            return 0
        fi
        
        kill $port_forward_pid 2>/dev/null || true
    fi
    
    return 1
}

# Cleanup on exit
cleanup() {
    local exit_code=$?
    
    # Kill any background port-forward processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deployment failed with exit code $exit_code"
        
        # Show recent events for debugging
        log_info "Recent events in namespace $NAMESPACE:"
        kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -20
        
        # Show pod logs for debugging
        log_info "Recent logs from plugin-pipeline-orchestrator pods:"
        kubectl logs -l app=plugin-pipeline-orchestrator -n "$NAMESPACE" --tail=50 || true
    fi
    
    exit $exit_code
}

# Main function
main() {
    trap cleanup EXIT

    log_info "Starting Plugin Installation Pipeline deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Dry Run: $DRY_RUN"

    parse_args "$@"
    check_prerequisites
    load_config

    if [[ "$ROLLBACK" == true ]]; then
        rollback_deployment
    else
        build_image
        run_migrations
        deploy_application
        wait_for_ready
    fi

    log_success "Plugin Installation Pipeline deployment completed successfully!"
    
    if [[ "$DRY_RUN" == false ]] && [[ "$ROLLBACK" == false ]]; then
        log_info "Access URLs:"
        log_info "  API: kubectl port-forward svc/plugin-pipeline-orchestrator 8080:8080 -n $NAMESPACE"
        log_info "  Health: kubectl port-forward svc/plugin-pipeline-orchestrator 8081:8081 -n $NAMESPACE"
        log_info "  Metrics: kubectl port-forward svc/plugin-pipeline-orchestrator 9090:9090 -n $NAMESPACE"
        log_info ""
        log_info "To check deployment status:"
        log_info "  kubectl get pods -l app=plugin-pipeline-orchestrator -n $NAMESPACE"
        log_info "  kubectl logs -l app=plugin-pipeline-orchestrator -n $NAMESPACE -f"
    fi
}

# Run main function with all arguments
main "$@"