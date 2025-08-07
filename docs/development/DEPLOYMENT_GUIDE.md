# Backstage IDP Wrapper - Deployment Guide

This guide provides comprehensive instructions for deploying the Backstage IDP Wrapper platform to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Building for Production](#building-for-production)
5. [Deployment Options](#deployment-options)
6. [Performance Optimizations](#performance-optimizations)
7. [Monitoring & Observability](#monitoring--observability)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+ (for production database)
- Docker & Docker Compose (optional, for containerized deployment)
- Kubernetes cluster (optional, for K8s deployment)
- Cloud provider account (AWS/Azure/GCP) if deploying to cloud

## Environment Configuration

1. **Copy the example environment file:**
 ```bash
 cp .env.example .env.production
 ```

2. **Configure required environment variables:**

 ### Core Configuration
 ```env
 # Database
 DATABASE_URL="postgresql://user:password@host:5432/backstage_idp?schema=public"
 USE_MOCK_DB="false"
 USE_MOCK_DATA="false"

 # Backstage API
 BACKSTAGE_API_URL="https://your-backstage-instance.com"
 BACKSTAGE_AUTH_TOKEN="your-backstage-api-token"

 # WebSocket
 NEXT_PUBLIC_WS_URL="wss://your-websocket-server.com"

 # Authentication
 NEXTAUTH_URL="https://your-app-domain.com"
 NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
 ```

 ### External Services (Optional)
 ```env
 # Version Control
 GITHUB_TOKEN=""
 GITLAB_TOKEN=""

 # Monitoring
 PROMETHEUS_URL=""
 GRAFANA_URL=""
 DATADOG_API_KEY=""
 SENTRY_DSN=""

 # CI/CD
 JENKINS_URL=""
 ARGOCD_URL=""

 # Cloud Providers
 AWS_ACCESS_KEY_ID=""
 AWS_SECRET_ACCESS_KEY=""
 AZURE_CLIENT_ID=""
 AZURE_CLIENT_SECRET=""
 AZURE_TENANT_ID=""
 GCP_PROJECT_ID=""
 GCP_SERVICE_ACCOUNT_KEY=""
 ```

## Database Setup

1. **Create the production database:**
 ```bash
 createdb backstage_idp -U postgres
 ```

2. **Run database migrations:**
 ```bash
 npm run db:migrate
 ```

3. **Seed initial data (optional):**
 ```bash
 npm run db:seed
 ```

## Building for Production

1. **Install dependencies:**
 ```bash
 npm ci --production
 ```

2. **Build the application:**
 ```bash
 # Increase memory for large builds
 export NODE_OPTIONS="--max-old-space-size=4096"
 npm run build
 ```

3. **Verify the build:**
 ```bash
 npm run start
 ```

## Deployment Options

### Option 1: Traditional Server Deployment

1. **Using PM2:**
 ```bash
 npm install -g pm2
 pm2 start ecosystem.config.js --env production
 ```

 Example `ecosystem.config.js`:
 ```javascript
 module.exports = {
 apps: [{
 name: 'backstage-idp',
 script: 'node_modules/.bin/next',
 args: 'start',
 env_production: {
 NODE_ENV: 'production',
 PORT: 3000
 },
 instances: 'max',
 exec_mode: 'cluster',
 autorestart: true,
 max_memory_restart: '1G'
 }]
 };
 ```

### Option 2: Docker Deployment

1. **Build the Docker image:**
 ```bash
 docker build -t backstage-idp-wrapper:latest .
 ```

2. **Run with Docker Compose:**
 ```bash
 docker-compose -f docker-compose.yml up -d
 ```

### Option 3: Kubernetes Deployment

1. **Apply Kubernetes manifests:**
 ```bash
 kubectl apply -f kubernetes/production.yaml
 ```

2. **Verify deployment:**
 ```bash
 kubectl get pods -n idp-production
 kubectl get svc -n idp-production
 ```

### Option 4: Cloud Platform Deployment

#### AWS (ECS/Fargate)
```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker tag backstage-idp-wrapper:latest $ECR_REGISTRY/backstage-idp:latest
docker push $ECR_REGISTRY/backstage-idp:latest

# Deploy with ECS
aws ecs update-service --cluster production --service backstage-idp --force-new-deployment
```

#### Azure (Container Instances)
```bash
# Push to ACR
az acr build --registry $ACR_NAME --image backstage-idp:latest .

# Deploy to ACI
az container create \
 --resource-group production \
 --name backstage-idp \
 --image $ACR_NAME.azurecr.io/backstage-idp:latest \
 --cpu 2 --memory 4 \
 --environment-variables-file .env.production
```

#### Google Cloud (Cloud Run)
```bash
# Build and deploy
gcloud run deploy backstage-idp \
 --image gcr.io/$PROJECT_ID/backstage-idp:latest \
 --platform managed \
 --region us-central1 \
 --allow-unauthenticated
```

## Performance Optimizations

### 1. Caching Configuration

The application implements multiple caching layers:

- **CDN/Edge Caching:** Static assets are cached at the edge
- **API Response Caching:** Backstage API responses are cached for 5 minutes
- **Database Query Caching:** Frequently accessed data is cached in Redis

### 2. Database Optimizations

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_services_owner ON services(owner);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_costs_service_date ON costs(service_id, date);

-- Enable query performance insights
ALTER DATABASE backstage_idp SET log_statement = 'all';
ALTER DATABASE backstage_idp SET log_duration = on;
```

### 3. Next.js Optimizations

The following optimizations are already configured:

- Image optimization with next/image
- Automatic code splitting
- Route prefetching
- Static generation where possible
- API route caching
- Bundle size optimization

### 4. Resource Limits

Set appropriate resource limits based on your load:

```yaml
# Kubernetes example
resources:
 requests:
 memory: "512Mi"
 cpu: "500m"
 limits:
 memory: "2Gi"
 cpu: "2000m"
```

## Monitoring & Observability

### 1. Health Checks

The application exposes health check endpoints:

- `/api/health` - Basic health check
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe

### 2. Metrics Collection

Configure Prometheus scraping:

```yaml
annotations:
 prometheus.io/scrape: "true"
 prometheus.io/port: "9090"
 prometheus.io/path: "/metrics"
```

### 3. Logging

Structured logging is implemented with correlation IDs:

```javascript
// Log format example
{
 "timestamp": "2024-01-30T10:00:00Z",
 "level": "info",
 "message": "API request completed",
 "correlationId": "abc-123",
 "userId": "user-456",
 "duration": 150,
 "status": 200
}
```

### 4. APM Integration

For Datadog APM:
```bash
DD_AGENT_HOST=localhost DD_TRACE_ENABLED=true npm start
```

For New Relic:
```bash
NEW_RELIC_APP_NAME="Backstage IDP" NEW_RELIC_LICENSE_KEY=$KEY npm start
```

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use secrets management services (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate secrets regularly

### 2. Network Security

- Use HTTPS everywhere (enforce with HSTS)
- Implement rate limiting on API endpoints
- Use Web Application Firewall (WAF) rules
- Enable CORS only for trusted domains

### 3. Authentication & Authorization

- Implement proper JWT validation
- Use secure session management
- Enable MFA for admin users
- Regular security audits

### 4. Dependency Security

```bash
# Regular security audits
npm audit
npm audit fix

# Keep dependencies updated
npm update
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
 - Verify DATABASE_URL is correct
 - Check network connectivity
 - Ensure database user has proper permissions

2. **Build Failures (Out of Memory)**
 ```bash
 # Increase Node.js memory
 export NODE_OPTIONS="--max-old-space-size=8192"
 npm run build
 ```

3. **WebSocket Connection Issues**
 - Verify WebSocket URL includes proper protocol (ws:// or wss://)
 - Check firewall rules for WebSocket ports
 - Ensure reverse proxy supports WebSocket upgrade

4. **API Authentication Failures**
 - Verify BACKSTAGE_AUTH_TOKEN is valid
 - Check token expiration
 - Ensure proper CORS configuration

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```

### Performance Profiling

1. **Enable Next.js build analysis:**
 ```bash
 ANALYZE=true npm run build
 ```

2. **Monitor bundle sizes:**
 ```bash
 npm run build
 # Check .next/build-manifest.json for page sizes
 ```

## Maintenance

### Regular Tasks

1. **Database maintenance:**
 ```bash
 # Weekly vacuum
 psql -d backstage_idp -c "VACUUM ANALYZE;"
 
 # Monthly reindex
 psql -d backstage_idp -c "REINDEX DATABASE backstage_idp;"
 ```

2. **Log rotation:**
 ```bash
 # Configure logrotate
 /var/log/backstage-idp/*.log {
 daily
 rotate 14
 compress
 delaycompress
 notifempty
 create 0640 app app
 }
 ```

3. **Backup strategy:**
 ```bash
 # Daily database backup
 pg_dump backstage_idp | gzip > backup-$(date +%Y%m%d).sql.gz
 
 # Upload to S3
 aws s3 cp backup-*.sql.gz s3://backups/backstage-idp/
 ```

## Support

For issues and support:
- Check the [troubleshooting guide](#troubleshooting)
- Review application logs
- Contact the development team
- Open an issue in the repository

## Conclusion

This deployment guide covers the essential steps for getting the Backstage IDP Wrapper into production. Always test thoroughly in a staging environment before deploying to production.