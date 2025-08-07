#!/bin/sh

# Health check script for Plugin Pipeline Orchestrator
# Performs comprehensive health checks for all critical components

set -e

# Configuration
HEALTH_URL="http://localhost:${HEALTH_PORT:-8081}"
API_URL="http://localhost:${PORT:-8080}"
METRICS_URL="http://localhost:${METRICS_PORT:-9090}"
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make HTTP requests with timeout
http_check() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="$3"
    
    printf "Checking %s... " "$description"
    
    if response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        if [ "$status_code" = "$expected_status" ]; then
            printf "${GREEN}OK${NC} (HTTP %s)\n" "$status_code"
            return 0
        else
            printf "${RED}FAIL${NC} (HTTP %s, expected %s)\n" "$status_code" "$expected_status"
            return 1
        fi
    else
        printf "${RED}FAIL${NC} (Connection failed)\n"
        return 1
    fi
}

# Helper function to check process is running
process_check() {
    local process_name="$1"
    local description="$2"
    
    printf "Checking %s... " "$description"
    
    if pgrep -f "$process_name" > /dev/null; then
        printf "${GREEN}OK${NC}\n"
        return 0
    else
        printf "${RED}FAIL${NC} (Process not found)\n"
        return 1
    fi
}

# Helper function to check disk space
disk_check() {
    local path="$1"
    local threshold="${2:-90}"
    local description="$3"
    
    printf "Checking %s... " "$description"
    
    usage=$(df "$path" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        printf "${GREEN}OK${NC} (%s%% used)\n" "$usage"
        return 0
    else
        printf "${YELLOW}WARNING${NC} (%s%% used, threshold %s%%)\n" "$usage" "$threshold"
        return 1
    fi
}

# Helper function to check memory usage
memory_check() {
    local threshold="${1:-90}"
    local description="Memory usage"
    
    printf "Checking %s... " "$description"
    
    if [ -f /proc/meminfo ]; then
        mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        mem_used=$((mem_total - mem_available))
        usage=$((mem_used * 100 / mem_total))
        
        if [ "$usage" -lt "$threshold" ]; then
            printf "${GREEN}OK${NC} (%s%% used)\n" "$usage"
            return 0
        else
            printf "${YELLOW}WARNING${NC} (%s%% used, threshold %s%%)\n" "$usage" "$threshold"
            return 1
        fi
    else
        printf "${YELLOW}SKIP${NC} (Unable to read memory info)\n"
        return 0
    fi
}

# Main health check function
main() {
    echo "=== Plugin Pipeline Orchestrator Health Check ==="
    echo "Timestamp: $(date)"
    echo "Node: $(hostname)"
    echo

    local exit_code=0

    # Critical health checks (if these fail, container is unhealthy)
    echo "=== Critical Health Checks ==="
    
    # Check if main process is running
    if ! process_check "node.*index.js" "Main process"; then
        exit_code=1
    fi
    
    # Check liveness endpoint
    if ! http_check "$HEALTH_URL/health/liveness" "200" "Liveness probe"; then
        exit_code=1
    fi
    
    # Check readiness endpoint
    if ! http_check "$HEALTH_URL/health/readiness" "200" "Readiness probe"; then
        exit_code=1
    fi
    
    # Check startup endpoint
    if ! http_check "$HEALTH_URL/health/startup" "200" "Startup probe"; then
        exit_code=1
    fi

    echo
    echo "=== Extended Health Checks ==="
    
    # Check API endpoint (non-critical)
    http_check "$API_URL/api/v1/status" "200" "API status endpoint" || true
    
    # Check metrics endpoint (non-critical)
    http_check "$METRICS_URL/metrics" "200" "Metrics endpoint" || true
    
    # Check system resources (non-critical, warnings only)
    disk_check "/app" "90" "Application disk usage" || true
    disk_check "/tmp" "95" "Temporary disk usage" || true
    memory_check "90" || true

    echo
    echo "=== External Dependencies ==="
    
    # Check Docker daemon (if available)
    if [ -e /var/run/docker.sock ]; then
        printf "Checking Docker daemon... "
        if docker version > /dev/null 2>&1; then
            printf "${GREEN}OK${NC}\n"
        else
            printf "${YELLOW}WARNING${NC} (Docker daemon not accessible)\n"
        fi
    else
        printf "Checking Docker daemon... ${YELLOW}SKIP${NC} (Socket not mounted)\n"
    fi
    
    # Check Kubernetes API access
    printf "Checking Kubernetes API... "
    if kubectl version --client=true > /dev/null 2>&1; then
        if kubectl cluster-info > /dev/null 2>&1; then
            printf "${GREEN}OK${NC}\n"
        else
            printf "${YELLOW}WARNING${NC} (Cannot connect to cluster)\n"
        fi
    else
        printf "${YELLOW}WARNING${NC} (kubectl not available)\n"
    fi

    echo
    echo "=== Configuration Checks ==="
    
    # Check required environment variables
    check_env_var() {
        local var_name="$1"
        local required="${2:-false}"
        
        printf "Checking %s... " "$var_name"
        
        if eval "[ -n \"\${$var_name}\" ]"; then
            printf "${GREEN}SET${NC}\n"
        elif [ "$required" = "true" ]; then
            printf "${RED}MISSING${NC} (Required)\n"
            exit_code=1
        else
            printf "${YELLOW}UNSET${NC} (Optional)\n"
        fi
    }
    
    # Check critical environment variables
    check_env_var "NODE_ENV"
    check_env_var "DATABASE_URL" "true"
    check_env_var "REDIS_URL" "true"
    check_env_var "DOCKER_REGISTRY_URL"
    
    # Check configuration files
    printf "Checking configuration files... "
    if [ -f "/app/config/pipeline-config.yaml" ]; then
        printf "${GREEN}OK${NC}\n"
    else
        printf "${YELLOW}WARNING${NC} (Using environment variables only)\n"
    fi

    echo
    
    # Summary
    if [ $exit_code -eq 0 ]; then
        echo "${GREEN}=== HEALTH CHECK PASSED ===${NC}"
        echo "All critical health checks passed successfully"
    else
        echo "${RED}=== HEALTH CHECK FAILED ===${NC}"
        echo "One or more critical health checks failed"
    fi
    
    echo "Completed at: $(date)"
    
    exit $exit_code
}

# Run the health check
main "$@"