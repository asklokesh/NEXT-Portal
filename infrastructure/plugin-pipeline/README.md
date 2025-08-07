# Plugin Installation Pipeline

A production-ready plugin installation and lifecycle management system for Backstage/Portal platforms, following Spotify's Portal architecture patterns for enterprise-grade deployment orchestration.

## Overview

The Plugin Installation Pipeline provides comprehensive automation for plugin deployment with Docker/Kubernetes orchestration, security scanning, service mesh integration, monitoring, and high availability. It supports multiple deployment strategies and maintains production-grade reliability.

## Features

### 🚀 **Plugin Lifecycle Management**
- Automated plugin installation, updates, and uninstallation
- Multiple deployment strategies: Rolling Update, Blue-Green, Canary, A/B Testing
- Plugin versioning and dependency resolution
- Rollback capabilities with state preservation

### 🔒 **Security & Compliance**
- Multi-scanner security validation (Trivy, Snyk, Clair)
- Vulnerability scanning and policy enforcement  
- Secret scanning with TruffleHog
- Compliance frameworks (SOC2, PCI-DSS, HIPAA, GDPR, CIS)
- Network policies and Pod Security Standards

### ☸️ **Kubernetes Orchestration**
- Namespace-based multi-tenancy and isolation
- Resource quotas and limits enforcement
- Auto-scaling with HPA support
- Service mesh integration (Istio/Linkerd)
- Network policies for traffic segmentation

### 🐳 **Container Management**  
- Automated Docker image building with multi-stage optimization
- Container registry integration
- Security hardened base images
- Image vulnerability scanning

### 📊 **Monitoring & Observability**
- Prometheus metrics collection
- Distributed tracing (Jaeger/OpenTelemetry)
- Structured logging (ELK/Loki)
- Grafana dashboards and alerting
- SLA monitoring and health checks

### 🏪 **Plugin Registry Integration**
- Multi-registry support (NPM, Docker, Git, OCI)
- Automated plugin discovery and scanning
- Dependency resolution and conflict detection
- Quality gates and compatibility validation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Plugin Installation Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Plugin Manager │  │ Docker Builder  │  │ Security Scanner│  │
│  │   Orchestrator  │  │   Multi-stage   │  │  Trivy/Snyk    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Kubernetes    │  │  Service Mesh   │  │   Monitoring    │  │
│  │ Orchestrator    │  │ Istio/Linkerd   │  │ Prometheus/Jaeger│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐                      ┌─────────────────┐  │
│  │ Plugin Registry │                      │ Quality Gates   │  │
│  │  Multi-source   │                      │  & Validation   │  │
│  └─────────────────┘                      └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        Kubernetes Cluster                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │   Plugin    │ │   Plugin    │ │   Plugin    │ │    ...     │ │
│  │ Namespace A │ │ Namespace B │ │ Namespace C │ │            │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster (v1.25+)
- Docker Engine (v20.0+)
- kubectl configured
- Helm 3.x (optional)
- Node.js 18+ (for development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd infrastructure/plugin-pipeline
   ```

2. **Configure environment:**
   ```bash
   cp config/prod.env.example config/prod.env
   # Edit configuration as needed
   ```

3. **Deploy to Kubernetes:**
   ```bash
   # Build and deploy
   ./scripts/deploy.sh -e prod -i v1.0.0 -w
   
   # Check deployment status
   kubectl get pods -n plugin-pipeline
   kubectl logs -l app=plugin-pipeline-orchestrator -n plugin-pipeline -f
   ```

4. **Access the API:**
   ```bash
   kubectl port-forward svc/plugin-pipeline-orchestrator 8080:8080 -n plugin-pipeline
   curl http://localhost:8080/api/v1/status
   ```

## Usage

### Installing a Plugin

```bash
# Install plugin via API
curl -X POST http://localhost:8080/api/v1/plugins/install \
  -H "Content-Type: application/json" \
  -d '{
    "plugin": {
      "name": "@backstage/plugin-catalog",
      "version": "1.0.0",
      "runtime": {
        "type": "frontend",
        "framework": "react"
      },
      "resources": {
        "cpu": {"request": "100m", "limit": "500m"},
        "memory": {"request": "128Mi", "limit": "512Mi"}
      },
      "networking": {
        "ports": [{"name": "http", "port": 3000, "protocol": "TCP"}]
      },
      "healthChecks": {
        "liveness": {"type": "http", "path": "/health", "port": 3000, "initialDelaySeconds": 30, "periodSeconds": 10, "timeoutSeconds": 5, "successThreshold": 1, "failureThreshold": 3},
        "readiness": {"type": "http", "path": "/ready", "port": 3000, "initialDelaySeconds": 15, "periodSeconds": 5, "timeoutSeconds": 3, "successThreshold": 1, "failureThreshold": 3}
      },
      "security": {
        "runAsNonRoot": true,
        "allowPrivilegeEscalation": false,
        "capabilities": {"drop": ["ALL"]}
      },
      "observability": {
        "metrics": {"enabled": true, "path": "/metrics", "port": 9090},
        "tracing": {"enabled": true, "samplingRate": 0.1}
      }
    },
    "strategy": "rolling-update",
    "options": {
      "skipSecurityScan": false,
      "skipDependencyCheck": false,
      "priority": 1
    }
  }'
```

### Monitoring Deployment

```bash
# Check installation status
INSTALLATION_ID="install-plugin-catalog-1234567890-abc123"
curl http://localhost:8080/api/v1/installations/$INSTALLATION_ID

# List all plugins
curl http://localhost:8080/api/v1/plugins

# Check system health
curl http://localhost:8080/api/v1/status
```

### Deployment Strategies

#### Rolling Update (Default)
```json
{
  "strategy": "rolling-update"
}
```

#### Blue-Green Deployment
```json
{
  "strategy": "blue-green"
}
```

#### Canary Deployment
```json
{
  "strategy": "canary"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `LOG_LEVEL` | Logging level | `info` |
| `PORT` | API server port | `8080` |
| `HEALTH_PORT` | Health check port | `8081` |
| `METRICS_PORT` | Metrics port | `9090` |
| `KUBERNETES_IN_CLUSTER` | In-cluster mode | `true` |
| `DOCKER_REGISTRY_URL` | Docker registry | `registry.hub.docker.com` |
| `SERVICE_MESH_PROVIDER` | Service mesh | `istio` |
| `PROMETHEUS_ENABLED` | Enable Prometheus | `true` |
| `TRACING_ENABLED` | Enable tracing | `true` |
| `SECURITY_TRIVY_ENABLED` | Enable Trivy scanning | `true` |

### Configuration Files

Create environment-specific configuration files:

```bash
# config/prod.env
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
SNYK_TOKEN=your-snyk-token
GITHUB_TOKEN=your-github-token
```

### Kubernetes Manifests

The pipeline includes comprehensive Kubernetes manifests:

- **Namespace**: Isolated environments for pipeline and plugins
- **RBAC**: Service accounts and permissions
- **Deployment**: High-availability orchestrator deployment
- **Services**: ClusterIP services for internal communication
- **ConfigMaps/Secrets**: Configuration and sensitive data
- **NetworkPolicies**: Traffic isolation and security
- **ResourceQuotas**: Resource limits and quotas
- **HPA**: Auto-scaling configuration
- **ServiceMonitor**: Prometheus metrics collection
- **Istio**: Service mesh integration

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test
npm run test:coverage

# Lint and format
npm run lint
npm run format
```

### Building

```bash
# Build TypeScript
npm run build

# Build Docker image
npm run docker:build

# Security scan
npm run security:scan
```

### Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance
```

## Monitoring

### Metrics

The pipeline exposes comprehensive metrics:

- Plugin installation success/failure rates
- Installation duration percentiles
- Resource utilization (CPU, memory, storage)
- Security scan results
- Health check status
- Queue sizes and throughput

### Dashboards

Pre-configured Grafana dashboards include:

- **Plugin Pipeline Overview**: High-level system metrics
- **Plugin Health Status**: Individual plugin monitoring
- **Security Dashboard**: Vulnerability trends and compliance
- **Performance Metrics**: Latency and throughput analysis
- **Resource Utilization**: Cluster resource usage

### Alerts

Critical alerts include:

- Pipeline orchestrator downtime
- High installation failure rates
- Security scan failures
- Resource exhaustion
- Health check failures

## Security

### Security Scanning

Multi-layered security scanning:

- **Container Images**: Trivy vulnerability scanning
- **Dependencies**: Snyk/npm audit for package vulnerabilities  
- **Secrets**: TruffleHog for credential detection
- **Compliance**: SOC2, PCI-DSS, HIPAA, GDPR frameworks

### Network Security

- **Network Policies**: Ingress/egress traffic control
- **Service Mesh**: mTLS encryption and authentication
- **Pod Security Standards**: Restricted security contexts
- **RBAC**: Principle of least privilege

### Data Protection

- **Secrets Management**: Kubernetes secrets with encryption at rest
- **TLS Termination**: End-to-end encryption
- **Audit Logging**: Comprehensive activity tracking

## Troubleshooting

### Common Issues

#### Plugin Installation Failures

```bash
# Check orchestrator logs
kubectl logs -l app=plugin-pipeline-orchestrator -n plugin-pipeline

# Check plugin pod status
kubectl get pods -n plugin-<plugin-name>

# Check events
kubectl get events -n plugin-<plugin-name> --sort-by=.metadata.creationTimestamp
```

#### Health Check Failures

```bash
# Manual health check
kubectl port-forward svc/plugin-pipeline-orchestrator 8081:8081 -n plugin-pipeline
curl http://localhost:8081/health/readiness

# Check resource usage
kubectl top pods -n plugin-pipeline
kubectl describe pod <pod-name> -n plugin-pipeline
```

#### Service Mesh Issues

```bash
# Check Istio sidecar injection
kubectl get pods -n plugin-<plugin-name> -o jsonpath='{.items[*].spec.containers[*].name}'

# Check service mesh configuration
kubectl get virtualservice,destinationrule,peerauthentication -n plugin-pipeline

# Check mTLS status
istioctl authn tls-check <pod-name>.<namespace>
```

### Debug Mode

Enable debug logging:

```bash
kubectl patch deployment plugin-pipeline-orchestrator -n plugin-pipeline -p '{"spec":{"template":{"spec":{"containers":[{"name":"orchestrator","env":[{"name":"LOG_LEVEL","value":"debug"}]}]}}}}'
```

## Performance Tuning

### Resource Optimization

- **CPU Limits**: Adjust based on plugin build load
- **Memory Limits**: Scale with concurrent installations
- **Storage**: Provision adequate space for image builds
- **Network**: Ensure sufficient bandwidth for registry access

### Scaling Configuration

```yaml
# HPA configuration
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Database Optimization

- **Connection Pooling**: Configure appropriate pool sizes
- **Query Optimization**: Index frequently accessed data
- **Backup Strategy**: Regular automated backups

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run quality checks: `npm run lint && npm test`
5. Submit a pull request

### Code Standards

- **TypeScript**: Strict mode with comprehensive types
- **ESLint**: Enforce coding standards
- **Prettier**: Consistent code formatting
- **Jest**: Unit and integration testing
- **Security**: No hardcoded secrets or credentials

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [docs.example.com/plugin-pipeline](https://docs.example.com/plugin-pipeline)
- **Issues**: [GitHub Issues](https://github.com/example/plugin-pipeline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/example/plugin-pipeline/discussions)
- **Slack**: #plugin-pipeline in company workspace

---

**Built with ❤️ by the Platform Engineering Team**