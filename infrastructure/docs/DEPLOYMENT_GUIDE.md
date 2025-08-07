# Developer Portal - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Authentication & SSO](#authentication--sso)
5. [Monitoring & Observability](#monitoring--observability)
6. [Disaster Recovery](#disaster-recovery)
7. [Performance Optimization](#performance-optimization)
8. [Security Hardening](#security-hardening)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
```bash
# Install required CLI tools
brew install kubectl helm terraform aws-cli jq yq
brew install --cask lens  # Kubernetes IDE

# Verify installations
kubectl version --client
helm version
terraform version
aws --version
```

### AWS Account Setup
1. Configure AWS credentials:
```bash
aws configure --profile developer-portal
export AWS_PROFILE=developer-portal
```

2. Create S3 bucket for Terraform state:
```bash
aws s3api create-bucket \
  --bucket developer-portal-terraform-state \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2

aws s3api put-bucket-versioning \
  --bucket developer-portal-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket developer-portal-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

3. Create DynamoDB table for state locking:
```bash
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

## Infrastructure Setup

### 1. Initialize Terraform
```bash
cd infrastructure/terraform
terraform init
```

### 2. Create Terraform Variables
Create `terraform.tfvars`:
```hcl
environment = "production"
aws_region = "us-west-2"
owner_email = "platform-team@example.com"
cost_center = "engineering"
domain_name = "portal.example.com"
alert_email = "alerts@example.com"

# Node groups configuration
node_groups = {
  general = {
    desired_size   = 5
    min_size       = 3
    max_size       = 10
    instance_types = ["m5.xlarge"]
    disk_size      = 100
    capacity_type  = "ON_DEMAND"
    labels = {
      role = "general"
    }
    taints = []
  }
  spot = {
    desired_size   = 3
    min_size       = 1
    max_size       = 8
    instance_types = ["m5.xlarge", "m5a.xlarge", "m5n.xlarge"]
    disk_size      = 100
    capacity_type  = "SPOT"
    labels = {
      role = "spot"
    }
    taints = [{
      key    = "spot"
      value  = "true"
      effect = "NoSchedule"
    }]
  }
}

# RDS Configuration
rds_instance_class = "db.r6g.2xlarge"
rds_allocated_storage = 200
rds_max_allocated_storage = 2000
rds_multi_az = true
rds_backup_retention_period = 30

# Redis Configuration
redis_node_type = "cache.r6g.xlarge"
redis_num_cache_nodes = 3
redis_automatic_failover_enabled = true

# Security
enable_waf = true
enable_monitoring = true
enable_backup = true
```

### 3. Deploy Infrastructure
```bash
# Plan deployment
terraform plan -out=tfplan

# Review plan
terraform show tfplan

# Apply infrastructure
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

## Kubernetes Deployment

### 1. Install Prerequisites
```bash
# Install cert-manager for TLS certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install nginx-ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.metrics.enabled=true

# Install Istio service mesh (optional)
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH
istioctl install --set profile=production -y
kubectl label namespace developer-portal istio-injection=enabled
```

### 2. Create Namespaces and Secrets
```bash
# Apply namespaces
kubectl apply -f infrastructure/kubernetes/base/namespace.yaml

# Create secrets (update values first!)
kubectl create secret generic portal-secrets \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=REDIS_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  -n developer-portal

# Create GitHub integration secrets
kubectl create secret generic github-credentials \
  --from-literal=GITHUB_APP_ID="your-app-id" \
  --from-literal=GITHUB_CLIENT_ID="your-client-id" \
  --from-literal=GITHUB_CLIENT_SECRET="your-client-secret" \
  --from-file=GITHUB_PRIVATE_KEY=path/to/private-key.pem \
  -n developer-portal
```

### 3. Deploy Database and Cache
```bash
# Deploy PostgreSQL
kubectl apply -f infrastructure/kubernetes/base/postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n developer-portal --timeout=300s

# Deploy Redis
kubectl apply -f infrastructure/kubernetes/base/redis.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis -n developer-portal --timeout=300s
```

### 4. Build and Push Docker Images
```bash
# Build frontend image
docker build -t portal-frontend:latest \
  --build-arg NEXT_PUBLIC_APP_URL=https://portal.example.com \
  --build-arg NEXT_PUBLIC_BACKSTAGE_API_URL=https://api.portal.example.com \
  -f Dockerfile .

# Build backend image
docker build -t backstage-backend:latest \
  -f Dockerfile.backend \
  backstage/

# Tag and push to registry
docker tag portal-frontend:latest $REGISTRY/portal-frontend:latest
docker tag backstage-backend:latest $REGISTRY/backstage-backend:latest

docker push $REGISTRY/portal-frontend:latest
docker push $REGISTRY/backstage-backend:latest
```

### 5. Deploy Applications
```bash
# Apply ConfigMaps
kubectl apply -f infrastructure/kubernetes/base/configmap.yaml

# Deploy applications
kubectl apply -f infrastructure/kubernetes/base/portal-deployment.yaml

# Apply services
kubectl apply -f infrastructure/kubernetes/base/services.yaml

# Apply ingress rules
kubectl apply -f infrastructure/kubernetes/base/ingress.yaml

# Apply HPA for autoscaling
kubectl apply -f infrastructure/kubernetes/base/hpa.yaml

# Apply network policies
kubectl apply -f infrastructure/kubernetes/base/networkpolicy.yaml
```

### 6. Configure TLS Certificates
```bash
# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform-team@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Authentication & SSO

### 1. Configure GitHub OAuth
1. Create GitHub OAuth App:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - New OAuth App
   - Homepage URL: `https://portal.example.com`
   - Authorization callback URL: `https://portal.example.com/api/auth/callback/github`

2. Update secrets:
```bash
kubectl patch secret github-credentials -n developer-portal \
  --patch='{"data":{"GITHUB_CLIENT_ID":"'$(echo -n "your-client-id" | base64)'"}}'
```

### 2. Configure Google OAuth
1. Create Google OAuth credentials:
   - Go to Google Cloud Console
   - APIs & Services > Credentials
   - Create Credentials > OAuth client ID
   - Authorized redirect URIs: `https://portal.example.com/api/auth/callback/google`

2. Update secrets:
```bash
kubectl patch secret oauth-credentials -n developer-portal \
  --patch='{"data":{"GOOGLE_CLIENT_ID":"'$(echo -n "your-client-id" | base64)'"}}'
```

### 3. Configure SAML SSO
```bash
# Apply auth configuration
kubectl apply -f infrastructure/security/auth-config.yaml

# Update SAML configuration with your IdP details
kubectl edit configmap auth-config -n developer-portal
```

## Monitoring & Observability

### 1. Deploy Prometheus Stack
```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values infrastructure/monitoring/prometheus-values.yaml

# Apply custom rules
kubectl apply -f infrastructure/monitoring/prometheus-stack.yaml
```

### 2. Deploy Grafana Dashboards
```bash
# Import dashboards
kubectl create configmap portal-dashboards \
  --from-file=infrastructure/monitoring/dashboards/ \
  -n monitoring

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Default credentials: admin/prom-operator
```

### 3. Setup Logging with ELK
```bash
# Deploy Elasticsearch
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace \
  --set replicas=3 \
  --set minimumMasterNodes=2

# Deploy Kibana
helm install kibana elastic/kibana \
  --namespace logging \
  --set elasticsearchHosts="http://elasticsearch-master:9200"

# Deploy Fluentd
kubectl apply -f infrastructure/monitoring/fluentd-config.yaml
```

### 4. Setup Distributed Tracing
```bash
# Deploy Jaeger
kubectl create namespace tracing
kubectl apply -n tracing -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/crds/jaegertracing.io_jaegers_crd.yaml
kubectl apply -n tracing -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/service_account.yaml
kubectl apply -n tracing -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/role.yaml
kubectl apply -n tracing -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/role_binding.yaml
kubectl apply -n tracing -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/operator.yaml
```

## Disaster Recovery

### 1. Configure Automated Backups
```bash
# Apply backup CronJobs
kubectl apply -f infrastructure/backup/backup-strategy.yaml

# Verify backup jobs
kubectl get cronjobs -n developer-portal
```

### 2. Test Restore Procedure
```bash
# Create test namespace
kubectl create namespace dr-test

# Restore database from backup
./scripts/restore-database.sh \
  --backup-file s3://developer-portal-backups/postgres/daily/postgres-backup-20240101-020000.sql.gz \
  --target-namespace dr-test

# Verify restoration
kubectl exec -it postgres-0 -n dr-test -- psql -U portal_user -d developer_portal -c "SELECT COUNT(*) FROM entities;"
```

### 3. Configure Cross-Region Replication
```bash
# Setup S3 cross-region replication
aws s3api put-bucket-replication \
  --bucket developer-portal-backups \
  --replication-configuration file://infrastructure/backup/replication-config.json
```

## Performance Optimization

### 1. Enable CDN
```bash
# Deploy CloudFront distribution
aws cloudformation deploy \
  --template-file infrastructure/cdn/cloudfront-template.yaml \
  --stack-name developer-portal-cdn \
  --parameter-overrides DomainName=portal.example.com

# Update application to use CDN URLs
kubectl set env deployment/portal-frontend \
  CDN_URL=https://cdn.portal.example.com \
  -n developer-portal
```

### 2. Configure Caching
```bash
# Apply Redis configuration for session caching
kubectl apply -f infrastructure/kubernetes/base/redis.yaml

# Enable query caching in PostgreSQL
kubectl exec -it postgres-0 -n developer-portal -- \
  psql -U portal_user -d developer_portal \
  -c "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';"
```

### 3. Optimize Database
```bash
# Run performance tuning script
kubectl exec -it postgres-0 -n developer-portal -- \
  psql -U portal_user -d developer_portal -f /etc/postgresql/performance-tuning.sql

# Create indexes
kubectl exec -it postgres-0 -n developer-portal -- psql -U portal_user -d developer_portal <<EOF
CREATE INDEX CONCURRENTLY idx_entities_kind ON entities(kind);
CREATE INDEX CONCURRENTLY idx_entities_namespace ON entities(namespace);
CREATE INDEX CONCURRENTLY idx_entities_metadata ON entities USING GIN(metadata);
ANALYZE;
EOF
```

## Security Hardening

### 1. Enable Pod Security Policies
```bash
kubectl apply -f infrastructure/security/pod-security-policy.yaml
kubectl apply -f infrastructure/security/network-policies.yaml
```

### 2. Configure RBAC
```bash
# Create service accounts
kubectl create serviceaccount portal-admin -n developer-portal
kubectl create serviceaccount portal-developer -n developer-portal
kubectl create serviceaccount portal-viewer -n developer-portal

# Apply RBAC rules
kubectl apply -f infrastructure/security/rbac.yaml
```

### 3. Enable Audit Logging
```bash
# Configure API server audit logging
cat <<EOF > audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: RequestResponse
    namespaces: ["developer-portal"]
    verbs: ["create", "update", "patch", "delete"]
  - level: Metadata
    namespaces: ["developer-portal"]
EOF

# Apply to cluster (requires API server restart)
kubectl apply -f audit-policy.yaml
```

### 4. Implement Secrets Management
```bash
# Install Sealed Secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace
```

## Troubleshooting

### Common Issues

#### 1. Pods not starting
```bash
# Check pod status
kubectl get pods -n developer-portal
kubectl describe pod <pod-name> -n developer-portal
kubectl logs <pod-name> -n developer-portal

# Check events
kubectl get events -n developer-portal --sort-by='.lastTimestamp'
```

#### 2. Database connection issues
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -n developer-portal -- \
  psql -h postgres-service -U portal_user -d developer_portal -c "SELECT 1"

# Check connection pool
kubectl exec -it postgres-0 -n developer-portal -- \
  psql -U portal_user -d developer_portal -c "SELECT * FROM pg_stat_activity;"
```

#### 3. High memory usage
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n developer-portal

# Get memory metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/developer-portal/pods
```

#### 4. Slow performance
```bash
# Check slow queries
kubectl exec -it postgres-0 -n developer-portal -- \
  psql -U portal_user -d developer_portal -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis performance
kubectl exec -it redis-0 -n developer-portal -- redis-cli --latency
```

### Health Checks

Run comprehensive health checks:
```bash
# Application health
curl -k https://portal.example.com/api/health
curl -k https://api.portal.example.com/healthcheck

# Database health
kubectl exec -it postgres-0 -n developer-portal -- pg_isready

# Redis health
kubectl exec -it redis-0 -n developer-portal -- redis-cli ping

# Certificate expiry
kubectl get certificates -A
kubectl describe certificate portal-tls -n developer-portal
```

### Rollback Procedures

If deployment fails:
```bash
# Rollback deployment
kubectl rollout undo deployment/portal-frontend -n developer-portal
kubectl rollout undo deployment/backstage-backend -n developer-portal

# Check rollback status
kubectl rollout status deployment/portal-frontend -n developer-portal
kubectl rollout status deployment/backstage-backend -n developer-portal

# Restore database from backup if needed
./scripts/restore-database.sh --latest
```

## Maintenance Windows

### Monthly Maintenance Tasks
1. Update dependencies and security patches
2. Review and rotate secrets
3. Analyze and optimize database
4. Review monitoring alerts and thresholds
5. Test disaster recovery procedures
6. Update documentation

### Quarterly Tasks
1. Load testing and performance benchmarking
2. Security audit and penetration testing
3. Review and update scaling policies
4. Capacity planning review
5. Cost optimization review

## Support and Escalation

### Support Tiers
- **L1 Support**: On-call engineers (PagerDuty)
- **L2 Support**: Platform team
- **L3 Support**: Architecture team
- **Vendor Support**: AWS, GitHub, Auth providers

### Escalation Matrix
| Severity | Response Time | Escalation Path |
|----------|--------------|-----------------|
| Critical | 15 minutes | L1 → L2 → L3 → CTO |
| High | 1 hour | L1 → L2 → L3 |
| Medium | 4 hours | L1 → L2 |
| Low | 24 hours | L1 |

### Contact Information
- **On-Call**: +1-xxx-xxx-xxxx
- **Slack**: #platform-support
- **Email**: platform-team@example.com
- **PagerDuty**: developer-portal-oncall