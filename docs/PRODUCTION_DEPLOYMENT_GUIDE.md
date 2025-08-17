# Production Deployment Guide - Enterprise SaaS IDP Platform

## Overview

This guide provides comprehensive instructions for deploying the Backstage.io-based SaaS Internal Developer Portal platform to production with enterprise-grade reliability, security, and monitoring.

## Infrastructure Architecture

The production deployment consists of multiple components organized for high availability:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer / CDN                      │
│                     (Nginx + CloudFlare)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                    Application Cluster                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    App      │  │    App      │  │    App      │             │
│  │ Instance 1  │  │ Instance 2  │  │ Instance N  │             │
│  │  Port 4400  │  │  Port 4401  │  │  Port 440N  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   WebSocket Cluster                             │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ WebSocket   │  │ WebSocket   │                              │
│  │  Server 1   │  │  Server 2   │                              │
│  │  Port 4403  │  │  Port 4404  │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────┬───────┴────────┬────────────────────────────┐
│                 │                │                            │
│  ┌─────────────┐│┌─────────────┐ │ ┌─────────────────────────┐│
│  │ PostgreSQL  ││ │    Redis    │ │ │      Backstage          ││
│  │   Primary   ││ │   Cluster   │ │ │      Backend            ││
│  │             ││ │             │ │ │                         ││
│  │ ┌─────────┐ ││ │ ┌─────────┐ │ │ │ ┌─────────┐ ┌─────────┐││
│  │ │Replica 1│ ││ │ │ Node 1  │ │ │ │ │Instance1│ │Instance2│││
│  │ │Replica 2│ ││ │ │ Node 2  │ │ │ │ │Port 7007│ │Port 7008│││
│  │ └─────────┘ ││ │ │ Node 3  │ │ │ │ └─────────┘ └─────────┘││
│  └─────────────┘│ │ └─────────┘ │ │ └─────────────────────────┘│
└─────────────────┘ └─────────────┘ └───────────────────────────┘
```

### Key Components

- **Application Cluster**: Next.js with PM2 clustering (4+ instances)
- **WebSocket Cluster**: Socket.io with Redis adapter for real-time features
- **Database**: PostgreSQL with read replicas and connection pooling
- **Cache Layer**: Redis cluster for sessions and application caching
- **Security**: WAF, SSL/TLS, rate limiting, and security headers
- **Monitoring**: Health checks, metrics collection, and alerting
- **Backup**: Automated database and application backups with S3 storage

## Quick Start Deployment

### Prerequisites

- Ubuntu 20.04+ server with 16GB RAM, 8 CPU cores, 100GB SSD
- Node.js 18+, PostgreSQL 15+, Redis 7+, Nginx 1.20+, PM2
- Domain name with DNS configured
- SSL certificates (Let's Encrypt recommended)

### Automated Deployment

```bash
# Clone repository
git clone https://github.com/your-org/saas-idp.git
cd saas-idp

# Configure environment
cp .env.production.template .env.production
# Edit .env.production with your actual values

# Run automated deployment
chmod +x scripts/deploy-production-infrastructure.sh
./scripts/deploy-production-infrastructure.sh
```

### Manual Verification

```bash
# Check application health
curl -f https://your-domain.com/health

# Check process status
pm2 status

# View logs
pm2 logs --lines 100

# Check SSL
openssl s_client -connect your-domain.com:443
```

## 🚀 Plugin Installation in Production (EKS)

When you click "Install Plugin" in the production environment deployed on EKS, here's the complete flow:

## Current Implementation Architecture

### 1. Frontend Action (User Clicks Install)
```
User clicks "Install" → API Call → /api/plugins/install
```

### 2. Backend Processing
The system currently has multiple installation strategies:

#### A. **Development Mode** (Local)
- Creates database records
- Downloads NPM package locally
- Modifies local Backstage instance
- Hot-reloads changes
- **Result**: Plugin available immediately in dev environment

#### B. **Production Mode** (EKS Deployment)
When deployed on EKS, the installation process is:

1. **API Endpoint Triggered** (`/api/plugins/install`)
   - Validates plugin from NPM registry
   - Performs security scanning
   - Checks license compatibility
   - Creates operation record in database

2. **CI/CD Pipeline Triggered**
   - GitHub Actions/Jenkins/GitLab CI webhook called
   - Pipeline parameters: plugin name, version, environment

3. **Build Phase**
   - New Docker image built with plugin included
   - Backstage rebuilt with new dependencies
   - Image pushed to ECR/Container Registry
   - Plugin artifact stored in S3/Artifactory

4. **Deployment Phase**
   - Helm chart updated with new image
   - Rolling deployment to EKS cluster
   - Zero-downtime deployment strategy
   - Health checks before traffic routing

5. **Verification Phase**
   - Smoke tests run against new deployment
   - Plugin health endpoint checked
   - Rollback triggered if tests fail

## Implementation Options for EKS

### Option 1: Dynamic Plugin Loading (Recommended for Backstage 1.27+)
```yaml
# backstage-config.yaml
dynamicPlugins:
  rootDirectory: /opt/backstage/dynamic-plugins
  backend:
    packages:
      - package: '@backstage/plugin-catalog-backend-dynamic'
        disabled: false
```

**Advantages:**
- No rebuild required
- Instant plugin activation
- Lower resource usage
- Faster deployments

**Implementation:**
1. Plugins downloaded to shared EFS volume
2. ConfigMap updated with plugin configuration
3. Backstage pods detect changes and load plugins
4. No container rebuild needed

### Option 2: Build-Time Integration (Traditional)
**Current Implementation** - Requires full rebuild

**Process:**
1. Trigger CI/CD pipeline
2. Rebuild Backstage with new plugin
3. Create new container image
4. Deploy new pods to EKS

**Advantages:**
- Full TypeScript type checking
- Optimized bundle size
- Better performance
- Traditional, well-tested approach

### Option 3: Sidecar Pattern
```yaml
# backstage-deployment.yaml
spec:
  containers:
  - name: backstage
    image: backstage:latest
  - name: plugin-loader
    image: plugin-loader:latest
    volumeMounts:
    - name: plugins
      mountPath: /plugins
```

**Advantages:**
- Plugin isolation
- Independent scaling
- Failure isolation

## EKS-Specific Configuration

### 1. Storage Configuration
```yaml
# Use EFS for shared plugin storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backstage-plugins
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: efs-sc
  resources:
    requests:
      storage: 20Gi
```

### 2. Service Account Permissions
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backstage
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/backstage-role
```

### 3. Environment Variables
```yaml
env:
- name: NODE_ENV
  value: "production"
- name: PLUGIN_INSTALL_MODE
  value: "dynamic"  # or "rebuild"
- name: BACKSTAGE_ROOT
  value: "/app"
- name: DYNAMIC_PLUGINS_PATH
  value: "/opt/backstage/dynamic-plugins"
- name: S3_PLUGIN_BUCKET
  value: "backstage-plugins"
- name: CI_CD_TRIGGER_URL
  value: "https://github.com/org/repo/actions/workflows/plugin-install.yml"
```

## Security Considerations

### 1. Plugin Validation
- NPM package signature verification
- Vulnerability scanning with Trivy/Snyk
- License compatibility checks
- Dependency conflict analysis

### 2. Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backstage-plugin-installer
spec:
  podSelector:
    matchLabels:
      app: plugin-installer
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: backstage
  - to:
    ports:
    - protocol: TCP
      port: 443  # For NPM registry
```

### 3. RBAC Configuration
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: plugin-installer
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "update", "patch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "update", "patch"]
```

## Monitoring & Observability

### 1. Metrics to Track
- Plugin installation success rate
- Installation duration
- Plugin health status
- Resource usage per plugin
- Error rates

### 2. Prometheus Metrics
```yaml
# ServiceMonitor for plugin metrics
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backstage-plugins
spec:
  selector:
    matchLabels:
      app: backstage
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

### 3. Logging
```yaml
# Fluent Bit configuration for plugin logs
[FILTER]
    Name    grep
    Match   kube.*
    Regex   log plugin-install
```

## Deployment Commands

### Install a Plugin (Manual)
```bash
# Trigger via kubectl
kubectl create job plugin-install-catalog \
  --from=cronjob/plugin-installer \
  -n backstage \
  -- env PLUGIN_NAME=@backstage/plugin-catalog \
         PLUGIN_VERSION=1.15.0

# Via GitHub Actions API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/ORG/REPO/dispatches \
  -d '{"event_type":"plugin-install","client_payload":{"plugin_name":"@backstage/plugin-catalog","plugin_version":"1.15.0"}}'
```

### Check Installation Status
```bash
# Check job status
kubectl get jobs -n backstage | grep plugin-install

# View logs
kubectl logs -n backstage job/plugin-install-catalog

# Check ConfigMap
kubectl get configmap backstage-plugins -n backstage -o yaml
```

### Rollback a Plugin
```bash
# Helm rollback
helm rollback backstage -n backstage

# Or manual deployment rollback
kubectl rollout undo deployment/backstage -n backstage
```

## Cost Optimization

### 1. Use Spot Instances for Build Jobs
```yaml
nodeSelector:
  node.kubernetes.io/lifecycle: spot
tolerations:
- key: "spot"
  operator: "Equal"
  value: "true"
  effect: "NoSchedule"
```

### 2. Implement Caching
- Cache NPM packages in S3
- Use ECR image layer caching
- Implement Redis for operation status

### 3. Auto-scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backstage
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backstage
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

## Troubleshooting

### Common Issues and Solutions

1. **Plugin Installation Timeout**
   ```bash
   # Increase timeout in Helm
   helm upgrade backstage . --timeout 20m
   ```

2. **Pod Fails to Start After Plugin Install**
   ```bash
   # Check pod logs
   kubectl logs -n backstage deployment/backstage
   
   # Check events
   kubectl get events -n backstage --sort-by='.lastTimestamp'
   ```

3. **Plugin Not Loading**
   ```bash
   # Verify ConfigMap
   kubectl describe configmap backstage-plugins -n backstage
   
   # Check dynamic plugins directory
   kubectl exec -n backstage deployment/backstage -- ls -la /opt/backstage/dynamic-plugins
   ```

4. **Permission Denied Errors**
   ```bash
   # Check service account permissions
   kubectl auth can-i update configmaps --as=system:serviceaccount:backstage:backstage -n backstage
   ```

## Summary

When you click "Install Plugin" in production (EKS):

1. **Immediate Actions:**
   - Database record created
   - Security scan initiated
   - Compatibility check performed

2. **Deployment Strategy (Based on Configuration):**
   - **Dynamic Loading**: Plugin downloaded and activated without restart
   - **CI/CD Pipeline**: Full rebuild and deployment (10-15 minutes)
   - **Sidecar Pattern**: Plugin loaded in isolated container

3. **End Result:**
   - Plugin available in Backstage
   - Health monitoring active
   - Rollback capability ready
   - Audit trail recorded

The system supports both instant dynamic loading (Backstage 1.27+) and traditional rebuild approaches, with full production-grade features including security scanning, health monitoring, and automated rollback capabilities.

## Production-Like Local Environment

For testing, demos, and development that closely mirrors production, use the included Docker Compose setup:

```bash
# Quick start production-like environment
./scripts/setup-production-local.sh

# Or manually
docker-compose -f docker-compose.production-local.yml up -d
```

This environment includes:
- PostgreSQL with production configuration
- Redis cluster with persistence
- Nginx reverse proxy with security headers
- Prometheus and Grafana monitoring
- Complete application with all 29 features

### Access Points:
- **Main Application**: http://localhost:4400
- **Monitoring Dashboard**: http://localhost:3000 (admin/admin123)
- **Metrics**: http://localhost:9090
- **Mock Backstage API**: http://localhost:4402

## Security Audit Results

Recent security audit identified 33 vulnerabilities:
- **High (1)**: xlsx package - Prototype pollution (no fix available)
- **Moderate (20)**: Mainly in Storybook and development dependencies
- **Low (12)**: Various development tools

### Production Impact:
- **Zero production vulnerabilities** in runtime dependencies
- All high/moderate vulnerabilities are in development-only packages
- Recommended: Use container scanning with Trivy in CI/CD pipeline

## Final Production Checklist

Before deploying to production:

### Security
- [ ] Update all environment variables in .env.production.template
- [ ] Configure GitHub OAuth credentials
- [ ] Set strong passwords for all services
- [ ] Enable SSL/TLS certificates
- [ ] Configure WAF rules
- [ ] Set up security monitoring

### Infrastructure
- [ ] Provision Kubernetes cluster (EKS/GKE/AKS)
- [ ] Configure persistent volumes for data
- [ ] Set up load balancer and ingress
- [ ] Configure auto-scaling policies
- [ ] Set up backup procedures

### Monitoring
- [ ] Deploy Prometheus and Grafana
- [ ] Configure log aggregation (ELK/Loki)
- [ ] Set up alerting rules
- [ ] Configure health checks
- [ ] Set up uptime monitoring

### Application
- [ ] Build production Docker images
- [ ] Run database migrations
- [ ] Verify all 29 enterprise features
- [ ] Load test with expected user volume
- [ ] Test disaster recovery procedures

### CI/CD
- [ ] Configure deployment pipeline
- [ ] Set up blue-green deployment
- [ ] Configure automated testing
- [ ] Set up rollback procedures
- [ ] Configure secrets management

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review security logs and update dependencies
2. **Monthly**: Performance optimization and capacity planning
3. **Quarterly**: Disaster recovery testing and security audits
4. **Annually**: Full infrastructure review and cost optimization

### Emergency Procedures
- **Application Down**: Follow rollback procedures in CI/CD pipeline
- **Database Issues**: Switch to read replicas and restore from backup
- **Security Breach**: Isolate affected services and rotate credentials
- **Performance Degradation**: Scale up resources and identify bottlenecks

### Contact Information
For production support and emergency escalation:
- **Platform Team**: platform-team@company.com
- **Security Team**: security@company.com
- **On-call Engineer**: +1-XXX-XXX-XXXX

---

This deployment guide provides comprehensive coverage of production deployment scenarios with enterprise-grade reliability, security, and monitoring. The included Docker Compose environment allows for thorough testing before production deployment.