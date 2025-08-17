# Deployment and Infrastructure Plan

## Overview
Design a scalable, multi-region infrastructure capable of supporting thousands of tenants with enterprise-grade reliability, security, and performance matching Spotify Portal's SaaS delivery model.

## Infrastructure Architecture

### High-Level Architecture
```
                            ┌─────────────────┐
                            │   Global CDN    │
                            │   (CloudFlare)  │
                            └─────────────────┘
                                     │
                            ┌─────────────────┐
                            │  Load Balancer  │
                            │   (AWS ALB)     │
                            └─────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
            ┌───────▼────────┐                ┌──────▼────────┐
            │   Region US     │                │  Region EU    │
            │   (Primary)     │                │  (Secondary)  │
            └────────────────┘                └───────────────┘
                    │                                 │
        ┌───────────┼───────────┐                    │
        │           │           │                    │
   ┌────▼───┐ ┌────▼───┐ ┌─────▼──┐                │
   │  AZ-A  │ │  AZ-B  │ │  AZ-C  │                │
   └────────┘ └────────┘ └────────┘                │
```

### Kubernetes Cluster Design
```yaml
# cluster-architecture.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: portal-system
---
apiVersion: v1
kind: Namespace
metadata:
  name: portal-tenants
---
# Multi-tenant namespace strategy
# Each tenant gets: portal-tenant-${tenantId}
```

## Container Orchestration

### Docker Configuration
```dockerfile
# Dockerfile.production
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build application
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM base AS runtime
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV production

CMD ["npm", "start"]
```

### Kubernetes Deployments
```yaml
# k8s/production/portal-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portal-app
  namespace: portal-system
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  selector:
    matchLabels:
      app: portal-app
  template:
    metadata:
      labels:
        app: portal-app
    spec:
      containers:
      - name: portal
        image: portal:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: portal-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: portal-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      imagePullSecrets:
      - name: registry-credentials
---
apiVersion: v1
kind: Service
metadata:
  name: portal-service
  namespace: portal-system
spec:
  selector:
    app: portal-app
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Horizontal Pod Autoscaling
```yaml
# k8s/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: portal-hpa
  namespace: portal-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: portal-app
  minReplicas: 6
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Database Infrastructure

### PostgreSQL Cluster Setup
```yaml
# k8s/database/postgresql-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgresql-cluster
  namespace: portal-system
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  
  postgresql:
    parameters:
      max_connections: "1000"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      maintenance_work_mem: "64MB"
      checkpoint_completion_target: "0.9"
      wal_buffers: "16MB"
      default_statistics_target: "100"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
    
  bootstrap:
    initdb:
      database: portal
      owner: portal_user
      secret:
        name: postgresql-credentials
    
  storage:
    size: 1Ti
    storageClass: fast-ssd
    
  monitoring:
    enabled: true
    
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: "s3://portal-backups/postgresql"
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-credentials
          key: SECRET_ACCESS_KEY
      wal:
        retention: "5d"
      data:
        retention: "30d"
```

### Redis Cluster
```yaml
# k8s/redis/redis-cluster.yaml
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: redis-cluster
  namespace: portal-system
spec:
  clusterSize: 6
  clusterVersion: v7
  persistenceEnabled: true
  redisExporter:
    enabled: true
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 100Gi
        storageClassName: fast-ssd
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
```

## Security Infrastructure

### Network Policies
```yaml
# k8s/security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: portal-network-policy
  namespace: portal-system
spec:
  podSelector:
    matchLabels:
      app: portal-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: portal-system
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
  - to: []  # Allow external API calls
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

### Pod Security Standards
```yaml
# k8s/security/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: portal-system
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Service Mesh (Istio)
```yaml
# k8s/istio/virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: portal-virtual-service
  namespace: portal-system
spec:
  hosts:
  - portal.company.com
  - "*.portal.company.com"
  gateways:
  - portal-gateway
  http:
  - match:
    - headers:
        x-tenant-id:
          regex: "^[a-zA-Z0-9-]+$"
    route:
    - destination:
        host: portal-service
        port:
          number: 80
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
  - route:
    - destination:
        host: portal-service
        port:
          number: 80
```

## Monitoring and Observability

### Prometheus Configuration
```yaml
# k8s/monitoring/prometheus.yaml
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: prometheus
  namespace: monitoring
spec:
  serviceAccountName: prometheus
  replicas: 2
  retention: 30d
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 500Gi
        storageClassName: fast-ssd
  
  serviceMonitorSelector:
    matchLabels:
      app: portal
  
  ruleSelector:
    matchLabels:
      app: portal
  
  resources:
    requests:
      memory: "4Gi"
      cpu: "2000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"
```

### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "Portal SaaS Metrics",
    "panels": [
      {
        "title": "Active Tenants",
        "type": "stat",
        "targets": [
          {
            "expr": "count(increase(portal_tenant_requests_total[5m]) > 0)"
          }
        ]
      },
      {
        "title": "Request Rate by Tenant",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(portal_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Plugin Installation Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(portal_plugin_installations_total{status=\"success\"}[5m]) / rate(portal_plugin_installations_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### Distributed Tracing
```yaml
# k8s/tracing/jaeger.yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger
  namespace: observability
spec:
  strategy: production
  collector:
    maxReplicas: 5
    resources:
      limits:
        cpu: 2000m
        memory: 2Gi
      requests:
        cpu: 500m
        memory: 1Gi
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
        index-prefix: jaeger
  ui:
    options:
      dependencies:
        menuEnabled: true
      tracking:
        gaID: UA-000000-2
```

## CI/CD Pipeline

### GitLab CI/CD Configuration
```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - security
  - deploy-staging
  - deploy-production

variables:
  DOCKER_REGISTRY: registry.company.com
  IMAGE_NAME: portal
  KUBECONFIG: /etc/deploy/config

test:
  stage: test
  image: node:18-alpine
  services:
    - postgres:15
    - redis:7
  script:
    - npm ci
    - npm run test:unit
    - npm run test:integration
    - npm run test:e2e
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA .
    - docker push $DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA
  only:
    - main
    - develop

security_scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 0 --severity HIGH,CRITICAL $DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA
    - trivy fs --exit-code 1 --severity CRITICAL .
  only:
    - main
    - develop

deploy_staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context staging
    - kubectl set image deployment/portal-app portal=$DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA -n portal-staging
    - kubectl rollout status deployment/portal-app -n portal-staging --timeout=600s
  environment:
    name: staging
    url: https://staging.portal.company.com
  only:
    - develop

deploy_production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context production
    - kubectl set image deployment/portal-app portal=$DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA -n portal-system
    - kubectl rollout status deployment/portal-app -n portal-system --timeout=600s
  environment:
    name: production
    url: https://portal.company.com
  when: manual
  only:
    - main
```

### ArgoCD Application
```yaml
# argocd/applications/portal-production.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: portal-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/company/portal-k8s-manifests
    targetRevision: main
    path: production
  destination:
    server: https://kubernetes.default.svc
    namespace: portal-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
    - PruneLast=true
  revisionHistoryLimit: 10
```

## Backup and Disaster Recovery

### Backup Strategy
```yaml
# k8s/backup/velero-backup.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: portal-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  template:
    includedNamespaces:
    - portal-system
    - portal-tenants
    excludedResources:
    - pods
    - replicasets
    storageLocation: aws-backup
    volumeSnapshotLocations:
    - aws-volumes
    ttl: 720h0m0s  # 30 days
```

### Disaster Recovery Plan
```yaml
# dr/restore-procedure.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dr-procedures
data:
  restore.sh: |
    #!/bin/bash
    
    # 1. Restore from Velero backup
    velero restore create --from-backup portal-backup-$(date +%Y%m%d)
    
    # 2. Verify database connectivity
    kubectl exec -n portal-system postgresql-cluster-1 -- pg_isready
    
    # 3. Run database migrations if needed
    kubectl exec -n portal-system deployment/portal-app -- npm run db:migrate
    
    # 4. Verify application health
    kubectl wait --for=condition=ready pod -l app=portal-app -n portal-system --timeout=300s
    
    # 5. Run smoke tests
    kubectl exec -n portal-system deployment/portal-app -- npm run test:smoke
```

## Multi-Region Deployment

### Regional Configuration
```yaml
# k8s/regions/us-east-1.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: region-config
  namespace: portal-system
data:
  region: "us-east-1"
  database_replica: "read-replica-us-east-1"
  redis_cluster: "redis-us-east-1"
  storage_bucket: "portal-assets-us-east-1"
---
# k8s/regions/eu-west-1.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: region-config
  namespace: portal-system
data:
  region: "eu-west-1"
  database_replica: "read-replica-eu-west-1"
  redis_cluster: "redis-eu-west-1"
  storage_bucket: "portal-assets-eu-west-1"
```

### Cross-Region Replication
```yaml
# k8s/replication/database-replication.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgresql-replica-eu
  namespace: portal-system
spec:
  instances: 2
  bootstrap:
    pg_basebackup:
      source: postgresql-cluster-us
  externalClusters:
  - name: postgresql-cluster-us
    connectionParameters:
      host: postgresql-cluster-us.portal-system.svc.cluster.local
      user: postgres
      dbname: portal
    password:
      name: postgresql-us-credentials
      key: password
```

## Cost Optimization

### Resource Optimization
```yaml
# k8s/optimization/vertical-pod-autoscaler.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: portal-vpa
  namespace: portal-system
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: portal-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: portal
      maxAllowed:
        cpu: 2000m
        memory: 4Gi
      minAllowed:
        cpu: 100m
        memory: 256Mi
```

### Cluster Autoscaling
```yaml
# k8s/autoscaling/cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.25.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/portal-cluster
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
```

This comprehensive deployment and infrastructure plan provides:
- Scalable Kubernetes architecture
- Multi-region redundancy
- Enterprise-grade security
- Automated CI/CD pipelines
- Comprehensive monitoring
- Disaster recovery capabilities
- Cost optimization strategies
- Production-ready configuration